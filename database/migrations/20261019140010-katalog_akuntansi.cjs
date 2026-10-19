'use strict';

// Akuntansi & Remunerasi (STD-0031): modul katalog "akuntansi" (sebelumnya berstatus Segera) menjadi tersedia dengan rute
// /akuntansi dan dua fitur: akuntansi_jurnal (wajib — bagan akun, pemetaan, jurnal otomatis & manual, persetujuan, buku
// besar, neraca saldo, periode) dan akuntansi_laporan (laporan keuangan & aging, dapat dimatikan per faskes). Preset
// segmen tidak berubah (modul tetap bawaan RS tipe C/D & A/B). Remunerasi (STD-0032) akan menambah fitur di modul yang sama.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
