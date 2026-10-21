'use strict';

// Substitusi obat wajib disetujui dokter (keputusan pemilik 21-10-2026). Dua jalur:
// - "menunggu": apoteker mengajukan, obat di resep BELUM diganti; dokter menyetujui (perubahan diterapkan saat itu)
//   atau menolak. Resep tidak bisa diverifikasi selama masih ada pengajuan menunggu.
// - "disetujui_lisan": konfirmasi lisan/telepon dicatat apoteker (dokter, cara, waktu) dan langsung diterapkan;
//   tetap muncul di daftar dokter sampai diverifikasi.
// perubahan = isian yang diterapkan ke item resep saat disetujui (obat, jenis stok, jumlah, dosis/aturan/cara pakai).
// Baris lama (sebelum migrasi ini, langsung diterapkan) ditandai "disetujui_lisan" bila ada nama dokter penyetuju,
// selain itu "tanpa_persetujuan"; keduanya menunggu verifikasi dokter.
//
// Izin baru Farmasi › Persetujuan Substitusi (READ, SETUJUI, TOLAK) diberikan ke peran/akun Dokter (nama diawali
// "dokter") dan Super Admin; modul Farmasi ditambahkan ke izin dokter bila belum ada.
const MODUL = 'Farmasi';
const SUB = 'Persetujuan Substitusi';
const AKSI = ['READ', 'SETUJUI', 'TOLAK'];

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    await sq.transaction(async (transaction) => {
      const sql = (s) => sq.query(s, { transaction });
      const struktur = await queryInterface.describeTable('prescription_item_substitutions', { transaction });
      const kolomBaru = !struktur.status;
      await sql(`ALTER TABLE prescription_item_substitutions
        ADD COLUMN IF NOT EXISTS status varchar(30) NOT NULL DEFAULT 'menunggu',
        ADD COLUMN IF NOT EXISTS perubahan jsonb,
        ADD COLUMN IF NOT EXISTS cara_konfirmasi varchar(20),
        ADD COLUMN IF NOT EXISTS waktu_konfirmasi bigint,
        ADD COLUMN IF NOT EXISTS diputuskan_oleh varchar(255),
        ADD COLUMN IF NOT EXISTS diputuskan_at bigint,
        ADD COLUMN IF NOT EXISTS alasan_tolak text,
        ADD COLUMN IF NOT EXISTS diverifikasi_oleh varchar(255),
        ADD COLUMN IF NOT EXISTS diverifikasi_at bigint`);
      if (kolomBaru) {
        await sql(`UPDATE prescription_item_substitutions
          SET status = CASE WHEN persetujuan_dokter AND coalesce(dokter_penyetuju, '') <> '' THEN 'disetujui_lisan' ELSE 'tanpa_persetujuan' END,
              waktu_konfirmasi = CASE WHEN persetujuan_dokter THEN created_at END`);
      }
      await sql(`CREATE INDEX IF NOT EXISTS prescription_item_substitutions_status
        ON prescription_item_substitutions (faskes_uuid, status) WHERE deleted_at IS NULL`);

      const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions, lower(name) AS nama
        FROM "role" WHERE deleted_at IS NULL FOR UPDATE`, { transaction });
      const [akun] = await sq.query(`SELECT 'users' AS tabel, u.uuid, u.permissions, lower(coalesce(r.name, '')) AS nama
        FROM users u LEFT JOIN "role" r ON r.uuid::text = u.role_uuid::text AND r.deleted_at IS NULL
        WHERE u.deleted_at IS NULL FOR UPDATE OF u`, { transaction });
      for (const r of [...peran, ...akun]) {
        if (r.nama !== 'super admin' && !r.nama.startsWith('dokter')) continue;
        let data;
        try { data = typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions; } catch { continue; }
        if (!Array.isArray(data) || !data.length) continue;
        let modul = data.find((m) => m.module === MODUL);
        if (!modul) {
          modul = { module: MODUL, subModules: [] };
          data.push(modul);
        }
        modul.subModules = modul.subModules ?? [];
        let sub = modul.subModules.find((s) => s.name === SUB);
        if (!sub) {
          sub = { name: SUB, allows: [] };
          modul.subModules.push(sub);
        }
        const allows = sub.allows ?? [];
        const kurang = AKSI.filter((a) => !allows.includes(a));
        if (!kurang.length) continue;
        sub.allows = [...allows, ...kurang];
        await sq.query(`UPDATE "${r.tabel}" SET permissions = :izin WHERE uuid = :uuid AND deleted_at IS NULL`, { replacements: { izin: JSON.stringify(data), uuid: r.uuid }, transaction });
      }
    });
  },
  async down() {
    // Status persetujuan adalah jejak audit pelayanan; izin yang kemudian diatur manusia tidak dicabut otomatis.
  },
};
