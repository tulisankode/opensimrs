import express from "express";
import { query, transaksi } from "../../db.js";
import { Galat } from "../../umum/respons.js";
import { fiturSdmAktif } from "../fitur.js";
import { SUB, tanpaCakupan } from "./bersama.js";
import { izin, tangani, galat, baca, catat } from "./dasar.js";
import komponen from "./komponen.js";
import konfigurasi from "./konfigurasi.js";
import periode from "./periode.js";
import laporan from "./laporan.js";

const rute = express.Router();
rute.use(tangani(async (req, res, next) => {
  res.set("Cache-Control", "no-store");
  try {
    tanpaCakupan(req);
    for (const kode of ["sdm_kepegawaian", "sdm_penggajian", "akuntansi_jurnal", "akuntansi_remunerasi"]) if (!(await fiturSdmAktif(kode, req.author.faskesUuid))) throw new Galat(403, `Fitur ${kode} belum aktif untuk faskes ini`);
  } catch (e) {
    if (req.author?.username && req.author?.faskesUuid) await transaksi((k) => catat(k, req, "akses_ditolak"));
    throw e;
  }
  next();
}));
rute.get("/referensi", izin(...Object.values(SUB).map((sub) => [sub, "READ"])), baca(async () => ({ status: ["draf", "verifikasi", "menunggu_persetujuan", "disetujui", "dibayar"], kehadiran: "tidak_digunakan", dependensi: { akuntansi: true, remunerasi: true } })));
// Sumber jaspel untuk membuka periode gaji tanpa izin modul Akuntansi: periode Remunerasi yang disetujui dan sudah
// berjurnal, beserta penggajian yang sudah memakainya (sumber yang dipakai periode lain ditolak saat dihitung).
rute.get("/referensi/remunerasi", izin([SUB.periode, "READ"], [SUB.periode, "CREATE"]), baca(async (k, req) => {
  const p = [req.author.faskesUuid];
  let syarat = "";
  if (req.query.tahun) syarat += ` AND r.tahun = $${p.push(Number(req.query.tahun) || 0)}`;
  if (req.query.bulan) syarat += ` AND r.bulan = $${p.push(Number(req.query.bulan) || 0)}`;
  return query(`SELECT r.uuid, r.nomor, r.tahun, r.bulan, r.status, r.total::text AS total, s.periode_uuid AS dipakai_periode_uuid
    FROM remunerasi_periode r
    LEFT JOIN hr_gaji_jaspel_sumber s ON s.faskes_uuid = r.faskes_uuid AND s.remunerasi_periode_uuid = r.uuid AND s.status <> 'dilepas' AND s.deleted_at IS NULL
    WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL AND r.status = 'disetujui' AND r.jurnal_uuid IS NOT NULL${syarat}
    ORDER BY r.tahun DESC, r.bulan DESC`, p, k);
}));
rute.get("/pegawai", izin([SUB.komponen, "READ"], [SUB.konfigurasi, "READ"], [SUB.rekening, "READ"]), baca(async (k, req) => {
  const { halaman, denganHalaman } = await import("../../umum/respons.js");
  const p = halaman({ ...req.query, limit: Math.min(Number(req.query.limit) || 20, 200) });
  const params = [req.author.faskesUuid, `%${String(req.query.cari ?? "").slice(0, 150)}%`, req.query.unit_uuid ?? null];
  const from = `FROM hr_kepegawaian h JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL AND p.status = true WHERE h.faskes_uuid = $1 AND h.deleted_at IS NULL AND p.name ILIKE $2 AND ($3::varchar IS NULL OR h.unit_uuid = $3)`;
  const count = await query(`SELECT count(*) AS jumlah ${from}`, params, k);
  const rows = await query(`SELECT h.uuid, h.unit_uuid, h.golongan, h.status_kepegawaian, p.name AS nama ${from} ORDER BY p.name, h.uuid LIMIT $4 OFFSET $5`, [...params, p.limit, p.offset], k);
  return denganHalaman(rows, count[0].jumlah, p);
}));
rute.use(komponen, konfigurasi, periode, laporan);
rute.use(galat);
export default rute;
