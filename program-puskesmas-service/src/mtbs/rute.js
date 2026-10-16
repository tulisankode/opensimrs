import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinProgramPuskesmas } from "../umum/izin.js";
import { pastikanPasien, pastikanRawatJalan } from "../umum/kunjungan.js";

// MTBS/MTBM — /api/v3/program-puskesmas/mtbs (klasifikasi balita sakit / bayi muda)
const rute = express.Router();

rute.get(
  "/",
  izinProgramPuskesmas("MTBS/MTBM", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "m.faskes_uuid = $1 AND m.deleted_at IS NULL";
    if (req.query.patient_uuid) {
      p.push(req.query.patient_uuid);
      w += ` AND m.patient_uuid = $${p.length}`;
    }
    if (req.query.rawat_jalan_uuid) {
      p.push(req.query.rawat_jalan_uuid);
      w += ` AND m.rawat_jalan_uuid = $${p.length}`;
    }
    if (req.query.jenis_form) {
      p.push(req.query.jenis_form);
      w += ` AND m.jenis_form = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM mtbs_klasifikasi m WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT m.*, p.name AS nama_pasien, p.no_rm FROM mtbs_klasifikasi m JOIN patients p ON p.uuid = m.patient_uuid
        WHERE ${w} ORDER BY m.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  izinProgramPuskesmas("MTBS/MTBM", "READ"),
  tangani(async (req, res) => {
    const r = await satu(`SELECT * FROM mtbs_klasifikasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, req.author.faskesUuid]);
    if (!r) throw tidakDitemukan("Klasifikasi MTBS/MTBM");
    kirim(res, r);
  }),
);

rute.post(
  "/",
  izinProgramPuskesmas("MTBS/MTBM", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["patient_uuid", "rawat_jalan_uuid", "jenis_form"]);
    if (!["mtbs", "mtbm"].includes(req.body.jenis_form)) throw permintaanSalah("jenis_form harus mtbs atau mtbm");
    await pastikanPasien(req.body.patient_uuid, f);
    await pastikanRawatJalan(req.body.rawat_jalan_uuid, f, req.body.patient_uuid);
    const r = await sisipkan("mtbs_klasifikasi", {
      faskes_uuid: f, patient_uuid: req.body.patient_uuid, rawat_jalan_uuid: req.body.rawat_jalan_uuid,
      jenis_form: req.body.jenis_form, temuan: req.body.temuan ?? {}, klasifikasi: req.body.klasifikasi ?? {},
      dibuat_oleh: req.author.username,
    });
    kirim(res, r, "Klasifikasi MTBS/MTBM berhasil disimpan");
  }),
);

rute.put(
  "/:uuid",
  izinProgramPuskesmas("MTBS/MTBM", "UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const r = await ubah("mtbs_klasifikasi", req.params.uuid, req.author.faskesUuid, {
      temuan: b.temuan === undefined ? undefined : b.temuan ?? {},
      klasifikasi: b.klasifikasi === undefined ? undefined : b.klasifikasi ?? {},
    });
    if (!r) throw tidakDitemukan("Klasifikasi MTBS/MTBM");
    kirim(res, r, "Klasifikasi MTBS/MTBM berhasil diperbarui");
  }),
);

rute.delete(
  "/:uuid",
  izinProgramPuskesmas("MTBS/MTBM", "DELETE"),
  tangani(async (req, res) => {
    const r = await ubah("mtbs_klasifikasi", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Klasifikasi MTBS/MTBM");
    kirim(res, { uuid: r.uuid }, "Klasifikasi MTBS/MTBM berhasil dihapus");
  }),
);

export default rute;
