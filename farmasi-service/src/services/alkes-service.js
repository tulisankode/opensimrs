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
import TagihanFarmasiService from "./tagihan-farmasi-service.js";

// Status order alkes (Farmasi Ruangan):
// 0 = dibatalkan, 1 = order masuk, 2 = terverifikasi/sedang disiapkan (stok sudah dipotong & ditagihkan),
// 3 = siap diserahkan, 4 = diserahkan, 5 = diretur (sebagian/seluruhnya, lihat retur-service.js).
export const STATUS_ALKES = Object.freeze({ BATAL: 0, ORDER_MASUK: 1, DISIAPKAN: 2, SIAP_DISERAHKAN: 3, DISERAHKAN: 4, DIRETUR: 5 });
const NAMA_STATUS = ["Dibatalkan", "Order Masuk", "Sedang Disiapkan", "Siap Diserahkan", "Diserahkan", "Diretur"];

// HPP sesuai metode Konfigurasi Harga (nilai tersimpan "average"/"avg" atau "last").
const hppDariHarga = (harga, konfigurasiHarga) => {
  if (!harga) return 0;
  const h = harga.dataValues ?? harga;
  return ["avg", "average"].includes(konfigurasiHarga?.metode_hpp) ? Number(h.harga_avg ?? 0) : Number(h.harga_terakhir ?? 0);
};

export default class AlkesService {
  // Ambil order milik faskes token (terkunci dalam transaksi) dan pastikan statusnya termasuk yang diizinkan.
  static async ambilOrder(uuid, faskesUuid, transaction, statusBoleh, aksi) {
    const order = await AlkesRepository.getOrderFaskes(uuid, faskesUuid, transaction);
    if (!order) throw new NotfoundException("Order alkes tidak ditemukan");
    if (statusBoleh && !statusBoleh.includes(order.order_status)) {
      throw new BadRequestException(
        `Order ${order.no_order_alkes} berstatus "${NAMA_STATUS[order.order_status] ?? order.order_status}"; tidak dapat ${aksi}.`
      );
    }
    return order;
  }

  // Ubah status/isi order dalam satu transaksi setelah status awal diperiksa (mencegah lompatan status).
  static async ubahOrder(uuid, faskesUuid, statusBoleh, aksi, data) {
    const transaction = await sequelizeInstance.transaction();
    try {
      await this.ambilOrder(uuid, faskesUuid, transaction, statusBoleh, aksi);
      const diubah = await AlkesRepository.editAlkes(data, uuid, transaction, faskesUuid);
      await transaction.commit();
      return diubah;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async getByUuid(req) {
    const alkes = await AlkesRepository.getByUuid(req.uuid, req.faskes_uuid);
    if (alkes === null) {
      throw new NotfoundException("data tidak ditemukan");
    }

    // status pembayaran dihitung sebelum payment_method diganti teks
    if (alkes.order_status === STATUS_ALKES.SIAP_DISERAHKAN) {
      alkes.dataValues.status_pembayaran = (
        await TagihanFarmasiService.statusPembayaran([alkes.get({ plain: true })], "alkes", req.faskes_uuid)
      ).get(alkes.uuid);
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
    req.order_status = STATUS_ALKES.ORDER_MASUK;

    // validate input
    ZodValidator.validate(AlkesValidation.ORDER_ALKES, req);

    // Kode 4 karakter acak bisa bentrok (unik per faskes) → ulangi bila sudah dipakai.
    for (let i = 0; i < 10; i++) {
      req.no_order_alkes = Utils.generate4Code("ORD");
      if (!(await AlkesRepository.noOrderDipakai(req.no_order_alkes, req.faskes_uuid))) break;
    }

    req.harga_total = 0;

    // Order dari RME mengirim lokasi stok tujuan sebagai lokasi_uuid; Kamar Operasi/Hemodialisa mengirim
    // lokasi_stok_uuid (depo) dan lokasi_uuid (ruang pelayanan).
    if (!req.lokasi_stok_uuid) {
      req.lokasi_stok_uuid = req.lokasi_uuid;
    }
    const lokasi = await DataMasterLokasiStokRepository.getByUuid(req.lokasi_stok_uuid);
    if (!lokasi || lokasi.faskes_uuid !== req.faskes_uuid) {
      throw new BadRequestException(
        `Lokasi stok dengan UUID ${req.lokasi_stok_uuid} tidak ditemukan`
      );
    }

    const konfigurasiHarga = await KonfigurasiHargaService.get({ faskes_uuid: req.faskes_uuid });
    const transaction = await sequelizeInstance.transaction();

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
        // Perkiraan jenis stok & HPP dari stok lokasi stok tujuan. Dulu dicari di lokasi_uuid (ruang pelayanan
        // untuk order Kamar Operasi/Hemodialisa → tidak pernah ketemu, harga 0) dan memakai harga_dasar (harga
        // kemasan beli, bukan HPP per satuan) sehingga perkiraan total berlipat.
        const itemConfig = await AlkesRepository.getItemConfigForOrder(
          item.item_medis_uuid,
          req.lokasi_stok_uuid
        );

        if (itemConfig) {
          item.jenis_stok_uuid = itemConfig.jenis_stok_uuid;
          item.harga_satuan = hppDariHarga(itemConfig.detail_harga?.[0], konfigurasiHarga);
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
    if (req.alkes_items === null || req.alkes_items === undefined) {
      throw new BadRequestException("'alkes_items' tidak boleh kosong");
    }

    const transaction = await sequelizeInstance.transaction();

    try {
      // item hanya boleh ditambah selama order belum diverifikasi (stok belum dipotong)
      await this.ambilOrder(req.order_alkes_uuid, req.faskes_uuid, transaction, [STATUS_ALKES.ORDER_MASUK], "ditambah item");

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

  // Item order hanya boleh diubah/dihapus selama order milik faskes token masih berstatus Order Masuk.
  static async pastikanItemBolehDiubah(itemUuid, faskesUuid, aksi) {
    const item = await AlkesRepository.getItemOrder(itemUuid);
    if (!item || (faskesUuid && item.faskes_uuid !== faskesUuid)) throw new NotfoundException("Item order alkes tidak ditemukan");
    await this.ambilOrder(item.order_alkes_uuid, item.faskes_uuid, undefined, [STATUS_ALKES.ORDER_MASUK], aksi);
    return item;
  }

  static async deleteAlkes(req) {
    ZodValidator.validate(AlkesValidation.DELETE_ALKES_ITEM, req);
    await this.pastikanItemBolehDiubah(req.alkes_item_uuid, req.faskes_uuid, "dihapus itemnya");
    const result = await AlkesRepository.deleteAlkesItem(req.alkes_item_uuid);

    if (result === 0) {
      throw new BadRequestException("data tidak ditemukan");
    }
    return result;
  }

  // Ubah lokasi stok tujuan (PUT /alkes/:uuid) — setara pindah lokasi.
  static async updateAlkes(req) {
    ZodValidator.validate(AlkesValidation.UPDATE_ALKES, req);
    return await this.updateLokasiStok(req);
  }

  static async updateAlkesItem(req) {
    ZodValidator.validate(AlkesValidation.UPDATE_ALKES_ITEM, req);
    await this.pastikanItemBolehDiubah(req.uuid, req.faskes_uuid, "diubah itemnya");
    const { faskes_uuid, ...data } = req;
    return await AlkesRepository.editAlkesItem({ uuid: data.uuid, qty: data.qty, item_medis_uuid: data.item_medis_uuid });
  }

  static async getOrderBySomeUuid(req) {
    ZodValidator.validate(AlkesValidation.GET_SOME_ORDER, req);
    const rawData = await AlkesRepository.getOrderBySomeUuid(req);
    let data = [];

    for (const resep of rawData) {
      resep.dataValues.jumlah_item = resep.dataValues.alkes_items.length;

      // lokasi stok bisa sudah dihapus dari datamaster → jangan 500
      resep.dataValues.lokasi_stok = resep.dataValues.lokasi_stok?.name ?? null;

      resep.dataValues.alkes_items = undefined;

      data.push(resep.dataValues);
    }

    // Belum ada order alkes untuk rekam medis ini bukan error: kembalikan daftar kosong
    // (sebelumnya 400 sehingga tab Alkes di rekam medis selalu menampilkan kegagalan).
    return data;
  }

  // Batal order. Order Masuk: cukup ditandai batal. Sudah diverifikasi (sedang disiapkan/siap diserahkan): stok yang
  // sudah dipotong dikembalikan ke batch asal & tagihan alkes ditarik. Sudah diserahkan: lewat Retur Obat & Material.
  static async batalOrder(req) {
    ZodValidator.validate(AlkesValidation.BATAL_ORDER, req);
    const transaction = await sequelizeInstance.transaction();

    try {
      const order = await this.ambilOrder(
        req.uuid,
        req.faskes_uuid,
        transaction,
        [STATUS_ALKES.ORDER_MASUK, STATUS_ALKES.DISIAPKAN, STATUS_ALKES.SIAP_DISERAHKAN],
        "dibatalkan (gunakan Retur Obat & Material untuk alkes yang sudah diserahkan)"
      );

      if (order.order_status !== STATUS_ALKES.ORDER_MASUK) {
        const items = await AlkesRepository.getItemsOrder(order.uuid, transaction);
        for (const item of items) {
          for (const catatan of item.stok_medis_uuides ?? []) {
            await StockMedisRepository.addQuantity(
              { stock_medis_uuid: catatan.stock_medis_uuid, quantity: catatan.quantity },
              {
                faskes_uuid: order.faskes_uuid,
                petugas: req.petugas_pembatalan,
                kode_referensi: `${order.no_order_alkes}-BATAL`,
                keterangan_prefix: `Batal Order Alkes: ${order.no_order_alkes}`,
                item_uuid: item.item_medis_uuid,
                jenis_stok_uuid: item.jenis_stok_uuid,
                lokasi_stok_uuid: order.lokasi_stok_uuid,
              },
              transaction
            );
          }
          await AlkesRepository.editAlkesItem({ uuid: item.uuid, stok_medis_uuides: null }, transaction);
        }
        await TagihanFarmasiService.tagihOrderAlkes({ order, token: req.token, hapus: true });
      }

      await AlkesRepository.editAlkes(
        {
          order_status: STATUS_ALKES.BATAL,
          petugas_pembatalan: req.petugas_pembatalan,
          alasan_batal: req.alasan_batal,
        },
        order.uuid,
        transaction,
        req.faskes_uuid
      );

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
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
      // Hanya order masuk milik faskes token; verifikasi ulang dulu memotong stok untuk kedua kalinya.
      await this.ambilOrder(validatedData.uuid, author.faskesUuid, transaction, [STATUS_ALKES.ORDER_MASUK], "diverifikasi");
      const alkes = await AlkesRepository.getByUuid(validatedData.uuid, author.faskesUuid, transaction);
      if (!alkes) {
        throw new NotfoundException("Data order alkes tidak ditemukan.");
      }
      if (!alkes.alkes_items?.length) {
        throw new BadRequestException("Order alkes tidak memiliki item.");
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
          keterangan_prefix: `Verifikasi Order Alkes: ${alkes.no_order_alkes}`,
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
        order_status: STATUS_ALKES.DISIAPKAN,
        waktu_verifikasi: toEpochDate(new Date()),
        petugas_verifikasi: author.username,
        harga_total: harga_total,
      };
      await AlkesRepository.editAlkes(
        dataToUpdate,
        validatedData.uuid,
        transaction,
        author.faskesUuid
      );

      // Tagihan alkes (kategori Alkes) ke kunjungan asal; gagal → verifikasi dibatalkan seluruhnya (pola resep).
      // Order dari Kamar Operasi/Hemodialisa tidak ditagihkan di sini (sudah ditagihkan modul tsb).
      const tagihan = await TagihanFarmasiService.tagihOrderAlkes({
        order: { ...alkes.dataValues, faskes_uuid: author.faskesUuid },
        konfigurasiHarga,
        token,
        items: alkes.alkes_items.map((i) => ({
          item_name: i.item_medis?.name ?? "Alkes",
          qty: i.qty,
          hpp: i.harga_satuan,
          order_alkes_item_uuid: i.uuid,
        })),
      });

      Object.assign(alkes.dataValues, dataToUpdate, { status_tagihan: tagihan.status });

      await transaction.commit();
      return alkes;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async updateSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_SIAP_DISERAHKAN, req);
    return await this.ubahOrder(req.uuid, req.faskes_uuid, [STATUS_ALKES.DISIAPKAN], "ditandai siap diserahkan", {
      order_status: STATUS_ALKES.SIAP_DISERAHKAN,
      waktu_penyiapan: toEpochDate(new Date()),
      petugas_penyiapan_obat: req.petugas_penyiapan_obat,
    });
  }

  static async batalSiapDiserahkan(req) {
    ZodValidator.validate(PrescriptionValidation.BATAL_DISERAHKAN, req);
    return await this.ubahOrder(req.uuid, req.faskes_uuid, [STATUS_ALKES.SIAP_DISERAHKAN], "dibatalkan siap diserahkannya", {
      order_status: STATUS_ALKES.DISIAPKAN,
    });
  }

  static async updateDiserahkan(req) {
    ZodValidator.validate(AlkesValidation.UPDATE_SERAHKAN, req);
    const transaction = await sequelizeInstance.transaction();
    try {
      const order = await this.ambilOrder(req.uuid, req.faskes_uuid, transaction, [STATUS_ALKES.SIAP_DISERAHKAN], "diserahkan");
      // alkes dibayar dulu di kasir, kecuali rawat inap, pasien penjamin & BHP Kamar Operasi/Hemodialisa
      await TagihanFarmasiService.pastikanSudahDibayar(order.get({ plain: true }), "alkes", req.faskes_uuid, transaction);
      const diubah = await AlkesRepository.editAlkes(
        {
          order_status: STATUS_ALKES.DISERAHKAN,
          waktu_pemberian: toEpochDate(new Date()),
          petugas_pemberi: req.petugas_pemberi,
          penerima: req.penerima,
        },
        req.uuid,
        transaction,
        req.faskes_uuid
      );
      await transaction.commit();
      return diubah;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  // Pindah lokasi stok tujuan; hanya sebelum verifikasi (sesudahnya stok sudah dipotong dari lokasi lama).
  static async updateLokasiStok(req) {
    ZodValidator.validate(PrescriptionValidation.UPDATE_LOKASI_STOK, req);

    const { uuid, lokasi_stok_uuid: lokasiStokUuid, faskes_uuid: faskesUuid } = req;
    const lokasi = await DataMasterLokasiStokRepository.getByUuid(lokasiStokUuid);
    if (!lokasi || lokasi.faskes_uuid !== faskesUuid) throw new BadRequestException("Lokasi stok tujuan tidak ditemukan");
    const transaction = await sequelizeInstance.transaction();

    try {
      await this.ambilOrder(uuid, faskesUuid, transaction, [STATUS_ALKES.ORDER_MASUK], "dipindah lokasi stoknya");
      // Dulu editAlkes(req, transaction): transaksi terkirim sebagai uuid (galat "circular structure to JSON")
      // dan uuid order ikut terhapus dari req sebelum jenis stok item dikosongkan.
      const diubah = await AlkesRepository.editAlkes({ lokasi_stok_uuid: lokasiStokUuid }, uuid, transaction, faskesUuid);
      if (!diubah) throw new NotfoundException("Order alkes tidak ditemukan");

      await AlkesRepository.removeJenisStok({ uuid }, transaction);

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
    // status pembayaran kasir pada tahap siap diserahkan, dihitung sebelum payment_method diganti teks
    const statusBayar = await TagihanFarmasiService.statusPembayaran(
      rawData.filter((o) => o.order_status === STATUS_ALKES.SIAP_DISERAHKAN).map((o) => o.get({ plain: true })),
      "alkes",
      req.faskes_uuid
    );

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
        resep.dataValues.status_pembayaran = statusBayar.get(resep.uuid);
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
    await this.pastikanItemBolehDiubah(req.uuid, req.faskes_uuid, "diubah jenis stoknya");

    return await AlkesRepository.editAlkesItem({ uuid: req.uuid, jenis_stok_uuid: req.jenis_stok_uuid });
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

      // metode_hpp tersimpan "average" (bukan "avg") → dulu selalu memakai harga terakhir
      const hargaSatuan = hppDariHarga(hargaItem.detail_harga[0], konfigurasiHarga);

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
      item.harga_satuan = hargaSatuan;
    }
    return totalHarga;
  }
}
