'use strict';

// Kode tindakan di LIS (mis. JAS3048) per tarif lab OpenSIMRS: dikirim sebagai tindakan[].kode_tindakan saat registrasi ke LIS.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE tarif_lab ADD COLUMN IF NOT EXISTS kode_lis VARCHAR(50);`);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE tarif_lab DROP COLUMN IF EXISTS kode_lis;`);
  },
};
