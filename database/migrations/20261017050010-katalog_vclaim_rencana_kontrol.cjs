'use strict';

// Fitur "Rencana Kontrol & SPRI" (vclaim_rencana_kontrol) di modul BPJS FKRTL (bpjs_fkrtl):
// dari "Segera" menjadi tersedia, tetap mati bawaan di seluruh segmen yang memakai bpjs_fkrtl
// (klinik_utama, rs_d, rs_c, rs_b, rs_a) — lihat database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
