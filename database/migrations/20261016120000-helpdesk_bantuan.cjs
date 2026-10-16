'use strict';

// Helpdesk asisten pengguna (docs/rancangan/HELPDESK-OPENCLAW.md): fitur katalog helpdesk_ai (modul Dashboard) dan log
// percakapan untuk evaluasi mutu. Teks yang dicatat sudah disaring data pribadinya; pengguna disimpan sebagai hash.
// Retensi 90 hari dihapus oleh setting-service.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS bantuan_log (
          id SERIAL PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          pengguna_hash VARCHAR(64) NOT NULL,
          halaman VARCHAR(255),
          pertanyaan TEXT NOT NULL,
          jawaban TEXT,
          disamarkan INTEGER NOT NULL DEFAULT 0,
          durasi_ms INTEGER,
          galat TEXT,
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS bantuan_log_faskes_idx ON bantuan_log (faskes_uuid, created_at DESC);
      `, { transaction });
      await sinkronKatalog(queryInterface, transaction);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS bantuan_log;`);
    // Katalog mengikuti JSON; hapus entri helpdesk_ai dari JSON lalu jalankan migrasi sinkron baru.
  },
};
