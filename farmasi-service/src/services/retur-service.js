import sequelizeInstance from "@opensimrs/model-sdk/instance";
import ZodValidator from "../validations/zod-validator.js";
import ReturValidation from "../validations/retur-validation.js";
import ReturRepository from "../repositories/retur-repository.js";
import PrescriptionRepository from "../repositories/prescription-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import { uuidv7 } from "uuidv7";
import PrescriptionValidation from "../validations/prescription-validation.js";
import AlkesRepository from "../repositories/alkes-repository.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import { setRangeDate } from "../helpers/date-helper.js";
import NotfoundException from "../errors/notfound-exception.js";
import TagihanFarmasiService, { KATEGORI_ALKES, KATEGORI_OBAT } from "./tagihan-farmasi-service.js";
import TagihanRepository from "../repositories/tagihan-repository.js";

// Status order yang boleh diretur: resep 5 = diserahkan, 6 = sudah pernah diretur (retur lanjutan);
// order alkes 4 = diserahkan, 5 = sudah pernah diretur. Jumlah retur dibatasi sisa yang belum diretur.
const STATUS_RETUR = {
  obat: { boleh: [5, 6], diretur: 6 },
  alkes: { boleh: [4, 5], diretur: 5 },
};

const jumlahDipakai = (stokMedisUuides) =>
  (Array.isArray(stokMedisUuides) ? stokMedisUuides : []).reduce((n, s) => n + Number(s.quantity || 0), 0);

// Pengembalian stok ke batch asal secara berurutan; retur sebelumnya dianggap sudah mengisi batch-batch awal
// sehingga retur bertahap tidak mengembalikan lebih dari yang diambil per batch.
const alokasiBatch = (stokMedisUuides, sudahDiretur, qtyRetur) => {
  let lewati = sudahDiretur;
  let sisa = qtyRetur;
  const hasil = [];
  for (const batch of stokMedisUuides ?? []) {
    const kapasitas = Number(batch.quantity || 0);
    const terpakaiRetur = Math.min(kapasitas, lewati);
    lewati -= terpakaiRetur;
    const ambil = Math.min(kapasitas - terpakaiRetur, sisa);
    if (ambil > 0) {
      hasil.push({ ...batch, quantity: ambil });
      sisa -= ambil;
    }
    if (sisa === 0) break;
  }
  return hasil;
};

export default class ReturService {
  static async create(data, author, token) {
    ZodValidator.validate(ReturValidation.CREATE, data);
    const retur_uuid = uuidv7();
    const faskesUuid = author.faskesUuid;
    const petugas = author.username;
    const jenis = data.jenis_retur;
    const aturan = STATUS_RETUR[jenis];

    const transaction = await sequelizeInstance.transaction();

    try {
      // Order asal hanya milik faskes token. Dulu dipanggil getByUuid(uuid, transaction) — transaksi masuk sebagai
      // argumen lain & tanpa filter faskes; status resep dibaca dari kolom yang tidak ada (`status`).
      const originalOrder =
        jenis === "obat"
          ? await ReturRepository.getResep(data.prescription_uuid, faskesUuid, transaction)
          : await ReturRepository.getOrderAlkes(data.order_alkes_uuid, faskesUuid, transaction);
      if (!originalOrder) {
        throw new NotfoundException(jenis === "obat" ? "Data Resep tidak ditemukan." : "Data Order Alkes tidak ditemukan.");
      }
      if (!aturan.boleh.includes(originalOrder.order_status)) {
        throw new BadRequestException(
          jenis === "obat"
            ? "Hanya resep yang sudah diserahkan yang bisa diretur."
            : "Hanya order alkes yang sudah diserahkan yang bisa diretur."
        );
      }
      const noReferensi = jenis === "obat" ? originalOrder.no_resep : originalOrder.no_order_alkes;
      const lokasiStokUuid = originalOrder.lokasi_stok_uuid;
      const kolomItem = jenis === "obat" ? "prescription_item_uuid" : "order_alkes_item_uuid";

      const itemsDiminta = (data.items ?? [])
        .map((i) => ({ ...i, item_uuid: jenis === "obat" ? i.order_obat_item_uuid ?? i.prescription_item_uuid : i.order_alkes_item_uuid }))
        .filter((i) => Number(i.qty_retur) > 0);
      if (itemsDiminta.length === 0) throw new BadRequestException("Isi jumlah retur minimal satu item.");
      if (new Set(itemsDiminta.map((i) => i.item_uuid)).size !== itemsDiminta.length) {
        throw new BadRequestException("Item retur tidak boleh ganda.");
      }
      const sudahDiretur = await ReturRepository.getQtyDiretur(kolomItem, itemsDiminta.map((i) => i.item_uuid), transaction);

      let totalHargaRetur = 0;
      const itemTagihan = [];

      for (const item of itemsDiminta) {
        const qtyRetur = Number(item.qty_retur);
        if (!Number.isInteger(qtyRetur)) throw new BadRequestException("Jumlah retur harus bilangan bulat.");

        const originalItem =
          jenis === "obat"
            ? await ReturRepository.getResepItem(item.item_uuid, originalOrder.uuid, transaction)
            : await ReturRepository.getOrderAlkesItem(item.item_uuid, originalOrder.uuid, transaction);
        if (!originalItem) throw new NotfoundException(`Item ${item.item_uuid} tidak ditemukan pada order ini.`);
        const namaItem = originalItem.item_medis?.name ?? "item";
        if (originalItem.is_compound) {
          throw new BadRequestException(`Obat racikan (${originalItem.nama_racikan ?? namaItem}) tidak dapat diretur.`);
        }

        // Batas retur = jumlah yang benar-benar diambil dari stok dikurangi retur sebelumnya.
        const dipakai = jumlahDipakai(originalItem.stok_medis_uuides);
        const sudah = sudahDiretur[originalItem.uuid] ?? 0;
        if (qtyRetur > dipakai - sudah) {
          throw new BadRequestException(
            `Jumlah retur ${namaItem} (${qtyRetur}) melebihi sisa yang dapat diretur (${Math.max(dipakai - sudah, 0)}).`
          );
        }

        const hargaSatuanAsli = Number(originalItem.harga_satuan ?? 0);
        totalHargaRetur += hargaSatuanAsli * qtyRetur;

        // Dulu seluruh jumlah tiap batch dikembalikan berapa pun qty retur-nya (retur 1 dari 10 → stok +10).
        const batches = alokasiBatch(originalItem.stok_medis_uuides, sudah, qtyRetur);
        for (const batch of batches) {
          await StockMedisRepository.addQuantity(
            { stock_medis_uuid: batch.stock_medis_uuid, quantity: batch.quantity },
            {
              faskes_uuid: faskesUuid,
              petugas: petugas,
              kode_referensi: `${noReferensi}-RETUR`,
              keterangan_prefix: `Retur Pasien: ${noReferensi}`,
              item_uuid: originalItem.item_medis_uuid,
              jenis_stok_uuid: originalItem.jenis_stok_uuid,
              lokasi_stok_uuid: lokasiStokUuid,
            },
            transaction
          );
        }

        const returItem = {
          faskes_uuid: faskesUuid,
          retur_uuid: retur_uuid,
          [kolomItem]: originalItem.uuid,
          qty_retur: qtyRetur,
          harga_satuan: hargaSatuanAsli,
          // tanggal kedaluwarsa diambil dari batch stok, bukan dari isian klien (dulu kosong → gagal simpan)
          expired_date: batches[0]?.expired_date ?? originalItem.stok_medis_uuides?.[0]?.expired_date ?? new Date(),
        };
        ZodValidator.validate(ReturValidation.CREATE_ITEM, returItem);
        await ReturRepository.createItem(returItem, transaction);

        // koreksi tagihan senilai HPP, sama dengan retur.total (dulu harga jual HPP + margin)
        itemTagihan.push({ item_name: namaItem, qty: qtyRetur, harga_satuan: hargaSatuanAsli });
      }

      const waktuRetur = Math.floor(Date.now() / 1000);
      const dataUpdate = { order_status: aturan.diretur, petugas_retur: petugas, waktu_retur: waktuRetur };
      if (jenis === "obat") {
        await ReturRepository.editResep(originalOrder.uuid, dataUpdate, transaction);
      } else {
        await ReturRepository.editOrderAlkes(originalOrder.uuid, dataUpdate, transaction);
      }

      const returHeader = {
        uuid: retur_uuid,
        faskes_uuid: faskesUuid,
        petugas_retur: petugas,
        jenis_retur: jenis,
        alasan_retur: data.alasan_retur,
        prescription_uuid: jenis === "obat" ? originalOrder.uuid : null,
        order_alkes_uuid: jenis === "alkes" ? originalOrder.uuid : null,
        total: totalHargaRetur,
        no_resep: originalOrder.no_resep || null,
        no_order_alkes: originalOrder.no_order_alkes || null,
        no_reg: originalOrder.no_reg,
        rekam_medis_uuid: originalOrder.rekam_medis_uuid,
        patient_uuid: originalOrder.patient_uuid,
        no_rm: originalOrder.no_rm,
        order_date: originalOrder.order_date || originalOrder.waktu_verifikasi || originalOrder.created_at,
        lokasi_stok_uuid: lokasiStokUuid,
      };

      const retur = await ReturRepository.create(returHeader, transaction);

      // Koreksi tagihan: baris negatif di tagihan kunjungan yang masih terbuka. Alkes pemakaian Kamar Operasi /
      // Hemodialisa ditagihkan modul tsb dengan harga berbeda → koreksi manual.
      let tagihan;
      if (jenis === "alkes" && (originalOrder.jenis_pelayanan === "ok" || (await TagihanRepository.dariPemakaianPenunjang(originalOrder.uuid)))) {
        tagihan = { status: "oleh_penunjang", pesan: "Tagihan BHP dibuat modul Kamar Operasi/Hemodialisa; koreksi tagihan manual di kasir." };
      } else {
        tagihan = await TagihanFarmasiService.koreksiRetur({
          faskesUuid,
          noReg: originalOrder.no_reg,
          returUuid: retur_uuid,
          kategori: jenis === "obat" ? KATEGORI_OBAT : KATEGORI_ALKES,
          items: itemTagihan,
          token,
        });
      }

      await transaction.commit();
      retur.dataValues.status_tagihan = tagihan.status;
      retur.dataValues.pesan_tagihan = tagihan.pesan;
      return retur;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  static async getDetail(req) {
    ZodValidator.validate(ReturValidation.GET_DETAIL, req);

    let result;
    let sudahDiretur = {};
    if (req.item_type === "obat") {
      result = await ReturRepository.getObatDetail(req);
      sudahDiretur = await ReturRepository.getQtyDiretur("prescription_item_uuid", result.map((r) => r.uuid));
    } else if (req.item_type === "alkes") {
      result = await ReturRepository.getAlkesDetail(req);
      sudahDiretur = await ReturRepository.getQtyDiretur("order_alkes_item_uuid", result.map((r) => r.uuid));
    }

    if (!result) {
      throw new BadRequestException("Data not found");
    }

    return this.mapReturDetail(result, req.item_type, sudahDiretur);
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

    // termasuk order yang sudah pernah diretur sebagian agar sisanya tetap bisa diretur
    if (req.item_type === "obat") {
      req.status = [5, 6];
      ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
      result = await PrescriptionRepository.getAllPrescription(req);
    } else if (req.item_type === "alkes") {
      req.status = [4, 5];
      ZodValidator.validate(PrescriptionValidation.GET_ALL, req);
      result = await AlkesRepository.getAllForFarmacy(req);
    }

    if (!result) {
      throw new BadRequestException("Data not found");
    }

    return result;
  }

  static mapReturDetail(req, type, sudahDiretur = {}) {
    const data = [];

    req.forEach((item) => {
      // sisa yang dapat diretur = jumlah yang diambil dari stok - retur sebelumnya
      const dipakai = jumlahDipakai(item.dataValues?.stok_medis_uuides);
      const sisa = Math.max(dipakai - (sudahDiretur[item.dataValues?.uuid] ?? 0), 0);
      const detail = {
        name: item.dataValues?.item_medis?.name,
        available_qty: `${sisa} ${item.dataValues?.item_medis?.satuan_penggunaan?.name ?? ""}`.trim(),
        detail: [
          {
            uuid: item.dataValues?.uuid,
            jenis_stok: item.dataValues?.jenis_stok?.name,
            used_qty: dipakai,
            sisa_qty: sisa,
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
