'use strict';

// Izin Dashboard › Command Center (STD-0037) kini objek terpisah dashboardCommandCenterPermission di
// auth-service/src/helpers/permission-list.js (sebelumnya menumpang di dashboardPermission yang diberikan ke hampir
// semua peran). Migrasi 20261019230000 membaca dashboardPermission sehingga pada database baru tidak lagi memberi
// submodul ini; migrasi ini memberikannya ke super admin (dikenali dari NAMA PERAN, pola 20261019230000) dari objek
// baru. Hanya menambah submodul/aksi yang belum ada; daftar izin kosong (super admin tanpa batas) tidak diubah.
// Peran faskes lain (direksi, bed manager, kepala IGD/ruangan) diatur manual di Setting › Hak Akses. Idempoten.

const path = require('path');
const { pathToFileURL } = require('url');

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    const { dashboardCommandCenterPermission: d } = await import(
      pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
    );
    if (!d || !Array.isArray(d.subModules) || !d.subModules.length) return;

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
      let modul = data.find((x) => x?.module === d.module);
      if (!modul) {
        modul = { module: d.module, subModules: [] };
        data.push(modul);
        berubah = true;
      }
      if (!Array.isArray(modul.subModules)) modul.subModules = [];
      for (const s of d.subModules) {
        const t = modul.subModules.find((x) => x?.name === s.name);
        if (!t) {
          modul.subModules.push(JSON.parse(JSON.stringify(s)));
          berubah = true;
          continue;
        }
        const lama = Array.isArray(t.allows) ? t.allows : [];
        const baru = [...new Set([...lama, ...s.allows])];
        if (baru.length !== lama.length) {
          t.allows = baru;
          berubah = true;
        }
      }
      if (berubah) {
        await sq.query(`UPDATE "${r.tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
      }
    }
  },

  async down() {
    // Tidak dikembalikan: aksi yang ditambahkan tidak bisa dibedakan dari aksi yang diberikan admin secara manual.
  },
};
