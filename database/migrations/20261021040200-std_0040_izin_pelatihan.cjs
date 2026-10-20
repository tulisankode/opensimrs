'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

module.exports = {
  async up(queryInterface) {
    const { sdmPermission } = await import(pathToFileURL(path.join(__dirname, '../../auth-service/src/helpers/permission-list.js')).href);
    const definisi = sdmPermission.subModules.find((s) => s.name === 'Pelatihan');
    await queryInterface.sequelize.transaction(async (transaction) => {
      const sq = queryInterface.sequelize;
      const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions FROM "role"
        WHERE lower(name) = 'super admin' AND deleted_at IS NULL FOR UPDATE`, { transaction });
      const [akun] = await sq.query(`SELECT 'users' AS tabel, u.uuid, u.permissions FROM users u JOIN "role" r ON r.uuid::text = u.role_uuid::text
        WHERE lower(r.name) = 'super admin' AND r.deleted_at IS NULL AND u.deleted_at IS NULL FOR UPDATE OF u`, { transaction });
      for (const r of [...peran, ...akun]) {
        let izin;
        try { izin = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions; } catch { continue; }
        // Daftar kosong adalah super admin tanpa batas; peran lain tidak diberi izin otomatis.
        if (!Array.isArray(izin) || !izin.length) continue;
        let modul = izin.find((m) => m.module === sdmPermission.module);
        if (!modul) izin.push((modul = { module: sdmPermission.module, subModules: [] }));
        if (!Array.isArray(modul.subModules)) modul.subModules = [];
        let sub = modul.subModules.find((s) => s.name === definisi.name);
        if (!sub) modul.subModules.push((sub = { name: definisi.name, allows: [] }));
        if (!Array.isArray(sub.allows)) sub.allows = [];
        for (const aksi of definisi.allows) if (!sub.allows.includes(aksi)) sub.allows.push(aksi);
        await sq.query(`UPDATE "${r.tabel}" SET permissions = :izin WHERE uuid = :uuid`, { replacements: { izin: JSON.stringify(izin), uuid: r.uuid }, transaction });
      }
    });
  },
  async down() {
    // Pencabutan izin yang sudah dikelola manusia dilakukan melalui Hak Akses.
  },
};
