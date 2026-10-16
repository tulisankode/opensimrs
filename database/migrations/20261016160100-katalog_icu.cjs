'use strict';

// Modul "ICU / Intensif" (rawat-inap-service): ubah tersedia=true, isi menu & rute, tambah 6 fitur.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
