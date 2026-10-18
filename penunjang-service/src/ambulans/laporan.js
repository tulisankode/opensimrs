import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim, wajib } from "../umum/respons.js";
import { izinAmbulans } from "../umum/izin.js";

// Laporan: jumlah layanan per jenis, waktu respons, jarak & BBM per armada, serta pendapatan (KF-18, filter
// rentang waktu). Ekspor mengikuti hasil & isolasi faskes yang sama (diunduh sebagai CSV sisi klien — lihat
// LaporanAmbulansPage.vue — karena layanan ini belum memakai dependensi pembuat Excel seperti exceljs).
const rute = express.Router();

rute.get(
  "/",
  izinAmbulans("Laporan Ambulans", "READ"),
  tangani(async (req, res) => {
    wajib(req.query, ["tanggal_mulai", "tanggal_selesai"]);
    const faskes = req.author.faskesUuid;
    const mulai = Number(req.query.tanggal_mulai);
    const selesai = Number(req.query.tanggal_selesai);

    const perJenis = await query(
      `SELECT p.jenis_layanan, COUNT(*)::int AS jumlah,
              COUNT(*) FILTER (WHERE p.status = 'selesai')::int AS selesai,
              COUNT(*) FILTER (WHERE p.status = 'batal')::int AS batal
         FROM ambulans_permintaan p
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.waktu_permintaan BETWEEN $2 AND $3
        GROUP BY p.jenis_layanan ORDER BY p.jenis_layanan`,
      [faskes, mulai, selesai],
    );

    const responsRata = await satu(
      `SELECT AVG(pn.waktu_penugasan - p.waktu_permintaan)::float8 AS rata_rata_tunggu_penugasan,
              AVG(pj.berangkat_pada - p.waktu_permintaan) FILTER (WHERE pj.berangkat_pada IS NOT NULL)::float8 AS rata_rata_waktu_respons
         FROM ambulans_permintaan p
         JOIN ambulans_penugasan pn ON pn.permintaan_uuid = p.uuid AND pn.deleted_at IS NULL
         LEFT JOIN ambulans_perjalanan pj ON pj.penugasan_uuid = pn.uuid AND pj.deleted_at IS NULL
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.waktu_permintaan BETWEEN $2 AND $3`,
      [faskes, mulai, selesai],
    );

    const perArmada = await query(
      `SELECT a.uuid AS armada_uuid, a.nomor_polisi, a.jenis,
              COUNT(pj.uuid)::int AS jumlah_perjalanan,
              COALESCE(SUM(pj.jarak_km), 0)::float8 AS total_jarak_km,
              COALESCE(SUM(pj.bbm_nilai), 0)::float8 AS total_bbm,
              COALESCE(SUM(b.jumlah), 0)::float8 AS pendapatan
         FROM ambulans_armada a
         LEFT JOIN ambulans_penugasan pn ON pn.armada_uuid = a.uuid AND pn.deleted_at IS NULL
         LEFT JOIN ambulans_perjalanan pj ON pj.penugasan_uuid = pn.uuid AND pj.deleted_at IS NULL AND pj.status = 'selesai'
            AND pj.kembali_pada BETWEEN $2 AND $3
         LEFT JOIN ambulans_biaya b ON b.permintaan_uuid = pn.permintaan_uuid AND b.deleted_at IS NULL AND b.status_penerusan = 'terkirim'
        WHERE a.faskes_uuid = $1 AND a.deleted_at IS NULL
        GROUP BY a.uuid, a.nomor_polisi, a.jenis ORDER BY a.nomor_polisi`,
      [faskes, mulai, selesai],
    );

    const pendapatan = await satu(
      `SELECT COALESCE(SUM(b.jumlah) FILTER (WHERE b.status_penerusan = 'terkirim'), 0)::float8 AS total_tertagih,
              COALESCE(SUM(k.jumlah) FILTER (WHERE k.status = 'terbit'), 0)::float8 AS total_kuitansi
         FROM ambulans_permintaan p
         LEFT JOIN ambulans_biaya b ON b.permintaan_uuid = p.uuid AND b.deleted_at IS NULL
         LEFT JOIN ambulans_kuitansi k ON k.permintaan_uuid = p.uuid AND k.deleted_at IS NULL
        WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.waktu_permintaan BETWEEN $2 AND $3`,
      [faskes, mulai, selesai],
    );

    kirim(res, {
      periode: { mulai, selesai },
      per_jenis_layanan: perJenis,
      waktu_respons: responsRata,
      per_armada: perArmada,
      pendapatan,
    });
  }),
);

export default rute;
