'use strict';

// Fitur "Bridging PACS/RIS" (rad_bridging_pacs) pada modul Radiologi — bersumber dari database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
