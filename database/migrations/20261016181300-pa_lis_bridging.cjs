'use strict';

// Bridging LIS Patologi Anatomi (penunjang-service, pola sama dengan Bridging LIS Laboratorium di lab-service).
// Granularitas pengiriman = kasus PA (pa_order_item), bukan pa_order: satu kasus = satu Nomor PA/jaringan di sisi
// LIS PA tujuan, sama seperti satu kasus punya satu Nomor PA internal. no_registrasi dibuat stabil per kasus agar
// kirim ulang tidak pernah membuat kasus ganda di sisi tujuan (idempoten).
// Penolakan eksternal (dari sistem PA) dicatat di kolom pa_order_item terpisah dari status/penolakan manual internal
// (pa_spesimen.status = 'ditolak') agar riwayat penerimaan jaringan & Nomor PA internal tidak pernah terhapus.
// Addendum (internal maupun dari LIS PA) disimpan sebagai versi baru di pa_laporan_versi; pa_laporan tetap memuat
// versi terbaru (ringkas, dipakai tampilan & cetak yang sudah ada).
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.
const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        -- Koneksi LIS PA (boleh lebih dari satu per faskes: internal dan/atau rujukan eksternal).
        CREATE TABLE IF NOT EXISTS pa_lis_koneksi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(200) NOT NULL, kode_rs VARCHAR(50),
          url_registrasi VARCHAR(500) NOT NULL, url_hasil VARCHAR(500), url_laporan VARCHAR(500),
          api_key TEXT, kunci_masuk TEXT, kunci_masuk_hash VARCHAR(64),
          aktif BOOLEAN NOT NULL DEFAULT true, bawaan BOOLEAN NOT NULL DEFAULT false,
          maks_paralel INTEGER NOT NULL DEFAULT 2, jeda_ms INTEGER NOT NULL DEFAULT 0,
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS pa_lis_koneksi_faskes_idx ON pa_lis_koneksi (faskes_uuid) WHERE deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS pa_lis_koneksi_kunci_hash_uq ON pa_lis_koneksi (kunci_masuk_hash) WHERE deleted_at IS NULL;

        -- Riwayat percobaan pengiriman per kasus PA (klaim atomik: UNIQUE (faskes, order_item, koneksi), sama
        -- dengan lab_lis_kirim). no_registrasi stabil untuk seluruh percobaan kirim ulang kasus yang sama.
        CREATE TABLE IF NOT EXISTS pa_lis_kirim (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES pa_lis_koneksi(uuid),
          order_item_uuid VARCHAR(255) NOT NULL REFERENCES pa_order_item(uuid) ON DELETE CASCADE,
          no_registrasi VARCHAR(80) NOT NULL, lis_no_pa VARCHAR(80),
          status VARCHAR(12) NOT NULL CHECK (status IN ('mengirim', 'terkirim', 'gagal', 'tidak_pasti')),
          pesan TEXT, permintaan JSONB, respons JSONB, percobaan INTEGER NOT NULL DEFAULT 0,
          diklaim_pada BIGINT, diklaim_oleh VARCHAR(255), dikirim_oleh VARCHAR(255),
          created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_lis_kirim_uq ON pa_lis_kirim (faskes_uuid, order_item_uuid, koneksi_uuid);
        CREATE INDEX IF NOT EXISTS pa_lis_kirim_status_idx ON pa_lis_kirim (faskes_uuid, status, updated_at DESC);

        -- Riwayat hasil masuk (tarik GET url_hasil maupun push dari sistem PA).
        CREATE TABLE IF NOT EXISTS pa_lis_hasil (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) REFERENCES pa_lis_koneksi(uuid),
          order_item_uuid VARCHAR(255) REFERENCES pa_order_item(uuid),
          no_registrasi VARCHAR(80), no_pa VARCHAR(80),
          status VARCHAR(12) NOT NULL CHECK (status IN ('diterima', 'sebagian', 'ditolak', 'gagal')),
          pesan TEXT, payload JSONB, sumber VARCHAR(10) NOT NULL DEFAULT 'push' CHECK (sumber IN ('tarik', 'push')),
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS pa_lis_hasil_item_idx ON pa_lis_hasil (order_item_uuid, created_at DESC);

        -- Mapping unit asal / dokter pengirim / penjamin → kode master LIS PA, per koneksi.
        CREATE TABLE IF NOT EXISTS pa_lis_peta_ref (
          faskes_uuid VARCHAR(255) NOT NULL, koneksi_uuid VARCHAR(255) NOT NULL REFERENCES pa_lis_koneksi(uuid) ON DELETE CASCADE,
          jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('unit', 'dokter', 'penjamin')),
          ref_uuid VARCHAR(255) NOT NULL, kode_lis VARCHAR(50) NOT NULL, nama_lis VARCHAR(200), updated_at BIGINT,
          PRIMARY KEY (koneksi_uuid, jenis, ref_uuid)
        );

        -- Mapping pemeriksaan PA (pa_pemeriksaan) → kode pemeriksaan LIS PA, per koneksi.
        CREATE TABLE IF NOT EXISTS pa_lis_peta_pemeriksaan (
          faskes_uuid VARCHAR(255) NOT NULL, koneksi_uuid VARCHAR(255) NOT NULL REFERENCES pa_lis_koneksi(uuid) ON DELETE CASCADE,
          pemeriksaan_uuid VARCHAR(255) NOT NULL REFERENCES pa_pemeriksaan(uuid),
          kode_lis VARCHAR(50) NOT NULL, nama_lis VARCHAR(200), updated_at BIGINT,
          PRIMARY KEY (koneksi_uuid, pemeriksaan_uuid)
        );

        -- Mapping nama field hasil vendor LIS PA → field laporan SIMRS (dot-path pada payload hasil), per koneksi.
        CREATE TABLE IF NOT EXISTS pa_lis_peta_hasil (
          faskes_uuid VARCHAR(255) NOT NULL, koneksi_uuid VARCHAR(255) NOT NULL REFERENCES pa_lis_koneksi(uuid) ON DELETE CASCADE,
          field_simrs VARCHAR(30) NOT NULL
            CHECK (field_simrs IN ('makroskopis', 'mikroskopis', 'diagnosis', 'icd_o_topografi', 'icd_o_morfologi', 'icd10', 'komentar')),
          field_lis VARCHAR(100) NOT NULL, updated_at BIGINT,
          PRIMARY KEY (koneksi_uuid, field_simrs)
        );

        -- Riwayat versi laporan PA (addendum internal maupun dari LIS PA): snapshot lengkap sebelum ditimpa,
        -- agar versi sebelumnya tetap dapat ditinjau (pa_laporan hanya menyimpan versi terbaru, seperti semula).
        CREATE TABLE IF NOT EXISTS pa_laporan_versi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_item_uuid VARCHAR(255) NOT NULL REFERENCES pa_order_item(uuid) ON DELETE CASCADE,
          versi INTEGER NOT NULL, sumber VARCHAR(10) NOT NULL CHECK (sumber IN ('internal', 'lis_pa')),
          makroskopis TEXT, mikroskopis TEXT, diagnosis TEXT, icd_o_topografi VARCHAR(20), icd_o_morfologi VARCHAR(20),
          icd10 VARCHAR(20), icd10_nama VARCHAR(255), komentar TEXT,
          dokter_pa_nama VARCHAR(200), dokter_pa_sip VARCHAR(100), alasan TEXT,
          dibuat_oleh VARCHAR(255), created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_laporan_versi_uq ON pa_laporan_versi (order_item_uuid, versi);

        -- Penolakan spesimen eksternal (dikirim sistem PA setelah jaringan diterima SIMRS): kolom terpisah dari
        -- status & pa_spesimen agar riwayat penerimaan jaringan internal tidak pernah terhapus/tertimpa.
        ALTER TABLE pa_order_item ADD COLUMN IF NOT EXISTS ditolak_eksternal_pada BIGINT;
        ALTER TABLE pa_order_item ADD COLUMN IF NOT EXISTS ditolak_eksternal_alasan TEXT;
        ALTER TABLE pa_order_item ADD COLUMN IF NOT EXISTS ditolak_eksternal_koneksi_uuid VARCHAR(255);
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE pa_order_item DROP COLUMN IF EXISTS ditolak_eksternal_pada;
      ALTER TABLE pa_order_item DROP COLUMN IF EXISTS ditolak_eksternal_alasan;
      ALTER TABLE pa_order_item DROP COLUMN IF EXISTS ditolak_eksternal_koneksi_uuid;
      DROP TABLE IF EXISTS pa_laporan_versi, pa_lis_peta_hasil, pa_lis_peta_pemeriksaan, pa_lis_peta_ref, pa_lis_hasil, pa_lis_kirim, pa_lis_koneksi CASCADE;
    `);
    // Katalog mengikuti JSON; hapus entri pa_bridging_lis dari JSON lalu jalankan migrasi sinkron baru.
  },
};
