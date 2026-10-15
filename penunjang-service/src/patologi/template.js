import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { JENIS, ramah, daftarNilai, icdoMorfologi, icdoTopografi } from "./bersama.js";
import { izinPa } from "../umum/izin.js";

// Datamaster Template Laporan PA: kasus normal/umum (mis. "Pap smear NILM", "Appendisitis akut", "Fibroadenoma
// mammae") berisi makroskopis, mikroskopis, diagnosis + kode ICD-O/ICD-10 untuk mempercepat pengisian laporan.
// Template terikat ke satu pemeriksaan (paling spesifik), satu jenis, atau umum (keduanya kosong).
// GET /?untuk_pemeriksaan=<uuid> → template aktif yang cocok: pemeriksaan tsb → jenisnya → umum.
const rute = express.Router();

const PILIH = `t.uuid, t.nama, t.jenis, t.pemeriksaan_uuid, t.makroskopis, t.mikroskopis, t.diagnosis, t.icd_o_topografi,
  t.icd_o_morfologi, t.icd10, t.komentar, t.status, t.created_at, t.updated_at,
  m.kode AS pemeriksaan_kode, m.nama AS pemeriksaan_nama, COALESCE(t.jenis, m.jenis) AS jenis_efektif`;
const DARI = `pa_template t LEFT JOIN pa_pemeriksaan m ON m.uuid = t.pemeriksaan_uuid`;

const KOLOM = async (b, faskes) => {
  const t = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);
  const k = {
    nama: b.nama === undefined ? undefined : String(b.nama ?? "").trim(),
    makroskopis: t(b.makroskopis),
    mikroskopis: t(b.mikroskopis),
    diagnosis: b.diagnosis === undefined ? undefined : String(b.diagnosis ?? "").trim(),
    icd_o_topografi: icdoTopografi(b.icd_o_topografi),
    icd_o_morfologi: icdoMorfologi(b.icd_o_morfologi),
    icd10: t(b.icd10),
    komentar: t(b.komentar),
  };
  if (k.nama === "") throw permintaanSalah("nama tidak boleh kosong");
  if (k.diagnosis === "") throw permintaanSalah("diagnosis tidak boleh kosong");
  if (b.pemeriksaan_uuid !== undefined) {
    k.pemeriksaan_uuid = b.pemeriksaan_uuid || null;
    if (k.pemeriksaan_uuid) {
      const m = await satu(`SELECT jenis FROM pa_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [k.pemeriksaan_uuid, faskes]);
      if (!m) throw permintaanSalah("Pemeriksaan tidak ditemukan");
      k.jenis = m.jenis;
    }
  }
  if (b.jenis !== undefined && !k.pemeriksaan_uuid) {
    if (b.jenis && !JENIS[b.jenis]) throw permintaanSalah("jenis tidak dikenal");
    k.jenis = b.jenis || null;
  }
  if (b.status !== undefined) k.status = Boolean(b.status);
  return k;
};

rute.get(
  "/",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    // Mode pilihan untuk dialog laporan: template aktif yang cocok, urut paling spesifik.
    if (req.query.untuk_pemeriksaan) {
      const m = await satu(`SELECT uuid, jenis FROM pa_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2`, [req.query.untuk_pemeriksaan, f]);
      const rows = await query(
        `SELECT ${PILIH}, CASE WHEN t.pemeriksaan_uuid = $2 THEN 0 WHEN t.pemeriksaan_uuid IS NULL AND t.jenis = $3 THEN 1 ELSE 2 END AS tingkat
           FROM ${DARI}
          WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.status
            AND (t.pemeriksaan_uuid = $2 OR (t.pemeriksaan_uuid IS NULL AND (t.jenis = $3 OR t.jenis IS NULL)))
          ORDER BY tingkat, t.nama`,
        [f, m?.uuid ?? null, m?.jenis ?? null],
      );
      return kirim(res, rows);
    }
    const pg = halaman(req.query);
    const p = [f];
    let w = "t.faskes_uuid = $1 AND t.deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (t.nama ILIKE $${p.length} OR m.nama ILIKE $${p.length} OR t.diagnosis ILIKE $${p.length})`;
    }
    const jenis = daftarNilai(req.query.jenis).filter((j) => JENIS[j]);
    if (jenis.length) {
      p.push(jenis);
      w += ` AND COALESCE(t.jenis, m.jenis) = ANY($${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM ${DARI} WHERE ${w}
        ORDER BY array_position(ARRAY['histopatologi','sitologi','potong_beku','ihk']::varchar[], COALESCE(t.jenis, m.jenis)) NULLS LAST, t.nama
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

const satuTemplate = async (uuid, f) => {
  const t = await satu(`SELECT ${PILIH} FROM ${DARI} WHERE t.uuid = $1 AND t.faskes_uuid = $2 AND t.deleted_at IS NULL`, [uuid, f]);
  if (!t) throw tidakDitemukan("Template laporan PA");
  return t;
};

rute.get("/:uuid", tangani(async (req, res) => kirim(res, await satuTemplate(req.params.uuid, req.author.faskesUuid))));

rute.post(
  "/",
  izinPa("Datamaster", "CREATE", "Template Laporan PA"),
  tangani(async (req, res) => {
    wajib(req.body, ["nama", "diagnosis"]);
    const f = req.author.faskesUuid;
    const k = await KOLOM(req.body, f);
    const t = await sisipkan("pa_template", { faskes_uuid: f, status: true, ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined)) }).catch((e) =>
      ramah(e, `Nama template "${req.body.nama}" sudah dipakai`),
    );
    kirim(res, await satuTemplate(t.uuid, f), "Template laporan PA berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  izinPa("Datamaster", "UPDATE", "Template Laporan PA"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const t = await ubah("pa_template", req.params.uuid, f, await KOLOM(req.body, f)).catch((e) => ramah(e, `Nama template "${req.body.nama}" sudah dipakai`));
    if (!t) throw tidakDitemukan("Template laporan PA");
    kirim(res, await satuTemplate(t.uuid, f), "Template laporan PA berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izinPa("Datamaster", "DELETE", "Template Laporan PA"),
  tangani(async (req, res) => {
    const t = await ubah("pa_template", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Template laporan PA");
    kirim(res, { uuid: t.uuid }, "Template laporan PA berhasil dihapus");
  }),
);

export default rute;
