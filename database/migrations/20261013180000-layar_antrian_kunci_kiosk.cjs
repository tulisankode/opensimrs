'use strict';

// Kunci akses layar antrian mode kiosk (TV): URL /layar/:uuid?kunci=… dibuka tanpa login dan hanya
// bisa membaca panggilan hari ini untuk layar tersebut. Kunci bisa dibuat ulang untuk mencabut akses.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE layar_antrian ADD COLUMN IF NOT EXISTS kunci_kiosk VARCHAR(64);`);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE layar_antrian DROP COLUMN IF EXISTS kunci_kiosk;`);
  },
};
