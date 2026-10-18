import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinSarpras } from "../umum/izin.js";
import { KATEGORI_ASET, STATUS_ASET, cekPilihan, periode } from "./bersama.js";
import { NAMA_PEGAWAI } from "./dasar.js";
import { batasKalibrasi } from "./kalibrasi.js";

// Laporan Sarpras (KF-17, fitur sarpras_laporan): daftar aset, riwayat per aset, kepatuhan pemeliharaan & kalibrasi,
// waktu respons perbaikan, biaya. Semua laporan disaring faskes dari token & filter permintaan (KT-20/KT-21); ekspor
// diunduh sebagai CSV sisi klien (LaporanPage.vue) karena layanan ini belum memakai pembuat Excel (exceljs).
const rute = express.Router();

rute.get(
  "/aset",
  izinSarpras("Laporan Sarpras", "READ"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "a.faskes_uuid = $1 AND a.deleted_at IS NULL";
    const kategori = cekPilihan(req.query.kategori || undefined, KATEGORI_ASET, "kategori");
    if (kategori) {
      p.push(kategori);
      w += ` AND a.kategori = $${p.length}`;
    }
    const status = cekPilihan(req.query.status || undefined, STATUS_ASET, "status");
    if (status) {
      p.push(status);
      w += ` AND a.status = $${p.length}`;
    }
    if (req.query.lokasi_uuid) {
      p.push(String(req.query.lokasi_uuid));
      w += ` AND a.lokasi_uuid = $${p.length}`;
    }
    const data = await query(
      `SELECT a.uuid, a.kode_inventaris, a.nama, a.kategori, a.status, a.merek, a.tipe, a.nomor_seri, a.tahun_perolehan,
              a.nilai_perolehan::float8 AS nilai_perolehan, a.wajib_kalibrasi, l.name AS nama_lokasi, ${NAMA_PEGAWAI("pg")} AS nama_penanggung_jawab
         FROM sarpras_aset a
         LEFT JOIN lokasi l ON l.uuid = a.lokasi_uuid AND l.faskes_uuid = a.faskes_uuid
         LEFT JOIN pegawai pg ON pg.uuid = a.penanggung_jawab_uuid AND pg.faskes_uuid = a.faskes_uuid
        WHERE ${w} ORDER BY a.kategori, a.nama LIMIT 10000`,
      p,
    );
    const ringkasan = await query(
      `SELECT a.kategori, a.status, COUNT(*)::int AS jumlah, COALESCE(SUM(a.nilai_perolehan), 0)::float8 AS total_nilai
         FROM sarpras_aset a WHERE ${w} GROUP BY a.kategori, a.status ORDER BY a.kategori, a.status`,
      p,
    );
    kirim(res, { data, ringkasan });
  }),
);

// Riwayat lengkap satu aset: data aset + peristiwa (riwayat), pemeliharaan, kerusakan, kalibrasi — urut waktu.
rute.get(
  "/riwayat-aset",
  izinSarpras("Laporan Sarpras", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    if (!req.query.aset_uuid) throw permintaanSalah("aset_uuid wajib diisi");
    const aset = await satu(
      `SELECT a.*, l.name AS nama_lokasi FROM sarpras_aset a LEFT JOIN lokasi l ON l.uuid = a.lokasi_uuid AND l.faskes_uuid = a.faskes_uuid
        WHERE a.uuid = $1 AND a.faskes_uuid = $2 AND a.deleted_at IS NULL`,
      [String(req.query.aset_uuid), f],
    );
    if (!aset) throw tidakDitemukan("Aset");
    const p = [aset.uuid, f];
    const [peristiwa, pemeliharaan, kerusakan, kalibrasi] = await Promise.all([
      query(`SELECT jenis_peristiwa, data_perubahan, pengguna, waktu_peristiwa FROM sarpras_riwayat_aset WHERE aset_uuid = $1 AND faskes_uuid = $2 ORDER BY waktu_peristiwa, uuid`, p),
      query(
        `SELECT x.uuid, x.waktu_mulai, x.waktu_selesai, x.hasil, x.catatan, x.biaya::float8 AS biaya, x.terlambat, x.jatuh_tempo, j.frekuensi, ${NAMA_PEGAWAI("pg")} AS nama_pelaksana
           FROM sarpras_pelaksanaan_pemeliharaan x JOIN sarpras_jadwal_pemeliharaan j ON j.uuid = x.jadwal_uuid
           LEFT JOIN pegawai pg ON pg.uuid = x.pelaksana_uuid AND pg.faskes_uuid = x.faskes_uuid
          WHERE x.aset_uuid = $1 AND x.faskes_uuid = $2 AND x.deleted_at IS NULL ORDER BY x.waktu_mulai`,
        p,
      ),
      query(
        `SELECT w.uuid, w.nomor_laporan, w.uraian, w.prioritas, w.status, w.waktu_laporan, w.waktu_penugasan, w.waktu_selesai, w.tindakan, w.hasil,
                w.biaya::float8 AS biaya, ${NAMA_PEGAWAI("pg")} AS nama_teknisi,
                (SELECT COALESCE(SUM(s.biaya), 0)::float8 FROM sarpras_suku_cadang s WHERE s.laporan_uuid = w.uuid AND s.deleted_at IS NULL) AS biaya_suku_cadang
           FROM sarpras_laporan_kerusakan w LEFT JOIN pegawai pg ON pg.uuid = w.teknisi_uuid AND pg.faskes_uuid = w.faskes_uuid
          WHERE w.aset_uuid = $1 AND w.faskes_uuid = $2 AND w.deleted_at IS NULL ORDER BY w.waktu_laporan`,
        p,
      ),
      query(
        `SELECT uuid, lembaga_penguji, tanggal_jadwal, tanggal_kalibrasi, hasil, nomor_sertifikat, tanggal_berlaku, catatan_tindak_lanjut
           FROM sarpras_kalibrasi WHERE aset_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY COALESCE(tanggal_kalibrasi, tanggal_jadwal)`,
        p,
      ),
    ]);
    kirim(res, { aset, peristiwa, pemeliharaan, kerusakan, kalibrasi });
  }),
);

// Kepatuhan pemeliharaan per aset dalam periode: pelaksanaan tepat waktu vs terlambat + jadwal aktif yang terlambat kini.
rute.get(
  "/kepatuhan-pemeliharaan",
  izinSarpras("Laporan Sarpras", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { mulai, selesai } = periode(req.query, true);
    const { hariIni } = await batasKalibrasi(f);
    const data = await query(
      `SELECT a.uuid AS aset_uuid, a.kode_inventaris, a.nama AS nama_aset, a.kategori,
              COUNT(x.uuid)::int AS jumlah_pelaksanaan,
              COUNT(x.uuid) FILTER (WHERE NOT x.terlambat)::int AS tepat_waktu,
              COUNT(x.uuid) FILTER (WHERE x.terlambat)::int AS terlambat,
              (SELECT COUNT(*)::int FROM sarpras_jadwal_pemeliharaan j WHERE j.aset_uuid = a.uuid AND j.faskes_uuid = a.faskes_uuid
                  AND j.status = 'aktif' AND j.deleted_at IS NULL AND j.tanggal_berikutnya < $4) AS jadwal_terlambat_kini
         FROM sarpras_aset a
         JOIN sarpras_jadwal_pemeliharaan jj ON jj.aset_uuid = a.uuid AND jj.faskes_uuid = a.faskes_uuid AND jj.deleted_at IS NULL
         LEFT JOIN sarpras_pelaksanaan_pemeliharaan x ON x.jadwal_uuid = jj.uuid AND x.deleted_at IS NULL AND x.waktu_mulai BETWEEN $2 AND $3
        WHERE a.faskes_uuid = $1 AND a.deleted_at IS NULL
        GROUP BY a.uuid, a.kode_inventaris, a.nama, a.kategori ORDER BY a.kategori, a.nama`,
      [f, mulai, selesai, hariIni],
    );
    const total = data.reduce((s, r) => ({ pelaksanaan: s.pelaksanaan + r.jumlah_pelaksanaan, tepat_waktu: s.tepat_waktu + r.tepat_waktu, terlambat: s.terlambat + r.terlambat }), {
      pelaksanaan: 0,
      tepat_waktu: 0,
      terlambat: 0,
    });
    kirim(res, { periode: { mulai, selesai }, data, total: { ...total, persen_tepat_waktu: total.pelaksanaan ? Math.round((total.tepat_waktu / total.pelaksanaan) * 1000) / 10 : null } });
  }),
);

// Kepatuhan kalibrasi: setiap aset wajib kalibrasi dengan status catatan terealisasi terbaru (belum ada / berlaku /
// jatuh tempo / kedaluwarsa) dan rencana terdekat.
rute.get(
  "/kepatuhan-kalibrasi",
  izinSarpras("Laporan Sarpras", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { ambang, hariIni, batas } = await batasKalibrasi(f);
    const data = await query(
      `SELECT a.uuid AS aset_uuid, a.kode_inventaris, a.nama AS nama_aset, a.status AS status_aset, l.name AS nama_lokasi,
              t.tanggal_kalibrasi, t.hasil, t.nomor_sertifikat, t.tanggal_berlaku, t.lembaga_penguji,
              (SELECT MIN(r.tanggal_jadwal) FROM sarpras_kalibrasi r WHERE r.aset_uuid = a.uuid AND r.faskes_uuid = a.faskes_uuid
                  AND r.tanggal_kalibrasi IS NULL AND r.deleted_at IS NULL) AS rencana_berikutnya,
              CASE WHEN t.uuid IS NULL THEN 'belum_ada' WHEN t.tanggal_berlaku IS NULL THEN 'tanpa_masa_berlaku'
                   WHEN t.tanggal_berlaku < $2 THEN 'kedaluwarsa' WHEN t.tanggal_berlaku <= $3 THEN 'jatuh_tempo' ELSE 'berlaku' END AS status_kalibrasi
         FROM sarpras_aset a
         LEFT JOIN lokasi l ON l.uuid = a.lokasi_uuid AND l.faskes_uuid = a.faskes_uuid
         LEFT JOIN LATERAL (SELECT k.* FROM sarpras_kalibrasi k WHERE k.aset_uuid = a.uuid AND k.faskes_uuid = a.faskes_uuid
                              AND k.tanggal_kalibrasi IS NOT NULL AND k.deleted_at IS NULL ORDER BY k.tanggal_kalibrasi DESC, k.uuid DESC LIMIT 1) t ON true
        WHERE a.faskes_uuid = $1 AND a.deleted_at IS NULL AND a.wajib_kalibrasi = true AND a.status <> 'dihapuskan'
        ORDER BY CASE WHEN t.uuid IS NULL THEN 0 WHEN t.tanggal_berlaku < $2 THEN 1 WHEN t.tanggal_berlaku <= $3 THEN 2 ELSE 3 END, a.nama`,
      [f, hariIni, batas],
    );
    const ringkasan = data.reduce((s, r) => ({ ...s, [r.status_kalibrasi]: (s[r.status_kalibrasi] ?? 0) + 1 }), {});
    kirim(res, { ambang_kalibrasi_hari: ambang, data, ringkasan: { total: data.length, ...ringkasan } });
  }),
);

// Waktu respons (penugasan − laporan) & penyelesaian (selesai − laporan) rata-rata per prioritas, dalam detik.
rute.get(
  "/respons-perbaikan",
  izinSarpras("Laporan Sarpras", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { mulai, selesai } = periode(req.query, true);
    const data = await query(
      `SELECT w.prioritas, COUNT(*)::int AS jumlah,
              COUNT(*) FILTER (WHERE w.status IN ('baru','diproses','menunggu_suku_cadang'))::int AS terbuka,
              COUNT(*) FILTER (WHERE w.status = 'selesai')::int AS selesai,
              COUNT(*) FILTER (WHERE w.status = 'tidak_dapat_diperbaiki')::int AS tidak_dapat_diperbaiki,
              AVG(w.waktu_penugasan - w.waktu_laporan) FILTER (WHERE w.waktu_penugasan IS NOT NULL)::float8 AS rata_rata_respons,
              AVG(w.waktu_selesai - w.waktu_laporan) FILTER (WHERE w.waktu_selesai IS NOT NULL)::float8 AS rata_rata_penyelesaian
         FROM sarpras_laporan_kerusakan w
        WHERE w.faskes_uuid = $1 AND w.deleted_at IS NULL AND w.waktu_laporan BETWEEN $2 AND $3
        GROUP BY w.prioritas ORDER BY CASE w.prioritas WHEN 'darurat' THEN 0 WHEN 'tinggi' THEN 1 WHEN 'sedang' THEN 2 ELSE 3 END`,
      [f, mulai, selesai],
    );
    kirim(res, { periode: { mulai, selesai }, data });
  }),
);

// Biaya pemeliharaan (pelaksanaan) + perbaikan (laporan ditutup) + suku cadang per aset dalam periode.
rute.get(
  "/biaya-pemeliharaan",
  izinSarpras("Laporan Sarpras", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const { mulai, selesai } = periode(req.query, true);
    const data = await query(
      `SELECT a.uuid AS aset_uuid, a.kode_inventaris, a.nama AS nama_aset, a.kategori,
              COALESCE(pm.biaya, 0)::float8 AS biaya_pemeliharaan, COALESCE(pr.biaya, 0)::float8 AS biaya_perbaikan,
              COALESCE(sc.biaya, 0)::float8 AS biaya_suku_cadang,
              (COALESCE(pm.biaya, 0) + COALESCE(pr.biaya, 0) + COALESCE(sc.biaya, 0))::float8 AS total
         FROM sarpras_aset a
         LEFT JOIN (SELECT aset_uuid, SUM(biaya) biaya FROM sarpras_pelaksanaan_pemeliharaan
                     WHERE faskes_uuid = $1 AND deleted_at IS NULL AND waktu_mulai BETWEEN $2 AND $3 GROUP BY aset_uuid) pm ON pm.aset_uuid = a.uuid
         LEFT JOIN (SELECT aset_uuid, SUM(biaya) biaya FROM sarpras_laporan_kerusakan
                     WHERE faskes_uuid = $1 AND deleted_at IS NULL AND waktu_selesai BETWEEN $2 AND $3 GROUP BY aset_uuid) pr ON pr.aset_uuid = a.uuid
         LEFT JOIN (SELECT w.aset_uuid, SUM(s.biaya) biaya FROM sarpras_suku_cadang s
                      JOIN sarpras_laporan_kerusakan w ON w.uuid = s.laporan_uuid AND w.faskes_uuid = s.faskes_uuid
                     WHERE s.faskes_uuid = $1 AND s.deleted_at IS NULL AND s.created_at BETWEEN $2 AND $3 GROUP BY w.aset_uuid) sc ON sc.aset_uuid = a.uuid
        WHERE a.faskes_uuid = $1 AND a.deleted_at IS NULL AND (pm.biaya IS NOT NULL OR pr.biaya IS NOT NULL OR sc.biaya IS NOT NULL)
        ORDER BY total DESC, a.nama`,
      [f, mulai, selesai],
    );
    const perKategori = Object.values(
      data.reduce((s, r) => {
        const x = (s[r.kategori] ??= { kategori: r.kategori, biaya_pemeliharaan: 0, biaya_perbaikan: 0, biaya_suku_cadang: 0, total: 0 });
        for (const k of ["biaya_pemeliharaan", "biaya_perbaikan", "biaya_suku_cadang", "total"]) x[k] += r[k];
        return s;
      }, {}),
    );
    kirim(res, { periode: { mulai, selesai }, data, per_kategori: perKategori, total: data.reduce((s, r) => s + r.total, 0) });
  }),
);

export default rute;
