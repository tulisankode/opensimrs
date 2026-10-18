'use strict';

// STD-0030 — pelacakan per unit linen: fitur laundry_unit, laundry_pemindaian_unit, laundry_laporan_unit pada modul
// "laundry" (lihat database/data/katalog-modul.json). Skema dibuat 20261018160000-laundry_pelacakan_unit.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
