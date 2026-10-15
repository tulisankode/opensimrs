'use strict';

// Manajemen fitur (satu tingkat di bawah modul): override superadmin terhadap preset fitur segmen.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE faskes_modul ADD COLUMN IF NOT EXISTS fitur_tambahan JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE faskes_modul ADD COLUMN IF NOT EXISTS fitur_nonaktif JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE faskes_modul DROP COLUMN IF EXISTS fitur_tambahan;
      ALTER TABLE faskes_modul DROP COLUMN IF EXISTS fitur_nonaktif;
    `);
  },
};
