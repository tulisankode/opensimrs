import express from "express";
import { query, satu } from "../db.js";
import { tangani, kirim, halaman, denganHalaman } from "../umum/respons.js";
import { izinKoding } from "../umum/izin.js";
import { KUNJUNGAN_TIPE, TARGET_KODING_DETIK, daftarNilai, hariIni, tanggalValid, tglLokal, unionKunjungan } from "./bersama.js";

// Laporan Koding Rekam Medis — /api/v3/penunjang/koding/laporan/...
// Semua laporan hanya memakai hasil koding terverifikasi (koding_kunjungan.status = 'siap_klaim'); diagnosis belum
// difinalisasi tidak dihitung (PRD KT-15).
const rute = express.Router();

const rentang = (q) => {
  const mulai = tanggalValid(q.tanggal_mulai || hariIni(), "tanggal_mulai");
  const selesai = tanggalValid(q.tanggal_sampai || mulai, "tanggal_sampai");
  return { mulai, selesai };
};

// Diagnosis/tindakan terverifikasi (versi terbaru kunjungan yang sudah siap_klaim) dalam rentang finalisasi.
const DASAR_FINAL = `
  FROM koding_kunjungan kk
  JOIN koding_diagnosis kd ON kd.koding_kunjungan_uuid = kk.uuid AND kd.versi = kk.versi_terakhir
  WHERE kk.faskes_uuid = $1 AND kk.deleted_at IS NULL AND kk.status = 'siap_klaim'
    AND ${tglLokal("kk.finalisasi_at")} BETWEEN $2 AND $3`;

rute.get(
  "/laporan/indeks",
  izinKoding("Laporan Koding", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const { mulai, selesai } = rentang(req.query);
    const pg = halaman(req.query);
    const jenis = req.query.jenis === "tindakan" ? "tindakan" : "diagnosis";
    const p = [faskes, mulai, selesai];
    let dasar;
    if (jenis === "tindakan") {
      dasar = `FROM koding_kunjungan kk JOIN koding_tindakan kt ON kt.koding_kunjungan_uuid = kk.uuid AND kt.versi = kk.versi_terakhir
                WHERE kk.faskes_uuid = $1 AND kk.deleted_at IS NULL AND kk.status = 'siap_klaim' AND ${tglLokal("kk.finalisasi_at")} BETWEEN $2 AND $3`;
    } else {
      dasar = DASAR_FINAL;
    }
    const kolomKode = jenis === "tindakan" ? "kt.kode" : "kd.kode";
    const kolomNama = jenis === "tindakan" ? "kt.nama" : "kd.nama";
    let w = "";
    if (req.query.kode) {
      p.push(`%${req.query.kode}%`);
      w = ` AND (${kolomKode} ILIKE $${p.length} OR ${kolomNama} ILIKE $${p.length})`;
    }
    const [rows, total] = await Promise.all([
      query(
        `SELECT ${kolomKode} AS kode, ${kolomNama} AS nama, COUNT(*)::int AS jumlah
           ${dasar}${w} GROUP BY ${kolomKode}, ${kolomNama} ORDER BY jumlah DESC, kode LIMIT ${pg.limit} OFFSET ${pg.offset}`,
        p,
      ),
      satu(`SELECT COUNT(DISTINCT ${kolomKode})::int n ${dasar}${w}`, p),
    ]);
    kirim(res, denganHalaman(rows, total.n, pg));
  }),
);

rute.get(
  "/laporan/sepuluh-besar",
  izinKoding("Laporan Koding", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const { mulai, selesai } = rentang(req.query);
    const jenis = daftarNilai(req.query.jenis_kunjungan).filter((t) => KUNJUNGAN_TIPE.includes(t));
    const p = [faskes, mulai, selesai];
    let w = "";
    if (jenis.length) {
      p.push(jenis);
      w = ` AND kk.kunjungan_tipe = ANY($${p.length})`;
    }
    const rows = await query(
      `SELECT kd.kode, kd.nama, COUNT(*)::int AS jumlah
         ${DASAR_FINAL}${w} AND kd.peran = 'utama'
        GROUP BY kd.kode, kd.nama ORDER BY jumlah DESC, kd.kode LIMIT 10`,
      p,
    );
    kirim(res, rows);
  }),
);

// Data morbiditas (10 besar per jenis kunjungan) & mortalitas (kondisi_pasien_pulang menandakan meninggal) berbasis
// kode terverifikasi. Pemetaan baku RL Kemenkes perlu ditetapkan pemilik laporan (lihat PRD, pertanyaan terbuka #7).
rute.get(
  "/laporan/rl",
  izinKoding("Laporan Koding", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const { mulai, selesai } = rentang(req.query);
    const p = [faskes, mulai, selesai];
    const sumber = unionKunjungan("uuid AS kunjungan_uuid, gender, kondisi_pasien_pulang");
    const [morbiditas, mortalitas] = await Promise.all([
      query(
        `SELECT kk.kunjungan_tipe, kd.kode, kd.nama, s.gender, COUNT(*)::int AS jumlah
           ${DASAR_FINAL}
           JOIN (${sumber}) s ON s.kunjungan_tipe = kk.kunjungan_tipe AND s.kunjungan_uuid = kk.kunjungan_uuid
          WHERE kd.peran = 'utama'
          GROUP BY kk.kunjungan_tipe, kd.kode, kd.nama, s.gender ORDER BY jumlah DESC`,
        p,
      ),
      query(
        `SELECT kd.kode, kd.nama, COUNT(*)::int AS jumlah
           ${DASAR_FINAL}
           JOIN (${sumber}) s ON s.kunjungan_tipe = kk.kunjungan_tipe AND s.kunjungan_uuid = kk.kunjungan_uuid
          WHERE kd.peran = 'utama' AND s.kondisi_pasien_pulang ILIKE '%meninggal%'
          GROUP BY kd.kode, kd.nama ORDER BY jumlah DESC`,
        p,
      ),
    ]);
    kirim(res, { morbiditas, mortalitas });
  }),
);

rute.get(
  "/laporan/produktivitas-koder",
  izinKoding("Laporan Koding", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const { mulai, selesai } = rentang(req.query);
    const p = [faskes, mulai, selesai];
    let w = "";
    if (req.query.koder_uuid) {
      p.push(req.query.koder_uuid);
      w = ` AND kk.koder_uuid = $${p.length}`;
    }
    const rows = await query(
      `SELECT kk.koder_uuid, COUNT(*)::int AS jumlah_finalisasi,
              ROUND(AVG(kk.finalisasi_at - COALESCE(s.discharge_date, kk.finalisasi_at)))::int AS rerata_waktu_koding_detik
         FROM koding_kunjungan kk
         JOIN (${unionKunjungan("uuid AS kunjungan_uuid, discharge_date")}) s
           ON s.kunjungan_tipe = kk.kunjungan_tipe AND s.kunjungan_uuid = kk.kunjungan_uuid
        WHERE kk.faskes_uuid = $1 AND kk.deleted_at IS NULL AND kk.status = 'siap_klaim'
          AND ${tglLokal("kk.finalisasi_at")} BETWEEN $2 AND $3${w}
        GROUP BY kk.koder_uuid ORDER BY jumlah_finalisasi DESC`,
      p,
    );
    kirim(res, rows);
  }),
);

// Dasbor kepala instalasi RM: capaian target koding RI (≤ 2×24 jam), antrean belum dikoding, rekap checklist terbuka.
rute.get(
  "/laporan/dasbor",
  izinKoding("Laporan Koding", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const { mulai, selesai } = rentang(req.query);
    const p = [faskes, mulai, selesai];
    const sumberRi = unionKunjungan("uuid AS kunjungan_uuid, discharge_date, status_pulang");

    const [capaianRi, antrean, checklistTerbuka] = await Promise.all([
      satu(
        `SELECT COUNT(*)::int AS jumlah_final,
                COUNT(*) FILTER (WHERE kk.finalisasi_at - s.discharge_date <= ${TARGET_KODING_DETIK})::int AS tepat_waktu
           FROM koding_kunjungan kk
           JOIN (${sumberRi}) s ON s.kunjungan_tipe = kk.kunjungan_tipe AND s.kunjungan_uuid = kk.kunjungan_uuid
          WHERE kk.faskes_uuid = $1 AND kk.deleted_at IS NULL AND kk.status = 'siap_klaim' AND kk.kunjungan_tipe = 'ri'
            AND ${tglLokal("kk.finalisasi_at")} BETWEEN $2 AND $3`,
        p,
      ),
      satu(
        `SELECT COUNT(*) FILTER (WHERE kk.uuid IS NULL OR kk.status = 'proses')::int AS belum_dikoding
           FROM (${unionKunjungan("uuid AS kunjungan_uuid, discharge_date, status_pulang, faskes_uuid")}) s
           LEFT JOIN koding_kunjungan kk ON kk.faskes_uuid = s.faskes_uuid AND kk.kunjungan_tipe = s.kunjungan_tipe
             AND kk.kunjungan_uuid = s.kunjungan_uuid AND kk.deleted_at IS NULL
          WHERE s.faskes_uuid = $1 AND s.status_pulang IS NOT NULL AND s.status_pulang <> ''
            AND ${tglLokal("s.discharge_date")} BETWEEN $2 AND $3`,
        p,
      ),
      satu(
        `SELECT COUNT(*) FILTER (WHERE COALESCE(ck.status, 'tidak_lengkap') = 'tidak_lengkap')::int AS item_tidak_lengkap
           FROM koding_kunjungan kk
           JOIN koding_checklist_item ci ON ci.faskes_uuid = kk.faskes_uuid AND ci.status AND ci.wajib
             AND (ci.berlaku_kunjungan_tipe IS NULL OR kk.kunjungan_tipe = ANY(ci.berlaku_kunjungan_tipe))
           LEFT JOIN koding_checklist_kunjungan ck ON ck.checklist_item_uuid = ci.uuid AND ck.koding_kunjungan_uuid = kk.uuid
          WHERE kk.faskes_uuid = $1 AND kk.deleted_at IS NULL AND kk.status = 'proses'`,
        [faskes],
      ),
    ]);

    kirim(res, {
      target_koding_detik: TARGET_KODING_DETIK,
      koding_ri: { jumlah_final: capaianRi.jumlah_final, tepat_waktu: capaianRi.tepat_waktu },
      belum_dikoding: antrean.belum_dikoding,
      checklist_item_tidak_lengkap: checklistTerbuka.item_tidak_lengkap,
    });
  }),
);

export default rute;
