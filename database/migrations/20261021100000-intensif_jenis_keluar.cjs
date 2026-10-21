'use strict';

// Penutupan episode perawatan intensif tanpa perpindahan bed: pasien meninggal di unit atau pulang langsung dari unit.
// Sebelumnya episode ICU/CCU (icu_perawatans) dan HDU (hdu_episode) hanya dapat ditutup lewat perpindahan keluar,
// sehingga episode pasien meninggal/pulang tetap aktif. jenis_keluar mencatat cara episode berakhir; episode yang
// sudah selesai lewat perpindahan diisi 'pindah'. Serah terima keluar ICU tanpa perpindahan tetap menyimpan ringkasan
// perawatan, sehingga perpindahan_uuid icu_serah_terimas boleh kosong.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE icu_perawatans ADD COLUMN IF NOT EXISTS jenis_keluar VARCHAR(10)
          CHECK (jenis_keluar IN ('pindah', 'pulang', 'meninggal'));
        UPDATE icu_perawatans SET jenis_keluar = 'pindah'
          WHERE status = 'selesai' AND perpindahan_keluar_uuid IS NOT NULL AND jenis_keluar IS NULL;
        ALTER TABLE icu_serah_terimas ALTER COLUMN perpindahan_uuid DROP NOT NULL;
        ALTER TABLE hdu_episode ADD COLUMN IF NOT EXISTS jenis_keluar VARCHAR(10)
          CHECK (jenis_keluar IN ('pindah', 'pulang', 'meninggal'));
        ALTER TABLE hdu_episode ADD COLUMN IF NOT EXISTS catatan_keluar TEXT;
        UPDATE hdu_episode SET jenis_keluar = 'pindah'
          WHERE status = 'selesai' AND perpindahan_keluar_uuid IS NOT NULL AND jenis_keluar IS NULL;
      `, { transaction });
    });
  },
  async down() {
    // Riwayat klinis dipertahankan; pembalikan memerlukan migrasi pemulihan tersendiri.
  },
};
