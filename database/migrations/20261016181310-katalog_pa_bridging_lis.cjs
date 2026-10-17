'use strict';

// Fitur "Bridging LIS Patologi Anatomi" (pa_bridging_lis) di modul Patologi Anatomi: sinkronkan ref_fitur & ref_rute
// (rute "/patologi-anatomi/mapping/lis") dari database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
