'use strict';

// Modul izin "SIMRS Studio" (auth-service permission-list) untuk role super admin & penggunanya, agar superadmin dapat
// memberikannya ke peran lain lewat editor Role. Tidak diberikan ke peran faskes mana pun (diatur manual per peran).
// Idempoten.
const path = require('path');
const { pathToFileURL } = require('url');

const MODULE = 'SIMRS Studio';

const ambilBaris = async (queryInterface) => {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT 'role' AS tabel, r.id, r.permissions FROM role r
    WHERE lower(r.name) = 'super admin' AND r.faskes_uuid IS NULL AND r.deleted_at IS NULL
    UNION ALL
    SELECT 'users' AS tabel, u.id, u.permissions FROM users u
    JOIN role r ON r.uuid = u.role_uuid
    WHERE lower(r.name) = 'super admin' AND r.faskes_uuid IS NULL AND r.deleted_at IS NULL AND u.deleted_at IS NULL
  `);
  return rows;
};

const baca = (teks) => {
  try {
    const data = typeof teks === 'string' ? JSON.parse(teks) : teks;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

module.exports = {
  async up(queryInterface) {
    const { mapPermission } = await import(
      pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
    );
    const [definisi] = mapPermission([MODULE]);
    if (!definisi) return;
    for (const r of await ambilBaris(queryInterface)) {
      const data = baca(r.permissions);
      if (!data || data.some((m) => m?.module === MODULE)) continue;
      data.push(definisi);
      await queryInterface.sequelize.query(`UPDATE ${r.tabel} SET permissions = :p WHERE id = :id`, { replacements: { p: JSON.stringify(data), id: r.id } });
    }
  },

  async down(queryInterface) {
    for (const r of await ambilBaris(queryInterface)) {
      const data = baca(r.permissions);
      if (!data || !data.some((m) => m?.module === MODULE)) continue;
      await queryInterface.sequelize.query(`UPDATE ${r.tabel} SET permissions = :p WHERE id = :id`, {
        replacements: { p: JSON.stringify(data.filter((m) => m?.module !== MODULE)), id: r.id },
      });
    }
  },
};
