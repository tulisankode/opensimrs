import express from "express";
import { query, satu, ubah, sekarang, sisipkan, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah } from "../umum/respons.js";
import { izinMutu } from "../umum/izin.js";
import { boolOpsional, cekPilihan, konflik, pilihan, teks, teksWajib, wajibPilihan } from "./bersama.js";
import {
  ARAH_TARGET,
  FREKUENSI_INDIKATOR,
  INM_BAWAAN,
  JENIS_INDIKATOR,
  KODE_OTOMATIS,
  REGULASI_INM,
  SATUAN_INDIKATOR,
  STATUS_CAPAIAN,
  STATUS_DATA,
  STATUS_TINDAK_LANJUT,
  SUMBER_DATA,
  SUMBER_TARGET,
  cekProfilIndikator,
  parameterOtomatis,
} from "./indikator-bersama.js";
import { ambilMilik, catatAudit, tanganiMutu } from "./dasar.js";
import { angkaOpsional } from "../sarpras/bersama.js";

// Master Indikator Mutu (STD-0025, fitur mutu_indikator) — izin "Mutu & Akreditasi › Indikator Mutu":
//   GET    /indikator/referensi        pilihan enum, unit (lokasi aktif), sumber otomatis, set INM bawaan   READ
//   GET    /indikator?jenis=&aktif=&cari=                                                                   READ
//   GET    /indikator/:uuid            profil + jejak audit                                                READ
//   POST   /indikator                  profil baru (IMP-RS/IMPU/INM buatan faskes)                         CREATE
//   POST   /indikator/pasang-inm       pasang set INM bawaan yang belum ada (idempoten per kode_bawaan)    CREATE
//   PUT    /indikator/:uuid            ubah profil (termasuk nonaktifkan: aktif=false)                     UPDATE
//   DELETE /indikator/:uuid            hapus lunak — hanya bila belum punya data                           DELETE
// Semua data disaring faskes_uuid dari token; perubahan & jejak audit (mutu_audit) dalam satu transaksi.
const rute = express.Router();
const SUB = "Indikator Mutu";

const KOLOM = `uuid, faskes_uuid, kode, judul, jenis, kode_bawaan, dimensi_mutu, definisi_operasional, definisi_numerator,
  definisi_denominator, kriteria_inklusi, kriteria_eksklusi, satuan, target_nilai, arah, target_sumber, regulasi_acuan, frekuensi,
  unit_pj_uuid, sumber_data, kode_otomatis, parameter_otomatis, numerator_maks_denominator, aktif, dibuat_oleh, created_at, updated_at`;

export const ambilIndikator = (uuid, f, k, kunci = false) => ambilMilik("mutu_indikator", uuid, f, k, { nama: "Indikator", kunci, kolom: KOLOM });

// Unit (lokasi Datamaster) milik faskes; null/"" = tingkat faskes. undefined = tidak diubah.
export const cekUnit = async (uuid, f, k, nama = "unit_uuid") => {
  if (uuid === undefined) return undefined;
  if (uuid === null || uuid === "") return null;
  if (typeof uuid !== "string") throw permintaanSalah(`${nama} tidak valid`);
  const ada = await satu(`SELECT uuid FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuid, f], k);
  if (!ada) throw permintaanSalah("Unit tidak ditemukan di faskes ini");
  return uuid;
};

// Body → kolom profil. `wajib` = pembuatan (kolom wajib harus ada); selain itu hanya kolom yang dikirim.
const bacaProfil = (b, wajib) => {
  const opsi = (v, obj, nama, bawaan) => (wajib ? cekPilihan(v, obj, nama) ?? bawaan : cekPilihan(v, obj, nama) ?? (v === undefined ? undefined : bawaan));
  const isiTeks = (k, maks) => (wajib ? teksWajib(b[k], k, maks) : b[k] === undefined ? undefined : teksWajib(b[k], k, maks));
  return {
    kode: isiTeks("kode", 50),
    judul: isiTeks("judul", 255),
    jenis: wajib ? wajibPilihan(b.jenis, JENIS_INDIKATOR, "jenis") : b.jenis === undefined ? undefined : wajibPilihan(b.jenis, JENIS_INDIKATOR, "jenis"),
    dimensi_mutu: teks(b.dimensi_mutu, "dimensi_mutu", 100),
    definisi_operasional: isiTeks("definisi_operasional", 5000),
    definisi_numerator: isiTeks("definisi_numerator", 2000),
    definisi_denominator: isiTeks("definisi_denominator", 2000),
    kriteria_inklusi: teks(b.kriteria_inklusi, "kriteria_inklusi", 2000),
    kriteria_eksklusi: teks(b.kriteria_eksklusi, "kriteria_eksklusi", 2000),
    satuan: opsi(b.satuan, SATUAN_INDIKATOR, "satuan", "persen"),
    target_nilai: angkaOpsional(b.target_nilai, "target_nilai", { min: 0, maks: 1e6 }),
    arah: opsi(b.arah, ARAH_TARGET, "arah", "naik"),
    target_sumber: cekPilihan(b.target_sumber, SUMBER_TARGET, "target_sumber"),
    regulasi_acuan: teks(b.regulasi_acuan, "regulasi_acuan", 255),
    frekuensi: opsi(b.frekuensi, FREKUENSI_INDIKATOR, "frekuensi", "bulanan"),
    sumber_data: opsi(b.sumber_data, SUMBER_DATA, "sumber_data", "manual"),
    kode_otomatis: b.kode_otomatis === undefined ? undefined : b.kode_otomatis || null,
    parameter_otomatis: b.parameter_otomatis,
    numerator_maks_denominator: boolOpsional(b.numerator_maks_denominator) ?? (wajib ? true : undefined),
    aktif: boolOpsional(b.aktif) ?? (wajib ? true : undefined),
  };
};

// Profil gabungan (lama + perubahan) diperiksa lintas kolom; parameter otomatis dinormalkan.
const rapikanProfil = (gabungan) => {
  if (gabungan.sumber_data !== "otomatis") {
    gabungan.kode_otomatis = null;
    gabungan.parameter_otomatis = null;
  }
  cekProfilIndikator(gabungan);
  if (gabungan.sumber_data === "otomatis") gabungan.parameter_otomatis = parameterOtomatis(gabungan.kode_otomatis, gabungan.parameter_otomatis);
  if (gabungan.target_nilai === null || gabungan.target_nilai === undefined) gabungan.target_sumber = null;
  return gabungan;
};
const tanpaUndefined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

rute.get(
  "/referensi",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const terpasang = new Set(
      (await query(`SELECT kode_bawaan FROM mutu_indikator WHERE faskes_uuid = $1 AND deleted_at IS NULL AND kode_bawaan IS NOT NULL`, [f])).map((r) => r.kode_bawaan),
    );
    kirim(res, {
      jenis: pilihan(JENIS_INDIKATOR),
      satuan: pilihan(SATUAN_INDIKATOR),
      arah: pilihan(ARAH_TARGET),
      sumber_target: pilihan(SUMBER_TARGET),
      frekuensi: pilihan(FREKUENSI_INDIKATOR),
      sumber_data: pilihan(SUMBER_DATA),
      status_data: pilihan(STATUS_DATA),
      status_tindak_lanjut: pilihan(STATUS_TINDAK_LANJUT),
      status_capaian: pilihan(STATUS_CAPAIAN),
      kode_otomatis: Object.entries(KODE_OTOMATIS).map(([kode, d]) => ({ kode, nama: d.nama, sumber: d.sumber, parameter: d.parameter })),
      unit: await query(`SELECT uuid, code AS kode, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status = true ORDER BY name`, [f]),
      regulasi_inm: REGULASI_INM,
      inm_bawaan: INM_BAWAAN.map((i) => ({
        kode_bawaan: i.kode_bawaan,
        judul: i.judul,
        target_nilai: i.target_nilai,
        arah: i.arah,
        satuan: i.satuan,
        sumber_data: i.sumber_data,
        terpasang: terpasang.has(i.kode_bawaan),
      })),
    });
  }),
);

rute.get(
  "/",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const pg = halaman(q);
    const syarat = ["i.faskes_uuid = $1", "i.deleted_at IS NULL"];
    const p = [f];
    const jenis = cekPilihan(q.jenis || undefined, JENIS_INDIKATOR, "jenis");
    const aktif = boolOpsional(q.aktif);
    const cari = teks(q.cari, "cari", 100);
    if (jenis) syarat.push(`i.jenis = $${p.push(jenis)}`);
    if (aktif !== undefined) syarat.push(`i.aktif = $${p.push(aktif)}`);
    if (cari) syarat.push(`(i.kode ILIKE $${p.push(`%${cari}%`)} OR i.judul ILIKE $${p.length})`);
    const where = syarat.join(" AND ");
    const total = (await satu(`SELECT COUNT(*) n FROM mutu_indikator i WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM.replace(/(^|,\s*)(\w+)/g, "$1i.$2")}, l.name AS unit_pj_nama,
              (SELECT COUNT(*) FROM mutu_indikator_data d WHERE d.indikator_uuid = i.uuid AND d.deleted_at IS NULL)::int AS jumlah_data
         FROM mutu_indikator i LEFT JOIN lokasi l ON l.uuid = i.unit_pj_uuid AND l.faskes_uuid = i.faskes_uuid
        WHERE ${where} ORDER BY i.jenis, i.kode LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, pg.limit, pg.offset],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/:uuid",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const ind = await ambilIndikator(req.params.uuid, f);
    const unit = ind.unit_pj_uuid ? await satu(`SELECT name FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2`, [ind.unit_pj_uuid, f]) : null;
    const audit = await query(
      `SELECT uuid, aksi, data_sebelum, data_sesudah, aktor, created_at FROM mutu_audit
        WHERE faskes_uuid = $1 AND entitas = 'indikator' AND entitas_uuid = $2 ORDER BY created_at DESC, uuid DESC LIMIT 100`,
      [f, ind.uuid],
    );
    kirim(res, { ...ind, unit_pj_nama: unit?.name ?? null, audit });
  }),
);

rute.post(
  "/",
  izinMutu(SUB, "CREATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const data = rapikanProfil(bacaProfil(req.body ?? {}, true));
    const hasil = await transaksi(async (k) => {
      data.unit_pj_uuid = (await cekUnit(req.body?.unit_pj_uuid, f, k, "unit_pj_uuid")) ?? null;
      const row = await sisipkan("mutu_indikator", { faskes_uuid: f, ...data, dibuat_oleh: req.author.username ?? null }, k);
      await catatAudit(k, req, "indikator", row.uuid, "buat", null, row);
      return row;
    });
    kirim(res, hasil, "Indikator berhasil ditambahkan");
  }, "Kode indikator sudah dipakai di faskes ini"),
);

rute.post(
  "/pasang-inm",
  izinMutu(SUB, "CREATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const pilih = req.body?.kode_bawaan;
    if (pilih !== undefined && !Array.isArray(pilih)) throw permintaanSalah("kode_bawaan harus berupa daftar");
    const daftar = pilih?.length ? INM_BAWAAN.filter((i) => pilih.includes(i.kode_bawaan)) : INM_BAWAAN;
    if (pilih?.length && daftar.length !== new Set(pilih).size) throw permintaanSalah("Sebagian kode_bawaan tidak dikenal");
    const hasil = await transaksi(async (k) => {
      // Kunci per faskes agar dua permintaan bersamaan tidak memasang ganda.
      await k.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`mutu_inm:${f}`]);
      const ada = await query(`SELECT kode, kode_bawaan FROM mutu_indikator WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [f], k);
      const bawaanAda = new Set(ada.map((r) => r.kode_bawaan).filter(Boolean));
      const kodeAda = new Set(ada.map((r) => r.kode));
      const dipasang = [];
      const dilewati = [];
      for (const i of daftar) {
        if (bawaanAda.has(i.kode_bawaan)) {
          dilewati.push({ kode_bawaan: i.kode_bawaan, alasan: "sudah terpasang" });
          continue;
        }
        if (kodeAda.has(i.kode)) {
          dilewati.push({ kode_bawaan: i.kode_bawaan, alasan: `kode ${i.kode} sudah dipakai indikator lain` });
          continue;
        }
        const row = await sisipkan("mutu_indikator", { faskes_uuid: f, ...i, aktif: true, dibuat_oleh: req.author.username ?? null }, k);
        await catatAudit(k, req, "indikator", row.uuid, "pasang_inm", null, row);
        dipasang.push({ uuid: row.uuid, kode: row.kode, judul: row.judul });
      }
      return { dipasang, dilewati };
    });
    kirim(res, hasil, hasil.dipasang.length ? `${hasil.dipasang.length} indikator INM dipasang` : "Tidak ada INM baru yang dipasang");
  }),
);

rute.put(
  "/:uuid",
  izinMutu(SUB, "UPDATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const perubahan = tanpaUndefined(bacaProfil(req.body ?? {}, false));
    const hasil = await transaksi(async (k) => {
      const lama = await ambilIndikator(req.params.uuid, f, k, true);
      const gabungan = rapikanProfil({ ...lama, target_nilai: lama.target_nilai === null ? null : Number(lama.target_nilai), ...perubahan });
      const unit = await cekUnit(req.body?.unit_pj_uuid, f, k, "unit_pj_uuid");
      const ubahan = {
        ...perubahan,
        kode_otomatis: gabungan.kode_otomatis,
        parameter_otomatis: gabungan.parameter_otomatis,
        target_sumber: gabungan.target_sumber,
        ...(unit !== undefined ? { unit_pj_uuid: unit } : {}),
      };
      const row = await ubah("mutu_indikator", lama.uuid, f, ubahan, k);
      await catatAudit(k, req, "indikator", row.uuid, "ubah", lama, row);
      return row;
    });
    kirim(res, hasil, "Indikator berhasil diubah");
  }, "Kode indikator sudah dipakai di faskes ini"),
);

rute.delete(
  "/:uuid",
  izinMutu(SUB, "DELETE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilIndikator(req.params.uuid, f, k, true);
      const ada = await satu(`SELECT COUNT(*)::int n FROM mutu_indikator_data WHERE indikator_uuid = $1 AND deleted_at IS NULL`, [lama.uuid], k);
      if (ada.n > 0) throw konflik(`Indikator sudah memiliki ${ada.n} data; nonaktifkan indikator alih-alih menghapus`);
      const n = sekarang();
      await k.query(`UPDATE mutu_indikator SET deleted_at = $1, updated_at = $1 WHERE uuid = $2 AND faskes_uuid = $3`, [n, lama.uuid, f]);
      await k.query(`UPDATE mutu_indikator_tindak_lanjut SET deleted_at = $1, updated_at = $1 WHERE indikator_uuid = $2 AND faskes_uuid = $3 AND deleted_at IS NULL`, [n, lama.uuid, f]);
      await catatAudit(k, req, "indikator", lama.uuid, "hapus", lama, null);
    });
    kirim(res, { uuid: req.params.uuid }, "Indikator berhasil dihapus");
  }),
);

export default rute;
