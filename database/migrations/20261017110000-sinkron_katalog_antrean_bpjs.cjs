'use strict';

// STD-0018 — Antrean Online BPJS (Mobile JKN): fitur "antrian_online_bpjs" (modul `antrian`) diaktifkan (tersedia:
// true, sebelumnya "Segera"), tetap mati bawaan di seluruh segmen lewat preset.fitur_mati. Syarat modul diperluas
// dari "bpjs_fkrtl" saja menjadi "bpjs_fkrtl,bpjs_fktp" (OR, lihat fiturLayak di setting-service/src/modul/katalog-modul.js)
// — lihat database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
