'use strict';
const { pathToFileURL } = require('url');
const path = require('path');
module.exports = {
  async up(queryInterface) {
    const { gabungIzinJadwal } = await import(pathToFileURL(path.join(__dirname, '../../auth-service/src/helpers/sdm-jadwal-izin.js')).href);
    const sq = queryInterface.sequelize;
    await sq.transaction(async (transaction) => {
      const [rows] = await sq.query(`SELECT 'role' AS tabel, r.uuid, r.permissions FROM role r
        WHERE r.deleted_at IS NULL AND lower(r.name) = 'super admin'
        UNION ALL SELECT 'users' AS tabel, u.uuid, u.permissions FROM users u JOIN role r ON r.uuid::text = u.role_uuid::text AND r.deleted_at IS NULL
        WHERE u.deleted_at IS NULL AND lower(r.name) = 'super admin'`, { transaction });
      for (const row of rows) {
        let data;
        try { data = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions; } catch { continue; }
        if (!Array.isArray(data) || !data.length) continue;
        const baru = gabungIzinJadwal(data);
        if (JSON.stringify(data) === JSON.stringify(baru)) continue;
        if (!['role', 'users'].includes(row.tabel)) throw new Error('Tabel izin tidak sah');
        await sq.query(`UPDATE "${row.tabel}" SET permissions = :p WHERE uuid = :u AND deleted_at IS NULL`, {
          replacements: { p: JSON.stringify(baru), u: row.uuid }, transaction,
        });
      }
    });
  },
  async down() {
    // Izin manual dan riwayat dipertahankan; fitur dapat dinonaktifkan dari katalog.
  },
};
