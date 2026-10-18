'use strict';

// Modul inti "Audit Trail" (audit_trail, STD-0029) di katalog Manajemen Modul: hanya informasi — modul inti selalu
// aktif dan tidak dapat dinonaktifkan; akses lihat/ekspor tetap lewat izin Setting › Audit Trail.
// Lihat database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
