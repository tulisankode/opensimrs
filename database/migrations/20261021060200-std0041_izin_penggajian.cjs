'use strict';

// Izin penggajian hanya ditambahkan kepada super admin; izin peran lain diberikan manusia.
const path = require('path');
const { pathToFileURL } = require('url');

const proses = async (queryInterface, tambah, transaction) => {
  const sq = queryInterface.sequelize;
  const { sdmPermission } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
  );
  const nama = sdmPermission.module;
  const submodul = sdmPermission.subModules.filter((s) => / Penggajian$/.test(s.name));
  const namaSub = new Set(submodul.map((s) => s.name));
  const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions FROM "role" WHERE lower(name) = 'super admin' AND deleted_at IS NULL`, { transaction });
  const [akun] = await sq.query(
    `SELECT 'users' AS tabel, u.uuid, u.permissions FROM "users" u JOIN "role" r ON r.uuid::text = u.role_uuid::text
     WHERE lower(r.name) = 'super admin' AND r.deleted_at IS NULL AND u.deleted_at IS NULL`, { transaction }
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
      await sq.query(`UPDATE "${r.tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid }, transaction });
    }
  }
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => proses(queryInterface, true, transaction));
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => proses(queryInterface, false, transaction));
  },
};
