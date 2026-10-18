'use strict';

// SIMRS Studio — awalan migrasi per item (blok jam UTC YYYYMMDDHH) yang dipesan saat coding dimulai, agar item yang
// dikerjakan paralel tidak memakai stempel waktu migrasi yang sama. Migrasi item bernama <awalan>MMSS-*.cjs.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_item ADD COLUMN IF NOT EXISTS awalan_migrasi VARCHAR(10);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_item DROP COLUMN IF EXISTS awalan_migrasi;
    `);
  },
};
