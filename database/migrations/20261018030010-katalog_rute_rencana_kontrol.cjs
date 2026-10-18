'use strict';

// Fitur "Rencana Kontrol & SPRI" (vclaim_rencana_kontrol): isi `rute` fitur (/admisi/rencana-kontrol, /admisi/spri)
// agar menu & guard router mengikuti status fitur faskes — lihat database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
