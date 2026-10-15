'use strict';

// Ambil hasil LIS dengan metode GET (tarik): URL pembacaan hasil per koneksi (mis.
// http://host:3001/api/v1/arsip/bridging/read?no_reg_rs={no_registrasi}) + asal catatan penerimaan hasil (push/tarik).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE lab_lis_koneksi ADD COLUMN IF NOT EXISTS url_hasil VARCHAR(500);`);
    await queryInterface.sequelize.query(`ALTER TABLE lab_lis_hasil ADD COLUMN IF NOT EXISTS sumber VARCHAR(10) NOT NULL DEFAULT 'push';`);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE lab_lis_hasil DROP COLUMN IF EXISTS sumber;`);
    await queryInterface.sequelize.query(`ALTER TABLE lab_lis_koneksi DROP COLUMN IF EXISTS url_hasil;`);
  },
};
