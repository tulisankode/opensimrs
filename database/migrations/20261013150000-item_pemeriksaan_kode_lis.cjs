'use strict';

// Kode pemeriksaan di LIS (mis. RBC, HGB) per item pemeriksaan OpenSIMRS untuk memetakan hasil yang dikirim LIS.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE item_pemeriksaan ADD COLUMN IF NOT EXISTS kode_lis VARCHAR(50);`);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE item_pemeriksaan DROP COLUMN IF EXISTS kode_lis;`);
  },
};
