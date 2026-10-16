'use strict';

// Konfigurasi Helpdesk (Gateway OpenClaw) yang diatur dari Setting › Integrasi — satu baris untuk seluruh instalasi
// (Gateway dipakai bersama semua faskes). Token disimpan terenkripsi (enc:v1, AES-256-GCM). Tanpa baris ini,
// setting-service memakai HELPDESK_GATEWAY_URL/HELPDESK_GATEWAY_TOKEN di .env.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS helpdesk_konfigurasi (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        aktif BOOLEAN NOT NULL DEFAULT true,
        gateway_url VARCHAR(500),
        token TEXT,
        agen VARCHAR(100) NOT NULL DEFAULT 'helpdesk-opensimrs',
        batas_per_jam INTEGER NOT NULL DEFAULT 20,
        timeout_detik INTEGER NOT NULL DEFAULT 120,
        diubah_oleh VARCHAR(255),
        updated_at BIGINT NOT NULL
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS helpdesk_konfigurasi;`);
  },
};
