import PrescriptionValidation from "../validations/prescription-validation.js";
import ZodValidator from "../validations/zod-validator.js";
import BadRequestException from "../errors/bad-request-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import DataMasterLokasiStokRepository from "../repositories/datamaster-lokasi-stok-repository.js";
import InternalServerException from "../errors/internal-server-exception.js";
import Utils from "../helpers/utils.js";
import { setRangeDate, toEpochDate } from "../helpers/date-helper.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import DataMasterItemMedisRepository from "../repositories/datamaster-item-medis-repository.js";
import AlkesValidation from "../validations/alkes-validation.js";
import AlkesRepository from "../repositories/alkes-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import KonfigurasiHargaService from "./konfigurasi-harga-service.js";

export default class AlkesService {
  static async getByUuid(req) {
    const alkes = await AlkesRepository.getByUuid(req.uuid);
    if (alkes === null) {
      throw new NotfoundException("data tidak ditemukan");
    }

    alkes.dataValues.payment_method =
      alkes.payment_method === 1 ? "Tunai" : "Asuransi";
    alkes.dataValues.user_uuid = req.user_uuid;

    alkes.dataValues.alkes_items = alkes.alkes_items.map((item) => {
      item.dataValues.list_alkes = [
        {
          stok_alkes: item.jenis_stok?.name,
          harga_satuan: item.harga_satuan,
          total: item.harga_satuan * item.qty,
        },
      ];

      return item;
    });
    return alkes;
  }

  static async orderAlkes(req) {
    console.log("req", req)
    req.order_status = 1;
    const transaction = await sequelizeInstance.transaction();
    req.no_order_alkes = Utils.generate4Code("ORD");

    // validate input
    ZodValidator.validate(AlkesValidation.ORDER_ALKES, req);

    req.harga_total = 0;

    let lokasi;

    if (!req.lokasi_stok_uuid) {
      const lokasiStocks = await DataMasterLokasiStokRepository.getAll({
        faskes_uuid: req.faskes_uuid,
        jenis_lokasi: "depo",
        limit: 100,
      });

      // if (!lokasiStocks) {
      //   throw new InternalServerException("lokasi stok belum di set");
      // }

      // lokasi = lokasiStocks.data.find((item) =>
      //   item.default_tujuan_order_permintaan.includes(
      //     Utils.pelayananToJenisStockCode(req.jenis_pelayanan)
      //   )
      // );
      // console.log("lokasi", lokasi)

      // if (!lokasi) {
      //   throw new InternalServerException(
      //     `Lokasi stok default belum di set untuk pelayanan ${req.jenis_pelayanan}`
      //   );
      // }
      req.lokasi_stok_uuid = req.lokasi_uuid;
    } else {
      lokasi = await DataMasterLokasiStokRepository.getByUuid(
        req.lokasi_stok_uuid
      );

      if (!lokasi) {
        throw new InternalServerException(
          `Lokasi stok dengan UUID ${req.lokasi_stok_uuid} tidak ditemukan`
        );
      }
    }

    try {
      // create alkes
      const order_alkes = await AlkesRepository.createAlkes(req, transaction);
      const order_alkes_uuid = order_alkes.dataValues.uuid;
      order_alkes.dataValues.alkes_items = [];

      let totalHargaOrder = 0;

      // create alkes item
      for (const item of req.alkes) {
        item.order_alkes_uuid = order_alkes_uuid;
        item.faskes_uuid = req.faskes_uuid;
        item.stok_medis_uuides = null;
        const itemConfig = await AlkesRepository.getItemConfigForOrder(
          item.item_medis_uuid,
          req.lokasi_uuid
        );
        console.log("item", item);

        if (itemConfig) {
          item.jenis_stok_uuid = itemConfig.jenis_stok_uuid;

          if (itemConfig.detail_harga && itemConfig.detail_harga.length > 0) {
            item.harga_satuan = itemConfig.detail_harga[0].harga_dasar || 0;
          } else {
            item.harga_satuan = 0;
          }
        } else {
          item.jenis_stok_uuid = null;
          item.harga_satuan = 0;
        }

        totalHargaOrder += item.qty * item.harga_satuan;

        ZodValidator.validate(AlkesValidation.CREATE_ALKES_ITEM, item);

        const alkes_item = await AlkesRepository.createAlkesItem(
          item,
          transaction
        );
        order_alkes.dataValues.alkes_items.push(alkes_item);
      }

      await AlkesRepository.updateAlkes(
        order_alkes_uuid,
        { harga_total: totalHargaOrder },
        transaction
      );
      order_alkes.dataValues.harga_total = totalHargaOrder;

      await transaction.commit();

      return order_alkes;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async addAlkesItems(req) {
    const transaction = await sequelizeInstance.transaction();

    if (req.alkes_items === null || req.alkes_items === undefined) {
      throw new BadRequestException("'alkes_items' tidak boleh kosong");
    }

    try {
      for (const item of req.alkes_items) {
        item.order_alkes_uuid = req.order_alkes_uuid;
        item.faskes_uuid = req.faskes_uuid;
        item.harga_satuan = 0;

        ZodValidator.validate(AlkesValidation.CREATE_ALKES_ITEM, item);

        await AlkesRepository.createAlkesItem(item, transaction);
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async deleteAlkes(req) {
    ZodValidator.validate(AlkesValidation.DELETE_ALKES_ITEM, req);
    const result = await AlkesRepository.deleteAlkesItem(req.alkes_item_uuid);

    if (result === 0) {
      throw new BadRequestException("data tidak ditemukan");
    }
    return result;
  }

  static async updateAlkes(req) {
    ZodValidator.validate(AlkesValidation.UPDATE_ALKES, req);
    return await AlkesRepository.editAlkes(req);
  }

  static async updateAlkesItem(req) {
    ZodValidator.validate(AlkesValidation.UPDATE_ALKES_ITEM, req);

    return await AlkesRepository.editAlkesItem(req);
  }

  static async getOrderBySomeUuid(req) {
    ZodValidator.validate(AlkesValidation.GET_SOME_ORDER, req);
    const rawData = await AlkesRepository.getOrderBySomeUuid(req);
    let data = [];

    for (const resep of rawData) {
      resep.dataValues.jumlah_item = resep.dataValues.alkes_items.length;

      resep.dataValues.lokasi_stok = resep.dataValues.lokasi_stok.name;

      resep.dataValues.alkes_items = undefined;

      data.push(resep.dataValues);
    }

    // Belum ada order alkes untuk rekam medis ini bukan error: kembalikan daftar kosong
    // (sebelumnya 400 sehingga tab Alkes di rekam medis selalu menampilkan kegagalan).
    return data;
  }

  static async batalOrder(req) {
    ZodValidator.validate(AlkesValidation.BATAL_ORDER, req);
    req.order_status = 0;
    return await AlkesRepository.editAlkes(req);
  }

  static async updateVerifikasi(data, author, token) {
    const validatedData = ZodValidator.validate(
      AlkesValidation.UPDATE_VERIFIKASI,
      data
    );

    const transaction = await sequelizeInstance.transaction();

    try {
      const konfigurasiHarga = await KonfigurasiHargaService.get({
        faskes_uuid: author.faskesUuid,
      });
      const alkes = await AlkesRepository.getByUuid(validatedData.uuid);
      if (!alkes) {
        throw new NotfoundException("Data order alkes tidak ditemukan.");
      }

      const itemStockMap = new Map(
        validatedData.items?.map((i) => [i.item_uuid, i.jenis_stok_uuid]) || []
      );

      if (itemStockMap.size === 0) {
        throw new BadRequestException(
          "Data 'items' (item_uuid dan jenis_stok_uuid) wajib diisi."
        );
      }

      const harga_total = await this.setPriceInOrderAlkes(
        alkes,
        konfigurasiHarga,
        itemStockMap,
        transaction
      );


      for (const alkesIitem of alkes.alkes_items) {
        if (!alkesIitem.jenis_stok_uuid) {
          throw new InternalServerException(
            `Jenis stok untuk item ${alkesIitem.uuid} gagal disimpan.`
          );
        }

        const mutasiData = {
          faskes_uuid: author.faskesUuid,
          petugas: author.username,
          kode_referensi: alkes.no_order_alkes,
          keterangan_prefix: `Verifikasi Order Alkes: ${alkesIitem.no_order_alkes}`,
          item_uuid: alkesIitem.item_medis_uuid,
          jenis_stok_uuid: alkesIitem.jenis_stok_uuid,
        };

        const usedStock = await StockMedisRepository.reduceQuantity(
          {
            item_medis_uuid: alkesIitem.item_medis_uuid,
            jenis_stok_uuid: alkesIitem.jenis_stok_uuid,
            quantity: alkesIitem.qty,
            lokasi_stok_uuid: alkes.lokasi_stok_uuid,
            metode_pemotongan_stok: konfigurasiHarga.metode_pemotongan_stok,
            name: alkesIitem?.item_medis?.name ?? "",
          },
          mutasiData,
          transaction
        );
        await AlkesRepository.editAlkesItem(
          {
            uuid: alkesIitem.uuid,
            stok_medis_uuides: usedStock,
          },
          transaction
        );

        // Update object di memory agar return response update
        alkesIitem.dataValues.stok_medis_uuides = usedStock;
      }

      const dataToUpdate = {
        order_status: 2,
        waktu_verifikasi: toEpochDate(new Date()),
        petugas_verifikasi: author.username,
        harga_total: harga_total,
      };
      await AlkesRepository.editAlkes(
        dataToUpdate,
        validatedData.uuid,
        transaction
      );

      Object.assign(alkes.dataValues, dataToUpdate);

      await transaction.commit();
      return alkes;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async updateSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_SIAP_DISERAHKAN, req);
    req.order_status = 3;
    req.waktu_penyiapan = toEpochDate(new Date());
    return await AlkesRepository.editAlkes(req);
  }

  static async batalSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.BATAL_DISERAHKAN, req);
    req.order_status = 2;
    return await AlkesRepository.editAlkes(req);
  }

  static async updateDiserahkan(req) {
    ZodValidator.validate(AlkesValidation.UPDATE_SERAHKAN, req);
    console.log(req);
    req.order_status = 4;
    req.waktu_pemberian = toEpochDate(new Date());
    return await AlkesRepository.editAlkes(req);
  }

  static async updateLokasiStok(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_LOKASI_STOK, req);

    const transaction = await sequelizeInstance.transaction();

    try {
      await AlkesRepository.editAlkes(req, transaction);

      await AlkesRepository.removeJenisStok(
        {
          uuid: req.uuid,
        },
        transaction
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async getAllForFarmacy(req) {
    setRangeDate(req);
    ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
    const rawData = await AlkesRepository.getAllForFarmacy(req);

    let order_masuk = [];
    let sedang_disiapkan = [];
    let penyerahan_alkes = [];

    for (const resep of rawData) {
      resep.dataValues.payment_method =
        resep.payment_method === 1 ? "Tunai" : "Asuransi";
      if (resep.order_status === 1) {
        order_masuk.push(resep);
      } else if (resep.order_status === 2) {
        sedang_disiapkan.push(resep);
      } else if (resep.order_status === 3) {
        penyerahan_alkes.push(resep);
      }

      resep.dataValues.patient = resep.patient?.name;
      resep.dataValues.lokasi = resep.lokasi?.name;
    }

    return {
      order_masuk,
      sedang_disiapkan,
      penyerahan_alkes,
    };
  }

  static async updateJenisItem(req) {
    ZodValidator.validate(AlkesValidation.UPDATE_JENIS_ITEM, req);

    return await AlkesRepository.editAlkesItem(req);
  }

  static async setPriceInOrderAlkes(
    alkes,
    konfigurasiHarga,
    itemStockMap,
    transaction
  ) {
    let totalHarga = 0;
    for (const item of alkes.alkes_items) {
      const jenis_stok_alkes = itemStockMap.get(item.item_medis_uuid);
      if (!jenis_stok_alkes) {
        throw new BadRequestException(
          `Jenis stok untuk item ${
            item.item_medis?.name || item.uuid
          } tidak disediakan.`
        );
      }

      const hargaItem = await DataMasterItemMedisRepository.getPrice({
        item_medis_uuid: item.item_medis_uuid,
        jenis_stok_uuid: jenis_stok_alkes,
      });

      if (
        hargaItem === null ||
        !hargaItem.detail_harga ||
        hargaItem.detail_harga.length === 0
      ) {
        throw new BadRequestException(
          `Harga item medis ${
            item.item_medis?.name ?? ""
          } tidak ditemukan (item: ${
            item.item_medis_uuid
          }, stok: ${jenis_stok_alkes})`
        );
      }

      const hargaSatuan =
        konfigurasiHarga.metode_hpp === "avg"
          ? hargaItem.detail_harga[0].dataValues.harga_avg
          : hargaItem.detail_harga[0].dataValues.harga_terakhir;

      totalHarga += hargaSatuan * item.qty;

      await AlkesRepository.editAlkesItem(
        {
          uuid: item.uuid,
          harga_satuan: hargaSatuan,
          jenis_stok_uuid: jenis_stok_alkes,
        },
        transaction
      );
      item.dataValues.jenis_stok_uuid = jenis_stok_alkes;
      item.dataValues.harga_satuan = hargaSatuan;
      item.jenis_stok_uuid = jenis_stok_alkes;
    }
    return totalHarga;
  }
}
