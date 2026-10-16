'use strict';

// SIMRS Studio — server tujuan deploy tanpa GitHub: branch lokal dikirim lewat SSH (git push ke repo penampung di server),
// server mengambilnya lalu menjalankan perintah deploy (bawaan ./deploy/server/deploy.sh).
// Autentikasi SSH memakai kunci yang dibuat Studio (privat terenkripsi; publik ditempel di authorized_keys server).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS studio_server (
        id               BIGSERIAL PRIMARY KEY,
        uuid             UUID NOT NULL UNIQUE,
        nama             VARCHAR(100) NOT NULL,
        jenis            VARCHAR(10) NOT NULL DEFAULT 'produksi',   -- produksi | staging
        host             VARCHAR(255) NOT NULL,                     -- IP atau nama host di jaringan RS
        port             INT NOT NULL DEFAULT 22,
        pengguna         VARCHAR(100) NOT NULL,
        kunci_privat     TEXT,                                      -- enc:v1:… (AES-256-GCM)
        kunci_publik     TEXT,
        repo_dir         VARCHAR(500) NOT NULL DEFAULT '~/opensimrs',
        repo_bare        VARCHAR(500) NOT NULL DEFAULT '~/opensimrs-rs.git',
        branch           VARCHAR(255),                              -- kosong = branch lokal Studio
        perintah_deploy  VARCHAR(500) NOT NULL DEFAULT './deploy/server/deploy.sh',
        aktif            BOOLEAN NOT NULL DEFAULT true,
        sidik_host       TEXT,                                      -- baris known_hosts (dicatat saat koneksi pertama)
        terakhir_deploy  BIGINT,
        sha_terakhir     VARCHAR(64),
        dibuat_oleh      VARCHAR(255),
        created_at       BIGINT NOT NULL,
        updated_at       BIGINT NOT NULL,
        deleted_at       BIGINT
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS studio_server;`);
  },
};
