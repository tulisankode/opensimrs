'use strict';

// Aksi baru Farmasi › Resep Dokter › SUBSTITUSI. Diberikan ke peran/akun yang sudah boleh "EDIT OBAT" pada
// Resep Dokter (apoteker) dan ke Super Admin; sebelumnya endpoint substitusi menumpang aksi
// "SIMPAN DAN UBAH MENJADI RACIK".
const MODUL = 'Farmasi';
const SUB = 'Resep Dokter';
const AKSI = 'SUBSTITUSI';

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    await sq.transaction(async (transaction) => {
      const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions, lower(name) = 'super admin' AS super_admin
        FROM "role" WHERE deleted_at IS NULL FOR UPDATE`, { transaction });
      const [akun] = await sq.query(`SELECT 'users' AS tabel, u.uuid, u.permissions, lower(coalesce(r.name, '')) = 'super admin' AS super_admin
        FROM users u LEFT JOIN "role" r ON r.uuid::text = u.role_uuid::text AND r.deleted_at IS NULL
        WHERE u.deleted_at IS NULL FOR UPDATE OF u`, { transaction });
      for (const r of [...peran, ...akun]) {
        let data;
        try { data = typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions; } catch { continue; }
        if (!Array.isArray(data) || !data.length) continue;
        const modul = data.find((m) => m.module === MODUL);
        const sub = modul?.subModules?.find((s) => s.name === SUB);
        if (!sub) continue;
        const allows = sub.allows ?? [];
        if (allows.includes(AKSI)) continue;
        if (!r.super_admin && !allows.includes('EDIT OBAT')) continue;
        sub.allows = [...allows, AKSI];
        await sq.query(`UPDATE "${r.tabel}" SET permissions = :izin WHERE uuid = :uuid AND deleted_at IS NULL`, { replacements: { izin: JSON.stringify(data), uuid: r.uuid }, transaction });
      }
    });
  },
  async down() {
    // Izin yang kemudian diberikan manusia tidak dicabut oleh pemulihan otomatis.
  },
};
