'use strict';

// Pelengkap skema Medical Check Up (MCU):
// - mcu_paket_item: ref_uuid opsional (item lab boleh teks bebas), satuan & nilai rujukan untuk isian hasil lab,
//   urutan tampil.
// - mcu_peserta: jenis MCU (pra-kerja, berkala, umum, khusus), data karyawan (NIK karyawan, jabatan, bagian),
//   snapshot stasiun paket saat pendaftaran.
// - mcu_invoice: tanggal invoice, jatuh tempo, jumlah peserta, waktu terbit/lunas, alasan batal.

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE mcu_paket_item ALTER COLUMN ref_uuid DROP NOT NULL;
        ALTER TABLE mcu_paket_item ADD COLUMN IF NOT EXISTS satuan VARCHAR(50);
        ALTER TABLE mcu_paket_item ADD COLUMN IF NOT EXISTS nilai_rujukan VARCHAR(150);
        ALTER TABLE mcu_paket_item ADD COLUMN IF NOT EXISTS urutan INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS mcu_paket_item_paket_idx ON mcu_paket_item (paket_uuid);

        ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS jenis_mcu VARCHAR(12) NOT NULL DEFAULT 'umum';
        ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS nik_karyawan VARCHAR(50);
        ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS jabatan VARCHAR(150);
        ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS bagian VARCHAR(150);
        ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS stasiun JSONB NOT NULL DEFAULT '[]';
        DO $$ BEGIN
          ALTER TABLE mcu_peserta ADD CONSTRAINT mcu_peserta_jenis_mcu_chk
            CHECK (jenis_mcu IN ('umum', 'pra_kerja', 'berkala', 'khusus', 'purna_kerja'));
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        CREATE INDEX IF NOT EXISTS mcu_peserta_perusahaan_idx ON mcu_peserta (perusahaan_uuid, tanggal);
        CREATE INDEX IF NOT EXISTS mcu_peserta_invoice_idx ON mcu_peserta (invoice_uuid);

        ALTER TABLE mcu_invoice ADD COLUMN IF NOT EXISTS tanggal DATE;
        ALTER TABLE mcu_invoice ADD COLUMN IF NOT EXISTS jatuh_tempo DATE;
        ALTER TABLE mcu_invoice ADD COLUMN IF NOT EXISTS jumlah_peserta INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE mcu_invoice ADD COLUMN IF NOT EXISTS terbit_pada BIGINT;
        ALTER TABLE mcu_invoice ADD COLUMN IF NOT EXISTS lunas_pada BIGINT;
        ALTER TABLE mcu_invoice ADD COLUMN IF NOT EXISTS alasan_batal TEXT;
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE mcu_invoice DROP COLUMN IF EXISTS tanggal, DROP COLUMN IF EXISTS jatuh_tempo,
        DROP COLUMN IF EXISTS jumlah_peserta, DROP COLUMN IF EXISTS terbit_pada, DROP COLUMN IF EXISTS lunas_pada,
        DROP COLUMN IF EXISTS alasan_batal;
      ALTER TABLE mcu_peserta DROP CONSTRAINT IF EXISTS mcu_peserta_jenis_mcu_chk;
      ALTER TABLE mcu_peserta DROP COLUMN IF EXISTS jenis_mcu, DROP COLUMN IF EXISTS nik_karyawan,
        DROP COLUMN IF EXISTS jabatan, DROP COLUMN IF EXISTS bagian, DROP COLUMN IF EXISTS stasiun;
      ALTER TABLE mcu_paket_item DROP COLUMN IF EXISTS satuan, DROP COLUMN IF EXISTS nilai_rujukan, DROP COLUMN IF EXISTS urutan;
    `);
  },
};
