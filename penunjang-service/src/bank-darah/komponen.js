import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinBdrs } from "../umum/izin.js";
import { ramah, teks } from "./bersama.js";

// Datamaster Komponen Darah (PRC/WB/TC/FFP, dapat ditambah faskes — PRD KF-14).
const rute = express.Router();
const TABEL = "bdrs_komponen_darah";
const PILIH = `uuid, kode, nama, keterangan, status, created_at, updated_at`;

const ambil = (uuid, faskes) => satu(`SELECT ${PILIH} FROM ${TABEL} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, faskes]);

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${TABEL} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH} FROM ${TABEL} WHERE ${w} ORDER BY nama LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/",
  izinBdrs("Datamaster", "CREATE", "Komponen Darah"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["kode", "nama"]);
    const t = await sisipkan(
      TABEL,
      { faskes_uuid: req.author.faskesUuid, kode: String(b.kode).trim().toUpperCase(), nama: String(b.nama).trim(), keterangan: teks(b.keterangan), status: b.status ?? true },
    ).catch((e) => ramah(e, `Kode ${b.kode} sudah dipakai`));
    kirim(res, await ambil(t.uuid, req.author.faskesUuid), "Komponen darah berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  izinBdrs("Datamaster", "UPDATE", "Komponen Darah"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    if (b.kode === "" || b.nama === "") throw permintaanSalah("kode dan nama tidak boleh kosong");
    const t = await ubah(
      TABEL,
      req.params.uuid,
      req.author.faskesUuid,
      {
        kode: b.kode === undefined ? undefined : String(b.kode).trim().toUpperCase(),
        nama: b.nama === undefined ? undefined : String(b.nama).trim(),
        keterangan: teks(b.keterangan),
        status: b.status === undefined ? undefined : Boolean(b.status),
      },
    ).catch((e) => ramah(e, `Kode ${b.kode} sudah dipakai`));
    if (!t) throw tidakDitemukan("Komponen darah");
    kirim(res, await ambil(t.uuid, req.author.faskesUuid), "Komponen darah berhasil diperbarui");
  }),
);

// Hapus lunak: komponen yang pernah dipakai permintaan/stok tetap tampil pada riwayat (snapshot nama tersimpan di sana).
rute.delete(
  "/:uuid",
  izinBdrs("Datamaster", "DELETE", "Komponen Darah"),
  tangani(async (req, res) => {
    const t = await ubah(TABEL, req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Komponen darah");
    kirim(res, { uuid: t.uuid }, "Komponen darah berhasil dihapus");
  }),
);

export default rute;
