import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah, wajib } from "../umum/respons.js";
import { izinKoding } from "../umum/izin.js";
import { ramah, teks, KEPUTUSAN_RETENSI } from "./bersama.js";

// Retensi & pemusnahan berkas rekam medis — /api/v3/penunjang/koding/retensi/...
//   /jenis-berkas          master jenis berkas & masa retensi aktif/inaktif (tahun) per faskes
//   /daftar                berkas yang memasuki tahap retensi (kunjungan terakhir + masa retensi aktif terlampaui)
//   /usulan                usulan pemusnahan & keputusan (disetujui/ditolak/ditunda) — bukan pelaksanaan pemusnahan
const rute = express.Router();
const TAHUN = 365 * 86400;

rute.get(
  "/retensi/jenis-berkas",
  izinKoding("Retensi", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    const [rows, total] = await Promise.all([
      query(`SELECT * FROM rm_jenis_berkas WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY nama LIMIT ${pg.limit} OFFSET ${pg.offset}`, p),
      satu(`SELECT COUNT(*)::int n FROM rm_jenis_berkas WHERE faskes_uuid = $1 AND deleted_at IS NULL`, p),
    ]);
    kirim(res, denganHalaman(rows, total.n, pg));
  }),
);

rute.post(
  "/retensi/jenis-berkas",
  izinKoding("Retensi", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["nama"]);
    const r = await sisipkan("rm_jenis_berkas", {
      faskes_uuid: req.author.faskesUuid, nama: teks(b.nama, 200),
      masa_retensi_aktif_tahun: Number(b.masa_retensi_aktif_tahun) || 5, masa_retensi_inaktif_tahun: Number(b.masa_retensi_inaktif_tahun) || 2,
      status: b.status !== false,
    }).catch((e) => ramah(e, "Nama jenis berkas sudah dipakai"));
    kirim(res, r, "Jenis berkas disimpan");
  }),
);

rute.put(
  "/retensi/jenis-berkas/:uuid",
  izinKoding("Retensi", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const r = await ubah("rm_jenis_berkas", req.params.uuid, req.author.faskesUuid, {
      nama: teks(b.nama, 200), masa_retensi_aktif_tahun: b.masa_retensi_aktif_tahun === undefined ? undefined : Number(b.masa_retensi_aktif_tahun),
      masa_retensi_inaktif_tahun: b.masa_retensi_inaktif_tahun === undefined ? undefined : Number(b.masa_retensi_inaktif_tahun), status: b.status,
    }).catch((e) => ramah(e, "Nama jenis berkas sudah dipakai"));
    if (!r) throw permintaanSalah("Jenis berkas tidak ditemukan");
    kirim(res, r, "Jenis berkas diperbarui");
  }),
);

// Berkas yang memasuki tahap retensi: kunjungan terakhir pasien (RJ/RI/IGD) sudah melewati masa retensi aktif jenis
// berkasnya. Daftar ini bersifat indikatif (dari tanggal kunjungan terakhir), bukan tanggal berkas difisikkan inaktif.
rute.get(
  "/retensi/daftar",
  izinKoding("Retensi", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const pg = halaman(req.query);
    const p = [faskes];
    let w = "jb.faskes_uuid = $1 AND jb.deleted_at IS NULL AND jb.status";
    if (req.query.jenis_berkas_uuid) {
      p.push(req.query.jenis_berkas_uuid);
      w += ` AND jb.uuid = $${p.length}`;
    }
    const dasar = `
      FROM rm_jenis_berkas jb
      CROSS JOIN LATERAL (
        SELECT k.no_rm, MAX(k.terakhir) AS kunjungan_terakhir FROM (
          SELECT no_rm, MAX(COALESCE(discharge_date, tanggal_daftar))::bigint AS terakhir FROM rawat_jalans WHERE faskes_uuid = jb.faskes_uuid AND deleted_at IS NULL GROUP BY no_rm
          UNION ALL
          SELECT no_rm, MAX(COALESCE(discharge_date, tanggal_daftar))::bigint FROM rawat_inaps WHERE faskes_uuid = jb.faskes_uuid AND deleted_at IS NULL GROUP BY no_rm
          UNION ALL
          SELECT no_rm, MAX(COALESCE(discharge_date, tanggal_daftar))::bigint FROM instalasi_gawat_darurats WHERE faskes_uuid = jb.faskes_uuid AND deleted_at IS NULL GROUP BY no_rm
        ) k GROUP BY k.no_rm
      ) r
      WHERE r.kunjungan_terakhir IS NOT NULL AND r.kunjungan_terakhir < EXTRACT(EPOCH FROM now())::bigint - jb.masa_retensi_aktif_tahun * ${TAHUN}
        AND NOT EXISTS (SELECT 1 FROM rm_retensi_usulan ru WHERE ru.faskes_uuid = jb.faskes_uuid AND ru.no_rm = r.no_rm AND ru.jenis_berkas_uuid = jb.uuid
                          AND ru.deleted_at IS NULL AND ru.keputusan IS DISTINCT FROM 'ditolak')`;
    const [rows, total] = await Promise.all([
      query(`SELECT r.no_rm, jb.uuid AS jenis_berkas_uuid, jb.nama AS jenis_berkas, r.kunjungan_terakhir ${dasar} AND ${w}
               ORDER BY r.kunjungan_terakhir LIMIT ${pg.limit} OFFSET ${pg.offset}`, p),
      satu(`SELECT COUNT(*)::int n ${dasar} AND ${w}`, p),
    ]);
    kirim(res, denganHalaman(rows, total.n, pg));
  }),
);

rute.get(
  "/retensi/usulan",
  izinKoding("Retensi", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const pg = halaman(req.query);
    const p = [faskes];
    let w = "ru.faskes_uuid = $1 AND ru.deleted_at IS NULL";
    if (req.query.status_keputusan === "diusulkan") w += " AND ru.keputusan IS NULL";
    else if (KEPUTUSAN_RETENSI.includes(req.query.status_keputusan)) {
      p.push(req.query.status_keputusan);
      w += ` AND ru.keputusan = $${p.length}`;
    }
    const dasar = `FROM rm_retensi_usulan ru JOIN rm_jenis_berkas jb ON jb.uuid = ru.jenis_berkas_uuid`;
    const [rows, total] = await Promise.all([
      query(`SELECT ru.*, jb.nama AS jenis_berkas ${dasar} WHERE ${w} ORDER BY ru.diusulkan_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p),
      satu(`SELECT COUNT(*)::int n ${dasar} WHERE ${w}`, p),
    ]);
    kirim(res, denganHalaman(rows, total.n, pg));
  }),
);

rute.post(
  "/retensi/usulan",
  izinKoding("Retensi", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["no_rm", "jenis_berkas_uuid"]);
    const jb = await satu(`SELECT * FROM rm_jenis_berkas WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.jenis_berkas_uuid, faskes]);
    if (!jb) throw permintaanSalah("Jenis berkas tidak ditemukan");
    const terakhir = await satu(
      `SELECT MAX(terakhir) AS terakhir FROM (
         SELECT MAX(COALESCE(discharge_date, tanggal_daftar))::bigint AS terakhir FROM rawat_jalans WHERE faskes_uuid = $1 AND no_rm = $2 AND deleted_at IS NULL
         UNION ALL SELECT MAX(COALESCE(discharge_date, tanggal_daftar))::bigint FROM rawat_inaps WHERE faskes_uuid = $1 AND no_rm = $2 AND deleted_at IS NULL
         UNION ALL SELECT MAX(COALESCE(discharge_date, tanggal_daftar))::bigint FROM instalasi_gawat_darurats WHERE faskes_uuid = $1 AND no_rm = $2 AND deleted_at IS NULL
       ) k`,
      [faskes, b.no_rm],
    );
    const batas = sekarang() - jb.masa_retensi_aktif_tahun * TAHUN;
    if (!terakhir?.terakhir || terakhir.terakhir >= batas) throw permintaanSalah("Berkas ini belum memenuhi masa retensi aktif, usulan ditolak");
    const r = await sisipkan("rm_retensi_usulan", {
      faskes_uuid: faskes, no_rm: teks(b.no_rm, 50), jenis_berkas_uuid: jb.uuid, alasan: teks(b.alasan) ?? null,
      diusulkan_oleh: req.author.username, diusulkan_at: sekarang(),
    });
    kirim(res, r, "Berkas diusulkan untuk pemusnahan");
  }),
);

rute.post(
  "/retensi/usulan/:uuid/keputusan",
  izinKoding("Retensi", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    if (!KEPUTUSAN_RETENSI.includes(b.keputusan)) throw permintaanSalah("Keputusan harus disetujui, ditolak, atau ditunda");
    const u = await satu(`SELECT * FROM rm_retensi_usulan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!u) throw permintaanSalah("Usulan tidak ditemukan");
    const r = await ubah("rm_retensi_usulan", u.uuid, faskes, {
      keputusan: b.keputusan, keputusan_oleh: req.author.username, keputusan_at: sekarang(),
      keputusan_alasan: teks(b.alasan) ?? null, berita_acara_ref: teks(b.berita_acara_ref) ?? null,
    });
    kirim(res, r, "Keputusan usulan retensi tersimpan");
  }),
);

export default rute;
