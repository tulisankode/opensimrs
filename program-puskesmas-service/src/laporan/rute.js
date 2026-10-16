import express from "express";
import ExcelJS from "exceljs";
import { query, satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, wajib, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinProgramPuskesmas } from "../umum/izin.js";
import { koleksiRekamMedis, idValid, keObjectId } from "../umum/mongo.js";
import { kelompokUmur, rentangPeriode } from "../umum/kelompok-umur.js";

// Laporan Dinkes — /api/v3/program-puskesmas/laporan/... (LB1, KIA, imunisasi, program; ekspor Excel; format).
const rute = express.Router();

const periodeWajib = (q) => {
  wajib(q, ["periode"]);
  const r = rentangPeriode(q.periode);
  if (!r) throw permintaanSalah("periode harus format YYYY-MM");
  return r;
};

// ── LB1: diagnosis kunjungan rawat jalan (Mongo) × kelompok umur & jenis kelamin (PostgreSQL) ──────────────
// Lihat dokumen desain: kelompok umur & aturan diagnosis ganda/kunjungan batal masih butuh validasi lanjutan.
export const susunLb1 = async (faskesUuid, periode) => {
  const rentang = rentangPeriode(periode);
  if (!rentang) throw permintaanSalah("periode harus format YYYY-MM");

  const kunjungan = await query(
    `SELECT rj.uuid, rj.rekam_medis_uuid, rj.gender, bd.age_year
       FROM rawat_jalans rj LEFT JOIN birth_details bd ON bd.uuid = rj.birth_detail_uuid
      WHERE rj.faskes_uuid = $1 AND rj.deleted_at IS NULL AND rj.rekam_medis_uuid IS NOT NULL
        AND rj.tanggal_periksa BETWEEN $2 AND $3`,
    [faskesUuid, rentang.mulai, rentang.selesai],
  );

  const idRekamMedis = [...new Set(kunjungan.map((k) => k.rekam_medis_uuid).filter(idValid))];
  let dokumenMongo = [];
  if (idRekamMedis.length) {
    const koleksi = await koleksiRekamMedis();
    dokumenMongo = await koleksi
      .find({ _id: { $in: idRekamMedis.map(keObjectId) }, faskes_uuid: faskesUuid }, { projection: { "summary.diagnosis_dokter": 1 } })
      .toArray();
  }
  const diagnosisPerRekamMedis = new Map(dokumenMongo.map((d) => [String(d._id), d.summary?.diagnosis_dokter ?? []]));

  // Hitung (diagnosis_uuid, kelompok_umur, gender) → jumlah, memakai diagnosis utama tiap baris (field `diagnosis_uuid`).
  const hitung = new Map();
  let kunjunganDenganDiagnosis = 0;
  for (const k of kunjungan) {
    const diagnosisList = diagnosisPerRekamMedis.get(k.rekam_medis_uuid) ?? [];
    if (!diagnosisList.length) continue;
    kunjunganDenganDiagnosis += 1;
    const kelompok = kelompokUmur(k.age_year);
    const gender = k.gender === "Male" ? "L" : k.gender === "Female" ? "P" : "-";
    for (const d of diagnosisList) {
      if (!d.diagnosis_uuid) continue;
      const kunci = `${d.diagnosis_uuid}|${kelompok}|${gender}`;
      hitung.set(kunci, (hitung.get(kunci) ?? 0) + 1);
    }
  }

  const diagnosisUuid = [...new Set([...hitung.keys()].map((k) => k.split("|")[0]))];
  const master = diagnosisUuid.length
    ? await query(`SELECT uuid, code, name FROM diagnosis WHERE uuid = ANY($1::varchar[])`, [diagnosisUuid])
    : [];
  const namaDiagnosis = new Map(master.map((m) => [m.uuid, m]));

  const rincian = [...hitung.entries()]
    .map(([kunci, jumlah]) => {
      const [uuid, kelompokUmurLabel, gender] = kunci.split("|");
      const m = namaDiagnosis.get(uuid);
      return { kode_icd10: m?.code ?? "?", nama_diagnosis: m?.name ?? "(kode tidak ditemukan di master)", kelompok_umur: kelompokUmurLabel, jenis_kelamin: gender, jumlah };
    })
    .sort((a, b) => b.jumlah - a.jumlah);

  return {
    periode,
    rincian,
    kelengkapan: {
      total_kunjungan: kunjungan.length,
      kunjungan_dengan_diagnosis: kunjunganDenganDiagnosis,
      kunjungan_tanpa_diagnosis: kunjungan.length - kunjunganDenganDiagnosis,
    },
  };
};

rute.get(
  "/lb1",
  izinProgramPuskesmas("Laporan Dinkes", "READ"),
  tangani(async (req, res) => kirim(res, await susunLb1(req.author.faskesUuid, req.query.periode))),
);

// ── KIA: cakupan K1–K6, persalinan, nifas ────────────────────────────────────────────────────────────────
export const susunLaporanKia = async (faskesUuid, periode) => {
  const r = periodeWajib({ periode });
  const [anc, persalinan, nifas] = await Promise.all([
    query(
      `SELECT nomor_kunjungan, COUNT(*)::int AS jumlah FROM kia_anc
        WHERE faskes_uuid = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3 GROUP BY nomor_kunjungan ORDER BY nomor_kunjungan`,
      [faskesUuid, r.mulai, r.selesai],
    ),
    satu(`SELECT COUNT(*)::int n FROM kia_persalinan WHERE faskes_uuid = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3`, [faskesUuid, r.mulai, r.selesai]),
    satu(`SELECT COUNT(*)::int n FROM kia_nifas WHERE faskes_uuid = $1 AND deleted_at IS NULL AND created_at BETWEEN $2 AND $3`, [faskesUuid, r.mulai, r.selesai]),
  ]);
  return { periode, cakupan_anc: anc, jumlah_persalinan: persalinan.n, jumlah_nifas: nifas.n };
};
rute.get("/kia", izinProgramPuskesmas("Laporan Dinkes", "READ"), tangani(async (req, res) => kirim(res, await susunLaporanKia(req.author.faskesUuid, req.query.periode))));

// ── Imunisasi: cakupan per antigen ────────────────────────────────────────────────────────────────────────
export const susunLaporanImunisasi = async (faskesUuid, periode) => {
  const r = periodeWajib({ periode });
  const cakupan = await query(
    `SELECT jenis_vaksin_kode, jenis_vaksin_nama, COUNT(*)::int AS jumlah, COUNT(DISTINCT patient_uuid)::int AS jumlah_pasien
       FROM imunisasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND tanggal_pemberian BETWEEN to_timestamp($2)::date AND to_timestamp($3)::date
       GROUP BY jenis_vaksin_kode, jenis_vaksin_nama ORDER BY jenis_vaksin_nama`,
    [faskesUuid, r.mulai, r.selesai],
  );
  return { periode, cakupan };
};
rute.get("/imunisasi", izinProgramPuskesmas("Laporan Dinkes", "READ"), tangani(async (req, res) => kirim(res, await susunLaporanImunisasi(req.author.faskesUuid, req.query.periode))));

// ── Program: ringkasan UKM & sasaran ─────────────────────────────────────────────────────────────────────
export const susunLaporanProgram = async (faskesUuid, periode) => {
  periodeWajib({ periode });
  const [ukm, sasaran] = await Promise.all([
    query(
      `SELECT k.name AS nama_kelurahan, u.jenis_kegiatan, COUNT(*)::int AS jumlah_kegiatan, COALESCE(SUM(u.jumlah_sasaran), 0)::int AS total_peserta
         FROM ukm_kegiatan u JOIN kelurahan k ON k.code = u.kelurahan_code
        WHERE u.faskes_uuid = $1 AND u.deleted_at IS NULL AND u.tanggal_pelaksanaan::text LIKE $2
        GROUP BY k.name, u.jenis_kegiatan ORDER BY k.name, u.jenis_kegiatan`,
      [faskesUuid, `${periode}%`],
    ),
    query(
      `SELECT k.name AS nama_kelurahan, s.jenis_sasaran, COUNT(*)::int AS jumlah_sasaran,
              COUNT(*) FILTER (WHERE s.status = 'sudah_dilayani')::int AS jumlah_dilayani
         FROM program_sasaran s JOIN kelurahan k ON k.code = s.kelurahan_code
        WHERE s.faskes_uuid = $1 AND s.deleted_at IS NULL AND s.periode = $2
        GROUP BY k.name, s.jenis_sasaran ORDER BY k.name, s.jenis_sasaran`,
      [faskesUuid, periode],
    ),
  ]);
  return { periode, ukm, sasaran };
};
rute.get("/program", izinProgramPuskesmas("Laporan Dinkes", "READ"), tangani(async (req, res) => kirim(res, await susunLaporanProgram(req.author.faskesUuid, req.query.periode))));

// ── Format laporan (Datamaster) ──────────────────────────────────────────────────────────────────────────
const JENIS_FORMAT = ["lb1", "kia", "imunisasi", "program"];
rute.get(
  "/format/:jenis",
  izinProgramPuskesmas("Datamaster", "READ", "Format Laporan Dinkes"),
  tangani(async (req, res) => {
    if (!JENIS_FORMAT.includes(req.params.jenis)) throw permintaanSalah("Jenis laporan tidak dikenal");
    const r = await satu(`SELECT * FROM program_format_laporan WHERE faskes_uuid = $1 AND jenis_laporan = $2 AND deleted_at IS NULL`, [req.author.faskesUuid, req.params.jenis]);
    kirim(res, r ?? { jenis_laporan: req.params.jenis, format: {}, status: true });
  }),
);
rute.put(
  "/format/:jenis",
  izinProgramPuskesmas("Datamaster", "UPDATE", "Format Laporan Dinkes"),
  tangani(async (req, res) => {
    if (!JENIS_FORMAT.includes(req.params.jenis)) throw permintaanSalah("Jenis laporan tidak dikenal");
    const f = req.author.faskesUuid;
    const ada = await satu(`SELECT uuid FROM program_format_laporan WHERE faskes_uuid = $1 AND jenis_laporan = $2 AND deleted_at IS NULL`, [f, req.params.jenis]);
    const r = ada
      ? await ubah("program_format_laporan", ada.uuid, f, { format: req.body.format ?? {}, status: req.body.status ?? true })
      : await sisipkan("program_format_laporan", { faskes_uuid: f, jenis_laporan: req.params.jenis, format: req.body.format ?? {}, status: req.body.status ?? true });
    kirim(res, r, "Format laporan berhasil disimpan");
  }),
);

// ── Ekspor Excel ──────────────────────────────────────────────────────────────────────────────────────────
const PENYUSUN = { lb1: susunLb1, kia: susunLaporanKia, imunisasi: susunLaporanImunisasi, program: susunLaporanProgram };
const isiLembar = {
  lb1: (sheet, data) => {
    sheet.addRow(["Kode ICD-10", "Nama Diagnosis", "Kelompok Umur", "Jenis Kelamin", "Jumlah"]);
    for (const r of data.rincian) sheet.addRow([r.kode_icd10, r.nama_diagnosis, r.kelompok_umur, r.jenis_kelamin, r.jumlah]);
  },
  kia: (sheet, data) => {
    sheet.addRow(["Nomor Kunjungan", "Jumlah"]);
    for (const r of data.cakupan_anc) sheet.addRow([r.nomor_kunjungan, r.jumlah]);
    sheet.addRow([]);
    sheet.addRow(["Jumlah Persalinan", data.jumlah_persalinan]);
    sheet.addRow(["Jumlah Nifas", data.jumlah_nifas]);
  },
  imunisasi: (sheet, data) => {
    sheet.addRow(["Jenis Vaksin", "Jumlah Pemberian", "Jumlah Pasien"]);
    for (const r of data.cakupan) sheet.addRow([r.jenis_vaksin_nama, r.jumlah, r.jumlah_pasien]);
  },
  program: (sheet, data) => {
    sheet.addRow(["Kelurahan", "Jenis Kegiatan", "Jumlah Kegiatan", "Total Peserta"]);
    for (const r of data.ukm) sheet.addRow([r.nama_kelurahan, r.jenis_kegiatan, r.jumlah_kegiatan, r.total_peserta]);
    sheet.addRow([]);
    sheet.addRow(["Kelurahan", "Jenis Sasaran", "Jumlah Sasaran", "Jumlah Dilayani"]);
    for (const r of data.sasaran) sheet.addRow([r.nama_kelurahan, r.jenis_sasaran, r.jumlah_sasaran, r.jumlah_dilayani]);
  },
};

rute.get(
  "/:jenis/ekspor",
  izinProgramPuskesmas("Laporan Dinkes", "EKSPOR EXCEL"),
  tangani(async (req, res) => {
    const penyusun = PENYUSUN[req.params.jenis];
    if (!penyusun) throw permintaanSalah("Jenis laporan tidak dikenal");
    const data = await penyusun(req.author.faskesUuid, req.query.periode);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(req.params.jenis.toUpperCase());
    isiLembar[req.params.jenis](sheet, data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.jenis}-${req.query.periode}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }),
);

export default rute;
