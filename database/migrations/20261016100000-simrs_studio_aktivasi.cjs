'use strict';

// SIMRS Studio — aktivasi otomatis setelah penerapan lokal: modul/fitur baru dinyalakan untuk faskes dan izin modul baru
// diberikan ke peran admin. aktivasi = catatan yang diubah (override & izin) agar bisa dibalik saat penerapan dibatalkan.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_item ADD COLUMN IF NOT EXISTS aktivasi JSONB;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_item DROP COLUMN IF EXISTS aktivasi;
    `);
  },
};
