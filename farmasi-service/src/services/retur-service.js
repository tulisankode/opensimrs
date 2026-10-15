import sequelizeInstance from "@opensimrs/model-sdk/instance";
import ZodValidator from "../validations/zod-validator.js";
import ReturValidation from "../validations/retur-validation.js";
import ReturRepository from "../repositories/retur-repository.js";
import PrescriptionRepository from "../repositories/prescription-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import OrderAlkesRepository from "../repositories/alkes-repository.js";
import { uuidv7 } from "uuidv7";
import PrescriptionValidation from "../validations/prescription-validation.js";
import AlkesRepository from "../repositories/alkes-repository.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import moment from "moment";
import { setRangeDate } from "../helpers/date-helper.js";
import InternalServerException from "../errors/internal-server-exception.js";
import NotfoundException from "../errors/notfound-exception.js";

export default class ReturService {
  static async create(data, author, token) {
    ZodValidator.validate(ReturValidation.CREATE, data);
    const retur_uuid = uuidv7();
    const faskesUuid = author.faskesUuid;
    const petugas = author.username;
    let originalOrder;
    let lokasiStokUuid;
    let noReferensi;

    const transaction = await sequelizeInstance.transaction();

    try {
      if (data.jenis_retur === "obat") {
        originalOrder = await PrescriptionRepository.getByUuid(
          data.prescription_uuid,
          transaction
        );
        if (!originalOrder) {
          throw new NotfoundException("Data Resep tidak ditemukan.");
        }
        if (originalOrder.status < 5) {
          throw new BadRequestException(
            "Hanya resep yang sudah diserahkan yang bisa direturs."
          );
        }
        noReferensi = originalOrder.no_resep;
        lokasiStokUuid = originalOrder.lokasi_stok_uuid;
      } else if (data.jenis_retur === "alkes") {
        originalOrder = await OrderAlkesRepository.getByUuid(
          data.order_alkes_uuid,
          transaction
        );
        if (!originalOrder) {
          throw new NotFoundError("Order Alkes not found");
        }
        if (originalOrder.order_status !== 4) {
          throw new BadRequestException(
            "Order Alkes tidak bisa direturs (status salah)."
          );
        }
        noReferensi = originalOrder.no_order_alkes;
        lokasiStokUuid = originalOrder.lokasi_stok_uuid;
      }

      let totalHargaRetur = 0;

      for (const item of data.items) {
        if (item.qty_retur <= 0) continue;

        let originalItem;
        if (data.jenis_retur === "obat") {
          originalItem = await PrescriptionRepository.getPrescriptionByUuid(
            item.order_obat_item_uuid,
            transaction
          );
          if (!originalItem)
            throw new NotfoundException(
              `Item resep ${item.order_obat_item_uuid} tidak ditemukan.`
            );
        }

        let hargaSatuanAsli = 0;

        if (originalItem.is_compound) {
          const racikanItems =
            await PrescriptionRepository.getAllPrescriptionItemRacikan(
              originalItem.uuid,
              transaction
            );
          for (const racikan of racikanItems) {
            if (racikan.harga_satuan) {
              hargaSatuanAsli += racikan.harga_satuan * racikan.medication_qty;
            }
          }
          if (originalItem.medication_qty > 0) {
            hargaSatuanAsli = hargaSatuanAsli / originalItem.medication_qty;
          }
        } else {
          hargaSatuanAsli = originalItem.harga_satuan;
        }

        if (hargaSatuanAsli === null || hargaSatuanAsli === undefined) {
          throw new InternalServerException(
            `Harga satuan asli untuk item ${originalItem.uuid} tidak ditemukan/null.`
          );
        }

        totalHargaRetur += hargaSatuanAsli * item.qty_retur;

        item.faskes_uuid = faskesUuid;
        item.retur_uuid = retur_uuid;
        item.harga_satuan = hargaSatuanAsli;

        ZodValidator.validate(ReturValidation.CREATE_ITEM, item);
        await ReturRepository.createItem(item, transaction);

        for (const catatan of originalItem.stok_medis_uuides) {
          const mutasiData = {
            faskes_uuid: faskesUuid,
            petugas: petugas,
            kode_referensi: `${noReferensi}-RETUR`,
            keterangan_prefix: `Retur Pasien: ${noReferensi}`,
            item_uuid: originalItem.item_medis_uuid,
            jenis_stok_uuid: originalItem.jenis_stok_uuid,
            lokasi_stok_uuid: lokasiStokUuid,
          };
          await StockMedisRepository.addQuantity(
            {
              stock_medis_uuid: catatan.stock_medis_uuid,
              quantity: catatan.quantity,
            },
            mutasiData,
            transaction
          );
        }
      }

      data.waktu_retur = moment().unix();
      if (data.jenis_retur === "obat") {
        const dataUpdate = {
          uuid: data.prescription_uuid,
          order_status: 6,
          petugas_retur: petugas,
          waktu_retur: data.waktu_retur,
        };
        await PrescriptionRepository.editPrescription(dataUpdate, transaction);
      } else {
        await OrderAlkesRepository.updateOrderAlkes(
          {
            order_status: 5,
            petugas_retur: petugas,
            waktu_retur: data.waktu_retur,
          },
          data.order_alkes_uuid,
          transaction
        );
      }

      const returHeader = {
        uuid: retur_uuid,
        faskes_uuid: faskesUuid,
        petugas_retur: petugas,
        jenis_retur: data.jenis_retur,
        alasan_retur: data.alasan_retur,
        prescription_uuid: data.prescription_uuid || null,
        order_alkes_uuid: data.order_alkes_uuid || null,
        total: totalHargaRetur,
        waktu_retur: data.waktuRetur,
        no_resep: originalOrder.no_resep || null,
        no_order_alkes: originalOrder.no_order_alkes || null,
        no_reg: originalOrder.no_reg,
        rekam_medis_uuid: originalOrder.rekam_medis_uuid,
        patient_uuid: originalOrder.patient_uuid,
        no_rm: originalOrder.no_rm,
        order_date: originalOrder.order_date || originalOrder.waktu_verifikasi,
        lokasi_stok_uuid: lokasiStokUuid,
      };

      const retur = await ReturRepository.create(returHeader, transaction);

      await transaction.commit();
      return retur;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async getDetail(req) {
    ZodValidator.validate(ReturValidation.GET_DETAIL, req);

    let result;
    if (req.item_type === "obat") {
      result = await ReturRepository.getObatDetail(req);
    } else if (req.item_type === "alkes") {
      result = await ReturRepository.getAlkesDetail(req);
    }

    result = this.mapReturDetail(result, req.item_type);
    if (!result) {
      throw new BadRequestException("Data not found");
    }

    return result;
  }

  static async getAll(req) {
    ZodValidator.validate(ReturValidation.GET_ALL, req);

    setRangeDate(req);

    if (!req.payment_method) {
      req.payment_method = 0;
    }
    req.payment_method = parseInt(req?.payment_method ?? "0");

    let result;
    req.pagination = true;
    req.subQuery = false;

    if (req.item_type === "obat") {
      req.status = [5, 5];
      ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
      result = await PrescriptionRepository.getAllPrescription(req);
    } else if (req.item_type === "alkes") {
      req.status = [4, 4];
      ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
      result = await AlkesRepository.getAllForFarmacy(req);
    }

    if (!result) {
      throw new BadRequestException("Data not found");
    }

    return result;
  }

  static mapReturDetail(req, type) {
    const data = [];

    req.forEach((item) => {
      const detail = {
        name: item.dataValues?.item_medis?.name,
        available_qty: `${
          item.dataValues?.sisa_qty_order ?? item.dataValues.qty
        } ${item.dataValues?.item_medis?.satuan_penggunaan?.name}`,
        detail: [
          {
            uuid: item.dataValues?.uuid,
            jenis_stok: item.dataValues?.jenis_stok?.name,
            used_qty:
              type === "obat"
                ? item.dataValues?.medication_qty -
                  item.dataValues?.sisa_qty_order
                : undefined,
            price: item.dataValues?.harga_satuan,
            total: 0,
            exp_date: item.dataValues?.stok_medis_uuides?.[0]?.expired_date,
            qty_retur: 0,
          },
        ],
      };
      data.push(detail);
    });

    return data;
  }
}
