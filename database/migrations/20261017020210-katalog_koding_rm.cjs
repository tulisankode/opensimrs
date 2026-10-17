'use strict';

// Modul Koding & Rekam Medis (penunjang-service): katalog_modul.koding_rm.tersedia → true, menu & rute aktif.
// Preset segmen (rs_c, rs_b, rs_a) sudah mencantumkan koding_rm sebelumnya, tidak berubah.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
