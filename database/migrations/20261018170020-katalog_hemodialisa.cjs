'use strict';

// Modul baru "Unit Hemodialisa" (STD-0033) didaftarkan ke katalog: tersedia, menu "Hemodialisa", rute "/hemodialisa",
// bidang Pelayanan Medis & Keperawatan › Unit Hemodialisa, plus fitur opsional hd_bridging_hdis (Bridging HDIS).
// Tidak ditambahkan ke preset segmen mana pun (segmen bawaan belum diputuskan — dokumen desain STD-0033 §9):
// aktivasi per faskes dilakukan superadmin lewat override Manajemen Modul.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
