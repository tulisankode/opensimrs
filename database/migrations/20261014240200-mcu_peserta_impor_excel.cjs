'use strict';

// MCU — data tambahan peserta dari impor Excel rombongan (format unggah massal adamLIS / templat OpenSIMRS):
// nomor registrasi eksternal (HRD/LIS), CITO, unit asal, dokter pengirim, penjamin, diagnosa awal & ICD-10,
// serta pemeriksaan tambahan di luar paket (lab/radiologi) dengan harganya (ditagihkan terpisah / masuk invoice).

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS no_registrasi VARCHAR(100);
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS cito BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS unit_asal_uuid VARCHAR(255);
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS dokter_pengirim_uuid VARCHAR(255);
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS penjamin_uuid VARCHAR(255);
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS diagnosa_awal TEXT;
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS icd10_code VARCHAR(20);
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS icd10_nama TEXT;
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS tambahan JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS harga_tambahan NUMERIC(14,2) NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS mcu_peserta_no_registrasi_idx ON mcu_peserta (faskes_uuid, no_registrasi) WHERE no_registrasi IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS mcu_peserta_no_registrasi_idx;
      ALTER TABLE mcu_peserta DROP COLUMN IF EXISTS no_registrasi, DROP COLUMN IF EXISTS cito, DROP COLUMN IF EXISTS unit_asal_uuid,
        DROP COLUMN IF EXISTS dokter_pengirim_uuid, DROP COLUMN IF EXISTS penjamin_uuid, DROP COLUMN IF EXISTS diagnosa_awal,
        DROP COLUMN IF EXISTS icd10_code, DROP COLUMN IF EXISTS icd10_nama, DROP COLUMN IF EXISTS tambahan, DROP COLUMN IF EXISTS harga_tambahan;
    `);
  },
};
