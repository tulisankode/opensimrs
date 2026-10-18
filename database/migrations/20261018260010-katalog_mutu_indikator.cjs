'use strict';

// Indikator Mutu (STD-0025): fitur mutu_indikator ditambahkan ke modul "mutu" yang sudah ada (STD-0028) dengan rute
// /mutu/indikator (dasbor capaian, master indikator, pengumpulan & validasi data, tindak lanjut). Tidak wajib dan tidak
// dimatikan preset segmen mana pun: aktif mengikuti modul mutu, superadmin dapat mematikannya per faskes lewat override
// Manajemen Modul. Deskripsi modul mutu diperbarui agar menyebut indikator mutu.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
