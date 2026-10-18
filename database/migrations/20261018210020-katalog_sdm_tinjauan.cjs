'use strict';

// Tinjauan HR / SDM (STD-0035): katalog modul sdm dirapikan — urutan 36 (sebelumnya 35, bentrok dengan hemodialisa),
// deskripsi modul/fitur tidak lagi menjanjikan fitur yang belum ada, kredensial disebut satu sumber dengan Mutu, dan
// fitur fase berikutnya (sdm_jadwal_dinas, sdm_kehadiran, sdm_pelatihan, sdm_penggajian) didaftarkan berstatus "Segera"
// (tersedia: false, tanpa rute) sehingga tidak bisa diaktifkan dan tidak muncul sebagai menu.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
