'use strict';

// Fitur baru "Dashboard Eksekutif" (STD-0034) pada modul inti Dashboard didaftarkan ke katalog: tersedia, tidak wajib,
// rute "/dashboard/eksekutif". Tidak dimatikan di preset segmen mana pun (pemilik klinik juga memakainya); akses
// tetap dibatasi izin Dashboard › Eksekutif.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
