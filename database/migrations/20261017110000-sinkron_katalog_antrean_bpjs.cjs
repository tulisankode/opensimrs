'use strict';

// STD-0018 — Antrean Online BPJS (Mobile JKN): fitur "antrian_online_bpjs" (modul `antrian`) diaktifkan (tersedia:
// true, sebelumnya "Segera"), tetap mati bawaan di seluruh segmen lewat preset.fitur_mati. modul_syarat dikosongkan:
// fitur ini berlaku untuk FKRTL maupun FKTP, sedangkan kolom ref_fitur.modul_syarat ber-FK ke ref_modul (satu kode
// modul) sehingga tidak dapat berisi daftar "bpjs_fkrtl,bpjs_fktp". Pemakaian tetap bergantung pada kredensial WS
// Antrean BPJS di Konfigurasi Integrasi — lihat database/data/katalog-modul.json.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },

  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
