'use strict';

// Integrasi BPJS PCare (FKTP):
// - kolom konfigurasi PCare per faskes di integrations (rahasia disimpan terenkripsi oleh bpjs-service)
// - kode poli BPJS per lokasi (pemetaan poli OpenSIMRS → kdPoli PCare)
// - catatan pendaftaran & kunjungan PCare per kunjungan rawat jalan
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE integrations
        ADD COLUMN IF NOT EXISTS pcare_aktif        BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS pcare_cons_id      VARCHAR(255),
        ADD COLUMN IF NOT EXISTS pcare_secret_key   TEXT,
        ADD COLUMN IF NOT EXISTS pcare_user_key     TEXT,
        ADD COLUMN IF NOT EXISTS pcare_username     VARCHAR(255),
        ADD COLUMN IF NOT EXISTS pcare_password     TEXT,
        ADD COLUMN IF NOT EXISTS pcare_kd_aplikasi  VARCHAR(10) DEFAULT '095',
        ADD COLUMN IF NOT EXISTS pcare_kd_provider  VARCHAR(50);

      ALTER TABLE lokasi ADD COLUMN IF NOT EXISTS kd_poli_bpjs VARCHAR(20);

      CREATE TABLE IF NOT EXISTS bpjs_pcare_kunjungan (
        id                  BIGSERIAL PRIMARY KEY,
        faskes_uuid         VARCHAR(255) NOT NULL,
        rawat_jalan_uuid    VARCHAR(255) NOT NULL,
        no_pelayanan        VARCHAR(255),
        no_kartu            VARCHAR(30),
        tgl_daftar          VARCHAR(10),        -- dd-mm-yyyy (format PCare)
        kd_poli             VARCHAR(20),
        status_pendaftaran  VARCHAR(20) NOT NULL DEFAULT 'belum', -- belum | terkirim | gagal
        no_urut             VARCHAR(30),
        status_kunjungan    VARCHAR(20) NOT NULL DEFAULT 'belum', -- belum | terkirim | gagal
        no_kunjungan        VARCHAR(50),
        percobaan           INTEGER NOT NULL DEFAULT 0,
        pesan               TEXT,
        created_at          BIGINT NOT NULL,
        updated_at          BIGINT NOT NULL,
        CONSTRAINT bpjs_pcare_kunjungan_unik UNIQUE (faskes_uuid, rawat_jalan_uuid)
      );
      CREATE INDEX IF NOT EXISTS bpjs_pcare_kunjungan_status_idx
        ON bpjs_pcare_kunjungan (faskes_uuid, status_pendaftaran, status_kunjungan);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS bpjs_pcare_kunjungan;
      ALTER TABLE lokasi DROP COLUMN IF EXISTS kd_poli_bpjs;
      ALTER TABLE integrations
        DROP COLUMN IF EXISTS pcare_aktif, DROP COLUMN IF EXISTS pcare_cons_id,
        DROP COLUMN IF EXISTS pcare_secret_key, DROP COLUMN IF EXISTS pcare_user_key,
        DROP COLUMN IF EXISTS pcare_username, DROP COLUMN IF EXISTS pcare_password,
        DROP COLUMN IF EXISTS pcare_kd_aplikasi, DROP COLUMN IF EXISTS pcare_kd_provider;
    `);
  },
};
