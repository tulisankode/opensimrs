import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { MODALITAS, ramah, daftarNilai } from "./bersama.js";

// Datamaster Template Expertise (bacaan normal / kalimat baku) untuk mempercepat pengisian hasil oleh dokter Sp.Rad.
// Template terikat ke satu pemeriksaan (paling spesifik), atau ke satu modalitas, atau umum (keduanya kosong).
// GET /?untuk_pemeriksaan=<uuid> mengembalikan template yang cocok: pemeriksaan tsb → modalitasnya → umum.
const rute = express.Router();

const PILIH = `t.uuid, t.nama, t.pemeriksaan_uuid, t.modalitas, t.hasil, t.kesan, t.status, t.created_at, t.updated_at,
  m.kode AS pemeriksaan_kode, m.nama AS pemeriksaan_nama, COALESCE(t.modalitas, m.modalitas) AS modalitas_efektif`;
const DARI = `rad_template t LEFT JOIN rad_pemeriksaan m ON m.uuid = t.pemeriksaan_uuid`;

const KOLOM = async (b, faskes) => {
  const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim());
  const k = { nama: teks(b.nama), hasil: teks(b.hasil), kesan: teks(b.kesan) };
  for (const [kolom, label] of [["nama", "nama"], ["hasil", "hasil"], ["kesan", "kesan"]]) if (k[kolom] === "") throw permintaanSalah(`${label} tidak boleh kosong`);
  if (b.pemeriksaan_uuid !== undefined) {
    k.pemeriksaan_uuid = b.pemeriksaan_uuid || null;
    if (k.pemeriksaan_uuid) {
      const m = await satu(`SELECT modalitas FROM rad_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [k.pemeriksaan_uuid, faskes]);
      if (!m) throw permintaanSalah("Pemeriksaan tidak ditemukan");
      k.modalitas = m.modalitas; // ikut modalitas pemeriksaan
    }
  }
  if (b.modalitas !== undefined && !k.pemeriksaan_uuid) {
    if (b.modalitas && !MODALITAS[b.modalitas]) throw permintaanSalah("modalitas tidak dikenal");
    k.modalitas = b.modalitas || null;
  }
  if (b.status !== undefined) k.status = Boolean(b.status);
  return k;
};

rute.get(
  "/",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    // Mode pilihan untuk dialog expertise: template aktif yang cocok, urut paling spesifik.
    if (req.query.untuk_pemeriksaan) {
      const m = await satu(`SELECT uuid, modalitas FROM rad_pemeriksaan WHERE uuid = $1 AND faskes_uuid = $2`, [req.query.untuk_pemeriksaan, f]);
      const rows = await query(
        `SELECT ${PILIH}, CASE WHEN t.pemeriksaan_uuid = $2 THEN 0 WHEN t.pemeriksaan_uuid IS NULL AND t.modalitas = $3 THEN 1 ELSE 2 END AS tingkat
           FROM ${DARI}
          WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.status
            AND (t.pemeriksaan_uuid = $2 OR (t.pemeriksaan_uuid IS NULL AND (t.modalitas = $3 OR t.modalitas IS NULL)))
          ORDER BY tingkat, t.nama`,
        [f, m?.uuid ?? null, m?.modalitas ?? null],
      );
      return kirim(res, rows);
    }
    const pg = halaman(req.query);
    const p = [f];
    let w = "t.faskes_uuid = $1 AND t.deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (t.nama ILIKE $${p.length} OR m.nama ILIKE $${p.length} OR t.kesan ILIKE $${p.length})`;
    }
    const modalitas = daftarNilai(req.query.modalitas);
    if (modalitas.length) {
      p.push(modalitas);
      w += ` AND COALESCE(t.modalitas, m.modalitas) = ANY($${p.length})`;
    }
    if (req.query.pemeriksaan_uuid) {
      p.push(req.query.pemeriksaan_uuid);
      w += ` AND t.pemeriksaan_uuid = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM ${DARI} WHERE ${w}
        ORDER BY array_position(ARRAY['XR','DX','US','CT','MR','FL','MG','LAIN']::varchar[], COALESCE(t.modalitas, m.modalitas)) NULLS LAST, t.nama
        LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

const satuTemplate = async (uuid, f) => {
  const t = await satu(`SELECT ${PILIH} FROM ${DARI} WHERE t.uuid = $1 AND t.faskes_uuid = $2 AND t.deleted_at IS NULL`, [uuid, f]);
  if (!t) throw tidakDitemukan("Template expertise");
  return t;
};

rute.get("/:uuid", tangani(async (req, res) => kirim(res, await satuTemplate(req.params.uuid, req.author.faskesUuid))));

rute.post(
  "/",
  tangani(async (req, res) => {
    wajib(req.body, ["nama", "hasil", "kesan"]);
    const f = req.author.faskesUuid;
    const k = await KOLOM(req.body, f);
    const t = await sisipkan("rad_template", { faskes_uuid: f, status: true, ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined)) }).catch((e) =>
      ramah(e, `Nama template "${req.body.nama}" sudah dipakai`),
    );
    kirim(res, await satuTemplate(t.uuid, f), "Template expertise berhasil ditambahkan");
  }),
);

rute.put(
  "/:uuid",
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const t = await ubah("rad_template", req.params.uuid, f, await KOLOM(req.body, f)).catch((e) => ramah(e, `Nama template "${req.body.nama}" sudah dipakai`));
    if (!t) throw tidakDitemukan("Template expertise");
    kirim(res, await satuTemplate(t.uuid, f), "Template expertise berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  tangani(async (req, res) => {
    const t = await ubah("rad_template", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!t) throw tidakDitemukan("Template expertise");
    kirim(res, { uuid: t.uuid }, "Template expertise berhasil dihapus");
  }),
);

export default rute;
