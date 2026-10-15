'use strict';

// Role "super admin" dibuat dari permission-list auth-service yang belum memuat submodul
// "Rekapitulasi Diagnosis berdasarkan Umur Pasien", sehingga halaman tersebut selalu 403.
// Tambahkan submodul itu ke modul Laporan pada role super admin dan salinan permission
// pengguna dengan role tersebut (users.permissions dipakai saat login). Idempoten.
// Role/pengguna lain diatur lewat menu Datamaster.
const MODULE = 'Laporan';
const SUBMODULE = 'Rekapitulasi Diagnosis berdasarkan Umur Pasien';

const ubahPermission = (teks, fn) => {
  let data;
  try {
    data = typeof teks === "string" ? JSON.parse(teks) : teks;
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const laporan = data.find((m) => m && m.module === MODULE && Array.isArray(m.subModules));
  if (!laporan) return null;
  const berubah = fn(laporan);
  return berubah ? JSON.stringify(data) : null;
};

// Role super admin + pengguna yang memakai role tersebut
const ambilBaris = async (queryInterface) => {
  const [rows] = await queryInterface.sequelize.query(`
    SELECT 'role' AS tabel, r.id, r.permissions FROM role r
    WHERE lower(r.name) = 'super admin' AND r.deleted_at IS NULL
    UNION ALL
    SELECT 'users' AS tabel, u.id, u.permissions FROM users u
    JOIN role r ON r.uuid = u.role_uuid
    WHERE lower(r.name) = 'super admin' AND r.deleted_at IS NULL AND u.deleted_at IS NULL
  `);
  return rows;
};

module.exports = {
  async up(queryInterface) {
    const roles = await ambilBaris(queryInterface);
    for (const role of roles) {
      const baru = ubahPermission(role.permissions, (laporan) => {
        if (laporan.subModules.some((s) => s.name === SUBMODULE)) return false;
        laporan.subModules.push({ name: SUBMODULE, allows: ['READ', 'CETAK LAPORAN'] });
        return true;
      });
      if (baru) {
        await queryInterface.sequelize.query(`UPDATE ${role.tabel} SET permissions = :permissions WHERE id = :id`, {
          replacements: { permissions: baru, id: role.id },
        });
      }
    }
  },

  async down(queryInterface) {
    const roles = await ambilBaris(queryInterface);
    for (const role of roles) {
      const baru = ubahPermission(role.permissions, (laporan) => {
        const sebelum = laporan.subModules.length;
        laporan.subModules = laporan.subModules.filter((s) => s.name !== SUBMODULE);
        return laporan.subModules.length !== sebelum;
      });
      if (baru) {
        await queryInterface.sequelize.query(`UPDATE ${role.tabel} SET permissions = :permissions WHERE id = :id`, {
          replacements: { permissions: baru, id: role.id },
        });
      }
    }
  },
};
