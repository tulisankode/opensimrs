'use strict';

// Catatan pemeriksaan Penggajian yang sebelumnya dikirim frontend tetapi tidak disimpan: catatan verifikasi rekening
// pegawai dan catatan pengesahan format bank. Opsional; juga dicatat di riwayat tindakan (alasan).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS hr_gaji_rekening ADD COLUMN IF NOT EXISTS catatan_verifikasi TEXT;
      ALTER TABLE IF EXISTS hr_gaji_format_bank ADD COLUMN IF NOT EXISTS catatan_pengesahan TEXT;
    `);
  },
  async down() {
    // Catatan pemeriksaan adalah bagian jejak audit; kolom tidak dihapus otomatis.
  },
};
