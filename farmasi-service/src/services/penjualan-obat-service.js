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
  // token: Authorization pemanggil, disiapkan untuk integrasi tagihan Kasir (payment-service) yang belum ada;
  // saat ini pembayaran OTC dicatat langsung di apotek lewat bayarOtc.
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

      // Lokasi penjualan wajib milik faskes pengguna (faskes dari JWT), begitu pula batch stok yang dipilih.
      const lokasiStok = await PenjualanObatRepository.getLokasiStok(
        data.lokasi_stok_uuid,
        faskesUuid
      );
      if (!lokasiStok) {
        throw new NotfoundException("Lokasi farmasi tidak ditemukan.");
      }

      const kodeTerpakai = await PenjualanObatRepository.getByCode({
        no_transaksi: data.no_transaksi,
        faskes_uuid: faskesUuid,
      });
      if (kodeTerpakai) {
        throw new BadRequestException(
          `No. transaksi ${data.no_transaksi} sudah dipakai, muat ulang halaman untuk kode baru.`
        );
      }

      const penjualanUuid = uuidv7();
      const konfigurasiHarga = await KonfigurasiHargaRepository.get(faskesUuid);
      // Harga jual = HPP x (1 + margin% Konfigurasi Harga), sama dengan tagihan resep (prescription-service).
      // Sebelumnya OTC dijual seharga HPP tanpa margin, dan metode "average" terbaca sebagai harga terakhir.
      const isAvg = ["avg", "average"].includes(konfigurasiHarga?.metode_hpp);
      const margin = Number(konfigurasiHarga?.margin || 0);

      let totalHargaCalculated = 0;
      const processedItems = [];

      for (const item of data.items) {
        ZodValidator.validate(PenjualanObatValidation.CREATE_OTC_ITEM, item);

        const stockDetail = stockMap.get(item.stock_uuid);
        if (
          !stockDetail ||
          stockDetail.faskes_uuid !== faskesUuid ||
          !stockDetail.item_medis_jenis_stok ||
          !stockDetail.item_medis_jenis_stok.item_medis
        ) {
          throw new NotfoundException(
            `Stok dengan UUID ${item.stock_uuid} tidak ditemukan atau tidak memiliki item medis terkait.`
          );
        }

        const itemMedisUuid = stockDetail.item_medis_jenis_stok.item_medis_uuid;
        const itemMedisData = stockDetail.item_medis_jenis_stok.item_medis;

        // Jenis stok mengikuti pilihan pengguna (Umum/BPJS/...); batch stock_uuid hanya penunjuk item.
        // Sebelumnya jenis stok pilihan diabaikan sehingga harga & stok yang dipotong bisa berbeda dari layar.
        const jenisStokUuid =
          item.jenis_stok_uuid || stockDetail.item_medis_jenis_stok.jenis_stok_uuid;
        const itemJenisStok =
          jenisStokUuid === stockDetail.item_medis_jenis_stok.jenis_stok_uuid
            ? stockDetail.item_medis_jenis_stok
            : await PenjualanObatRepository.getItemJenisStok(
                itemMedisUuid,
                jenisStokUuid
              );
        if (!itemJenisStok) {
          throw new BadRequestException(
            `Jenis stok yang dipilih tidak tersedia untuk ${itemMedisData.name}.`
          );
        }

        const hargaInfo =
          await DataMasterItemMedisRepository.findLatestPricesForItemJenisStok(
            itemJenisStok.uuid,
            isAvg
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
        const hargaSatuan = Math.round(
          Number(hargaInfo.dataValues.harga) * (1 + margin / 100)
        );

        // Diskon = potongan nominal per baris (sesuai kolom "Diskon Rp." di layar), bukan per satuan.
        const diskon = Number(item.diskon || 0);
        const jumlah = hargaSatuan * item.qty;
        if (diskon > jumlah) {
          throw new BadRequestException(
            `Diskon ${itemMedisData.name} melebihi jumlah harga (${jumlah}).`
          );
        }
        const subtotal = jumlah - diskon;
        totalHargaCalculated += subtotal;

        processedItems.push({
          stock_uuid: item.stock_uuid,
          item_medis_uuid: itemMedisUuid,
          item_medis_name: itemMedisData.name,
          jenis_stok_uuid: jenisStokUuid,
          qty: item.qty,
          diskon: diskon,
          uuid: uuidv7(),
          penjualan_obat_uuid: penjualanUuid,
          faskes_uuid: faskesUuid,
          harga_satuan: hargaSatuan,
          satuan_uuid: itemMedisData.satuan_penggunaan_uuid,
          satuan_name: itemMedisData.satuan_penggunaan?.name || null,
          exp_date: stockDetail.exp_date,
          subtotal: subtotal,
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
        lokasi_stok_uuid: lokasiStok.uuid,
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
            name: itemData.item_medis_name,
            lokasi_stok_uuid: penjualan.lokasi_stok_uuid,
          },
          mutasiData,
          transaction
        );

        itemData.catatan_stok = catatanStok;

        const { item_medis_name, satuan_name, subtotal, ...dbPayload } =
          itemData;

        await PenjualanObatRepository.createOtcItem(dbPayload, transaction);
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

  // Pembayaran di apotek: hanya penjualan berstatus belum_lunas milik faskes pengguna yang dapat dilunasi.
  static async bayarOtc(data, author) {
    ZodValidator.validate(PenjualanObatValidation.BAYAR_OTC, data);
    const faskesUuid = author.faskesUuid;
    const transaction = await sequelizeInstance.transaction();

    try {
      const penjualan = await PenjualanObatRepository.getOtcByUuid(
        { uuid: data.uuid, faskes_uuid: faskesUuid },
        transaction
      );
      if (!penjualan) {
        throw new NotfoundException(
          `Penjualan obat dengan UUID ${data.uuid} tidak ditemukan.`
        );
      }
      if (penjualan.status !== "belum_lunas") {
        throw new BadRequestException(
          `Penjualan obat tidak dapat dibayar karena statusnya sudah '${penjualan.status}'.`
        );
      }

      await PenjualanObatRepository.updateOtc(
        { status: "lunas" },
        data.uuid,
        transaction,
        faskesUuid
      );
      await transaction.commit();

      return { uuid: data.uuid, no_transaksi: penjualan.no_transaksi, status: "lunas" };
    } catch (error) {
      await transaction.rollback();
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
    const result = await PenjualanObatRepository.getOtcByUuid(req);
    if (!result) {
      throw new NotfoundException("Penjualan obat tidak ditemukan.");
    }
    return result;
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
