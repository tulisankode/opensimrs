'use strict';

// Modul Gizi (STD-0007) diaktifkan di katalog: tersedia, menu "Gizi", rute "/gizi". Sudah ada di preset
// rs_c/rs_b/rs_a sejak sebelumnya (lihat database/data/katalog-modul.json).
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
