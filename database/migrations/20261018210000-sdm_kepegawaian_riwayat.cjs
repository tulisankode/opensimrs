'use strict';

// Tinjauan HR / SDM (STD-0035) — riwayat kepegawaian lengkap (KF-2/KT-2). Migrasi 20261018150100 hanya mencatat riwayat
// jabatan/unit dan melewatkan riwayat bila jabatan kosong; perubahan status kepegawaian & golongan hilang. Sekarang
// hr_riwayat_jabatan menyimpan POTRET keadaan (status, unit, jabatan, golongan) per masa berlaku + jenis perubahan &
// nomor SK; baris lama tidak pernah ditimpa (hanya tanggal_selesai diisi saat digantikan potret baru).
//   - kolom baru: status_kepegawaian, golongan, jenis_perubahan, nomor_sk; jabatan boleh kosong;
//   - catatan kepegawaian yang belum punya potret terbuka diberi potret awal dari keadaan terkininya (data lama utuh);
//   - potret terbuka lama yang belum berisi status/golongan dilengkapi dari keadaan terkini.
// Idempoten (IF NOT EXISTS / NOT EXISTS / hanya mengisi kolom NULL). Migrasi lama STD-0035 tidak diubah.

const crypto = require('crypto');

const uuidv7 = () => {
  const b = crypto.randomBytes(16);
  const t = BigInt(Date.now());
  for (let i = 0; i < 6; i++) b[i] = Number((t >> BigInt(8 * (5 - i))) & 255n);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    await sq.transaction(async (transaction) => {
      await sq.query(
        `
        ALTER TABLE hr_riwayat_jabatan ALTER COLUMN jabatan DROP NOT NULL;
        ALTER TABLE hr_riwayat_jabatan ADD COLUMN IF NOT EXISTS status_kepegawaian VARCHAR(20);
        ALTER TABLE hr_riwayat_jabatan ADD COLUMN IF NOT EXISTS golongan VARCHAR(50);
        ALTER TABLE hr_riwayat_jabatan ADD COLUMN IF NOT EXISTS jenis_perubahan VARCHAR(150);
        ALTER TABLE hr_riwayat_jabatan ADD COLUMN IF NOT EXISTS nomor_sk VARCHAR(100);
        CREATE INDEX IF NOT EXISTS hr_riwayat_terbuka_idx ON hr_riwayat_jabatan (faskes_uuid, kepegawaian_uuid)
          WHERE deleted_at IS NULL AND tanggal_selesai IS NULL;
        UPDATE hr_riwayat_jabatan r SET status_kepegawaian = COALESCE(r.status_kepegawaian, h.status_kepegawaian),
            golongan = COALESCE(r.golongan, h.golongan), jenis_perubahan = COALESCE(r.jenis_perubahan, 'awal')
          FROM hr_kepegawaian h
          WHERE h.uuid = r.kepegawaian_uuid AND r.deleted_at IS NULL AND r.tanggal_selesai IS NULL
            AND (r.status_kepegawaian IS NULL OR r.jenis_perubahan IS NULL);
        `,
        { transaction }
      );
      const [tanpaRiwayat] = await sq.query(
        `SELECT h.uuid, h.faskes_uuid, h.status_kepegawaian, h.unit_uuid, h.jabatan, h.golongan, h.tanggal_mulai, h.tanggal_selesai, h.dibuat_oleh
           FROM hr_kepegawaian h
          WHERE h.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM hr_riwayat_jabatan r WHERE r.kepegawaian_uuid = h.uuid AND r.deleted_at IS NULL)`,
        { transaction }
      );
      const n = Math.floor(Date.now() / 1000);
      for (const h of tanpaRiwayat) {
        await sq.query(
          `INSERT INTO hr_riwayat_jabatan (uuid, faskes_uuid, kepegawaian_uuid, status_kepegawaian, unit_uuid, jabatan, golongan,
             tanggal_mulai, tanggal_selesai, jenis_perubahan, catatan, dicatat_oleh, created_at, updated_at)
           VALUES (:uuid, :faskes_uuid, :kepegawaian_uuid, :status_kepegawaian, :unit_uuid, :jabatan, :golongan,
             :tanggal_mulai, :tanggal_selesai, 'awal', 'Potret awal dari data kepegawaian (migrasi tinjauan STD-0035)', :dicatat_oleh, :n, :n)`,
          {
            replacements: {
              uuid: uuidv7(),
              faskes_uuid: h.faskes_uuid,
              kepegawaian_uuid: h.uuid,
              status_kepegawaian: h.status_kepegawaian,
              unit_uuid: h.unit_uuid,
              jabatan: h.jabatan,
              golongan: h.golongan,
              tanggal_mulai: h.tanggal_mulai,
              tanggal_selesai: h.tanggal_selesai,
              dicatat_oleh: h.dibuat_oleh,
              n,
            },
            transaction,
          }
        );
      }
    });
  },

  async down() {
    // Kolom tambahan & potret riwayat dibiarkan: menghapusnya akan menghilangkan riwayat kepegawaian yang sudah dicatat.
  },
};
