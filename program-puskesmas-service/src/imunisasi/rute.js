import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, ramah } from "../umum/respons.js";
import { izinProgramPuskesmas } from "../umum/izin.js";
import { pastikanPasien, pastikanRawatJalan } from "../umum/kunjungan.js";
import { vaksinBerikutnya, dasarLengkap } from "../umum/jadwal-imunisasi.js";
import { statusAwalKirim, kirimImunisasiSatuSehat } from "../umum/satusehat.js";

// Imunisasi — /api/v3/program-puskesmas/imunisasi/...
const rute = express.Router();

// ── Datamaster jenis vaksin & jadwal ──────────────────────────────────
rute.get(
  "/jenis-vaksin",
  izinProgramPuskesmas("Datamaster", "READ", "Jenis Vaksin & Jadwal"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.kelompok_sasaran) {
      p.push(req.query.kelompok_sasaran);
      w += ` AND kelompok_sasaran = $${p.length}`;
    }
    if (req.query.aktif === "1") w += " AND status = true";
    const rows = await query(`SELECT * FROM imunisasi_jenis_vaksin WHERE ${w} ORDER BY kelompok_sasaran, urutan_dosis`, p);
    kirim(res, rows);
  }),
);

rute.post(
  "/jenis-vaksin",
  izinProgramPuskesmas("Datamaster", "CREATE", "Jenis Vaksin & Jadwal"),
  tangani(async (req, res) => {
    wajib(req.body, ["kode", "nama", "kelompok_sasaran"]);
    const r = await sisipkan("imunisasi_jenis_vaksin", {
      faskes_uuid: req.author.faskesUuid,
      kode: String(req.body.kode).trim().toLowerCase(),
      nama: req.body.nama,
      kelompok_sasaran: req.body.kelompok_sasaran,
      urutan_dosis: Number(req.body.urutan_dosis) || 1,
      interval_minimal_hari: req.body.interval_minimal_hari === undefined ? null : Number(req.body.interval_minimal_hari) || null,
      usia_minimal_hari: req.body.usia_minimal_hari === undefined ? null : Number(req.body.usia_minimal_hari) || null,
      wajib_dasar_lengkap: Boolean(req.body.wajib_dasar_lengkap),
      status: req.body.status ?? true,
    }).catch((e) => ramah(e, `Kode vaksin ${req.body.kode} sudah dipakai`));
    kirim(res, r, "Jenis vaksin berhasil ditambahkan");
  }),
);

rute.put(
  "/jenis-vaksin/:uuid",
  izinProgramPuskesmas("Datamaster", "UPDATE", "Jenis Vaksin & Jadwal"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const r = await ubah("imunisasi_jenis_vaksin", req.params.uuid, req.author.faskesUuid, {
      nama: b.nama, kelompok_sasaran: b.kelompok_sasaran,
      urutan_dosis: b.urutan_dosis === undefined ? undefined : Number(b.urutan_dosis) || 1,
      interval_minimal_hari: b.interval_minimal_hari === undefined ? undefined : Number(b.interval_minimal_hari) || null,
      usia_minimal_hari: b.usia_minimal_hari === undefined ? undefined : Number(b.usia_minimal_hari) || null,
      wajib_dasar_lengkap: b.wajib_dasar_lengkap === undefined ? undefined : Boolean(b.wajib_dasar_lengkap),
      status: b.status,
    }).catch((e) => ramah(e, "Kode vaksin sudah dipakai"));
    if (!r) throw tidakDitemukan("Jenis vaksin");
    kirim(res, r, "Jenis vaksin berhasil diperbarui");
  }),
);

rute.delete(
  "/jenis-vaksin/:uuid",
  izinProgramPuskesmas("Datamaster", "DELETE", "Jenis Vaksin & Jadwal"),
  tangani(async (req, res) => {
    const r = await ubah("imunisasi_jenis_vaksin", req.params.uuid, req.author.faskesUuid, { deleted_at: sekarang() });
    if (!r) throw tidakDitemukan("Jenis vaksin");
    kirim(res, { uuid: r.uuid }, "Jenis vaksin berhasil dihapus");
  }),
);

// ── Riwayat & pencatatan ───────────────────────────────────────────────
rute.get(
  "/riwayat/:patientUuid",
  izinProgramPuskesmas("Imunisasi", "READ"),
  tangani(async (req, res) => {
    const rows = await query(
      `SELECT uuid, jenis_vaksin_kode, jenis_vaksin_nama, tanggal_pemberian::text AS tanggal_pemberian, status_kirim_satusehat
         FROM imunisasi WHERE patient_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ORDER BY tanggal_pemberian`,
      [req.params.patientUuid, req.author.faskesUuid],
    );
    kirim(res, rows);
  }),
);

rute.get(
  "/",
  izinProgramPuskesmas("Imunisasi", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const f = req.author.faskesUuid;
    const p = [f];
    let w = "i.faskes_uuid = $1 AND i.deleted_at IS NULL";
    if (req.query.patient_uuid) {
      p.push(req.query.patient_uuid);
      w += ` AND i.patient_uuid = $${p.length}`;
    }
    if (req.query.jenis_vaksin_kode) {
      p.push(req.query.jenis_vaksin_kode);
      w += ` AND i.jenis_vaksin_kode = $${p.length}`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM imunisasi i WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT i.*, p.name AS nama_pasien, p.no_rm FROM imunisasi i JOIN patients p ON p.uuid = i.patient_uuid
        WHERE ${w} ORDER BY i.tanggal_pemberian DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/",
  izinProgramPuskesmas("Imunisasi", "CREATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    wajib(req.body, ["patient_uuid", "jenis_vaksin_uuid", "tanggal_pemberian"]);
    await pastikanPasien(req.body.patient_uuid, f);
    if (req.body.rawat_jalan_uuid) await pastikanRawatJalan(req.body.rawat_jalan_uuid, f, req.body.patient_uuid);
    const vaksin = await satu(`SELECT * FROM imunisasi_jenis_vaksin WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.body.jenis_vaksin_uuid, f]);
    if (!vaksin) throw tidakDitemukan("Jenis vaksin");

    const r = await sisipkan("imunisasi", {
      faskes_uuid: f, patient_uuid: req.body.patient_uuid, rawat_jalan_uuid: req.body.rawat_jalan_uuid ?? null,
      jenis_vaksin_uuid: vaksin.uuid, jenis_vaksin_kode: vaksin.kode, jenis_vaksin_nama: vaksin.nama,
      tanggal_pemberian: req.body.tanggal_pemberian, petugas_uuid: req.body.petugas_uuid ?? null,
      catatan: req.body.catatan ?? null, status_kirim_satusehat: await statusAwalKirim(f),
      dibuat_oleh: req.author.username,
    });

    const riwayat = await query(`SELECT jenis_vaksin_kode FROM imunisasi WHERE patient_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [
      req.body.patient_uuid, f,
    ]);
    const aktifKelompok = await query(`SELECT * FROM imunisasi_jenis_vaksin WHERE faskes_uuid = $1 AND kelompok_sasaran = $2 AND status = true AND deleted_at IS NULL`, [
      f, vaksin.kelompok_sasaran,
    ]);
    kirim(res, {
      ...r,
      jadwal_berikutnya: vaksinBerikutnya(riwayat, aktifKelompok),
      imunisasi_dasar_lengkap: dasarLengkap(riwayat, aktifKelompok),
    }, "Pemberian imunisasi berhasil disimpan");
  }),
);

rute.post(
  "/:uuid/kirim-ulang",
  izinProgramPuskesmas("Imunisasi", "KIRIM SATUSEHAT"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const im = await satu(`SELECT uuid, status_kirim_satusehat FROM imunisasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, f]);
    if (!im) throw tidakDitemukan("Pemberian imunisasi");
    if (im.status_kirim_satusehat === "tidak_berlaku") throw permintaanSalah("Integrasi SATUSEHAT tidak aktif untuk faskes ini");
    const hasil = await kirimImunisasiSatuSehat(im);
    const r = await ubah("imunisasi", im.uuid, f, { status_kirim_satusehat: hasil.status });
    kirim(res, { ...r, pesan_satusehat: hasil.pesan ?? null }, hasil.status === "terkirim" ? "Berhasil dikirim ke SATUSEHAT" : "Pengiriman SATUSEHAT gagal");
  }),
);

export default rute;
