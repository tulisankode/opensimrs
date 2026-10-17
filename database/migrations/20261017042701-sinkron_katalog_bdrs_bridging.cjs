'use strict';

// Fitur "Bridging Bank Darah (UTD)" (bdrs_bridging) di modul Bank Darah RS (BDRS): turunan bank_darah, mati bawaan
// di seluruh segmen (termasuk RS B/RS A) — lihat database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
