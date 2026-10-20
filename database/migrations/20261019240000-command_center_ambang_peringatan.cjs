'use strict';

// Command Center (STD-0037, laporan-service): ambang peringatan per faskes, peringatan berbasis ambang, dan jejak
// tindak lanjut (tinjau/eskalasi). Tabel ini bukan catatan transaksi pasien: hanya kode indikator, nilai agregat,
// label ruangan/poli, dan petugas; tidak ada identitas pasien.
//   command_center_ambang    : satu baris aktif per (faskes, kode); kode mengikuti KATALOG_AMBANG di
//                              laporan-service/src/helpers/command-center.js. Diisi pemegang izin Dashboard ›
//                              Command Center › ATUR AMBANG; sistem tidak memasang ambang otomatis.
//   command_center_peringatan: satu peringatan TERBUKA per (faskes, kunci) (indeks unik parsial selesai_pada IS NULL)
//                              agar polling beberapa layar tidak menggandakan peringatan; selesai_pada diisi otomatis
//                              saat nilai kembali di bawah ambang.
//   command_center_tindakan  : log tinjauan/eskalasi (petugas, waktu, catatan, tujuan eskalasi); tidak pernah diubah.
// Konvensi: uuid varchar (uuidv7 aplikasi), waktu epoch detik, soft delete deleted_at. Idempoten (IF NOT EXISTS).

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS command_center_ambang (
        uuid VARCHAR(255) PRIMARY KEY,
        faskes_uuid VARCHAR(255) NOT NULL,
        kode VARCHAR(50) NOT NULL,
        operator VARCHAR(2) NOT NULL DEFAULT '>',
        batas_peringatan NUMERIC(18, 4),
        batas_kritis NUMERIC(18, 4),
        aktif BOOLEAN NOT NULL DEFAULT true,
        diubah_oleh VARCHAR(255),
        created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
        CONSTRAINT command_center_ambang_operator_ck CHECK (operator IN ('>', '>=')),
        CONSTRAINT command_center_ambang_batas_ck CHECK (batas_peringatan IS NOT NULL OR batas_kritis IS NOT NULL),
        CONSTRAINT command_center_ambang_urut_ck CHECK (batas_peringatan IS NULL OR batas_kritis IS NULL OR batas_peringatan <= batas_kritis)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS command_center_ambang_kode_uq ON command_center_ambang (faskes_uuid, kode) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS command_center_peringatan (
        uuid VARCHAR(255) PRIMARY KEY,
        faskes_uuid VARCHAR(255) NOT NULL,
        kunci VARCHAR(320) NOT NULL,
        kode VARCHAR(50) NOT NULL,
        sasaran_uuid VARCHAR(255),
        sasaran_label VARCHAR(255),
        tingkat VARCHAR(20) NOT NULL,
        operator VARCHAR(2) NOT NULL,
        batas NUMERIC(18, 4),
        satuan VARCHAR(20),
        nilai_awal NUMERIC(18, 4),
        nilai_terakhir NUMERIC(18, 4),
        status VARCHAR(20) NOT NULL DEFAULT 'aktif',
        mulai_pada BIGINT NOT NULL,
        terdeteksi_pada BIGINT NOT NULL,
        selesai_pada BIGINT,
        ditinjau_oleh VARCHAR(255), ditinjau_pada BIGINT,
        dieskalasi_oleh VARCHAR(255), dieskalasi_pada BIGINT,
        created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
        CONSTRAINT command_center_peringatan_tingkat_ck CHECK (tingkat IN ('peringatan', 'kritis')),
        CONSTRAINT command_center_peringatan_status_ck CHECK (status IN ('aktif', 'ditinjau', 'dieskalasi'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS command_center_peringatan_terbuka_uq
        ON command_center_peringatan (faskes_uuid, kunci) WHERE selesai_pada IS NULL AND deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS command_center_peringatan_selesai_idx
        ON command_center_peringatan (faskes_uuid, selesai_pada) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS command_center_tindakan (
        uuid VARCHAR(255) PRIMARY KEY,
        faskes_uuid VARCHAR(255) NOT NULL,
        peringatan_uuid VARCHAR(255) NOT NULL,
        jenis VARCHAR(20) NOT NULL,
        catatan TEXT NOT NULL,
        tujuan VARCHAR(255),
        petugas VARCHAR(255),
        petugas_uuid VARCHAR(255),
        created_at BIGINT NOT NULL, deleted_at BIGINT,
        CONSTRAINT command_center_tindakan_jenis_ck CHECK (jenis IN ('tinjau', 'eskalasi'))
      );
      CREATE INDEX IF NOT EXISTS command_center_tindakan_peringatan_idx ON command_center_tindakan (faskes_uuid, peringatan_uuid);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS command_center_tindakan;
      DROP TABLE IF EXISTS command_center_peringatan;
      DROP TABLE IF EXISTS command_center_ambang;
    `);
  },
};
