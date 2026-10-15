'use strict';

// Katalog modul diselaraskan dengan PRD lama: modul Training (prototipe), fitur farmasi/inventory/pendaftaran/
// rawat inap/BPJS, bagian Surat Resep Kacamata. Fitur kini boleh mensyaratkan modul lain (mis. Obat Kronis BPJS
// hanya aktif bila modul BPJS FKRTL aktif) lewat ref_fitur.modul_syarat.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE ref_fitur ADD COLUMN IF NOT EXISTS modul_syarat VARCHAR(50)
          REFERENCES ref_modul(kode) ON UPDATE CASCADE ON DELETE SET NULL;
      `, { transaction });
      await sinkronKatalog(queryInterface, transaction);
    });
  },

  async down(queryInterface) {
    // Baris katalog baru dibiarkan (sinkron berikutnya yang merapikan); kolom syarat dilepas.
    await queryInterface.sequelize.query(`ALTER TABLE ref_fitur DROP COLUMN IF EXISTS modul_syarat`);
  },
};
