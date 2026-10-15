import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { MODALITAS, ramah, daftarNilai } from "./bersama.js";

// Datamaster Pemeriksaan Radiologi (jenis pemeriksaan + tarif + modalitas + kode ICD-9-CM + persiapan pasien).
const rute = express.Router();

const KOLOM = (b) => {
  if (b.modalitas !== undefined && !MODALITAS[b.modalitas]) throw permintaanSalah(`modalitas harus salah satu: ${Object.keys(MODALITAS).join(", ")}`);
  if (b.harga !== undefined && b.harga !== null && (!Number.isFinite(Number(b.harga)) || Number(b.harga) < 0)) throw permintaanSalah("harga tidak valid");
  const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
  return {
    kode: b.kode === undefined ? undefined : String(b.kode).trim(),
    nama: b.nama === undefined ? undefined : String(b.nama).trim(),
    modalitas: b.modalitas,
    bagian_tubuh: teks(b.bagian_tubuh),
    kode_icd9: teks(b.kode_icd9),
    persiapan: teks(b.persiapan),
    harga: b.harga === undefined || b.harga === null ? undefined : Number(b.harga),
    status: b.status === undefined ? undefined : Boolean(b.status),
  };
};

const PILIH = `uuid, faskes_uuid, kode, nama, modalitas, bagian_tubuh, harga::float8 AS harga, kode_icd9, persiapan, status, created_at, updated_at`;
const angkaHarga = (t) => ({ ...t, harga: Number(t.harga) });

// Daftar modalitas untuk pilihan di frontend.
rute.get(
  "/modalitas",
  tangani(async (req, res) => kirim(res, Object.entries(MODALITAS).map(([kode, nama]) => ({ kode, nama })))),
);

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (kode ILIKE $${p.length} OR nama ILIKE $${p.length} OR bagian_tubuh ILIKE $${p.length})`;
    }
    const modalitas = daftarNilai(req.query.modalitas);
    if (modalitas.length) {
      p.push(modalitas);
      w += ` AND modalitas = ANY($${p.length})`;
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      p.push(["1", "true", "aktif"].includes(String(req.query.status)));
      w += ` AND status = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM rad_pemeriksaan WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM rad_pemeriksaan WHERE ${w}
        ORDER BY array_position(ARRAY['XR','DX','US','CT','MR','FL','MG','LAIN']::varchar[], modalitas), nama
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await satu(`SELECT ${PILIH} FROM rad_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, req.author.faskesUuid]);
    if (!t) throw tidakDitemukan("Pemeriksaan radiologi");
    kirim(res, t);
  }),
);

rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama", "modalitas"]);
    const t = await sisipkan("rad_pemeriksaan", {
      faskes_uuid: req.author.faskesUuid,
      harga: 0,
      ...Object.fromEntries(Object.entries(KOLOM(req.body)).filter(([, v]) => v !== undefined)),
      status: req.body.status ?? true,
    }).catch((e) =>
      ramah(e, `Kode pemeriksaan ${req.body.kode} sudah dipakai`),
    );
    kirim(res, angkaHarga(t), "Pemeriksaan radiologi berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const kolom = KOLOM(req.body);
    if (kolom.kode === "" || kolom.nama === "") throw permintaanSalah("kode dan nama tidak boleh kosong");
    const t = await ubah("rad_pemeriksaan", req.params.uuid, req.author.faskesUuid, kolom).catch((e) => ramah(e, `Kode pemeriksaan ${req.body.kode} sudah dipakai`));
    if (!t) throw tidakDitemukan("Pemeriksaan radiologi");
    kirim(res, angkaHarga(t), "Pemeriksaan radiologi berhasil diperbarui");
  }),
);

// Hapus lunak: order lama tetap menyimpan nama, modalitas & harga (snapshot) di rad_order_item.
rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await ubah("rad_pemeriksaan", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Pemeriksaan radiologi");
    kirim(res, { uuid: t.uuid }, "Pemeriksaan radiologi berhasil dihapus");
  }),
);

export default rute;
