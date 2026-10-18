'use strict';

// STD-0017 — Bridging Bank Darah RS (BDRS) ke UTD/BDRS eksternal.
// Tabel baru saja (tidak mengubah bdrs_permintaan/bdrs_stok/bdrs_komponen_darah yang sudah ada). Kantong yang lolos
// validasi tetap masuk ke bdrs_stok lewat alur penerimaan BDRS biasa (sumber='utd_otomatis', utd_referensi_uuid
// menunjuk ke bdrs_utd_kantong.uuid) — lihat penunjang-service/src/bank-darah/utd/*.
// - bdrs_utd_koneksi       : konfigurasi koneksi UTD per faskes (bisa lebih dari satu). API key & kunci masuk
//                            disimpan terenkripsi (penunjang-service/src/bank-darah/utd/kripto.js, pola sama dengan
//                            lab-service/src/lis/rahasia.js). Hanya satu koneksi bawaan aktif per faskes (indeks unik parsial).
// - bdrs_utd_kirim         : satu baris per kombinasi faskes+permintaan+koneksi (idempotensi KF-4/T1); no_registrasi stabil
//                            dipakai ulang pada percobaan berikutnya.
// - bdrs_utd_hasil         : pembaruan status dari UTD (push/tarik), ringkasan jumlah kantong & penolakan.
// - bdrs_utd_kantong       : satu baris per kantong bridging (idempoten pada no_kantong per pengiriman — KF-9/T2).
//                            status_imltd dinormalisasi (trim+lower) terpisah dari imltd_mentah (nilai asli UTD, KT-11).
//                            Hanya status_validasi='menunggu' & status_imltd='non_reaktif' yang dapat diteruskan ke
//                            penerimaan BDRS (lihat utd-hasil.js & stok.js/bersama penerimaan).
// - bdrs_utd_peta_*        : pemetaan komponen/unit/dokter/penjamin lokal ke kode UTD, per koneksi (satu faskes bisa
//                            punya kode berbeda untuk UTD yang berbeda).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS bdrs_utd_koneksi (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(200) NOT NULL,
          kode_rs VARCHAR(100),
          url_registrasi VARCHAR(500) NOT NULL,
          url_status VARCHAR(500),
          url_stok VARCHAR(500),
          api_key TEXT,
          kunci_masuk TEXT,
          kunci_masuk_hash VARCHAR(128),
          aktif BOOLEAN NOT NULL DEFAULT true,
          bawaan BOOLEAN NOT NULL DEFAULT false,
          maks_paralel SMALLINT NOT NULL DEFAULT 2,
          jeda_ms INTEGER NOT NULL DEFAULT 0,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_utd_koneksi_bawaan_uq ON bdrs_utd_koneksi (faskes_uuid)
          WHERE bawaan = true AND aktif = true AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bdrs_utd_koneksi_kunci_idx ON bdrs_utd_koneksi (kunci_masuk_hash) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bdrs_utd_koneksi_faskes_idx ON bdrs_utd_koneksi (faskes_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bdrs_utd_kirim (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_koneksi (uuid),
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_permintaan (uuid),
          no_registrasi VARCHAR(100) NOT NULL,
          no_registrasi_utd VARCHAR(100),
          status VARCHAR(20) NOT NULL DEFAULT 'sedang_dikirim'
            CHECK (status IN ('sedang_dikirim', 'terkirim', 'gagal', 'tidak_pasti', 'kantong_diterima', 'diterima_sebagian')),
          pesan TEXT,
          payload JSONB,
          respons JSONB,
          percobaan INTEGER NOT NULL DEFAULT 0,
          dikirim_oleh VARCHAR(255),
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          CONSTRAINT bdrs_utd_kirim_uq UNIQUE (faskes_uuid, permintaan_uuid, koneksi_uuid)
        );
        CREATE INDEX IF NOT EXISTS bdrs_utd_kirim_status_idx ON bdrs_utd_kirim (faskes_uuid, status);
        CREATE INDEX IF NOT EXISTS bdrs_utd_kirim_no_registrasi_idx ON bdrs_utd_kirim (faskes_uuid, no_registrasi);

        CREATE TABLE IF NOT EXISTS bdrs_utd_hasil (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_koneksi (uuid),
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_permintaan (uuid),
          no_registrasi VARCHAR(100) NOT NULL,
          status VARCHAR(50),
          pesan TEXT,
          jumlah_kantong INTEGER NOT NULL DEFAULT 0,
          jumlah_diterima INTEGER NOT NULL DEFAULT 0,
          ringkasan_ditolak JSONB,
          payload JSONB,
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS bdrs_utd_hasil_permintaan_idx ON bdrs_utd_hasil (faskes_uuid, permintaan_uuid, created_at);

        CREATE TABLE IF NOT EXISTS bdrs_utd_kantong (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          hasil_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_hasil (uuid),
          kirim_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_kirim (uuid),
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_permintaan (uuid),
          no_kantong VARCHAR(100) NOT NULL,
          kode_komponen_utd VARCHAR(50),
          komponen_uuid VARCHAR(255),
          golongan_abo VARCHAR(5),
          rhesus VARCHAR(20),
          volume_ml NUMERIC,
          tanggal_produksi BIGINT,
          tanggal_kedaluwarsa BIGINT,
          imltd_mentah VARCHAR(100),
          status_imltd VARCHAR(20) NOT NULL DEFAULT 'tidak_dikenal'
            CHECK (status_imltd IN ('non_reaktif', 'reaktif', 'belum_diperiksa', 'tidak_dikenal')),
          crossmatch_utd JSONB,
          peringatan_golongan BOOLEAN NOT NULL DEFAULT false,
          status_validasi VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status_validasi IN ('menunggu', 'diterima', 'ditolak')),
          alasan_tolak TEXT,
          stok_uuid VARCHAR(255) REFERENCES bdrs_stok (uuid),
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          CONSTRAINT bdrs_utd_kantong_uq UNIQUE (faskes_uuid, kirim_uuid, no_kantong)
        );
        CREATE INDEX IF NOT EXISTS bdrs_utd_kantong_permintaan_idx ON bdrs_utd_kantong (faskes_uuid, permintaan_uuid);
        CREATE INDEX IF NOT EXISTS bdrs_utd_kantong_status_idx ON bdrs_utd_kantong (faskes_uuid, status_validasi);

        CREATE TABLE IF NOT EXISTS bdrs_utd_peta_komponen (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_koneksi (uuid),
          komponen_uuid VARCHAR(255) NOT NULL,
          kode_utd VARCHAR(50) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_utd_peta_komponen_uq ON bdrs_utd_peta_komponen (faskes_uuid, koneksi_uuid, komponen_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bdrs_utd_peta_unit (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_koneksi (uuid),
          lokasi_uuid VARCHAR(255) NOT NULL,
          kode_utd VARCHAR(50) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_utd_peta_unit_uq ON bdrs_utd_peta_unit (faskes_uuid, koneksi_uuid, lokasi_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bdrs_utd_peta_dokter (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_koneksi (uuid),
          practitioner_uuid VARCHAR(255) NOT NULL,
          kode_utd VARCHAR(50) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_utd_peta_dokter_uq ON bdrs_utd_peta_dokter (faskes_uuid, koneksi_uuid, practitioner_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bdrs_utd_peta_penjamin (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          koneksi_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_utd_koneksi (uuid),
          penjamin_uuid VARCHAR(255) NOT NULL,
          kode_utd VARCHAR(50) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_utd_peta_penjamin_uq ON bdrs_utd_peta_penjamin (faskes_uuid, koneksi_uuid, penjamin_uuid) WHERE deleted_at IS NULL;
      `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS bdrs_utd_peta_penjamin;
      DROP TABLE IF EXISTS bdrs_utd_peta_dokter;
      DROP TABLE IF EXISTS bdrs_utd_peta_unit;
      DROP TABLE IF EXISTS bdrs_utd_peta_komponen;
      DROP TABLE IF EXISTS bdrs_utd_kantong;
      DROP TABLE IF EXISTS bdrs_utd_hasil;
      DROP TABLE IF EXISTS bdrs_utd_kirim;
      DROP TABLE IF EXISTS bdrs_utd_koneksi;
    `);
  },
};
