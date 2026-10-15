'use strict';

// Manajemen modul per faskes: segmen (praktik mandiri … RS kelas A) menentukan modul bawaan;
// superadmin dapat menambah modul di luar segmen atau menonaktifkan modul bawaan.
// Faskes tanpa baris di sini = belum diatur → semua modul yang tersedia aktif (kompatibel dengan instalasi lama).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS faskes_modul (
        faskes_uuid VARCHAR(255) PRIMARY KEY,
        segmen VARCHAR(50) NOT NULL,
        modul_tambahan JSONB NOT NULL DEFAULT '[]'::jsonb,
        modul_nonaktif JSONB NOT NULL DEFAULT '[]'::jsonb,
        diubah_oleh VARCHAR(255),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS faskes_modul_riwayat (
        id SERIAL PRIMARY KEY,
        faskes_uuid VARCHAR(255) NOT NULL,
        oleh VARCHAR(255),
        sebelum JSONB,
        sesudah JSONB NOT NULL,
        alasan TEXT,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS faskes_modul_riwayat_faskes_idx ON faskes_modul_riwayat (faskes_uuid, created_at DESC);
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS faskes_modul_riwayat; DROP TABLE IF EXISTS faskes_modul;`);
  },
};
