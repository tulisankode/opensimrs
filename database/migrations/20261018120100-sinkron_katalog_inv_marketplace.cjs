'use strict';

// STD-0019 — Pembelian BMHP via marketplace mitra: fitur "inv_marketplace" (modul inventory) diaktifkan
// (tersedia: true, sebelumnya "Segera") dengan rute "/inventory/marketplace", tetap mati bawaan di seluruh
// segmen lewat preset.fitur_mati — lihat database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
