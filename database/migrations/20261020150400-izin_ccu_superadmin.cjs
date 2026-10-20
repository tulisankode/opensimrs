'use strict';

// Super admin mendapat izin modul baru "CCU" (STD-0045) agar menu Perawatan Intensif › CCU tampil setelah modul
// diaktifkan. Super admin dikenali dari NAMA PERAN (pola 20261019230000-izin_dashboard_command_center_virtual_office).
// Hanya menambah submodul/aksi yang belum ada; daftar izin kosong (super admin tanpa batas) tidak diubah. Peran faskes
// lain mendapat izin CCU lewat Setting › Manajemen Modul (sinkron izin admin faskes) atau Setting › Hak Akses.
// Definisi izin dibaca dari auth-service/src/helpers/permission-list.js.

const path = require('path');
const { pathToFileURL } = require('url');

const gabungSub = (tujuan, sumber) => {
  let berubah = false;
  for (const s of sumber.subModules ?? []) {
    const t = tujuan.subModules.find((x) => x?.name === s.name);
    if (!t) {
      tujuan.subModules.push(JSON.parse(JSON.stringify(s)));
      berubah = true;
      continue;
    }
    const lama = Array.isArray(t.allows) ? t.allows : [];
    const baru = [...new Set([...lama, ...(s.allows ?? [])])];
    if (baru.length !== lama.length) {
      t.allows = baru;
      berubah = true;
    }
  }
  return berubah;
};

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    const izin = await import(
      pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
    );
    const definisi = izin.ccuPermission;
    if (!definisi || !Array.isArray(definisi.subModules)) return;

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
      let modul = data.find((x) => x?.module === definisi.module);
      let berubah = false;
      if (!modul) {
        modul = { module: definisi.module, subModules: [] };
        data.push(modul);
        berubah = true;
      }
      if (!Array.isArray(modul.subModules)) modul.subModules = [];
      if (gabungSub(modul, definisi)) berubah = true;
      if (berubah) {
        await sq.query(`UPDATE "${r.tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
      }
    }
  },

  async down() {
    // Tidak dikembalikan: aksi yang ditambahkan tidak bisa dibedakan dari aksi yang diberikan admin secara manual.
  },
};
