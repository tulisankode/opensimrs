'use strict';
// Fitur HDU (rawat_inap_hdu) kini tersedia: halaman & endpoint HDU tidak lagi menolak dengan "Fitur HDU tidak aktif".
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },
  async down() { /* Katalog dipulihkan melalui migrasi korektif baru. */ },
};
