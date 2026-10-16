'use strict';

// Modul CSSD (penunjang-service): aktifkan entri katalog (sebelumnya "Segera") + sinkron menu/rute.
// Preset rs_b dan rs_a sudah mencantumkan kode modul `cssd`, sehingga tidak perlu perubahan preset segmen.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
