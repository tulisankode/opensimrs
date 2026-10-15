import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { MODALITAS, hariIni, tanggalValid, tglLokal } from "./bersama.js";

// Laporan Kunjungan Radiologi: rentang tanggal order (zona Asia/Jakarta), order batal tidak dihitung.
// Pendapatan = tarif item order yang ditagihkan (status valid/diperiksa/selesai, bukan tanpa_tagihan seperti MCU).
// Item dari paket menyimpan harga alokasi (jumlah per order = harga paket), sehingga total pendapatan tetap benar.
const rute = express.Router();

rute.get(
  "/kunjungan",
  tangani(async (req, res) => {
    const mulai = tanggalValid(req.query.tanggal_mulai || hariIni(), "tanggal_mulai");
    const selesai = tanggalValid(req.query.tanggal_selesai || mulai, "tanggal_selesai");
    const p = [req.author.faskesUuid, mulai, selesai];
    const w = `o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status <> 'batal' AND ${tglLokal("o.created_at")} BETWEEN $2 AND $3`;
    const PENDAPATAN = `COALESCE(SUM(i.harga) FILTER (WHERE NOT o.tanpa_tagihan AND o.status <> 'order'), 0)::float8`;
    const dari = `FROM rad_order o JOIN rad_order_item i ON i.order_uuid = o.uuid AND i.deleted_at IS NULL`;

    // Waktu tunggu hasil (TAT, menit): validasi order (atau waktu order) → expertise selesai; respons baca: periksa → expertise.
    const TAT = `ROUND(AVG((i.waktu_hasil - COALESCE(o.divalidasi_pada, o.created_at)) / 60.0) FILTER (WHERE i.status = 'selesai' AND i.waktu_hasil IS NOT NULL))::float8`;
    const BACA = `ROUND(AVG((i.waktu_hasil - i.waktu_periksa) / 60.0) FILTER (WHERE i.status = 'selesai' AND i.waktu_hasil IS NOT NULL AND i.waktu_periksa IS NOT NULL))::float8`;
    const [ringkasan, batal, perModalitas, perPemeriksaan, perPelayanan, perHari, perPaket, perRuang, jadwal] = await Promise.all([
      satu(
        `SELECT COUNT(DISTINCT o.uuid)::int AS jumlah_order, COUNT(DISTINCT o.patient_uuid)::int AS jumlah_pasien,
                COUNT(i.uuid)::int AS jumlah_pemeriksaan,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS jumlah_selesai,
                COUNT(DISTINCT o.uuid) FILTER (WHERE o.cito)::int AS jumlah_cito,
                COUNT(DISTINCT o.uuid) FILTER (WHERE o.status = 'order')::int AS belum_validasi,
                ${PENDAPATAN} AS pendapatan, ${TAT} AS rerata_tat_menit, ${BACA} AS rerata_baca_menit
           ${dari} WHERE ${w}`,
        p,
      ),
      satu(`SELECT COUNT(*)::int n FROM rad_order o WHERE o.faskes_uuid = $1 AND o.deleted_at IS NULL AND o.status = 'batal'
              AND ${tglLokal("o.created_at")} BETWEEN $2 AND $3`, p),
      query(
        `SELECT i.modalitas, COUNT(i.uuid)::int AS jumlah, COUNT(DISTINCT o.patient_uuid)::int AS jumlah_pasien, ${PENDAPATAN} AS pendapatan,
                ${TAT} AS rerata_tat_menit, ${BACA} AS rerata_baca_menit
           ${dari} WHERE ${w} GROUP BY i.modalitas ORDER BY jumlah DESC, i.modalitas`,
        p,
      ),
      query(
        `SELECT i.pemeriksaan_uuid, MAX(m.kode) AS kode, i.nama, i.modalitas, COUNT(i.uuid)::int AS jumlah,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS selesai, ${PENDAPATAN} AS pendapatan
           ${dari} LEFT JOIN rad_pemeriksaan m ON m.uuid = i.pemeriksaan_uuid
          WHERE ${w} GROUP BY i.pemeriksaan_uuid, i.nama, i.modalitas ORDER BY jumlah DESC, i.nama`,
        p,
      ),
      query(
        `SELECT o.pelayanan, COUNT(DISTINCT o.uuid)::int AS jumlah_order, COUNT(i.uuid)::int AS jumlah_pemeriksaan, ${PENDAPATAN} AS pendapatan
           ${dari} WHERE ${w} GROUP BY o.pelayanan ORDER BY jumlah_order DESC`,
        p,
      ),
      query(
        `SELECT to_char(${tglLokal("o.created_at")}, 'YYYY-MM-DD') AS tanggal, COUNT(DISTINCT o.uuid)::int AS jumlah_order,
                COUNT(i.uuid)::int AS jumlah_pemeriksaan, ${PENDAPATAN} AS pendapatan
           ${dari} WHERE ${w} GROUP BY 1 ORDER BY 1`,
        p,
      ),
      // Rekap paket: jumlah order yang memakai paket & pendapatannya (item non-paket tidak dihitung).
      query(
        `SELECT i.paket_uuid, MAX(pk.kode) AS kode, MAX(pk.nama) AS nama, COUNT(DISTINCT o.uuid)::int AS jumlah_order,
                COUNT(i.uuid)::int AS jumlah_pemeriksaan, ${PENDAPATAN} AS pendapatan
           ${dari} JOIN rad_paket pk ON pk.uuid = i.paket_uuid
          WHERE ${w} GROUP BY i.paket_uuid ORDER BY jumlah_order DESC, nama`,
        p,
      ),
      // Per ruang/alat: ruang tempat diperiksa, atau ruang jadwal bila belum diperiksa; null = belum ditentukan.
      query(
        `SELECT r.uuid AS ruang_uuid, r.kode, r.nama, r.nama_alat, COUNT(i.uuid)::int AS jumlah, COUNT(DISTINCT o.patient_uuid)::int AS jumlah_pasien,
                COUNT(i.uuid) FILTER (WHERE i.status = 'selesai')::int AS selesai, ${PENDAPATAN} AS pendapatan, ${TAT} AS rerata_tat_menit
           ${dari} LEFT JOIN rad_jadwal j ON j.uuid = i.jadwal_uuid AND j.status <> 'batal' AND j.deleted_at IS NULL
           LEFT JOIN rad_ruang r ON r.uuid = COALESCE(i.ruang_uuid, j.ruang_uuid)
          WHERE ${w} GROUP BY r.uuid ORDER BY r.kode NULLS LAST`,
        p,
      ),
      // Penjadwalan per ruang: tanggal jadwal dalam rentang (bukan tanggal order).
      query(
        `SELECT r.uuid AS ruang_uuid, r.kode, r.nama, COUNT(j.uuid)::int AS jumlah_jadwal,
                COUNT(j.uuid) FILTER (WHERE j.status = 'terjadwal')::int AS terjadwal,
                COUNT(j.uuid) FILTER (WHERE j.status = 'hadir')::int AS hadir,
                COUNT(j.uuid) FILTER (WHERE j.status = 'diperiksa')::int AS diperiksa,
                COUNT(j.uuid) FILTER (WHERE j.status = 'batal')::int AS batal,
                COUNT(j.uuid) FILTER (WHERE j.segera)::int AS segera,
                ROUND(AVG((j.waktu_hadir - EXTRACT(EPOCH FROM ((j.tanggal + j.jam_mulai) AT TIME ZONE 'Asia/Jakarta'))) / 60.0)
                      FILTER (WHERE j.waktu_hadir IS NOT NULL))::float8 AS rerata_selisih_hadir_menit
           FROM rad_jadwal j JOIN rad_ruang r ON r.uuid = j.ruang_uuid
          WHERE j.faskes_uuid = $1 AND j.deleted_at IS NULL AND j.tanggal BETWEEN $2 AND $3
          GROUP BY r.uuid ORDER BY r.kode`,
        p,
      ),
    ]);
    kirim(res, {
      tanggal_mulai: mulai,
      tanggal_selesai: selesai,
      ringkasan: { ...ringkasan, jumlah_batal: batal.n },
      per_modalitas: perModalitas.map((r) => ({ ...r, nama_modalitas: MODALITAS[r.modalitas] ?? r.modalitas })),
      per_pemeriksaan: perPemeriksaan.map((r) => ({ ...r, nama_modalitas: MODALITAS[r.modalitas] ?? r.modalitas })),
      per_pelayanan: perPelayanan,
      per_hari: perHari,
      per_paket: perPaket,
      per_ruang: perRuang,
      jadwal_per_ruang: jadwal,
    });
  }),
);

export default rute;
