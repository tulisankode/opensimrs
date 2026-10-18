import express from "express";
import { query, satu, sisipkan, sekarang } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinLaundry, wajibSalahSatu } from "../umum/izin.js";
import { JENIS_KOREKSI, KATEGORI_LINEN, LOKASI_TIPE, STATUS_BATCH, STATUS_DISTRIBUSI, STATUS_PENERIMAAN, STATUS_PERMINTAAN, TAHAP_BATCH, boolOpsional, konflik, pilihan, teks } from "./bersama.js";
import { rute as stok } from "./stok.js";
import { rute as penerimaan } from "./penerimaan.js";
import { rute as batch } from "./batch.js";
import { rute as distribusi } from "./distribusi.js";
import { rute as laporan } from "./laporan.js";

// Laundry & Linen (STD-0023) — /api/v3/penunjang/laundry/...
//   /referensi                                         jenis linen aktif, ruangan, pilihan enum
//   /linen                                             datamaster jenis linen
//   /stok, /stok/:lokasi/:jenis, /stok-laundry/:jenis   saldo & par level ruangan, saldo awal stok bersih laundry
//   /stok/riwayat, /koreksi-stok                       buku transaksi & koreksi hilang/rusak/afkir
//   /penerimaan, /penerimaan/:uuid/konfirmasi           serah terima linen kotor (dua petugas)
//   /penerimaan/antrean, /batch, /batch/:uuid/tahap/:t  antrean cuci & pemrosesan batch
//   /permintaan, /distribusi, /distribusi/:uuid/konfirmasi  permintaan & distribusi linen bersih
//   /laporan, /laporan/rekonsiliasi, /laporan/ekspor   laporan
const rute = express.Router();

const MODUL = "Laundry";
rute.get(
  "/referensi",
  wajibSalahSatu(
    [MODUL, "Stok & Par Level", "READ"],
    [MODUL, "Penerimaan", "READ"],
    [MODUL, "Batch", "READ"],
    [MODUL, "Permintaan Linen", "READ"],
    [MODUL, "Distribusi", "READ"],
    [MODUL, "Koreksi Stok", "READ"],
    [MODUL, "Laporan Laundry", "READ"],
    [MODUL, "Datamaster", "READ", "Jenis Linen"],
  ),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    kirim(res, {
      jenis_linen: await query(`SELECT uuid, kode, nama, satuan, aktif FROM laundry_jenis_linen WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama`, [f]),
      ruangan: await query(`SELECT uuid, name AS nama, pelayanan FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]),
      kategori: pilihan(KATEGORI_LINEN),
      jenis_koreksi: pilihan(JENIS_KOREKSI),
      lokasi_tipe: pilihan(LOKASI_TIPE),
      tahap: pilihan(TAHAP_BATCH),
      status_penerimaan: pilihan(STATUS_PENERIMAAN),
      status_batch: pilihan(STATUS_BATCH),
      status_permintaan: pilihan(STATUS_PERMINTAAN),
      status_distribusi: pilihan(STATUS_DISTRIBUSI),
    });
  }),
);

// ── Datamaster jenis linen
const kodeTerpakai = async (faskes, kode, kecuali = null) =>
  satu(`SELECT uuid FROM laundry_jenis_linen WHERE faskes_uuid = $1 AND lower(kode) = lower($2) AND deleted_at IS NULL AND uuid IS DISTINCT FROM $3`, [faskes, kode, kecuali]);

const batasTeks = (nilai, nama, maks) => {
  if (nilai && nilai.length > maks) throw permintaanSalah(`${nama} maksimal ${maks} karakter`);
  return nilai;
};

rute.get(
  "/linen",
  izinLaundry("Datamaster", "READ", "Jenis Linen"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.q) {
      p.push(`%${String(req.query.q).trim()}%`);
      w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length})`;
    }
    if (req.query.aktif === "true" || req.query.aktif === "false") {
      p.push(req.query.aktif === "true");
      w += ` AND aktif = $${p.length}`;
    }
    kirim(res, await query(`SELECT * FROM laundry_jenis_linen WHERE ${w} ORDER BY nama`, p));
  }),
);

rute.post(
  "/linen",
  izinLaundry("Datamaster", "CREATE", "Jenis Linen"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["kode", "nama", "satuan"]);
    const f = req.author.faskesUuid;
    const kode = batasTeks(teks(b.kode), "kode", 40);
    const nama = batasTeks(teks(b.nama), "nama", 120);
    const satuan = batasTeks(teks(b.satuan), "satuan", 30);
    if (!kode || !nama || !satuan) throw permintaanSalah("kode, nama, satuan wajib diisi");
    if (await kodeTerpakai(f, kode)) throw konflik(`Kode jenis linen ${kode} sudah dipakai`);
    const data = await sisipkan("laundry_jenis_linen", { faskes_uuid: f, kode, nama, satuan, aktif: boolOpsional(b.aktif) ?? true });
    kirim(res, data, "Jenis linen berhasil ditambahkan");
  }),
);

rute.patch(
  "/linen/:uuid",
  izinLaundry("Datamaster", "UPDATE", "Jenis Linen"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const ada = await satu(`SELECT uuid FROM laundry_jenis_linen WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f]);
    if (!ada) throw tidakDitemukan("Jenis linen");
    const fields = {
      kode: batasTeks(teks(b.kode), "kode", 40),
      nama: batasTeks(teks(b.nama), "nama", 120),
      satuan: batasTeks(teks(b.satuan), "satuan", 30),
      aktif: boolOpsional(b.aktif),
    };
    for (const k of ["kode", "nama", "satuan"]) if (fields[k] === null) throw permintaanSalah(`${k} tidak boleh kosong`);
    if (fields.kode && (await kodeTerpakai(f, fields.kode, ada.uuid))) throw konflik(`Kode jenis linen ${fields.kode} sudah dipakai`);
    const cols = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (!cols.length) throw permintaanSalah("Tidak ada perubahan yang dikirim");
    const rows = await query(
      `UPDATE laundry_jenis_linen SET ${cols.map(([c], i) => `${c} = $${i + 1}`).join(", ")}, updated_at = $${cols.length + 1}
        WHERE uuid = $${cols.length + 2} AND faskes_uuid = $${cols.length + 3} AND deleted_at IS NULL RETURNING *`,
      [...cols.map(([, v]) => v), sekarang(), ada.uuid, f],
    );
    kirim(res, rows[0], "Jenis linen berhasil diperbarui");
  }),
);

// Arsip (soft delete) hanya bila tidak ada saldo tersisa di mana pun; riwayat transaksi tetap utuh (KF-18).
rute.delete(
  "/linen/:uuid",
  izinLaundry("Datamaster", "DELETE", "Jenis Linen"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const sisa = await satu(
      `SELECT COALESCE(SUM(CASE WHEN arah = 'masuk' THEN jumlah ELSE -jumlah END), 0)::numeric AS saldo FROM laundry_transaksi_stok
        WHERE faskes_uuid = $1 AND jenis_linen_uuid = $2 AND deleted_at IS NULL`,
      [f, req.params.uuid],
    );
    if (Number(sisa?.saldo ?? 0) !== 0) throw konflik("Jenis linen masih memiliki saldo; nonaktifkan saja atau koreksi saldonya terlebih dahulu");
    const rows = await query(`UPDATE laundry_jenis_linen SET deleted_at = $1, updated_at = $1 WHERE uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL RETURNING uuid`, [sekarang(), req.params.uuid, f]);
    if (!rows.length) throw tidakDitemukan("Jenis linen");
    kirim(res, { uuid: rows[0].uuid }, "Jenis linen berhasil diarsipkan");
  }),
);

rute.use("/", stok);
rute.use("/", penerimaan);
rute.use("/", batch);
rute.use("/", distribusi);
rute.use("/", laporan);

export default rute;
