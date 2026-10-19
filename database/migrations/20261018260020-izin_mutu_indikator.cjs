'use strict';

// Izin submodul baru "Mutu & Akreditasi › Indikator Mutu" (STD-0025; definisi dari auth-service permission-list.js,
// mutuPermission). Hanya peran & akun super admin — dikenali dari NAMA PERAN, karena akun superadmin bisa memiliki
// faskes_uuid (lihat 20261018250000-izin_superadmin_modul_baru) — yang SUDAH memiliki daftar izin; daftar kosong = super
// admin tanpa batas, tidak diubah. Peran faskes
// (Komite Mutu, PIC/pengumpul unit, validator) TIDAK diberi otomatis — diatur di Setting › Hak Akses; admin faskes
// mendapat izin lewat sinkron modul. Submodul lain (dokumen, kredensial) tidak disentuh. Idempoten: submodul & aksi yang
// sudah ada tidak digandakan.

const path = require('path');
const { pathToFileURL } = require('url');

const SUBMODUL = 'Indikator Mutu';

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  const { mutuPermission } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
  );
  const definisi = mutuPermission.subModules.find((s) => s.name === SUBMODUL);
  const nama = mutuPermission.module;
  const [peran] = await sq.query(
    `SELECT 'role' AS tabel, uuid, permissions FROM "role" WHERE lower(name) = 'super admin' AND deleted_at IS NULL AND permissions IS NOT NULL AND permissions <> ''`
  );
  const [akun] = await sq.query(
    `SELECT 'users' AS tabel, u.uuid, u.permissions FROM "users" u JOIN "role" r ON r.uuid::text = u.role_uuid::text
     WHERE lower(r.name) = 'super admin' AND u.deleted_at IS NULL AND u.permissions IS NOT NULL AND u.permissions <> ''`
  );
  {
    for (const r of [...peran, ...akun]) {
      const tabel = r.tabel;
      let data;
      try {
        data = JSON.parse(r.permissions);
      } catch {
        continue;
      }
      if (!Array.isArray(data) || !data.length) continue;
      let modul = data.find((x) => x?.module === nama);
      let berubah = false;
      if (tambah) {
        if (!modul) {
          data.push((modul = { module: nama, subModules: [] }));
          berubah = true;
        }
        if (!Array.isArray(modul.subModules)) modul.subModules = [];
        const ada = modul.subModules.find((s) => s?.name === SUBMODUL);
        if (!ada) {
          modul.subModules.push(JSON.parse(JSON.stringify(definisi)));
          berubah = true;
        } else {
          if (!Array.isArray(ada.allows)) ada.allows = [];
          for (const aksi of definisi.allows) {
            if (!ada.allows.includes(aksi)) {
              ada.allows.push(aksi);
              berubah = true;
            }
          }
        }
      } else if (modul && Array.isArray(modul.subModules) && modul.subModules.some((s) => s?.name === SUBMODUL)) {
        const sisa = modul.subModules.filter((s) => s?.name !== SUBMODUL);
        if (sisa.length) modul.subModules = sisa;
        else data.splice(data.indexOf(modul), 1);
        berubah = true;
      }
      if (berubah) {
        await sq.query(`UPDATE "${tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
      }
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
