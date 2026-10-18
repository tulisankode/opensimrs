'use strict';

// Modul baru "Manajemen Ambulans" (STD-0024) didaftarkan ke katalog: tersedia, menu "Manajemen Ambulans",
// rute "/ambulans", 8 fitur (armada & servis, kru & jadwal jaga, permintaan, penugasan, perjalanan, tarif,
// biaya & kuitansi, laporan). Tidak ditambahkan ke preset segmen mana pun (segmen bawaan belum diputuskan —
// lihat dokumen desain STD-0024): aktivasi per faskes dilakukan superadmin lewat override Manajemen Modul.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
