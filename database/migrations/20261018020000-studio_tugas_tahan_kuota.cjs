'use strict';

// SIMRS Studio — agen tahan kuota:
// - status tugas baru: tunda_kuota (semua konektor dalam rantai cadangan habis kuota; dilanjutkan otomatis pada
//   lanjut_pada) dan dilanjutkan (tugas tunda yang sudah diganti tugas lanjutan). Kolom status VARCHAR(12) tanpa CHECK.
// - lanjutan_dari / lanjutan_ke : tugas lanjutan menunjuk tugas yang ditunda & urutan lanjutannya.
// - menunggu_slot               : tugas antri yang belum dimulai karena maks_agen_bersamaan tercapai.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_tugas
        ADD COLUMN IF NOT EXISTS lanjut_pada   BIGINT,
        ADD COLUMN IF NOT EXISTS lanjutan_dari UUID,
        ADD COLUMN IF NOT EXISTS lanjutan_ke   INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS menunggu_slot BOOLEAN NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS studio_tugas_status_lanjut_idx ON studio_tugas (status, lanjut_pada);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS studio_tugas_status_lanjut_idx;
      ALTER TABLE studio_tugas
        DROP COLUMN IF EXISTS lanjut_pada,
        DROP COLUMN IF EXISTS lanjutan_dari,
        DROP COLUMN IF EXISTS lanjutan_ke,
        DROP COLUMN IF EXISTS menunggu_slot;
    `);
  },
};
