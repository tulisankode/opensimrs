'use strict';

// Medical Check Up (MCU) — integrasi & kelengkapan:
// - mcu_paket_item.tarif_lab_uuid: item lab boleh menunjuk pemeriksaan/tarif lab (panel, mis. Darah Rutin) selain
//   parameter item_pemeriksaan (ref_uuid). Dipakai untuk membuat order di lab-service saat peserta didaftarkan.
// - mcu_peserta.lab_order_uuid: relasi ke order_lab (lab-service, is_mcu = true, tanpa tagihan lab terpisah);
//   mcu_peserta.kontrak_uuid: harga kontrak perusahaan yang dipakai saat pendaftaran (null = harga paket).
// - mcu_harga_kontrak: harga paket per perusahaan, masa berlaku opsional (dari–sampai).
// - mcu_invoice_bayar: riwayat pembayaran invoice korporasi (sebagian / lunas); status invoice + 'sebagian'.

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE mcu_paket_item ADD COLUMN IF NOT EXISTS tarif_lab_uuid VARCHAR(255);

        ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS lab_order_uuid VARCHAR(255);
        ALTER TABLE mcu_peserta ADD COLUMN IF NOT EXISTS kontrak_uuid VARCHAR(255);
        CREATE INDEX IF NOT EXISTS mcu_peserta_lab_order_idx ON mcu_peserta (lab_order_uuid);

        CREATE TABLE IF NOT EXISTS mcu_harga_kontrak (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          perusahaan_uuid VARCHAR(255) NOT NULL REFERENCES mcu_perusahaan(uuid),
          paket_uuid VARCHAR(255) NOT NULL REFERENCES mcu_paket(uuid),
          harga NUMERIC(14,2) NOT NULL CHECK (harga >= 0),
          berlaku_mulai DATE,
          berlaku_sampai DATE,
          no_kontrak VARCHAR(100),
          catatan TEXT,
          status BOOLEAN NOT NULL DEFAULT true,
          dibuat_oleh VARCHAR(255),
          created_at BIGINT,
          updated_at BIGINT,
          deleted_at BIGINT,
          CONSTRAINT mcu_harga_kontrak_periode_chk CHECK (berlaku_mulai IS NULL OR berlaku_sampai IS NULL OR berlaku_mulai <= berlaku_sampai)
        );
        CREATE INDEX IF NOT EXISTS mcu_harga_kontrak_idx ON mcu_harga_kontrak (faskes_uuid, perusahaan_uuid, paket_uuid);

        CREATE TABLE IF NOT EXISTS mcu_invoice_bayar (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          invoice_uuid VARCHAR(255) NOT NULL REFERENCES mcu_invoice(uuid),
          no_bayar VARCHAR(50) NOT NULL,
          tanggal DATE NOT NULL,
          jumlah NUMERIC(14,2) NOT NULL CHECK (jumlah > 0),
          metode VARCHAR(20) NOT NULL CHECK (metode IN ('transfer', 'tunai', 'giro', 'cek', 'lainnya')),
          no_referensi VARCHAR(100),
          catatan TEXT,
          dibuat_oleh VARCHAR(255),
          alasan_batal TEXT,
          dibatalkan_oleh VARCHAR(255),
          created_at BIGINT,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE INDEX IF NOT EXISTS mcu_invoice_bayar_invoice_idx ON mcu_invoice_bayar (invoice_uuid);

        ALTER TABLE mcu_invoice DROP CONSTRAINT IF EXISTS mcu_invoice_status_check;
        ALTER TABLE mcu_invoice ADD CONSTRAINT mcu_invoice_status_check
          CHECK (status IN ('draft', 'terbit', 'sebagian', 'lunas', 'batal'));
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE mcu_invoice SET status = 'terbit' WHERE status = 'sebagian';
      ALTER TABLE mcu_invoice DROP CONSTRAINT IF EXISTS mcu_invoice_status_check;
      ALTER TABLE mcu_invoice ADD CONSTRAINT mcu_invoice_status_check CHECK (status IN ('draft', 'terbit', 'lunas', 'batal'));
      DROP TABLE IF EXISTS mcu_invoice_bayar;
      DROP TABLE IF EXISTS mcu_harga_kontrak;
      DROP INDEX IF EXISTS mcu_peserta_lab_order_idx;
      ALTER TABLE mcu_peserta DROP COLUMN IF EXISTS lab_order_uuid, DROP COLUMN IF EXISTS kontrak_uuid;
      ALTER TABLE mcu_paket_item DROP COLUMN IF EXISTS tarif_lab_uuid;
    `);
  },
};
