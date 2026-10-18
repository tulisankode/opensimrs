import express from "express";
import { query, satu } from "../db.js";
import { kirim, halaman, denganHalaman, tidakDitemukan } from "../umum/respons.js";
import { izinMutu } from "../umum/izin.js";
import { sekarangDetik, teks } from "./bersama.js";
import { tanganiMutu } from "./dasar.js";

// Akses baca surveior (KF-11, keputusan desain §9.6): akun pengguna biasa dengan izin "Akses Surveior" › READ, hanya
// melihat dokumen yang dibagikan faskes (dibagikan_surveior), berstatus disahkan, dan belum melewati batas waktu
// berbagi. Tanpa hak ubah; dokumen lain → 404 (tidak membocorkan keberadaannya).
//   GET /surveior/dokumen?cari=          daftar dokumen dibagikan + elemen penilaian yang dipetakan
//   GET /surveior/dokumen/:uuid/berkas   unduh berkas (base64)
const rute = express.Router();
const DIBAGIKAN = `d.faskes_uuid = $1 AND d.deleted_at IS NULL AND d.status = 'disahkan' AND d.dibagikan_surveior = true
  AND (d.dibagikan_sampai IS NULL OR d.dibagikan_sampai >= $2)`;

rute.get(
  "/dokumen",
  izinMutu("Akses Surveior", "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const pg = halaman(req.query);
    const p = [f, sekarangDetik()];
    let where = DIBAGIKAN;
    const cari = teks(req.query.cari, "cari", 100);
    if (cari) where += ` AND (d.nomor ILIKE $${p.push(`%${cari}%`)} OR d.judul ILIKE $${p.length})`;
    const total = (await satu(`SELECT COUNT(*) n FROM mutu_dokumen d WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT d.uuid, d.jenis, d.nomor, d.judul, d.versi, d.unit_pemilik, d.tanggal_terbit, d.tanggal_tinjau_ulang, d.dibagikan_sampai, d.berkas_info,
         COALESCE((SELECT json_agg(json_build_object('kode', e.kode, 'standar_kode', s.kode, 'bab_kode', b.kode) ORDER BY b.kode, s.kode, e.kode)
            FROM mutu_dokumen_elemen de JOIN mutu_elemen_penilaian e ON e.uuid = de.elemen_uuid
            JOIN mutu_standar s ON s.uuid = e.standar_uuid JOIN mutu_bab b ON b.uuid = s.bab_uuid
           WHERE de.dokumen_uuid = d.uuid AND de.deleted_at IS NULL), '[]'::json) AS elemen
       FROM mutu_dokumen d WHERE ${where} ORDER BY d.nomor, d.versi LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, pg.limit, pg.offset],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/dokumen/:uuid/berkas",
  izinMutu("Akses Surveior", "READ"),
  tanganiMutu(async (req, res) => {
    const row = await satu(`SELECT d.berkas, d.berkas_info FROM mutu_dokumen d WHERE d.uuid = $3 AND ${DIBAGIKAN}`, [req.author.faskesUuid, sekarangDetik(), String(req.params.uuid)]);
    if (!row?.berkas) throw tidakDitemukan("Dokumen yang dibagikan");
    kirim(res, { ...row.berkas_info, data_base64: row.berkas.toString("base64") });
  }),
);

export default rute;
