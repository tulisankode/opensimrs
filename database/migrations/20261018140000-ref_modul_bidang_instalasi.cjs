'use strict';

// Hierarki organisasi faskes pada katalog modul: setiap modul kini punya `bidang` (mis. Penunjang Medis) dan
// `instalasi` (mis. Instalasi Laboratorium). Dipakai frontend untuk mengelompokkan panel menu "Lainnya" per bidang
// dan instalasi — lihat database/data/katalog-modul.json. Kolom `kelompok` (layar Manajemen Modul) tidak berubah.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE ref_modul ADD COLUMN IF NOT EXISTS bidang VARCHAR(100);
        ALTER TABLE ref_modul ADD COLUMN IF NOT EXISTS instalasi VARCHAR(100);
      `, { transaction });
      await sinkronKatalog(queryInterface, transaction);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ref_modul DROP COLUMN IF EXISTS instalasi;
      ALTER TABLE ref_modul DROP COLUMN IF EXISTS bidang;
    `);
  },
};
