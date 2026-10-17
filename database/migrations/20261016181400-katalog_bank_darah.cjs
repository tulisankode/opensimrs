'use strict';

// Modul Bank Darah RS / BDRS (penunjang-service): katalog modul sudah memesan `bank_darah` beserta tiga fiturnya
// (bdrs_permintaan, bdrs_crossmatch, bdrs_stok) tanpa menu/rute. Migrasi ini menyinkronkan katalog setelah
// database/data/katalog-modul.json diperbarui (tersedia: true, menu & rute dilengkapi). Preset segmen rs_b/rs_a
// sudah mencantumkan `bank_darah` sebelumnya; tidak ada perubahan pada preset_segmen_fitur_mati untuk modul ini.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
