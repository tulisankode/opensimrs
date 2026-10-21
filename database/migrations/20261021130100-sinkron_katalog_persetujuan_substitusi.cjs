'use strict';
// Fitur Substitusi Obat (farmasi_substitusi) kini punya halaman Farmasi › Persetujuan Substitusi untuk dokter.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },
  async down() { /* Katalog dipulihkan melalui migrasi korektif baru. */ },
};
