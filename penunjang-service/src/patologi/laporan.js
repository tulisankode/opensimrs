import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { JENIS, hariIni, tanggalValid, tglLokal } from "./bersama.js";

// Laporan Kunjungan PA: rentang tanggal order (zona Asia/Jakarta), order batal tidak dihitung.
// Pendapatan = tarif kasus pada order yang sudah divalidasi (tagihan terkirim). TAT dalam hari: jaringan diterima →
// laporan diverifikasi pertama kali (waktu_selesai); tepat waktu = selesai ≤ target (terima + TAT hari pemeriksaan).
// Keganasan = kode ICD-O morfologi berperilaku /3 (ganas primer) atau /6 (metastasis).
const rute = express.Router();

rute.get(
  "/kunjungan",
  tangani(async (req, res) => {
    const mulai = tanggalValid(req.query.tanggal_mulai || hariIni(), "tanggal_mulai");
    const selesai = tanggalValid(req.query.tanggal_selesai || mulai, "tanggal_selesai");
    const p = [req.author.faskesUuid, mulai, selesai];
    const w = `o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status <> 'batal' AND ${tglLokal("o.created_at")} BETWEEN $2 AND $3`;
    const dari = `FROM pa_order o JOIN pa_order_item i ON i.order_uuid = o.uuid AND i.deleted_at IS NULL
                  LEFT JOIN pa_laporan lp ON lp.order_item_uuid = i.uuid AND lp.deleted_at IS NULL`;
    const PENDAPATAN = `COALESCE(SUM(i.harga) FILTER (WHERE o.status <> 'order'), 0)::float8`;
    const TAT = `ROUND(AVG((i.waktu_selesai - i.waktu_terima) / 86400.0) FILTER (WHERE i.waktu_selesai IS NOT NULL AND i.waktu_terima IS NOT NULL), 1)::float8`;
    const TEPAT = `COUNT(*) FILTER (WHERE i.waktu_selesai IS NOT NULL AND i.waktu_selesai <= i.target_selesai)::int`;
    const SELESAI = `COUNT(*) FILTER (WHERE i.waktu_selesai IS NOT NULL)::int`;
    const GANAS = `COUNT(*) FILTER (WHERE i.status = 'selesai' AND lp.icd_o_morfologi ~ '/[36]$')::int`;

    const [ringkasan, batal, perJenis, perPemeriksaan, perPelayanan, perHari, perDiagnosis, perDokter, perOrgan] = await Promise.all([
      satu(
        `SELECT COUNT(DISTINCT o.uuid)::int AS jumlah_order, COUNT(DISTINCT o.patient_uuid)::int AS jumlah_pasien,
                COUNT(i.uuid)::int AS jumlah_kasus,
                COUNT(i.uuid) FILTER (WHERE i.no_pa IS NOT NULL)::int AS jumlah_diterima,
                COUNT(i.uuid) FILTER (WHERE i.status = 'ditolak')::int AS jumlah_ditolak,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS jumlah_selesai,
                COUNT(i.uuid) FILTER (WHERE i.status IN ('diterima', 'diproses', 'verifikasi'))::int AS dalam_proses,
                COUNT(i.uuid) FILTER (WHERE i.status = 'verifikasi')::int AS menunggu_verifikasi,
                COUNT(DISTINCT o.uuid) FILTER (WHERE o.cito)::int AS jumlah_cito,
                COUNT(DISTINCT o.uuid) FILTER (WHERE o.status = 'order')::int AS belum_validasi,
                ${GANAS} AS jumlah_ganas, ${PENDAPATAN} AS pendapatan, ${TAT} AS rerata_tat_hari, ${TEPAT} AS tepat_waktu, ${SELESAI} AS jumlah_tat
           ${dari} WHERE ${w}`,
        p,
      ),
      satu(`SELECT COUNT(*)::int n FROM pa_order o WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status = 'batal'
              AND ${tglLokal("o.created_at")} BETWEEN $2 AND $3`, p),
      query(
        `SELECT i.jenis, COUNT(i.uuid)::int AS jumlah, COUNT(DISTINCT o.patient_uuid)::int AS jumlah_pasien,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS selesai, COUNT(i.uuid) FILTER (WHERE i.status = 'ditolak')::int AS ditolak,
                ${GANAS} AS ganas, ${PENDAPATAN} AS pendapatan, ${TAT} AS rerata_tat_hari, ${TEPAT} AS tepat_waktu, ${SELESAI} AS jumlah_tat
           ${dari} WHERE ${w} GROUP BY i.jenis
          ORDER BY array_position(ARRAY['histopatologi','sitologi','potong_beku','ihk']::varchar[], i.jenis)`,
        p,
      ),
      query(
        `SELECT i.pemeriksaan_uuid, MAX(m.kode) AS kode, i.nama, i.jenis, MAX(i.tat_hari)::int AS target_hari, COUNT(i.uuid)::int AS jumlah,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS selesai, ${PENDAPATAN} AS pendapatan, ${TAT} AS rerata_tat_hari,
                ${TEPAT} AS tepat_waktu, ${SELESAI} AS jumlah_tat
           ${dari} LEFT JOIN pa_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
          WHERE ${w} GROUP BY i.pemeriksaan_uuid, i.nama, i.jenis ORDER BY jumlah DESC, i.nama`,
        p,
      ),
      query(
        `SELECT o.pelayanan, o.sumber, COUNT(DISTINCT o.uuid)::int AS jumlah_order, COUNT(i.uuid)::int AS jumlah_kasus, ${PENDAPATAN} AS pendapatan
           ${dari} WHERE ${w} GROUP BY o.pelayanan, o.sumber ORDER BY jumlah_order DESC`,
        p,
      ),
      query(
        `SELECT to_char(${tglLokal("o.created_at")}, 'YYYY-MM-DD') AS tanggal, COUNT(DISTINCT o.uuid)::int AS jumlah_order,
                COUNT(i.uuid)::int AS jumlah_kasus, ${PENDAPATAN} AS pendapatan
           ${dari} WHERE ${w} GROUP BY 1 ORDER BY 1`,
        p,
      ),
      // Diagnosis terbanyak (kasus terverifikasi): per kode ICD-O morfologi bila ada, selain itu teks diagnosis.
      query(
        `SELECT COALESCE(lp.icd_o_morfologi, '-') AS icd_o_morfologi, MAX(lp.icd10) AS icd10,
                MIN(split_part(lp.diagnosis, E'\\n', 1)) AS contoh_diagnosis, COUNT(*)::int AS jumlah,
                bool_or(lp.icd_o_morfologi ~ '/[36]$') AS ganas
           ${dari} WHERE ${w} AND i.status = 'selesai'
          GROUP BY COALESCE(lp.icd_o_morfologi, '-'), CASE WHEN lp.icd_o_morfologi IS NULL THEN lp.diagnosis END
          ORDER BY jumlah DESC LIMIT 15`,
        p,
      ),
      query(
        `SELECT COALESCE(lp.dokter_pa_nama, '-') AS dokter, COUNT(*)::int AS jumlah, ${TAT} AS rerata_tat_hari, ${TEPAT} AS tepat_waktu, ${SELESAI} AS jumlah_tat
           ${dari} WHERE ${w} AND i.status = 'selesai' GROUP BY 1 ORDER BY jumlah DESC`,
        p,
      ),
      query(
        `SELECT COALESCE(lp.icd_o_topografi, '-') AS icd_o_topografi, COUNT(*)::int AS jumlah, ${GANAS} AS ganas
           ${dari} WHERE ${w} AND i.status = 'selesai' GROUP BY 1 ORDER BY jumlah DESC LIMIT 15`,
        p,
      ),
    ]);
    kirim(res, {
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      ringkasan: { ...ringkasan, jumlah_batal: batal.n },
      per_jenis: perJenis.map((r) => ({ ...r, nama_jenis: JENIS[r.jenis]?.label ?? r.jenis })),
      per_pemeriksaan: perPemeriksaan.map((r) => ({ ...r, nama_jenis: JENIS[r.jenis]?.label ?? r.jenis })),
      per_pelayanan: perPelayanan,
      per_hari: perHari,
      per_diagnosis: perDiagnosis,
      per_dokter: perDokter,
      per_topografi: perOrgan,
    });
  }),
);

export default rute;
