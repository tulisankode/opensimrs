'use strict';

// Katalog modul CCU (STD-0045): modul `ccu` berinstalasi "Instalasi Perawatan Intensif" beserta fiturnya.
// Isi katalog dari database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },
  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
