'use strict';

// Modul baru "Mutu & Akreditasi" (STD-0028) didaftarkan ke katalog: tersedia, menu "Mutu & Akreditasi", rute "/mutu",
// bidang Manajemen & Mutu › Manajemen Mutu, dengan fitur pertama mutu_dokumen_kredensial (dokumen akreditasi,
// instrumen, kredensial staf, dasbor kesiapan). Item mutu berikutnya (indikator mutu, IKP, PPI) menambah fitur pada
// modul yang sama. Tidak ditambahkan ke preset segmen mana pun (preseden Ambulans/Sarpras): aktivasi per faskes
// dilakukan superadmin lewat override Manajemen Modul.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
