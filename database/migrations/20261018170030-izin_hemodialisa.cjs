'use strict';

// Izin modul baru "Hemodialisa" (STD-0033): peran & akun super admin mendapat seluruh submodul/aksi Hemodialisa
// (definisi dari auth-service permission-list.js, hemodialisaPermission). Super admin dikenali dari nama peran (akun
// superadmin bisa memiliki faskes_uuid). Daftar izin kosong = super admin tanpa batas, tidak diubah (bila diisi satu
// modul justru membatasi akses). Peran faskes TIDAK diberi otomatis: admin faskes mendapat izin lewat sinkron modul saat
// modul diaktifkan di Manajemen Modul; perawat/dokter/admisi/kasir diatur di Setting › Hak Akses (pengesahan resep dan
// konfigurasi HDIS sengaja tidak diberikan otomatis). Submodul/aksi digabung, tidak digandakan (idempoten).

const path = require('path');
const { pathToFileURL } = require('url');

const baris = async (sq) => {
  const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions FROM "role" WHERE lower(name) = 'super admin' AND deleted_at IS NULL`);
  const [akun] = await sq.query(
    `SELECT 'users' AS tabel, u.uuid, u.permissions FROM "users" u JOIN "role" r ON r.uuid::text = u.role_uuid::text
     WHERE lower(r.name) = 'super admin' AND u.deleted_at IS NULL`
  );
  return [...peran, ...akun];
};

// Gabungkan aksi (allows) per submodul/fitur tanpa menghapus aksi yang sudah ada.
const gabungAllows = (tujuan, sumber) => {
  if (!Array.isArray(tujuan.allows)) tujuan.allows = [];
  let berubah = false;
  for (const aksi of sumber.allows ?? []) {
    if (!tujuan.allows.includes(aksi)) {
      tujuan.allows.push(aksi);
      berubah = true;
    }
  }
  return berubah;
};

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    const { hemodialisaPermission } = await import(
      pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
    );
    for (const r of await baris(sq)) {
      let data;
      try {
        data = JSON.parse(r.permissions || '[]');
      } catch {
        continue;
      }
      if (!Array.isArray(data) || !data.length) continue;
      let berubah = false;
      let modul = data.find((x) => x?.module === hemodialisaPermission.module);
      if (!modul) {
        modul = { module: hemodialisaPermission.module, subModules: [] };
        data.push(modul);
        berubah = true;
      }
      if (!Array.isArray(modul.subModules)) modul.subModules = [];
      for (const sub of hemodialisaPermission.subModules) {
        let ada = modul.subModules.find((s) => s?.name === sub.name);
        if (!ada) {
          modul.subModules.push(JSON.parse(JSON.stringify(sub)));
          berubah = true;
          continue;
        }
        if (sub.allows) berubah = gabungAllows(ada, sub) || berubah;
        if (sub.features) {
          if (!Array.isArray(ada.features)) ada.features = [];
          for (const f of sub.features) {
            const fAda = ada.features.find((x) => x?.name === f.name);
            if (!fAda) {
              ada.features.push(JSON.parse(JSON.stringify(f)));
              berubah = true;
            } else berubah = gabungAllows(fAda, f) || berubah;
          }
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
