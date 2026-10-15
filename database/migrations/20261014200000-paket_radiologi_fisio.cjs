'use strict';

// Paket Pemeriksaan Radiologi & Paket Terapi Fisioterapi.
// - rad_paket + rad_paket_item: kumpulan pemeriksaan dengan harga paket. Saat diorder, paket diekspansi menjadi
//   rad_order_item (paket_uuid terisi) dan harga paket dialokasikan proporsional ke item sehingga jumlah harga
//   item = harga paket. Tagihan & laporan tetap per item.
// - fisio_paket + fisio_paket_tindakan: tindakan + jumlah sesi + harga paket (seluruh sesi). Saat diorder,
//   fisio_order.paket_uuid terisi dan harga paket dialokasikan ke tindakan pada kolom
//   fisio_order_tindakan.nilai_paket (nilai seluruh sesi untuk tindakan tsb; jumlahnya = harga paket).
//   Kolom harga tetap menyimpan tarif satuan (snapshot) sebagai pembanding.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        -- ── RADIOLOGI ───────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS rad_paket (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL, deskripsi TEXT,
          harga NUMERIC(14,2) NOT NULL DEFAULT 0, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rad_paket_kode_uq ON rad_paket (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS rad_paket_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          paket_uuid VARCHAR(255) NOT NULL REFERENCES rad_paket(uuid) ON DELETE CASCADE,
          pemeriksaan_uuid VARCHAR(255) NOT NULL REFERENCES rad_pemeriksaan(uuid),
          urutan INTEGER NOT NULL DEFAULT 0, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS rad_paket_item_paket_idx ON rad_paket_item (paket_uuid);

        ALTER TABLE rad_order_item ADD COLUMN IF NOT EXISTS paket_uuid VARCHAR(255) REFERENCES rad_paket(uuid);

        -- ── FISIOTERAPI ─────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS fisio_paket (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL,
          jenis_fisio VARCHAR(20) NOT NULL CHECK (jenis_fisio IN ('sport', 'saraf', 'orto', 'anak', 'geriatri')),
          jumlah_sesi INTEGER NOT NULL DEFAULT 1 CHECK (jumlah_sesi BETWEEN 1 AND 100),
          harga NUMERIC(14,2) NOT NULL DEFAULT 0, deskripsi TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS fisio_paket_kode_uq ON fisio_paket (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS fisio_paket_tindakan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          paket_uuid VARCHAR(255) NOT NULL REFERENCES fisio_paket(uuid) ON DELETE CASCADE,
          tindakan_uuid VARCHAR(255) NOT NULL REFERENCES fisio_tindakan(uuid),
          qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 1), urutan INTEGER NOT NULL DEFAULT 0, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS fisio_paket_tindakan_paket_idx ON fisio_paket_tindakan (paket_uuid);

        ALTER TABLE fisio_order ADD COLUMN IF NOT EXISTS paket_uuid VARCHAR(255) REFERENCES fisio_paket(uuid);
        ALTER TABLE fisio_order_tindakan ADD COLUMN IF NOT EXISTS nilai_paket NUMERIC(14,2);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE fisio_order_tindakan DROP COLUMN IF EXISTS nilai_paket;
      ALTER TABLE fisio_order DROP COLUMN IF EXISTS paket_uuid;
      ALTER TABLE rad_order_item DROP COLUMN IF EXISTS paket_uuid;
      DROP TABLE IF EXISTS fisio_paket_tindakan, fisio_paket, rad_paket_item, rad_paket;
    `);
  },
};
