'use strict';

// Lab Rujukan: pemeriksaan laboratorium yang dirujuk ke laboratorium luar beserta input hasilnya.
// - lab_rujukan_faskes : data master laboratorium rujukan per faskes (dipakai berulang di banyak order).
// - observation_item   : kolom tambahan penanda rujukan (dirujuk, lab tujuan, status kirim, catatan, berkas hasil).
//   Semua kolom nullable/berdefault agar baris lama (item internal, Bridging LIS) tidak terpengaruh.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS lab_rujukan_faskes (
        id SERIAL UNIQUE,
        uuid VARCHAR(255) PRIMARY KEY,
        faskes_uuid VARCHAR(255) NOT NULL,
        code VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        alamat VARCHAR(255),
        telepon VARCHAR(50),
        kontak_person VARCHAR(255),
        status BOOLEAN NOT NULL DEFAULT true,
        created_at BIGINT NOT NULL,
        updated_at BIGINT,
        deleted_at BIGINT
      );
      CREATE INDEX IF NOT EXISTS lab_rujukan_faskes_faskes_idx ON lab_rujukan_faskes (faskes_uuid);
      CREATE UNIQUE INDEX IF NOT EXISTS lab_rujukan_faskes_code_uq ON lab_rujukan_faskes (code, faskes_uuid, deleted_at);

      ALTER TABLE observation_item
        ADD COLUMN IF NOT EXISTS dirujuk BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS lab_rujukan_uuid VARCHAR(255),
        ADD COLUMN IF NOT EXISTS status_rujukan VARCHAR(20),
        ADD COLUMN IF NOT EXISTS waktu_kirim_rujukan BIGINT,
        ADD COLUMN IF NOT EXISTS catatan_rujukan VARCHAR(255),
        ADD COLUMN IF NOT EXISTS berkas_hasil_rujukan BYTEA,
        ADD COLUMN IF NOT EXISTS berkas_hasil_rujukan_info JSONB;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observation_item_status_rujukan_check') THEN
          ALTER TABLE observation_item ADD CONSTRAINT observation_item_status_rujukan_check
            CHECK (status_rujukan IS NULL OR status_rujukan IN ('belum_dikirim','terkirim','hasil_diterima'));
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS observation_item_dirujuk_idx ON observation_item (order_lab_uuid) WHERE dirujuk = true;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE observation_item DROP CONSTRAINT IF EXISTS observation_item_status_rujukan_check;
      DROP INDEX IF EXISTS observation_item_dirujuk_idx;
      ALTER TABLE observation_item
        DROP COLUMN IF EXISTS dirujuk,
        DROP COLUMN IF EXISTS lab_rujukan_uuid,
        DROP COLUMN IF EXISTS status_rujukan,
        DROP COLUMN IF EXISTS waktu_kirim_rujukan,
        DROP COLUMN IF EXISTS catatan_rujukan,
        DROP COLUMN IF EXISTS berkas_hasil_rujukan,
        DROP COLUMN IF EXISTS berkas_hasil_rujukan_info;
      DROP TABLE IF EXISTS lab_rujukan_faskes;
    `);
  },
};
