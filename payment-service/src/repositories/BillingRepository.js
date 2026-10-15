import db from '../configs/knex-config.js';
import { Context } from '../middlewares/context.js';
import { CTX_AUTHOR } from '../constants/context-constant.js';
import { ITEM_CATEGORIES } from '../constants/app-constants.js';
import NotfoundException from '../exceptions/notfound-exception.js';
import BadRequestException from '../exceptions/bad-request-exception.js';
import VoucherRepository from './VoucherRepository.js';
import * as BillHelpers from './BillHelpers.js';
import { KnexPagination } from '../helpers/pagination.js';
import moment from 'moment';
import PatientGateway from '../services/external/PatientGateway.js';

export default class BillRepository {
  // Helper Query Dasar (Updated)
  static _baseBillQuery(faskesUuid) {
    return db('bills as b')
      .select(
        'b.uuid',
        'b.name as patient_name',
        'b.invoice_code',
        'b.bill_code',
        'b.patient_uuid',
        'b.grand_total',
        'b.created_at',
        'b.updated_at',
        db.raw(`(CASE WHEN b.status = true THEN 'LUNAS' ELSE 'PIUTANG' END) as payment_status`),

        // Ambil Nomor Registrasi Dari Service Code
        db.raw(`(
            SELECT STRING_AGG(DISTINCT sb.service_code, ', ') 
            FROM service_bill sb 
            WHERE sb.bill_uuid = b.uuid AND sb.service_code != '-'
        ) as no_reg`),

        // Ambil Nama Dokter (Digabung koma jika banyak)
        db.raw(`(
            SELECT STRING_AGG(DISTINCT sb.practitioner_name, ', ') 
            FROM service_bill sb 
            WHERE sb.bill_uuid = b.uuid
        ) as doctor_name`),

        // Ambil Tipe Layanan (RJ, RI, IGD)
        db.raw(`(
            SELECT STRING_AGG(DISTINCT sb.type::text, ', ') 
            FROM service_bill sb 
            WHERE sb.bill_uuid = b.uuid
        ) as service_types`),

        // Tentukan Tunai/Asuransi
        db.raw(`(
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM service_bill sb 
                    WHERE sb.bill_uuid = b.uuid AND sb.with_insurance = true
                ) THEN 'ASURANSI' 
                ELSE 'TUNAI' 
            END
        ) as payment_type`)
      )
      .where('b.faskes_uuid', faskesUuid);
  }

  // Method public untuk mendapatkan tagihan yang ditutup (Closed Bill)
  static async getClosedBill(params) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);
    const query = this._baseBillQuery(faskesUuid).where('b.close_bill', true).orderBy('b.updated_at', 'desc');
    if (params.search) {
      query.andWhere((q) =>
        q.where('b.name', 'ilike', `%${params.search}%`).orWhere('b.invoice_code', 'ilike', `%${params.search}%`)
      );
    }
    return await KnexPagination.init(query, params);
  }

  // Method public untuk mendapatkan tagihan APS/OTC
  static async getApsOtc(params) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);
    const apsOtcTypes = ['OTC', 'LAB', 'FISIO', 'RAD', 'MCU', 'PA', 'MIKRO'];

    const query = this._baseBillQuery(faskesUuid)
      .where('b.close_bill', false)
      .whereExists(function () {
        this.select(1).from('service_bill as sb').whereRaw('sb.bill_uuid = b.uuid').whereIn('sb.type', apsOtcTypes);
      })
      .orderBy('b.created_at', 'desc');

    if (params.search) {
      query.andWhere((q) =>
        q.where('b.name', 'ilike', `%${params.search}%`).orWhere('b.invoice_code', 'ilike', `%${params.search}%`)
      );
    }

    return await KnexPagination.init(query, params);
  }

  // Method public untuk mendapatkan tagihan pelayanan (Non-OTC)
  static async getPelayanan(params) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);
    const apsOtcTypes = ['OTC', 'LAB', 'FISIO', 'RAD', 'MCU', 'PA', 'MIKRO'];

    // Memanggil Base Query
    const query = this._baseBillQuery(faskesUuid);

    // Core Logic: Non OTC/APS
    query.whereNotExists(function () {
      this.select(1).from('service_bill as sb').whereRaw('sb.bill_uuid = b.uuid').whereIn('sb.type', apsOtcTypes);
    });

    // Filter Pembayaran Lunas
    if (params.status) {
      if (params.status.toUpperCase() === 'LUNAS') {
        query.where('b.status', true);
      } else {
        query.where('b.status', false);
        query.where('b.close_bill', false);
      }
    } else {
      query.where('b.status', false);
    }

    // Filter Tipe Pelayanan
    if (params.service_type) {
      const typeMap = {
        RJ: 'RJ',
        RI: 'RI',
        IGD: 'IGD',
      };

      const inputTypes = Array.isArray(params.service_type) ? params.service_type : [params.service_type];

      const dbTypes = inputTypes.map((t) => typeMap[t.toUpperCase()]).filter(Boolean);

      if (dbTypes.length > 0) {
        query.whereExists(function () {
          this.select(1).from('service_bill as sb').whereRaw('sb.bill_uuid = b.uuid').whereIn('sb.type', dbTypes);
        });
      }
    }

    // Filter Metode Pembayaran
    if (params.payment_method) {
      const inputMethods = Array.isArray(params.payment_method) ? params.payment_method : [params.payment_method];

      const methods = inputMethods.map((m) => m.toUpperCase());

      const hasTunai = methods.includes('TUNAI');
      const hasAsuransi = methods.includes('ASURANSI');

      if (hasTunai && hasAsuransi) {
        // KASUS: Pilih Keduanya (Tampilkan Semua)
      } else if (hasAsuransi) {
        query.whereExists(function () {
          this.select(1).from('service_bill as sb').whereRaw('sb.bill_uuid = b.uuid').where('sb.with_insurance', true);
        });
      } else if (hasTunai) {
        query.whereNotExists(function () {
          this.select(1).from('service_bill as sb').whereRaw('sb.bill_uuid = b.uuid').where('sb.with_insurance', true);
        });
      }
    }

    // Search Filter
    if (params.search) {
      query.andWhere((q) =>
        q.where('b.name', 'ilike', `%${params.search}%`).orWhere('b.invoice_code', 'ilike', `%${params.search}%`)
      );
    }

    query.orderBy('b.created_at', 'desc');

    return await KnexPagination.init(query, params);
  }

  // Method public untuk mencari tagihan (Search Bar Kasir)
  static async FindBill(search) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);
    const query = this._baseBillQuery(faskesUuid).where('b.close_bill', false);

    if (search) {
      query.andWhere((q) =>
        q
          .where('b.name', 'ilike', `%${search}%`)
          .orWhere('b.invoice_code', 'ilike', `%${search}%`)
          .orWhere('b.bill_code', 'ilike', `%${search}%`)
      );
    }

    return await query;
  }

  // Method public untuk mendapatkan detail tagihan (Header & Aggregation)
  static async GetDetailBill(uuid) {
    const parentBill = await db('bills as b').where('b.uuid', uuid).select('b.*', 'b.name as patient_name').first();
    if (!parentBill) throw new NotfoundException('Tagihan tidak ditemukan');

    // Jika tagihan ini ternyata adalah "Anak" (sudah di-merge ke induk lain)
    if (parentBill.merge_with) {
      throw new BadRequestException(
        `Tagihan ini telah digabung. Silakan proses melalui tagihan induknya (UUID: ${parentBill.merge_with})`
      );
    }

    const childBills = await db('bills as b').where('b.merge_with', uuid).select('b.*');

    // Hitung Total Gabungan
    let aggregatedBill = { ...parentBill };
    aggregatedBill.sub_total = parseFloat(parentBill.sub_total) || 0;
    aggregatedBill.grand_total = parseFloat(parentBill.grand_total) || 0;
    aggregatedBill.ppn = parseFloat(parentBill.ppn) || 0;

    const allInvolvedBillUuids = [parentBill.uuid];

    childBills.forEach((child) => {
      aggregatedBill.sub_total += parseFloat(child.sub_total) || 0;
      aggregatedBill.grand_total += parseFloat(child.grand_total) || 0;
      aggregatedBill.ppn += parseFloat(child.ppn) || 0;
      allInvolvedBillUuids.push(child.uuid);
    });

    const paymentHistories = await db('payment_history as ph')
      .leftJoin('cashier_report as cr', 'ph.kasir_uuid', 'cr.uuid')
      .select('ph.amount', 'ph.receipt_number', 'cr.nama_kasir')
      .whereIn('ph.bill_uuid', allInvolvedBillUuids)
      .orderBy('ph.created_at', 'desc');

    const totalPaid = paymentHistories.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
    const remainingDebt = aggregatedBill.grand_total - totalPaid;

    const receiptNumber = paymentHistories.length > 0 ? paymentHistories[0].receipt_number : null;

    const cashierNames = [...new Set(paymentHistories.map((h) => h.nama_kasir).filter(Boolean))];

    const billOwnerMap = {};

    billOwnerMap[parentBill.uuid] = {
      name: parentBill.patient_name,
      uuid: parentBill.patient_uuid,
      is_child: false,
    };

    childBills.forEach((child) => {
      billOwnerMap[child.uuid] = {
        name: child.patient_name, // Contoh: "By. Ny. Ani"
        uuid: child.patient_uuid,
        is_child: true,
      };
    });

    const raw_service_bills = await db('service_bill as sb')
      .select('sb.*')
      .whereIn('sb.bill_uuid', allInvolvedBillUuids)
      .whereNull('sb.deleted_at');

    const service_bills = await Promise.all(
      raw_service_bills.map(async (service) => {
        const owner = billOwnerMap[service.bill_uuid];

        let locationName = service.service_name; // Default: Snapshot
        let scheduleInfo = '-';
        let visitDate = null;
        let dischargeDate = null;
        let noReg = null;

        // Panggil Gateway jika ada layanan_uuid
        if (service.layanan_uuid && service.type) {
          const detail = await PatientGateway.getServiceDetail(service.layanan_uuid, service.type);
          if (detail) {
            if (detail.location_name) locationName = detail.location_name;
            if (detail.schedule_string) scheduleInfo = detail.schedule_string;
            visitDate = detail.visit_date;
            dischargeDate = detail.discharge_date;
            noReg = detail.no_reg;
          }
        }

        return {
          ...service,
          // Data Pemilik (Merge Family)k
          patient_name: owner ? owner.name : 'Unknown',
          patient_uuid: owner ? owner.uuid : null,
          is_child_bill: owner ? owner.is_child : false,
          location_name: locationName,
          schedule_time: scheduleInfo,
          visit_date: visitDate,
          discharge_date: dischargeDate,
          // Tagihan lama tidak menyimpan service_code: ambil No. Registrasi dari kunjungan.
          service_code: service.service_code ?? noReg,
        };
      })
    );

    const serviceBillUuids = service_bills.map((sb) => sb.uuid);
    const allItems = await db('bill_item').whereIn('service_bill_uuid', serviceBillUuids).whereNull('deleted_at');

    const isInsurance = service_bills.some((sb) => sb.with_insurance === true);
    const paymentType = isInsurance ? 'ASURANSI' : 'TUNAI';

    // Hitung rincian per kategori
    let totalTindakan = 0;
    let totalObatAlkes = 0;
    let totalRuangan = 0;
    let totalPenunjang = 0;

    allItems.forEach((item) => {
      const qty = parseInt(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      const serviceFee = parseFloat(item.service_fee) || 0;

      const amount = qty * price + serviceFee;
      const cat = item.category_code;

      if (cat === '1') {
        totalTindakan += amount;
      } else if (cat === '2' || cat === '3') {
        totalObatAlkes += amount;
      } else if (cat === '4') {
        totalRuangan += amount;
      } else if (cat === '5') {
        totalPenunjang += amount;
      }
    });

    // Identitas pasien & kunjungan utama (layanan pertama tagihan induk) untuk kuitansi / rincian biaya.
    const pasien = parentBill.patient_uuid
      ? await db('patients as p')
          .leftJoin('addresses as a', 'a.uuid', 'p.address_uuid')
          .where('p.uuid', parentBill.patient_uuid)
          .select('p.no_rm', 'a.full_address')
          .first()
      : null;
    const layananUtama = service_bills.find((sb) => sb.bill_uuid === parentBill.uuid && sb.layanan_uuid) ?? service_bills[0];

    return {
      ...aggregatedBill,
      patient_name: aggregatedBill.patient_name,
      no_rm: pasien?.no_rm ?? null,
      alamat: pasien?.full_address ?? null,
      no_reg: layananUtama?.service_code ?? null,
      visit_date: layananUtama?.visit_date ?? null,
      discharge_date: layananUtama?.discharge_date ?? null,
      total_tindakan: totalTindakan,
      total_obat_alkes: totalObatAlkes,
      total_ruangan: totalRuangan,
      total_penunjang: totalPenunjang,
      total_paid: totalPaid,
      remaining_debt: remainingDebt > 0 ? remainingDebt : 0,
      is_paid: totalPaid >= aggregatedBill.grand_total,
      receipt_number: receiptNumber,
      cashier_name: cashierNames,
      payment_type: paymentType,
      service_bill: service_bills,
      is_parent: true,
      has_merged_bills: childBills.length > 0,
      merged_bills_count: childBills.length,
    };
  }

  // Method public untuk mendapatkan detail item (Rincian Biaya)
  static async GetDetailBillItem(uuid) {
    const serviceBill = await db('service_bill as sb')
      .where('sb.uuid', uuid)
      .select('with_insurance', 'type', 'service_name', 'created_at', 'layanan_uuid')
      .first();

    if (!serviceBill) throw new NotfoundException('Service Bill tidak ditemukan');

    let locationName = serviceBill.service_name;

    if (serviceBill.layanan_uuid && serviceBill.type) {
      const serviceDetail = await PatientGateway.getServiceDetail(serviceBill.layanan_uuid, serviceBill.type);

      if (serviceDetail && serviceDetail.location_name) {
        locationName = serviceDetail.location_name;
      }
    }

    const items = await db('bill_item as bi')
      .where('bi.service_bill_uuid', uuid)
      .select(
        'bi.uuid',
        'bi.item_name',
        'bi.qty',
        'bi.price',
        'bi.price_item',
        'bi.service_fee',
        'bi.category_code',
        'bi.date_used'
      );

    const paymentType = serviceBill.with_insurance ? 'ASURANSI' : 'TUNAI';

    const groupedResult = {
      tindakan: { list: [], total: 0 },
      penunjang: { list: [], total: 0 },
      obat: { list: [], total: 0 },
      alkes: { list: [], total: 0 },
      ruangan: { list: [], total: 0 },
    };
    let totalKeseluruhan = 0;

    items.forEach((item) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.qty) || 0;
      const serviceFee = parseFloat(item.service_fee) || 0;

      const itemTotal = price * qty + serviceFee;
      totalKeseluruhan += itemTotal;

      const newItem = {
        uuid: item.uuid,
        itemName: item.item_name,
        qty: qty,
        price: price,
        serviceFee: serviceFee,
        date: moment.unix(item.date_used || item.created_at).format('DD/MM/YYYY'),
        total: itemTotal,
      };

      const categoryMap = {
        [ITEM_CATEGORIES.TINDAKAN]: 'tindakan',
        [ITEM_CATEGORIES.OBAT]: 'obat',
        [ITEM_CATEGORIES.ALKES]: 'alkes',
        [ITEM_CATEGORIES.RUANGAN]: 'ruangan',
        [ITEM_CATEGORIES.PENUNJANG]: 'penunjang',
      };

      const catKey = categoryMap[item.category_code] || 'tindakan';
      if (groupedResult[catKey]) {
        groupedResult[catKey].list.push(newItem);
        groupedResult[catKey].total += itemTotal;
      }
    });

    return {
      item: groupedResult,
      total: totalKeseluruhan,
      payment_type: paymentType,
      schedule_time: moment.unix(serviceBill.created_at).format('HH:mm'),
      location_name: locationName,
    };
  }

  // Method public untuk mendapatkan detail tagihan pasien LENGKAP
  static async getDetailPasienBill(uuid) {
    const billDetail = await this.GetDetailBill(uuid);
    const serviceBillUuids = billDetail.service_bill.map((sb) => sb.uuid);
    const allItems = await db('bill_item as bi').whereIn('bi.service_bill_uuid', serviceBillUuids).select('*');

    const itemsByServiceBill = allItems.reduce((acc, item) => {
      const key = item.service_bill_uuid;
      if (!acc[key]) {
        acc[key] = {
          tindakan: { list: [], total: 0 },
          penunjang: { list: [], total: 0 },
          obat: { list: [], total: 0 },
          alkes: { list: [], total: 0 },
          ruangan: { list: [], total: 0 },
          totalKeseluruhan: 0,
        };
      }
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.qty) || 0;
      const serviceFee = parseFloat(item.service_fee) || 0;
      const itemTotal = price * qty + serviceFee;
      acc[key].totalKeseluruhan += itemTotal;
      const newItem = {
        uuid: item.uuid,
        dateUsed: item.date_used,
        itemName: item.item_name,
        qty: qty,
        price: price,
        serviceFee: serviceFee,
        additionalField: item.additional_field,
      };
      const categoryMap = { 1: 'tindakan', 2: 'obat', 3: 'alkes', 4: 'ruangan', 5: 'penunjang' };
      const category = categoryMap[item.category_code];
      if (category && acc[key][category]) {
        acc[key][category].list.push(newItem);
        acc[key][category].total += itemTotal;
      }
      return acc;
    }, {});

    billDetail.service_bill.forEach((sb) => {
      sb.items = { item: itemsByServiceBill[sb.uuid] || { totalKeseluruhan: 0 } };
    });

    let patientData = {};
    if (billDetail.patient_uuid) {
      const apiResult = await PatientGateway.getPatientDetail(billDetail.patient_uuid);
      if (apiResult) {
        patientData = apiResult;
      }
    }

    const patient = {
      patient_name: billDetail.patient_name,
      no_rm: patientData.no_rm || null,
      gender: patientData.gender || null,
      no_identity: patientData.no_identity || null,
      identity_type: patientData.identity || null,
      no_handphone: patientData.phone || null,
      agama: patientData.religion || null,
      title: patientData.title || null,
      maritial_status: patientData.maritial_status || null,
      mother_name: patientData.mother_name || null,
      tgl_lahir: patientData.birth_detail?.birth_date || null,
      age_year: patientData.birth_detail?.age_year || 0,
      age_month: patientData.birth_detail?.age_month || 0,
      age_day: patientData.birth_detail?.age_day || 0,
      birth_place: patientData.birth_detail?.birth_place || null,
      alamat: patientData.address?.full_address || null,
      kelurahan_desa: patientData.address?.village || null,
      kecamatan: patientData.address?.district || null,
      kabupaten_kota: patientData.address?.city || null,
      provinsi: patientData.address?.prov || null,
      rt: patientData.address?.rt || null,
      rw: patientData.address?.rw || null,
      kodepos: patientData.address?.postal_code || null,
      country: patientData.address?.country || null,
    };

    return { patient, bill: billDetail };
  }

  // Method public untuk mendapatkan total tagihan
  static async GetTotalBill(uuid) {
    const bill = await db('bills')
      .where('uuid', uuid)
      .select('sub_total', 'ppn', 'admin_fee', 'discount', 'grand_total', 'voucher_value')
      .first();

    if (!bill) throw new NotfoundException('Tagihan tidak ditemukan');

    return bill;
  }

  // Method public untuk apply voucher
  static async ApplyVoucher(uuid, data) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);
    const { code } = data;

    return db.transaction(async (trx) => {
      const bill = await trx('bills').where({ uuid, faskes_uuid: faskesUuid }).forUpdate().first();
      if (!bill) throw new NotfoundException('Bill tidak ditemukan');
      if (bill.voucher_code) throw new BadRequestException('Tagihan sudah memiliki voucher');

      const currentBillTotal = bill.sub_total + bill.ppn + bill.admin_fee;

      const v = await VoucherRepository.validateAndGetVoucher(code, currentBillTotal);
      const tempBillData = { ...bill, voucher_code: v.code, voucher_value: v.value, voucher_type: v.type };
      const newGrandTotal = BillHelpers.calculateBillTotals(tempBillData);

      await trx('bills').where({ uuid }).update({
        voucher_code: v.code,
        voucher_value: v.value,
        voucher_type: v.type,
        grand_total: newGrandTotal,
        updated_at: moment().unix(),
      });

      return true;
    });
  }

  static async ApplyDiscount(uuid, data) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);
    const { value } = data;

    return db.transaction(async (trx) => {
      const bill = await trx('bills').where({ uuid, faskes_uuid: faskesUuid }).forUpdate().first();
      if (!bill) throw new NotfoundException('Bill tidak ditemukan');
      if (bill.discount) throw new BadRequestException('Tagihan sudah memiliki diskon');

      const tempBillData = { ...bill, discount: value };

      const newGrandTotal = BillHelpers.calculateBillTotals(tempBillData);

      await trx('bills').where({ uuid }).update({
        discount: value,
        grand_total: newGrandTotal,
        updated_at: moment().unix(),
      });

      return true;
    });
  }

  static async CloseBill(uuid) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);

    return db.transaction(async (trx) => {
      const bill = await db('bills as b').where({ 'b.uuid': uuid, 'b.faskes_uuid': faskesUuid }).first();
      if (!bill) throw new NotfoundException('Bill tidak ditemukan');
      if (bill.close_bill) throw new BadRequestException('Tagihan sudah ditutup');
      await trx('bills').where({ uuid, faskes_uuid: faskesUuid }).update({
        close_bill: true,
        updated_at: moment().unix(),
      });
      return true;
    });
  }

  static async getBillsForPatient(patientUuid) {
    const query = db('bills as b')
      .select('b.uuid', 'b.invoice_code', 'b.grand_total', 'b.status as payment_status', 'b.created_at')
      .where('b.patient_uuid', patientUuid);
    return await query;
  }
}
