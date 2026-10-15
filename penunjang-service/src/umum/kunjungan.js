import { satu } from "../db.js";

// Data kunjungan, pasien & praktisi yang dibaca lintas modul (database bersama).

// Kunjungan asal (RJ/RI/IGD) berdasarkan No. Registrasi. RI: practitioner_uuid = DPJP, lokasi_uuid = ruang/kamar
// rawat (diisi Admisi saat penempatan bed; sebelum itu ruang tujuan SPRI).
export const cariKunjungan = (noReg, faskesUuid) =>
  !noReg
    ? null
    : satu(
        `SELECT * FROM (
           SELECT 'RJ' AS type, 'rajal' AS pelayanan, 'Rawat Jalan' AS service_name, r.uuid, r.no_reg, r.patient_uuid,
                  r.practitioner_uuid, r.payment_method, r.lokasi_uuid, r.rekam_medis_uuid
             FROM rawat_jalans r WHERE r.no_reg = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL
           UNION ALL
           SELECT 'RI', 'ranap', 'Rawat Inap', r.uuid, r.no_reg, r.patient_uuid, r.practitioner_uuid, r.payment_method,
                  r.lokasi_uuid, r.rekam_medis_uuid
             FROM rawat_inaps r WHERE r.no_reg = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL
           UNION ALL
           SELECT 'IGD', 'igd', 'IGD', r.uuid, r.no_reg, r.patient_uuid, r.practitioner_uuid, r.payment_method,
                  -- kunjungan IGD dari Admisi tidak menyimpan lokasi: pakai lokasi pelayanan IGD faskes
                  COALESCE(r.lokasi_uuid, (SELECT l.uuid FROM lokasi l
                                            WHERE l.faskes_uuid = r.faskes_uuid AND l.pelayanan = 'IGD' AND l.deleted_at IS NULL
                                            ORDER BY (l.location_type = 'Ward') DESC, l.id LIMIT 1)),
                  r.rekam_medis_uuid
             FROM instalasi_gawat_darurats r WHERE r.no_reg = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL
         ) k LIMIT 1`,
        [noReg, faskesUuid],
      );

// Kunjungan berdasarkan dokumen rekam medis (order dari RME).
export const kunjunganDariRekamMedis = (rekamMedisUuid, faskesUuid) =>
  !rekamMedisUuid
    ? null
    : satu(
        `SELECT no_reg FROM (
           SELECT no_reg FROM rawat_jalans WHERE rekam_medis_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
           UNION ALL SELECT no_reg FROM rawat_inaps WHERE rekam_medis_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
           UNION ALL SELECT no_reg FROM instalasi_gawat_darurats WHERE rekam_medis_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL
         ) k LIMIT 1`,
        [rekamMedisUuid, faskesUuid],
      ).then((r) => (r ? cariKunjungan(r.no_reg, faskesUuid) : null));

export const pasien = (patientUuid, faskesUuid) =>
  satu(
    `SELECT p.uuid, p.no_rm, p.name, p.gender, p.phone, bd.birth_date
       FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
      WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL`,
    [patientUuid, faskesUuid],
  );

export const namaPraktisi = async (practitionerUuid) =>
  !practitionerUuid
    ? null
    : (await satu(
        `SELECT TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = $1`,
        [practitionerUuid],
      ))?.nama ?? null;
