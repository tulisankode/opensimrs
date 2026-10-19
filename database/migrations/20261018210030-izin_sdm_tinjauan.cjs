'use strict';

// Tinjauan HR / SDM (STD-0035) — izin:
//   - "HR / SDM" kini hanya berisi submodul yang benar-benar ada (Kepegawaian, Kredensial) dengan aksi baru DELETE
//     (Kepegawaian) serta CABUT & DELETE (Kredensial; data yang sama dengan Mutu › Kredensial Staf).
//     Submodul fase berikutnya yang diberikan migrasi 20261018150130 (Pola Shift, Jadwal Dinas, Kehadiran, Cuti & Izin,
//     Tukar Dinas, Pelatihan, Penggajian, Slip Gaji, Integrasi, Pengaturan, Laporan SDM) dilepas dari daftar izin super
//     admin agar Hak Akses tidak menjanjikan fitur yang belum ada; item lanjutan menambahkannya kembali bersama fiturnya.
//   - "Mutu & Akreditasi › Kredensial Staf" mendapat aksi VERIFIKASI (verifikasi kredensial tersedia di kedua modul).
// Hanya peran & akun super admin (nama peran "super admin" atau tanpa faskes) yang daftar izinnya tidak kosong; daftar
// kosong = super admin tanpa batas, tidak diubah. Peran faskes TIDAK diberi otomatis (data pegawai bersifat pribadi);
// diatur di Setting › Hak Akses. Aksi digabung, tidak digandakan (idempoten).

const path = require('path');
const { pathToFileURL } = require('url');

const BELUM_ADA = ['Pola Shift', 'Jadwal Dinas', 'Kehadiran', 'Cuti & Izin', 'Tukar Dinas', 'Pelatihan', 'Penggajian', 'Slip Gaji', 'Integrasi', 'Pengaturan', 'Laporan SDM'];

const baris = async (sq) => {
  const [rows] = await sq.query(
    `SELECT 'role' AS tabel, r.uuid, r.permissions FROM "role" r
      WHERE r.deleted_at IS NULL AND (lower(r.name) = 'super admin' OR r.faskes_uuid IS NULL)
     UNION ALL
     SELECT 'users' AS tabel, u.uuid, u.permissions FROM "users" u LEFT JOIN "role" r ON r.uuid::text = u.role_uuid::text
      WHERE u.deleted_at IS NULL AND (lower(r.name) = 'super admin' OR u.faskes_uuid IS NULL)`
  );
  return rows;
};

// Gabungkan submodul & aksi definisi ke entri modul (dibuat bila belum ada). true bila berubah.
const gabung = (data, definisi) => {
  let berubah = false;
  let modul = data.find((x) => x?.module === definisi.module);
  if (!modul) {
    data.push((modul = { module: definisi.module, subModules: [] }));
    berubah = true;
  }
  if (!Array.isArray(modul.subModules)) modul.subModules = [];
  for (const sub of definisi.subModules) {
    const ada = modul.subModules.find((s) => s?.name === sub.name);
    if (!ada) {
      modul.subModules.push(JSON.parse(JSON.stringify(sub)));
      berubah = true;
      continue;
    }
    if (!Array.isArray(ada.allows)) ada.allows = [];
    for (const aksi of sub.allows) {
      if (!ada.allows.includes(aksi)) {
        ada.allows.push(aksi);
        berubah = true;
      }
    }
  }
  return { modul, berubah };
};

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    const { sdmPermission, mutuPermission } = await import(
      pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
    );
    const kredensialStaf = { module: mutuPermission.module, subModules: mutuPermission.subModules.filter((s) => s.name === 'Kredensial Staf') };
    for (const r of await baris(sq)) {
      let data;
      try {
        data = JSON.parse(r.permissions || '[]');
      } catch {
        continue;
      }
      if (!Array.isArray(data) || !data.length) continue;
      const sdm = gabung(data, sdmPermission);
      let berubah = sdm.berubah;
      const sisa = sdm.modul.subModules.filter((s) => !BELUM_ADA.includes(s?.name));
      if (sisa.length !== sdm.modul.subModules.length) {
        sdm.modul.subModules = sisa;
        berubah = true;
      }
      // Mutu hanya digabung bila modulnya sudah ada di daftar izin (mengikuti keputusan migrasi izin Mutu).
      if (data.some((x) => x?.module === mutuPermission.module)) berubah = gabung(data, kredensialStaf).berubah || berubah;
      if (berubah) {
        await sq.query(`UPDATE "${r.tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
      }
    }
  },

  async down() {
    // Aksi tambahan dibiarkan; submodul fase berikutnya akan diberikan kembali oleh migrasi item lanjutan.
  },
};
