import ZodValidator from "../validations/zod-validator.js";
import PrescriptionValidation from "../validations/prescription-validation.js";
import PrescriptionRepository from "../repositories/prescription-repository.js";
import AlkesRepository from "../repositories/alkes-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import RiwayatValidation from "../validations/riwayat-validation.js";
import ReturRepository from "../repositories/retur-repository.js";
import { setRangeDate } from "../helpers/date-helper.js";

export default class RiwayatService {
  static async getAll(req) {
    ZodValidator.validate(RiwayatValidation.GET_ALL, req);

    let result;
    req.pagination = true;
    req.subQuery = false;

    setRangeDate(req);

    if (req.item_type === "obat") {
      if (req.status_type === "resep") {
        req.status = [5, 5];
      } else if (req.status_type === "retur") {
        req.status = [6, 6];
      } else if (req.status_type === "batal") {
        req.status = [0, 0];
      }

      ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
      result = await PrescriptionRepository.getAllPrescription(req);
    } else if (req.item_type === "alkes") {
      if (req.status_type === "resep") {
        req.status = [4, 4];
      } else if (req.status_type === "retur") {
        req.status = [5, 5];
      } else if (req.status_type === "batal") {
        req.status = [0, 0];
      }

      ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
      result = await AlkesRepository.getAllForFarmacy(req);
    }

    if (!result) {
      throw new BadRequestException("Data not found");
    }

    // map data
    result.data = result.data.map((data) => {
      return {
        uuid: data.uuid,
        code: data.no_order_alkes ?? data.no_resep,
        date: data.order_date ?? data.created_at,
        name: data.patient?.name,
        no_reg: data.no_reg,
        no_rm: data.no_rm,
        jenis_pelayanan: data.jenis_pelayanan,
        lokasi_stok: data.lokasi_stok?.name,
        racikan: data.obat && data.obat.some((obat) => obat.is_compound),
        kronis: data.obat && data.obat.some((obat) => obat.is_chronic),
        payment_method: data.payment_method === 1 ? "Tunai" : "Non Tunai",
      };
    });

    return result;
  }

  static async getDetail(req) {
    ZodValidator.validate(RiwayatValidation.GET_DETAIL, req);

    let result;

    if (req.item_type === "obat") {
      result = await PrescriptionRepository.getByUuid(req.uuid);

      if (req.status_type === "retur") {
        const retur = await ReturRepository.getObatOne({
          no_resep: result.no_resep,
        });

        result.dataValues.obat = undefined;
        result.dataValues.retur = retur;
      }
    } else if (req.item_type === "alkes") {
      result = await AlkesRepository.getByUuid(req.uuid);

      if (req.status_type === "retur") {
        const retur = await ReturRepository.getAlkesOne({
          no_order_alkes: result.no_order_alkes,
        });

        result.dataValues.alkes_items = undefined;
        result.dataValues.retur = retur;
      }
    }

    result.dataValues.order_date = result.order_date ?? result.created_at;
    result.dataValues.payment_method =
      result.payment_method == 1 ? "Tunai" : "Non Tunai";
    result.dataValues.history = this.mapStatusHistory(result, req.item_type);
    result.dataValues.item_type = req.item_type;
    result.dataValues.status_type = req.status_type;
    if (req.status_type === "retur" && result.dataValues.retur) {
      result.dataValues.alasan_retur = result.dataValues.retur.alasan_retur;
      result.dataValues.retur = this.mapItemRetur(result);
      result.dataValues.grand_total = result.dataValues.retur.reduce(
        (acc, item) => acc + item.detail[0]?.total_harga,
        0
      );
    } else {
      result.dataValues.items = this.mapItems(result, req.item_type);
      result.dataValues.grand_total = result.dataValues.items.reduce(
        (acc, item) => acc + item.detail[0]?.total_harga,
        0
      );
    }

    result.dataValues.obat = undefined;
    result.dataValues.alkes_items = undefined;

    return result;
  }

  static mapStatusHistory(result, itemType) {
    const data = [];

    if (result.order_date ?? result.created_at) {
      data.push({
        status: `Order ${itemType}`,
        date: result.order_date ?? result.created_at,
        petugas: result.dokter_order ?? result.petugas_order,
      });
    }

    if (result.waktu_verifikasi) {
      data.push({
        status: `Verifikasi ${itemType}`,
        date: result.waktu_verifikasi,
        petugas: result.petugas_verifikasi,
      });
    }

    if (result.waktu_penyiapan) {
      data.push({
        status: "Disiapkan Oleh",
        date: result.waktu_penyiapan,
        petugas: result.petugas_penyiapan_obat,
      });
    }

    if (result.waktu_pemberian) {
      data.push({
        status: "Diberikan Oleh",
        date: result.waktu_pemberian,
        petugas: result.petugas_pemberi,
      });
    }

    if (result.waktu_retur) {
      data.push({
        status: "Diretur Oleh",
        date: result.waktu_retur,
        petugas: result.petugas_retur,
      });
    }

    if (result.petugas_pembatalan) {
      data.push({
        status: "Dibatalkan Oleh",
        date: result.updated_at,
        petugas: result.petugas_pembatalan,
      });
    }

    return data;
  }

  static mapItems(result, itemType) {
    let data = [];

    if (itemType === "obat") {
      data = result.obat.map((obat) => {
        return {
          name: obat.item_medis?.name,
          qty: `${obat.medication_qty} ${obat.item_medis?.satuan_penggunaan?.name}`,
          is_chronic: obat.is_chronic ?? undefined,
          is_compound: obat.is_compound ?? undefined,
          detail: [
            {
              jenis_stok: obat.jenis_stok?.name,
              aturan_pakai: `${obat.aturan_pakai?.frekuensi} x ${obat.aturan_pakai?.periode} (${obat.aturan_pakai?.periode_unit}) ${obat.cara_pakai?.cara_pakai}`,
              harga_satuan: obat.harga_satuan,
              jasa_resep: obat.biaya_racik + obat.biaya_embalase,
              total_harga:
                obat.biaya_racik +
                obat.biaya_embalase +
                obat.harga_satuan * obat.medication_qty,
            },
          ],
        };
      });
    }

    if (itemType === "alkes") {
      data = result.alkes_items.map((obat) => {
        return {
          name: obat.item_medis?.name,
          qty: `${obat.medication_qty} ${obat.name?.item_medis?.satuan_penggunaan?.name}`,
          detail: [
            {
              jenis_stok: obat.jenis_stok?.name,
              harga_satuan: obat.harga_satuan,
              total_harga: obat.harga_satuan * obat.medication_qty,
            },
          ],
        };
      });
    }

    return data;
  }

  static mapItemRetur(result) {
    const data = [];

    result.dataValues.retur.items.forEach((item) => {
      data.push({
        name:
          item.detail_prescription_item?.item_medis?.name ??
          item.detail_order_alkes_item?.item_medis?.name,
        detail: [
          {
            retur_qty: item.qty_retur,
            expired_date: item.expired_date,
            harga_satuan: item.harga_satuan,
            jenis_stok:
              item.detail_prescription_item?.jenis_stok?.name ??
              item.detail_order_alkes_item?.jenis_stok?.name,
            total_harga: item.harga_satuan * item.qty_retur,
            used_qty: item.detail_prescription_item?.sisa_qty_order,
          },
        ],
      });
    });

    return data;
  }
}
