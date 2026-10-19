'use strict';

// Insiden Keselamatan Pasien & manajemen risiko (STD-0026): fitur mutu_ikp ditambahkan ke modul "mutu" yang sudah ada
// (STD-0028) dengan rute /mutu/ikp (lapor insiden, daftar & detail laporan, dasbor, register risiko, pengaturan). Tidak
// wajib dan tidak dimatikan preset segmen mana pun: aktif mengikuti modul mutu, superadmin dapat mematikannya per faskes
// lewat override Manajemen Modul. Deskripsi modul mutu diperbarui agar menyebut pelaporan insiden.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
