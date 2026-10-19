'use strict';

// Izin Remunerasi (STD-0032): submodul baru pada modul izin "Akuntansi & Remunerasi" yang sudah ada (definisi dari
// auth-service permission-list.js, akuntansiPermission — submodul berakhiran "Remunerasi"). Hanya peran & akun super
// admin — dikenali dari NAMA PERAN (lower(role.name) = 'super admin'; akun lewat users JOIN role) — yang SUDAH memiliki
// daftar izin; daftar kosong = super admin tanpa batas, tidak diubah. Peran faskes (tim remunerasi, verifikator,
// direksi, keuangan, dokter/nakes untuk slip) TIDAK diberi otomatis — diatur di Setting › Hak Akses.
// Idempoten: hanya menambah submodul/aksi yang belum ada; down hanya melepas submodul Remunerasi.

const path = require('path');
const { pathToFileURL } = require('url');

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  const { akuntansiPermission } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
  );
  const nama = akuntansiPermission.module;
  const submodul = akuntansiPermission.subModules.filter((s) => / Remunerasi$/.test(s.name));
  const namaSub = new Set(submodul.map((s) => s.name));
  const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions FROM "role" WHERE lower(name) = 'super admin' AND deleted_at IS NULL`);
  const [akun] = await sq.query(
    `SELECT 'users' AS tabel, u.uuid, u.permissions FROM "users" u JOIN "role" r ON r.uuid::text = u.role_uuid::text
     WHERE lower(r.name) = 'super admin' AND u.deleted_at IS NULL`
  );
  for (const r of [...peran, ...akun]) {
    let data;
    try {
      data = JSON.parse(r.permissions || '[]');
    } catch {
      continue;
    }
    if (!Array.isArray(data) || !data.length) continue;
    let berubah = false;
    let modul = data.find((x) => x?.module === nama);
    if (tambah) {
      if (!modul) {
        data.push((modul = { module: nama, subModules: [] }));
        berubah = true;
      }
      if (!Array.isArray(modul.subModules)) modul.subModules = [];
      for (const s of submodul) {
        const ada = modul.subModules.find((x) => x?.name === s.name);
        if (!ada) {
          modul.subModules.push(JSON.parse(JSON.stringify(s)));
          berubah = true;
          continue;
        }
        if (!Array.isArray(ada.allows)) ada.allows = [];
        for (const aksi of s.allows) {
          if (!ada.allows.includes(aksi)) {
            ada.allows.push(aksi);
            berubah = true;
          }
        }
      }
    } else if (modul && Array.isArray(modul.subModules)) {
      const sisa = modul.subModules.filter((x) => !namaSub.has(x?.name));
      if (sisa.length !== modul.subModules.length) {
        modul.subModules = sisa;
        berubah = true;
      }
    }
    if (berubah) {
      await sq.query(`UPDATE "${r.tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
    }
  }
};

module.exports = {
  async up(queryInterface) {
    await proses(queryInterface, true);
  },
  async down(queryInterface) {
    await proses(queryInterface, false);
  },
};
