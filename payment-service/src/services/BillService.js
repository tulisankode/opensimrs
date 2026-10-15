import db from '../configs/knex-config.js';
import { uuidv7 } from 'uuidv7';
import { MERGE_TYPES } from '../constants/app-constants.js';
import moment from 'moment';
import BadRequestException from '../exceptions/bad-request-exception.js';
import { generateInvoiceAndBillCode } from '../repositories/BillHelpers.js';
import SettingGateway from './external/SettingGateway.js';

export default class BillService {
  static async createBillFromService(data) {
    if (!data.patient_uuid || !data.faskes_uuid) {
      throw new BadRequestException('Data Patient UUID dan Faskes UUID wajib ada');
    }
    if (!data.services || data.services.length === 0) {
      throw new BadRequestException('Minimal harus ada 1 service/layanan');
    }

    // 1. Ambil Config PPN & Admin (Via Gateway)
    const financeConfig = await SettingGateway.getFaskesFinanceConfig();
    const PPN_PERCENTAGE = financeConfig.ppn_percent;
    const ADMIN_FEE_FIXED = financeConfig.admin_fee;

    return db.transaction(async (trx) => {
      const now = moment().unix();

      let billUuid = uuidv7();
      let isUpdateSelf = false;
      let parentBillUuid = null;
      let currentSubTotal = 0;

      // Memeriksa payload apakah ada merge keluarga
      if (data.target_patient_uuid) {
        const motherBill = await trx('bills')
          .where({
            faskes_uuid: data.faskes_uuid,
            patient_uuid: data.target_patient_uuid,
            close_bill: false,
            merge_with: null,
          })
          .first();

        if (motherBill) {
          parentBillUuid = motherBill.uuid;
        } else {
          console.warn('Target merge bill tidak ditemukan, membuat tagihan terpisah.');
        }
      }

      // Jika tidak ada merge keluarga
      if (!parentBillUuid) {
        const selfActiveBill = await trx('bills')
          .where({
            faskes_uuid: data.faskes_uuid,
            patient_uuid: data.patient_uuid,
            close_bill: false,
          })
          .first();

        if (selfActiveBill) {
          billUuid = selfActiveBill.uuid;
          isUpdateSelf = true;
          currentSubTotal = parseFloat(selfActiveBill.sub_total);
          if (selfActiveBill.merge_with) {
            parentBillUuid = selfActiveBill.merge_with;
          }
        }
      }

      // Penarikan (hapus item via replace_ref tanpa item baru) saat pasien tidak punya tagihan aktif: tidak ada yang
      // perlu ditarik — jangan membuat tagihan kosong.
      const hanyaTarik = data.services.every((sv) => (!sv.items || sv.items.length === 0) && sv.replace_ref);
      if (hanyaTarik && !isUpdateSelf) {
        return { success: true, message: 'Tidak ada tagihan aktif yang perlu ditarik', data: { bill_uuid: null, sub_total: 0, grand_total: 0 } };
      }

      // Proses Insert Header Bill
      if (!isUpdateSelf) {
        const { invoice_code, bill_code } = await generateInvoiceAndBillCode(trx, data.faskes_uuid);

        await trx('bills').insert({
          uuid: billUuid,
          faskes_uuid: data.faskes_uuid,
          patient_uuid: data.patient_uuid,
          name: data.patient_name,
          invoice_code: invoice_code,
          bill_code: bill_code,
          status: false,
          close_bill: false,
          merge_with: parentBillUuid,
          merge_type: parentBillUuid ? MERGE_TYPES.KELUARGA : null,
          sub_total: 0,
          ppn: 0,
          admin_fee: 0,
          grand_total: 0,
          created_at: now,
          updated_at: now,
        });
      }

      // Proses insert item & Calculate
      let additionalSubTotal = 0;
      let layananDihapus = false;
      for (const service of data.services) {
        let serviceBillUuid = uuidv7();
        const isInsurance = service.with_insurance === true;

        const existingService = await trx('service_bill')
          .where({
            bill_uuid: billUuid,
            layanan_uuid: service.layanan_uuid,
            type: service.type,
          })
          .first();

        // Penarikan untuk layanan yang belum pernah ditagihkan: lewati (jangan buat layanan kosong).
        if (!existingService && (!service.items || service.items.length === 0) && service.replace_ref) continue;

        if (existingService) {
          serviceBillUuid = existingService.uuid;
          await trx('service_bill').where('uuid', serviceBillUuid).update({
            updated_at: now,
            with_insurance: isInsurance,
          });
        } else {
          await trx('service_bill').insert({
            uuid: serviceBillUuid,
            faskes_uuid: data.faskes_uuid,
            bill_uuid: billUuid,
            type: service.type,
            practitioner_name: service.practitioner_name,
            service_name: service.service_name,
            service_code: service.service_code || '-',
            layanan_uuid: service.layanan_uuid,
            with_insurance: isInsurance,
            status: true,
            date: service.date ?? now, // tanggal layanan (sebelumnya kosong → tampil 01-01-1970 di kasir)
            created_at: now,
            updated_at: now,
          });
        }

        // Item yang dihitung ulang oleh sistem mengganti item lama agar pengiriman ulang tidak menagih dua kali:
        // - replace_category_codes: semua item kategori tsb (mis. biaya kamar saat discharge);
        // - replace_ref: item dengan additional_info.ref yang sama (mis. satu order lab).
        const gantiKategori = Array.isArray(service.replace_category_codes) && service.replace_category_codes.length > 0;
        if (existingService && (gantiKategori || service.replace_ref)) {
          let itemLama = await trx('bill_item')
            .where('service_bill_uuid', serviceBillUuid)
            .whereNull('deleted_at')
            .modify((q) => { if (gantiKategori) q.whereIn('category_code', service.replace_category_codes.map(String)); });
          if (service.replace_ref) {
            itemLama = itemLama.filter((item) => {
              try {
                return JSON.parse(item.additional_field ?? 'null')?.ref === service.replace_ref;
              } catch {
                return false;
              }
            });
          }
          for (const item of itemLama) {
            additionalSubTotal -= (parseInt(item.qty) || 0) * (parseFloat(item.price) || 0) + (parseFloat(item.service_fee) || 0);
          }
          if (itemLama.length > 0) {
            await trx('bill_item').whereIn('uuid', itemLama.map((i) => i.uuid)).del();
          }
        }

        if (service.items && service.items.length > 0) {
          const billItemsPayload = service.items.map((item) => {
            const qty = parseInt(item.qty) || 0;
            const price = parseFloat(item.price) || 0;
            const serviceFee = parseFloat(item.service_fee) || 0;
            additionalSubTotal += qty * price + serviceFee;

            return {
              uuid: uuidv7(),
              faskes_uuid: data.faskes_uuid,
              service_bill_uuid: serviceBillUuid,
              item_name: item.item_name,
              qty: qty,
              price: price,
              price_item: price,
              service_fee: serviceFee,
              category_code: item.category_code,
              additional_field: item.additional_info ? JSON.stringify(item.additional_info) : null,
              status: true,
              created_at: now,
              date_used: now,
            };
          });
          await trx('bill_item').insert(billItemsPayload);
        } else if (existingService && service.replace_ref) {
          // Penarikan tagihan (order dibatalkan): layanan yang tidak lagi berisi item dihapus agar tidak muncul
          // sebagai tagihan kosong di kasir.
          const sisa = await trx('bill_item').where('service_bill_uuid', serviceBillUuid).whereNull('deleted_at').count({ n: '*' }).first();
          if (Number(sisa?.n ?? 0) === 0) {
            await trx('service_bill').where('uuid', serviceBillUuid).del();
            layananDihapus = true;
          }
        }
      }

      // Final Calculation & Update
      const newSubTotal = currentSubTotal + additionalSubTotal;

      // Rumus PPN: Subtotal * (10 / 100)
      const newPpnAmount = Math.round(newSubTotal * (PPN_PERCENTAGE / 100));

      // Grand Total = Subtotal + PPN + Admin Fee (500 perak)
      const newGrandTotal = newSubTotal + newPpnAmount + ADMIN_FEE_FIXED;

      // Tagihan yang menjadi kosong (tanpa layanan, tanpa pembayaran, bukan induk gabungan) setelah penarikan dihapus.
      if (layananDihapus && isUpdateSelf) {
        const [layanan, bayar, anak] = await Promise.all([
          trx('service_bill').where('bill_uuid', billUuid).count({ n: '*' }).first(),
          trx('payment_history').where('bill_uuid', billUuid).count({ n: '*' }).first(),
          trx('bills').where('merge_with', billUuid).count({ n: '*' }).first(),
        ]);
        if (Number(layanan?.n) === 0 && Number(bayar?.n) === 0 && Number(anak?.n) === 0 && !parentBillUuid) {
          await trx('bills').where('uuid', billUuid).del();
          return { success: true, message: 'Tagihan kosong dihapus', data: { bill_uuid: billUuid, sub_total: 0, grand_total: 0, dihapus: true } };
        }
      }

      // Update Header Tagihan dengan angka terbaru
      await trx('bills').where('uuid', billUuid).update({
        sub_total: newSubTotal,
        ppn: newPpnAmount,
        admin_fee: ADMIN_FEE_FIXED,
        grand_total: newGrandTotal,
        updated_at: now,
      });

      if (parentBillUuid) {
        const parentBill = await trx('bills').where('uuid', parentBillUuid).first();
        if (parentBill) {
          const parentSub = parseFloat(parentBill.sub_total) + additionalSubTotal;
          const parentPpn = Math.round(parentSub * (PPN_PERCENTAGE / 100));
          const parentGrand = parentSub + parentPpn + ADMIN_FEE_FIXED;
          await trx('bills').where('uuid', parentBillUuid).update({
            sub_total: parentSub,
            ppn: parentPpn,
            grand_total: parentGrand,
            updated_at: now,
          });
        }
      }

      return {
        success: true,
        message: parentBillUuid ? 'Tagihan berhasil dibuat & digabung ke Ibu' : 'Tagihan berhasil dibuat',
        data: {
          bill_uuid: billUuid,
          sub_total: newSubTotal,
          grand_total: newGrandTotal,
        },
      };
    });
  }
}
