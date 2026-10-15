'use strict';

// Modul Patologi Anatomi & Mikrobiologi (penunjang-service): katalog modul + preset segmen (PA: RS C/B/A, Mikrobiologi: RS B/A).
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
