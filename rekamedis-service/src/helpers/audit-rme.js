import { QueryTypes } from "sequelize";
import sequelizeInstance from "../configurations/sequelize-instance.js";
import { catatPeristiwaAudit } from "@opensimrs/model-sdk/audit-sequelize";

// STD-0029 — Audit Trail terpusat: dokumen RME tersimpan di MongoDB (bukan lewat hook Sequelize), jadi perubahan dan
// akses baca dicatat eksplisit lewat helper ini. `audit_trail` tetap satu tabel PostgreSQL bersama (sama dengan
// layanan lain); rekamedis-service punya instance Sequelize Postgres sendiri untuk model lokalnya (lihat
// configurations/sequelize-instance.js), dipakai di sini hanya untuk menulis baris audit.
//
// Koleksi `rekam_medises` tidak menyimpan uuid pasien (hanya `no_rm`/`no_pelayanan`), jadi `patient_uuid` ditelusuri
// balik ke tabel kunjungan Postgres yang ditautkan rekamedis-service saat RME dibuat (lihat
// repositories/pelayanan-repository.js `insertRekamMedis`), lewat `no_pelayanan` + `faskes_uuid`. Bila tidak
// ditemukan, `patient_uuid` dibiarkan null (bukan memakai `no_rm` sebagai pengganti) agar riwayat akses per pasien
// tidak tercampur dengan pencarian lain berdasarkan `patient_uuid`. Isi klinis (sesi, assessment, vital sign, dsb.)
// TIDAK disalin ke audit — hanya metadata dokumen yang berubah.
const TABEL_PELAYANAN = {
  igd: { tabel: "instalasi_gawat_darurats", kolomNoPelayanan: "no_pelayanan" },
  rj: { tabel: "rawat_jalans", kolomNoPelayanan: "no_pelayanan" },
  ri: { tabel: "rawat_inaps", kolomNoPelayanan: "no_pelayanan" },
  fisio: { tabel: "order_fisio", kolomNoPelayanan: "no_order" },
};

async function ambilPatientUuidPelayanan({ pelayanan, noPelayanan, faskesUuid }) {
  const target = TABEL_PELAYANAN[pelayanan];
  if (!target || !noPelayanan || !faskesUuid) return null;
  try {
    const rows = await sequelizeInstance.query(
      `SELECT patient_uuid FROM ${target.tabel} WHERE ${target.kolomNoPelayanan} = :noPelayanan AND faskes_uuid = :faskesUuid LIMIT 1`,
      { replacements: { noPelayanan, faskesUuid }, type: QueryTypes.SELECT }
    );
    return rows?.[0]?.patient_uuid ?? null;
  } catch (error) {
    console.error("[audit-trail] gagal menelusuri patient_uuid RME:", error.message);
    return null;
  }
}

export async function catatAksesBacaRme({ faskesUuid, rekamMedisUuid, pelayanan, noPelayanan }) {
  if (!faskesUuid) return;
  const patientUuid = await ambilPatientUuidPelayanan({ pelayanan, noPelayanan, faskesUuid });
  await catatPeristiwaAudit(sequelizeInstance, {
    faskes_uuid: faskesUuid,
    layanan: "rekamedis",
    aksi: "baca",
    entitas: "Rekam Medis",
    entitas_uuid: rekamMedisUuid ? String(rekamMedisUuid) : null,
    patient_uuid: patientUuid,
  });
}

export async function catatPerubahanRme({ faskesUuid, rekamMedisUuid, pelayanan, noPelayanan, aksi, ringkasanPerubahan }) {
  if (!faskesUuid) return;
  const patientUuid = await ambilPatientUuidPelayanan({ pelayanan, noPelayanan, faskesUuid });
  await catatPeristiwaAudit(sequelizeInstance, {
    faskes_uuid: faskesUuid,
    layanan: "rekamedis",
    aksi,
    entitas: "Rekam Medis",
    entitas_uuid: rekamMedisUuid ? String(rekamMedisUuid) : null,
    patient_uuid: patientUuid,
    ringkasan_perubahan: ringkasanPerubahan ?? null,
  });
}
