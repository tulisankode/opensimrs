'use strict';

// Modul UTD / UPTD Produksi Darah: backend STD-0011 sudah ada, frontend (halaman /utd/*) kini tersedia. Katalog
// database/data/katalog-modul.json mengubah `utd` dan keenam fiturnya menjadi tersedia (menu "UTD" = nama modul izin,
// rute modul `/utd`, sub-rute di fitur). Migrasi ini menyinkronkan katalog itu ke tabel ref_*.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
