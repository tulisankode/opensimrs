'use strict';

// Preset segmen memasukkan modul yang sudah tersedia tetapi belum menjadi bawaan segmen mana pun, sehingga jumlah
// modul/fitur/bagian per segmen di Setting › Manajemen Modul ikut bertambah:
//   - Mutu & Akreditasi: klinik pratama, klinik utama, puskesmas, RS kelas D–A;
//   - HR / SDM dan Sarana & Prasarana (IPSRS): klinik utama, RS kelas D–A;
//   - Manajemen Ambulans: puskesmas, RS kelas D–A;
//   - Hemodialisa: RS kelas C–A; Akuntansi: RS kelas C (kelas B & A sudah).
// Praktik mandiri tidak berubah. Faskes yang segmennya cocok langsung mendapat modul ini kecuali dimatikan lewat
// override Manajemen Modul; ringkasan segmen diperbarui.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
