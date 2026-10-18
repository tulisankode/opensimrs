'use strict';

// Modul baru "Sarana dan Prasarana (IPSRS)" (STD-0022) didaftarkan ke katalog: tersedia, menu "Sarana dan Prasarana
// (IPSRS)", rute "/sarpras", 5 fitur (register aset & laporan kerusakan [wajib], pemeliharaan preventif, kalibrasi,
// utilitas, laporan [wajib]). Tidak ditambahkan ke preset segmen mana pun (keputusan desain STD-0022 §7 Q1, sama
// seperti ambulans): aktivasi per faskes dilakukan superadmin lewat override Manajemen Modul.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
