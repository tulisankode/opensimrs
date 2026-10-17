'use strict';

// Bridging PACS/RIS Radiologi (pola sama dengan Bridging LIS di lab-service/src/lis):
// - rad_pacs_koneksi       : koneksi PACS/RIS per faskes (API key & kunci masuk terenkripsi oleh penunjang-service).
// - rad_pacs_kirim         : riwayat percobaan kirim per item pemeriksaan (klaim atomik anti kirim dobel, status
//                            terpisah dari status klinis rad_order_item).
// - rad_pacs_hasil         : log penerimaan hasil (push/pull), termasuk hasil yang diterima tapi tidak diterapkan
//                            (expertise manual sudah ada).
// - rad_pacs_peta_tindakan : mapping rad_pemeriksaan → kode prosedur & modalitas PACS.
// - rad_pacs_peta_ref      : mapping unit asal / dokter pengirim / penjamin → kode PACS.
// - rad_order_item         : + accession_number (kunci idempotensi, unik), pacs_koneksi_uuid, url_viewer.
// - rad_ruang              : + ae_title (data referensi worklist, dikirim ke PACS; bukan endpoint DICOM MWL).
const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS rad_pacs_koneksi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(100) NOT NULL, kode_rs VARCHAR(50),
          url_kirim_order VARCHAR(500) NOT NULL, url_hasil VARCHAR(500), url_viewer VARCHAR(500),
          api_key TEXT, kunci_masuk TEXT, kunci_masuk_hash VARCHAR(64) UNIQUE,
          aktif BOOLEAN NOT NULL DEFAULT true, bawaan BOOLEAN NOT NULL DEFAULT false,
          maks_paralel SMALLINT NOT NULL DEFAULT 2, jeda_ms INTEGER NOT NULL DEFAULT 0,
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS rad_pacs_koneksi_faskes_idx ON rad_pacs_koneksi (faskes_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS rad_pacs_kirim (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES rad_pacs_koneksi(uuid),
          order_item_uuid VARCHAR(255) NOT NULL REFERENCES rad_order_item(uuid) ON DELETE CASCADE,
          accession_number VARCHAR(50) NOT NULL,
          status VARCHAR(12) NOT NULL CHECK (status IN ('baru', 'mengirim', 'terkirim', 'gagal', 'tidak_pasti')),
          pesan TEXT, permintaan JSONB, respons JSONB, percobaan INT NOT NULL DEFAULT 0,
          dikirim_oleh VARCHAR(255), diklaim_pada BIGINT, diklaim_oleh VARCHAR(255),
          created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
          CONSTRAINT rad_pacs_kirim_unik UNIQUE (faskes_uuid, order_item_uuid, koneksi_uuid)
        );
        CREATE INDEX IF NOT EXISTS rad_pacs_kirim_accession_idx ON rad_pacs_kirim (faskes_uuid, accession_number);
        CREATE INDEX IF NOT EXISTS rad_pacs_kirim_item_idx ON rad_pacs_kirim (order_item_uuid);

        CREATE TABLE IF NOT EXISTS rad_pacs_hasil (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255),
          koneksi_uuid VARCHAR(255), order_item_uuid VARCHAR(255),
          accession_number VARCHAR(50),
          status VARCHAR(12) NOT NULL CHECK (status IN ('diterima', 'sebagian', 'ditolak')),
          pesan TEXT, payload JSONB, diterapkan BOOLEAN NOT NULL DEFAULT false,
          sumber VARCHAR(10) NOT NULL CHECK (sumber IN ('push', 'pull')),
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS rad_pacs_hasil_item_idx ON rad_pacs_hasil (faskes_uuid, order_item_uuid);
        CREATE INDEX IF NOT EXISTS rad_pacs_hasil_accession_idx ON rad_pacs_hasil (accession_number);

        CREATE TABLE IF NOT EXISTS rad_pacs_peta_tindakan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          pemeriksaan_uuid VARCHAR(255) NOT NULL REFERENCES rad_pemeriksaan(uuid),
          koneksi_uuid VARCHAR(255) REFERENCES rad_pacs_koneksi(uuid),
          kode_prosedur_pacs VARCHAR(50) NOT NULL, modalitas_pacs VARCHAR(20) NOT NULL,
          updated_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rad_pacs_peta_tindakan_uq
          ON rad_pacs_peta_tindakan (faskes_uuid, pemeriksaan_uuid, COALESCE(koneksi_uuid, ''));

        CREATE TABLE IF NOT EXISTS rad_pacs_peta_ref (
          faskes_uuid VARCHAR(50) NOT NULL,
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('unit', 'dokter', 'penjamin')),
          ref_uuid VARCHAR(50) NOT NULL,
          kode_pacs VARCHAR(50) NOT NULL, nama_pacs VARCHAR(200),
          updated_at BIGINT,
          PRIMARY KEY (faskes_uuid, jenis, ref_uuid)
        );

        ALTER TABLE rad_order_item ADD COLUMN IF NOT EXISTS accession_number VARCHAR(50);
        ALTER TABLE rad_order_item ADD COLUMN IF NOT EXISTS pacs_koneksi_uuid VARCHAR(255) REFERENCES rad_pacs_koneksi(uuid);
        ALTER TABLE rad_order_item ADD COLUMN IF NOT EXISTS url_viewer TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS rad_order_item_accession_uq ON rad_order_item (accession_number) WHERE accession_number IS NOT NULL;

        ALTER TABLE rad_ruang ADD COLUMN IF NOT EXISTS ae_title VARCHAR(100);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE rad_ruang DROP COLUMN IF EXISTS ae_title;
      DROP INDEX IF EXISTS rad_order_item_accession_uq;
      ALTER TABLE rad_order_item DROP COLUMN IF EXISTS url_viewer;
      ALTER TABLE rad_order_item DROP COLUMN IF EXISTS pacs_koneksi_uuid;
      ALTER TABLE rad_order_item DROP COLUMN IF EXISTS accession_number;
      DROP TABLE IF EXISTS rad_pacs_peta_ref;
      DROP TABLE IF EXISTS rad_pacs_peta_tindakan;
      DROP TABLE IF EXISTS rad_pacs_hasil;
      DROP TABLE IF EXISTS rad_pacs_kirim;
      DROP TABLE IF EXISTS rad_pacs_koneksi;
    `);
  },
};
