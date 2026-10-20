'use strict';

// Super admin mendapat izin modul NICU (STD-0043). Sinkron katalog hanya mengaktifkan modul tanpa memberi izin, sehingga
// menu NICU tidak tampil bagi super admin yang daftar izinnya tidak kosong. Super admin dikenali dari NAMA PERAN (pola
// 20261019230000-izin_dashboard_command_center_virtual_office). Hanya menambah submodul/aksi yang belum ada; daftar izin
// kosong (super admin tanpa batas) tidak diubah. Peran admin faskes mendapat izin saat modul diaktifkan lewat Setting ›
// Manajemen Modul (sinkron-modul auth-service); peran lain diatur manual di Setting › Hak Akses.
// Definisi izin dibaca dari auth-service/src/helpers/permission-list.js.

const path = require('path');
const { pathToFileURL } = require('url');

const gabungSub = (tujuan, sumber) => {
  let berubah = false;
  for (const s of sumber.subModules ?? []) {
    let t = tujuan.subModules.find((x) => x?.name === s.name);
    if (!t) {
      tujuan.subModules.push(JSON.parse(JSON.stringify(s)));
      berubah = true;
      continue;
    }
    if (Array.isArray(s.allows)) {
      const lama = Array.isArray(t.allows) ? t.allows : [];
      const baru = [...new Set([...lama, ...s.allows])];
      if (baru.length !== lama.length) {
        t.allows = baru;
        berubah = true;
      }
    }
    for (const f of s.features ?? []) {
      t.features = Array.isArray(t.features) ? t.features : [];
      const tf = t.features.find((x) => x?.name === f.name);
      if (!tf) {
        t.features.push(JSON.parse(JSON.stringify(f)));
        berubah = true;
      } else {
        const lama = Array.isArray(tf.allows) ? tf.allows : [];
        const baru = [...new Set([...lama, ...(f.allows ?? [])])];
        if (baru.length !== lama.length) {
          tf.allows = baru;
          berubah = true;
        }
      }
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
    const definisi = [izin.nicuPermission].filter(
      (d) => d && Array.isArray(d.subModules) && d.subModules.length
    );

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
      for (const d of definisi) {
        let modul = data.find((x) => x?.module === d.module);
        if (!modul) {
          modul = { module: d.module, subModules: [] };
          data.push(modul);
          berubah = true;
        }
        if (!Array.isArray(modul.subModules)) modul.subModules = [];
        if (gabungSub(modul, d)) berubah = true;
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
