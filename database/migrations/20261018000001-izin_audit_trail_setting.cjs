'use strict';

// Submodul izin "Audit Trail" (LIHAT, EKSPOR) pada modul Setting yang sudah ada (auth-service permission-list,
// settingPermission). Setting tidak punya entri di katalog modul (bagian inti), jadi izin ini cukup ditambahkan ke
// peran & pengguna super admin saja — sesuai STD-0029: izin lihat/ekspor audit tidak diberikan otomatis selain ke
// superadmin. Idempoten.
const MODULE = 'Setting';
const SUBMODULE = 'Audit Trail';
const SUBMODULE_BARU = { name: SUBMODULE, allows: ['LIHAT', 'EKSPOR'] };

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
    for (const r of await ambilBaris(queryInterface)) {
      const data = baca(r.permissions);
      if (!data) continue;
      const modul = data.find((m) => m?.module === MODULE);
      if (!modul) continue;
      if (!Array.isArray(modul.subModules)) modul.subModules = [];
      if (modul.subModules.some((sm) => sm?.name === SUBMODULE)) continue;
      modul.subModules.push(SUBMODULE_BARU);
      await queryInterface.sequelize.query(`UPDATE ${r.tabel} SET permissions = :p WHERE id = :id`, {
        replacements: { p: JSON.stringify(data), id: r.id },
      });
    }
  },

  async down(queryInterface) {
    for (const r of await ambilBaris(queryInterface)) {
      const data = baca(r.permissions);
      if (!data) continue;
      const modul = data.find((m) => m?.module === MODULE);
      if (!modul || !Array.isArray(modul.subModules)) continue;
      const sebelum = modul.subModules.length;
      modul.subModules = modul.subModules.filter((sm) => sm?.name !== SUBMODULE);
      if (modul.subModules.length === sebelum) continue;
      await queryInterface.sequelize.query(`UPDATE ${r.tabel} SET permissions = :p WHERE id = :id`, {
        replacements: { p: JSON.stringify(data), id: r.id },
      });
    }
  },
};
