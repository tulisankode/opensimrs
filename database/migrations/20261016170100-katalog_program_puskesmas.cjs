'use strict';

// Modul "Program Puskesmas" (program_puskesmas) berubah dari Segera (tersedia=false) menjadi tersedia, dengan
// menu/rute serta fitur "Kirim Imunisasi ke SATUSEHAT" (syarat modul satusehat). Preset segmen puskesmas sudah
// menyertakan kode modul ini sejak sebelumnya.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
