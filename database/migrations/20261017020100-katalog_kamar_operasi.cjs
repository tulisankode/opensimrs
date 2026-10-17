'use strict';

// Modul Kamar Operasi (penunjang-service): aktivasi katalog modul (sudah terdaftar sebagai "segera" sejak awal,
// sudah masuk preset RS kelas C/B/A) + fitur baru: Order Operasi dari RME, Jadwal & Daftar Tunggu OK, dan
// Checklist Keselamatan Bedah (WHO, wajib).
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
