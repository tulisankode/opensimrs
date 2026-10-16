import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { izinProgramPuskesmas } from "../umum/izin.js";
import { pastikanPasien, pastikanRawatJalan } from "../umum/kunjungan.js";

// KIA — /api/v3/program-puskesmas/kia/...
const rute = express.Router();

const PILIH_ANC = `a.uuid, a.faskes_uuid, a.patient_uuid, a.rawat_jalan_uuid, a.nomor_kunjungan, a.usia_kehamilan_minggu,
  a.risiko_tinggi, a.hasil_pemeriksaan, a.dibuat_oleh, a.created_at, a.updated_at,
  p.name AS nama_pasien, p.no_rm`;

const KOLOM_ANC = (b) => ({
  nomor_kunjungan: b.nomor_kunjungan,
  usia_kehamilan_minggu: b.usia_kehamilan_minggu === undefined ? undefined : Number(b.usia_kehamilan_minggu) || null,
  risiko_tinggi: b.risiko_tinggi === undefined ? undefined : Boolean(b.risiko_tinggi),
  hasil_pemeriksaan: b.hasil_pemeriksaan === undefined ? undefined : b.hasil_pemeriksaan ?? {},
});

rute.get(
  "/anc",
  izinProgramPuskesmas("KIA", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "a.faskes_uuid = $1 AND a.deleted_at IS NULL";
    if (req.query.patient_uuid) {
      p.push(req.query.patient_uuid);
      w += ` AND a.patient_uuid = $${p.length}`;
    }
    if (req.query.rawat_jalan_uuid) {
      p.push(req.query.rawat_jalan_uuid);
      w += ` AND a.rawat_jalan_uuid = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM kia_anc a WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH_ANC} FROM kia_anc a JOIN patients p ON p.uuid = a.patient_uuid
        WHERE ${w} ORDER BY a.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// Riwayat K1–K6 pasien (dipakai form ANC berikutnya, KT-2).
rute.get(
  "/anc/riwayat/:patientUuid",
  izinProgramPuskesmas("KIA", "READ"),
  tangani(async (req, res) => {
    const rows = await query(
      `SELECT uuid, nomor_kunjungan, usia_kehamilan_minggu, risiko_tinggi, created_at FROM kia_anc
        WHERE patient_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY created_at`,
      [req.params.patientUuid, req.author.faskesUuid],
    );
    kirim(res, rows);
  }),
);

rute.get(
  "/anc/:uuid",
  izinProgramPuskesmas("KIA", "READ"),
  tangani(async (req, res) => {
    const r = await satu(`SELECT ${PILIH_ANC} FROM kia_anc a JOIN patients p ON p.uuid = a.patient_uuid WHERE a.uuid = $1 AND a.faskes_uuid = $2 AND a.deleted_at IS NULL`, [
      req.params.uuid,
      req.author.faskesUuid,
    ]);
    if (!r) throw tidakDitemukan("Pelayanan ANC");
    kirim(res, r);
  }),
);

rute.post(
  "/anc",
  izinProgramPuskesmas("KIA", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["patient_uuid", "rawat_jalan_uuid", "nomor_kunjungan"]);
    if (!["K1", "K2", "K3", "K4", "K5", "K6"].includes(req.body.nomor_kunjungan)) throw permintaanSalah("nomor_kunjungan harus K1–K6");
    await pastikanPasien(req.body.patient_uuid, f);
    const rj = await pastikanRawatJalan(req.body.rawat_jalan_uuid, f, req.body.patient_uuid);
    if (rj.maternity !== true) throw permintaanSalah("Kunjungan rawat jalan bukan kunjungan kebidanan (maternity)");
    const r = await sisipkan("kia_anc", {
      faskes_uuid: f, patient_uuid: req.body.patient_uuid, rawat_jalan_uuid: req.body.rawat_jalan_uuid,
      ...KOLOM_ANC(req.body), dibuat_oleh: req.author.username,
    });
    kirim(res, r, "Pelayanan ANC berhasil disimpan");
  }),
);

rute.put(
  "/anc/:uuid",
  izinProgramPuskesmas("KIA", "UPDATE"),
  tangani(async (req, res) => {
    const r = await ubah("kia_anc", req.params.uuid, req.author.faskesUuid, KOLOM_ANC(req.body));
    if (!r) throw tidakDitemukan("Pelayanan ANC");
    kirim(res, r, "Pelayanan ANC berhasil diperbarui");
  }),
);

rute.delete(
  "/anc/:uuid",
  izinProgramPuskesmas("KIA", "DELETE"),
  tangani(async (req, res) => {
    const r = await ubah("kia_anc", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Pelayanan ANC");
    kirim(res, { uuid: r.uuid }, "Pelayanan ANC berhasil dihapus");
  }),
);

// ── Persalinan ──────────────────────────────────────────────────────
rute.post(
  "/persalinan",
  izinProgramPuskesmas("KIA", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["patient_uuid", "rawat_jalan_uuid"]);
    await pastikanPasien(req.body.patient_uuid, f);
    await pastikanRawatJalan(req.body.rawat_jalan_uuid, f, req.body.patient_uuid);
    if (req.body.birth_detail_uuid) {
      const bd = await satu(`SELECT uuid FROM birth_details WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.body.birth_detail_uuid, f]);
      if (!bd) throw permintaanSalah("birth_detail_uuid tidak ditemukan");
    }
    const r = await sisipkan("kia_persalinan", {
      faskes_uuid: f, patient_uuid: req.body.patient_uuid, rawat_jalan_uuid: req.body.rawat_jalan_uuid,
      birth_detail_uuid: req.body.birth_detail_uuid ?? null, hasil_pemeriksaan: req.body.hasil_pemeriksaan ?? {},
      dibuat_oleh: req.author.username,
    });
    kirim(res, r, "Pelayanan persalinan berhasil disimpan");
  }),
);

rute.get(
  "/persalinan",
  izinProgramPuskesmas("KIA", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "s.faskes_uuid = $1 AND s.deleted_at IS NULL";
    if (req.query.patient_uuid) {
      p.push(req.query.patient_uuid);
      w += ` AND s.patient_uuid = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM kia_persalinan s WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT s.*, p.name AS nama_pasien, p.no_rm FROM kia_persalinan s JOIN patients p ON p.uuid = s.patient_uuid
        WHERE ${w} ORDER BY s.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

// ── Nifas ───────────────────────────────────────────────────────────
rute.post(
  "/nifas",
  izinProgramPuskesmas("KIA", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["patient_uuid", "kia_persalinan_uuid"]);
    const persalinan = await satu(`SELECT uuid, patient_uuid FROM kia_persalinan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      req.body.kia_persalinan_uuid,
      f,
    ]);
    if (!persalinan) throw tidakDitemukan("Pelayanan persalinan");
    if (persalinan.patient_uuid !== req.body.patient_uuid) throw permintaanSalah("Persalinan bukan milik pasien ini");
    const r = await sisipkan("kia_nifas", {
      faskes_uuid: f, patient_uuid: req.body.patient_uuid, kia_persalinan_uuid: req.body.kia_persalinan_uuid,
      kunjungan_ke: Number(req.body.kunjungan_ke) || 1, hasil_pemeriksaan: req.body.hasil_pemeriksaan ?? {},
      dibuat_oleh: req.author.username,
    });
    kirim(res, r, "Pelayanan nifas berhasil disimpan");
  }),
);

rute.get(
  "/nifas",
  izinProgramPuskesmas("KIA", "READ"),
  tangani(async (req, res) => {
    const rows = await query(
      `SELECT n.*, p.name AS nama_pasien, p.no_rm FROM kia_nifas n JOIN patients p ON p.uuid = n.patient_uuid
        WHERE n.faskes_uuid = $1 AND n.kia_persalinan_uuid = $2 AND n.deleted_at IS NULL ORDER BY n.kunjungan_ke`,
      [req.author.faskesUuid, req.query.kia_persalinan_uuid ?? null],
    );
    kirim(res, rows);
  }),
);

// ── Kohort ibu: diturunkan dari ANC/persalinan/nifas tersimpan (bukan form terpisah, aturan bisnis #2) ─────
rute.get(
  "/kohort",
  izinProgramPuskesmas("KIA", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "p.faskes_uuid = $1 AND p.deleted_at IS NULL";
    if (req.query.cari) {
      p.push(`%${req.query.cari}%`);
      w += ` AND (p.name ILIKE $${p.length} OR p.no_rm ILIKE $${p.length})`;
    }
    const sub = `SELECT DISTINCT patient_uuid FROM kia_anc WHERE faskes_uuid = $1 AND deleted_at IS NULL
                 UNION SELECT DISTINCT patient_uuid FROM kia_persalinan WHERE faskes_uuid = $1 AND deleted_at IS NULL`;
    const total = (await satu(`SELECT COUNT(*) n FROM patients p WHERE ${w} AND p.uuid IN (${sub})`, p)).n;
    const rows = await query(
      `SELECT p.uuid AS patient_uuid, p.no_rm, p.name,
              (SELECT COUNT(*)::int FROM kia_anc a WHERE a.patient_uuid = p.uuid AND a.faskes_uuid = p.faskes_uuid AND a.deleted_at IS NULL) AS jumlah_anc,
              (SELECT array_agg(DISTINCT nomor_kunjungan) FROM kia_anc a WHERE a.patient_uuid = p.uuid AND a.faskes_uuid = p.faskes_uuid AND a.deleted_at IS NULL) AS nomor_kunjungan_tercatat,
              (SELECT COUNT(*)::int FROM kia_persalinan s WHERE s.patient_uuid = p.uuid AND s.faskes_uuid = p.faskes_uuid AND s.deleted_at IS NULL) AS jumlah_persalinan,
              EXISTS(SELECT 1 FROM kia_anc a WHERE a.patient_uuid = p.uuid AND a.faskes_uuid = p.faskes_uuid AND a.risiko_tinggi AND a.deleted_at IS NULL) AS risiko_tinggi
         FROM patients p WHERE ${w} AND p.uuid IN (${sub})
         ORDER BY p.name LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

export default rute;
