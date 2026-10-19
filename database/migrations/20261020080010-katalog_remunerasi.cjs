'use strict';

// Remunerasi / jasa pelayanan (STD-0032): fitur katalog baru "akuntansi_remunerasi" (tidak wajib, rute
// /akuntansi/remunerasi) di modul "akuntansi" yang sudah ada, serta deskripsi modul yang diperbarui. Preset segmen tidak
// berubah (fitur aktif bila modul akuntansi aktif, dapat dimatikan per faskes di Setting › Manajemen Modul).
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
