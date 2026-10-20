'use strict';
const { pathToFileURL } = require('url');
const path = require('path');

module.exports = {
  async up(queryInterface) {
    const { sdmPermission } = await import(pathToFileURL(path.join(__dirname, '../../auth-service/src/helpers/permission-list.js')).href);
    const sub = sdmPermission.subModules.find((s) => s.name === 'Kehadiran, Cuti & Izin');
    if (!sub) throw new Error('Definisi izin Kehadiran, Cuti & Izin tidak ditemukan');
    const sq = queryInterface.sequelize;
    await sq.transaction(async (transaction) => {
      const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions FROM "role" WHERE lower(name) = 'super admin' AND deleted_at IS NULL FOR UPDATE`, { transaction });
      const [akun] = await sq.query(`SELECT 'users' AS tabel, u.uuid, u.permissions FROM users u JOIN "role" r ON r.uuid::text = u.role_uuid::text
        WHERE lower(r.name) = 'super admin' AND r.deleted_at IS NULL AND u.deleted_at IS NULL FOR UPDATE OF u`, { transaction });
      for (const r of [...peran, ...akun]) {
        let data;
        try { data = typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions; } catch { continue; }
        if (!Array.isArray(data) || !data.length) continue;
        let modul = data.find((m) => m.module === sdmPermission.module);
        if (!modul) { modul = { module: sdmPermission.module, subModules: [] }; data.push(modul); }
        modul.subModules ??= [];
        let lama = modul.subModules.find((s) => s.name === sub.name);
        if (!lama) modul.subModules.push(JSON.parse(JSON.stringify(sub)));
        else lama.allows = [...new Set([...(lama.allows ?? []), ...sub.allows])];
        await sq.query(`UPDATE "${r.tabel}" SET permissions = :izin WHERE uuid = :uuid AND deleted_at IS NULL`, { replacements: { izin: JSON.stringify(data), uuid: r.uuid }, transaction });
      }
    });
  },
  async down() {
    // Izin yang kemudian diberikan manusia tidak dicabut oleh pemulihan otomatis.
  },
};
