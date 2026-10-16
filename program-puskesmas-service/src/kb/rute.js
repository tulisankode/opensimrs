import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan } from "../umum/respons.js";
import { izinProgramPuskesmas } from "../umum/izin.js";
import { pastikanPasien, pastikanRawatJalan } from "../umum/kunjungan.js";

// KB — /api/v3/program-puskesmas/kb/pelayanan (pelayanan & kohort KB, KF-6..KF-8)
const rute = express.Router();

const PILIH = `k.uuid, k.faskes_uuid, k.patient_uuid, k.rawat_jalan_uuid, k.metode, k.tanggal_pelayanan::text AS tanggal_pelayanan,
  k.rencana_kunjungan_ulang::text AS rencana_kunjungan_ulang, k.efek_samping, k.created_at, k.updated_at,
  p.name AS nama_pasien, p.no_rm,
  (k.rencana_kunjungan_ulang IS NOT NULL AND k.rencana_kunjungan_ulang < CURRENT_DATE) AS terlambat_kunjungan_ulang`;

const KOLOM = (b) => ({
  metode: b.metode,
  tanggal_pelayanan: b.tanggal_pelayanan,
  rencana_kunjungan_ulang: b.rencana_kunjungan_ulang ?? null,
  efek_samping: b.efek_samping ?? null,
});

rute.get(
  "/pelayanan",
  izinProgramPuskesmas("KB", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "k.faskes_uuid = $1 AND k.deleted_at IS NULL";
    if (req.query.patient_uuid) {
      p.push(req.query.patient_uuid);
      w += ` AND k.patient_uuid = $${p.length}`;
    }
    if (req.query.kunjungan_ulang_lewat === "1") w += ` AND k.rencana_kunjungan_ulang < CURRENT_DATE`;
    const total = (await satu(`SELECT COUNT(*) n FROM kb_pelayanan k WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM kb_pelayanan k JOIN patients p ON p.uuid = k.patient_uuid
        WHERE ${w} ORDER BY k.tanggal_pelayanan DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/pelayanan",
  izinProgramPuskesmas("KB", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["patient_uuid", "metode", "tanggal_pelayanan"]);
    await pastikanPasien(req.body.patient_uuid, f);
    if (req.body.rawat_jalan_uuid) await pastikanRawatJalan(req.body.rawat_jalan_uuid, f, req.body.patient_uuid);
    const r = await sisipkan("kb_pelayanan", {
      faskes_uuid: f, patient_uuid: req.body.patient_uuid, rawat_jalan_uuid: req.body.rawat_jalan_uuid ?? null,
      ...KOLOM(req.body), dibuat_oleh: req.author.username,
    });
    kirim(res, r, "Pelayanan KB berhasil disimpan");
  }),
);

rute.put(
  "/pelayanan/:uuid",
  izinProgramPuskesmas("KB", "UPDATE"),
  tangani(async (req, res) => {
    const r = await ubah("kb_pelayanan", req.params.uuid, req.author.faskesUuid, KOLOM(req.body));
    if (!r) throw tidakDitemukan("Pelayanan KB");
    kirim(res, r, "Pelayanan KB berhasil diperbarui");
  }),
);

rute.delete(
  "/pelayanan/:uuid",
  izinProgramPuskesmas("KB", "DELETE"),
  tangani(async (req, res) => {
    const r = await ubah("kb_pelayanan", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Pelayanan KB");
    kirim(res, { uuid: r.uuid }, "Pelayanan KB berhasil dihapus");
  }),
);

export default rute;
