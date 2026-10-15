import ZodValidator from "../validations/zod-validator.js";
import PenjualanObatValidation from "../validations/penjualan-obat-validation.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import PenjualanObatRepository from "../repositories/penjualan-obat-repository.js";
import Utils from "../helpers/utils.js";
import { setRangeDate, toEpochDate } from "../helpers/date-helper.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import KonfigurasiHargaRepository from "../repositories/konfigurasi-harga-repository.js";
import DataMasterItemMedisRepository from "../repositories/datamaster-item-medis-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import InternalServerException from "../errors/internal-server-exception.js";
import { uuidv7 } from "uuidv7";
import NotfoundException from "../errors/notfound-exception.js";

export default class PenjualanObatService {
  static async create(data, author, token) {
    ZodValidator.validate(PenjualanObatValidation.CREATE_OTC, data);

    const faskesUuid = author.faskesUuid;
    let transaction;

    try {
      // Transaksi dibuka tepat sebelum penulisan (di bawah). Sebelumnya transaksi juga dibuka di sini lalu
      // ditimpa tanpa commit/rollback sehingga satu koneksi pool bocor setiap penjualan.
      const stockUuids = data.items.map((item) => item.stock_uuid);
      if (stockUuids.length === 0) {
        throw new BadRequestException("Item obat tidak ditemukan di stok.");
      }

      const stockDetails = await StockMedisRepository.findStocksWithDetails(
        stockUuids
      );

      const stockMap = new Map(
        stockDetails.map((stock) => [stock.uuid, stock])
      );
      const penjualanUuid = uuidv7();
      const konfigurasiHarga = await KonfigurasiHargaRepository.get(faskesUuid);

      let totalHargaCalculated = 0;
      const processedItems = [];

      for (const item of data.items) {
        ZodValidator.validate(PenjualanObatValidation.CREATE_OTC_ITEM, item);

        const stockDetail = stockMap.get(item.stock_uuid);
        if (
          !stockDetail ||
          !stockDetail.item_medis_jenis_stok ||
          !stockDetail.item_medis_jenis_stok.item_medis
        ) {
          throw new NotfoundException(
            `Stok dengan UUID ${item.stock_uuid} tidak ditemukan atau tidak memiliki item medis terkait.`
          );
        }

        if (stockDetail.sisa_stok < item.qty) {
          throw new BadRequestException(
            `Stok untuk ${stockDetail.item_medis_jenis_stok.item_medis.name} (Batch UUID: ${item.stock_uuid}) tidak mencukupi. Sisa: ${stockDetail.sisa_stok}, diminta: ${item.qty}`
          );
        }

        const itemMedisJenisStokUuid = stockDetail.item_medis_jenis_stok_uuid;
        const itemMedisUuid = stockDetail.item_medis_jenis_stok.item_medis_uuid;
        const itemMedisData = stockDetail.item_medis_jenis_stok.item_medis;

        const hargaInfo =
          await DataMasterItemMedisRepository.findLatestPricesForItemJenisStok(
            itemMedisJenisStokUuid,
            konfigurasiHarga.metode_hpp === "avg"
          );
        if (
          !hargaInfo ||
          hargaInfo.dataValues.harga === null ||
          hargaInfo.dataValues.harga === undefined
        ) {
          throw new BadRequestException(
            `Harga (avg/terakhir) untuk item medis ${itemMedisData.name} (UUID: ${itemMedisUuid}) tidak ditemukan di database.`
          );
        }
        const hargaSatuan = hargaInfo.dataValues.harga;

        totalHargaCalculated += (hargaSatuan - (item.diskon || 0)) * item.qty;

        processedItems.push({
          stock_uuid: item.stock_uuid,
          item_medis_uuid: itemMedisUuid,
          item_medis_name: itemMedisData.name,
          jenis_stok_uuid: stockDetail.item_medis_jenis_stok.jenis_stok_uuid,
          qty: item.qty,
          diskon: item.diskon || 0,
          uuid: uuidv7(),
          penjualan_obat_uuid: penjualanUuid,
          faskes_uuid: faskesUuid,
          harga_satuan: hargaSatuan,
          satuan_uuid: itemMedisData.satuan_penggunaan_uuid,
          satuan_name: itemMedisData.satuan_penggunaan?.name || null,
          exp_date: stockDetail.exp_date,
          subtotal: (hargaSatuan - (item.diskon || 0)) * item.qty,
        });
      }

      const initialData = {
        ...data,
        uuid: penjualanUuid,
        total_item: processedItems.length,
        tanggal_pembelian: toEpochDate(new Date()),
        total_harga: totalHargaCalculated,
        status: "belum_lunas",
        faskes_uuid: faskesUuid,
        items: undefined,
      };

      transaction = await sequelizeInstance.transaction();

      const penjualan = await PenjualanObatRepository.createOtc(
        initialData,
        transaction
      );

      for (const itemData of processedItems) {
        const mutasiData = {
          faskes_uuid: faskesUuid,
          petugas: author.username,
          kode_referensi: initialData.no_transaksi,
          keterangan_prefix: `Penjualan OTC: ${initialData.no_transaksi}`,
        };

        const catatanStok = await StockMedisRepository.reduceQuantity(
          {
            item_medis_uuid: itemData.item_medis_uuid,
            jenis_stok_uuid: itemData.jenis_stok_uuid,
            quantity: itemData.qty,
            metode_pemotongan_stok: konfigurasiHarga.metode_pemotongan_stok,
            name: itemData.name,
            lokasi_stok_uuid: penjualan.lokasi_stok_uuid,
          },
          mutasiData,
          transaction
        );

        itemData.catatan_stok = catatanStok;

        const { item_medis_name, satuan_name, subtotal, ...dbPayload } =
          itemData;

        await PenjualanObatRepository.createOtcItem(itemData, transaction);
      }

      await PenjualanObatRepository.updateOtc(
        { total_harga: totalHargaCalculated },
        penjualanUuid,
        transaction,
        faskesUuid
      );

      await transaction.commit();

      return {
        ...initialData,
        total_harga: totalHargaCalculated,
        items: processedItems.map((item) => ({
          uuid: item.uuid,
          item_medis_uuid: item.item_medis_uuid,
          item_medis_name: item.item_medis_name,
          qty: item.qty,
          satuan_uuid: item.satuan_uuid,
          satuan_name: item.satuan_name,
          harga_satuan: item.harga_satuan,
          diskon: item.diskon,
          subtotal: item.subtotal,
          exp_date: item.exp_date,
        })),
      };
    } catch (error) {
      if (transaction) await transaction.rollback();

      throw error;
    }
  }

  static async batalOtc(data, author, token) {
    ZodValidator.validate(PenjualanObatValidation.BATAL_OTC, data);

    const { uuid, alasan_batal } = data;
    const faskesUuid = author.faskesUuid;
    const petugas = author.username;
    let transaction;
    let penjualanDibatalkan;

    try {
      transaction = await sequelizeInstance.transaction();

      const penjualan = await PenjualanObatRepository.getOtcByUuid(
        { uuid, faskes_uuid: faskesUuid },
        transaction
      );

      if (!penjualan) {
        throw new NotfoundException(
          `Penjualan obat dengan UUID ${uuid} tidak ditemukan.`
        );
      }
      if (penjualan.status !== "belum_lunas") {
        throw new BadRequestException(
          `Penjualan obat tidak dapat dibatalkan karena statusnya sudah '${penjualan.status}'.`
        );
      }

      penjualanDibatalkan = penjualan;

      const addStockPromises = [];

      for (const item of penjualan.items) {
        if (item.catatan_stok && Array.isArray(item.catatan_stok)) {
          for (const catatan of item.catatan_stok) {
            if (catatan.stock_medis_uuid && catatan.quantity) {
              const mutasiData = {
                faskes_uuid: faskesUuid,
                petugas: petugas,
                kode_referensi: `${penjualan.no_transaksi}-CANCEL`,
                keterangan_prefix: `Pembatalan Penjualan OTC: ${penjualan.no_transaksi}`,
                item_uuid: item.item_medis.uuid,
                jenis_stok_uuid: item.jenis_stok.uuid,
                lokasi_stok_uuid: penjualan.lokasi_stok.uuid,
              };
              addStockPromises.push(
                StockMedisRepository.addQuantity(
                  catatan,
                  mutasiData,
                  transaction
                )
              );
            }
          }
        }
      }
      await Promise.all(addStockPromises);

      const dataUpdate = {
        status: "cancel",
        alasan_batal: alasan_batal,
      };
      const updatedRows = await PenjualanObatRepository.updateOtc(
        dataUpdate,
        uuid,
        transaction,
        faskesUuid
      );
      if (updatedRows === 0) {
        throw new InternalServerException(
          "Gagal memperbarui status penjualan menjadi cancel."
        );
      }

      await transaction.commit();

      return penjualanDibatalkan;
    } catch (error) {
      if (transaction) await transaction.rollback();
      throw error;
    }
  }

  static async getAll(req) {
    setRangeDate(req);

    ZodValidator.validate(PenjualanObatValidation.GET_ALL, req);

    return await PenjualanObatRepository.getAllOtc(req);
  }

  static async getAllWithoutPagination(req) {
    setRangeDate(req);
    ZodValidator.validate(
      PenjualanObatValidation.GET_ALL_WITHOUT_PAGINATION,
      req
    );
    return await PenjualanObatRepository.getAllOtcWithoutPagination(req);
  }

  static async getByUuid(req) {
    return await PenjualanObatRepository.getOtcByUuid(req);
  }

  static async generateCode(req) {
    let isAvailable = false;

    while (!isAvailable) {
      req.no_transaksi = Utils.generate4Code("OTC");
      const result = await PenjualanObatRepository.getByCode(req);

      if (result === null) {
        isAvailable = true;
      }
    }

    return {
      code: req.no_transaksi,
    };
  }
}
