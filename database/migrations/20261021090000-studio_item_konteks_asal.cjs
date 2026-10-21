'use strict';

// Konteks asal permintaan SIMRS Studio dari Asisten Pengembang (halaman, modul/fitur katalog, izin, galat tertangkap).
// Rancangan: docs/rancangan/STUDIO-ASISTEN-KONTEKS.md (F1).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE IF EXISTS studio_item ADD COLUMN IF NOT EXISTS konteks_asal JSONB`);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE IF EXISTS studio_item DROP COLUMN IF EXISTS konteks_asal`);
  },
};
