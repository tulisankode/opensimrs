import { satu, query } from "../db.js";
import { permintaanSalah, tidakDitemukan } from "./respons.js";

// Data pasien & kunjungan rawat jalan yang dibaca lintas modul (database bersama). Pelayanan program puskesmas
// (KIA/KB/Imunisasi/MTBS) selalu tertaut ke kunjungan rawat jalan yang sudah ada (bukan kunjungan baru).

export const pasien = (patientUuid, faskesUuid) =>
  satu(
    `SELECT p.uuid, p.no_rm, p.name, p.gender, p.no_identity, bd.birth_date::text AS tanggal_lahir
       FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
      WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL`,
    [patientUuid, faskesUuid],
  );

export const rawatJalan = (uuid, faskesUuid) =>
  satu(
    `SELECT uuid, patient_uuid, no_reg, name, gender, maternity, tanggal_periksa, rekam_medis_uuid
       FROM rawat_jalans WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`,
    [uuid, faskesUuid],
  );

// Pastikan kunjungan rawat jalan ada, milik faskes ini, dan (bila diisi) milik pasien yang sama.
export const pastikanRawatJalan = async (rawatJalanUuid, faskesUuid, patientUuid = null) => {
  if (!rawatJalanUuid) throw permintaanSalah("rawat_jalan_uuid wajib diisi");
  const rj = await rawatJalan(rawatJalanUuid, faskesUuid);
  if (!rj) throw tidakDitemukan("Kunjungan rawat jalan");
  if (patientUuid && rj.patient_uuid !== patientUuid) throw permintaanSalah("Kunjungan rawat jalan bukan milik pasien ini");
  return rj;
};

export const pastikanPasien = async (patientUuid, faskesUuid) => {
  const p = await pasien(patientUuid, faskesUuid);
  if (!p) throw tidakDitemukan("Pasien");
  return p;
};

export const pastikanKelurahan = async (kode) => {
  if (!kode) throw permintaanSalah("kelurahan_code wajib diisi");
  const k = await satu(`SELECT code, name FROM kelurahan WHERE code = $1`, [kode]);
  if (!k) throw permintaanSalah("kelurahan_code tidak ditemukan di master wilayah");
  return k;
};

// Kunjungan rawat jalan terbaru milik seorang pasien (dipakai frontend memilih kunjungan saat mencatat
// pelayanan KIA/KB/Imunisasi/MTBS). `maternity` opsional untuk membatasi ke kunjungan kebidanan (KIA).
export const daftarKunjunganPasien = (patientUuid, faskesUuid, { maternity } = {}) => {
  const p = [patientUuid, faskesUuid];
  let w = "patient_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL";
  if (maternity !== undefined) {
    p.push(maternity);
    w += ` AND maternity = $${p.length}`;
  }
  return query(
    `SELECT uuid, no_reg, maternity, tanggal_periksa, rekam_medis_uuid FROM rawat_jalans WHERE ${w} ORDER BY tanggal_periksa DESC LIMIT 20`,
    p,
  );
};
