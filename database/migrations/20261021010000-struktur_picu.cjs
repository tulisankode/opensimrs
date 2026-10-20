'use strict';

// PICU merujuk okupansi dan perpindahan sumber; tidak membuat okupansi kedua.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS picu_tempat_tidur (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          tempat_tidur_uuid VARCHAR(255) NOT NULL, dibuat_oleh VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS picu_tempat_tidur_aktif_uq
          ON picu_tempat_tidur (faskes_uuid, tempat_tidur_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS picu_konfigurasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis VARCHAR(40) NOT NULL, nama VARCHAR(255) NOT NULL, definisi JSONB NOT NULL,
          status VARCHAR(12) NOT NULL CHECK (status IN ('draf', 'berlaku')),
          referensi_penetapan TEXT, disahkan_oleh VARCHAR(255), disahkan_at BIGINT,
          dibuat_oleh VARCHAR(255) NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          UNIQUE (faskes_uuid, uuid)
        );
        CREATE TABLE IF NOT EXISTS picu_episode (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          pasien_uuid VARCHAR(255) NOT NULL, kunjungan_uuid VARCHAR(255) NOT NULL,
          tempat_tidur_uuid VARCHAR(255) NOT NULL, referensi_penerimaan_uuid VARCHAR(255) NOT NULL,
          sumber_penerimaan VARCHAR(30) NOT NULL CHECK (sumber_penerimaan = 'rawat_inap'),
          status VARCHAR(12) NOT NULL CHECK (status IN ('aktif', 'selesai')),
          versi INTEGER NOT NULL DEFAULT 1, waktu_masuk BIGINT NOT NULL, waktu_keluar BIGINT,
          jenis_keluar VARCHAR(20), dibuat_oleh VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          UNIQUE (faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS picu_episode_pasien_aktif_uq ON picu_episode (faskes_uuid, pasien_uuid)
          WHERE status = 'aktif' AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS picu_episode_bed_aktif_uq ON picu_episode (faskes_uuid, tempat_tidur_uuid)
          WHERE status = 'aktif' AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS picu_episode_penerimaan_uq ON picu_episode (faskes_uuid, referensi_penerimaan_uuid)
          WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS picu_dokumentasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          episode_uuid VARCHAR(255) NOT NULL, konfigurasi_uuid VARCHAR(255) NOT NULL,
          jenis VARCHAR(40) NOT NULL, isi JSONB NOT NULL, waktu_catatan BIGINT NOT NULL,
          status VARCHAR(12) NOT NULL CHECK (status IN ('draf', 'final')),
          koreksi_uuid VARCHAR(255), alasan TEXT, finalisasi_oleh VARCHAR(255), finalisasi_at BIGINT,
          dibuat_oleh VARCHAR(255) NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          UNIQUE (faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES picu_episode (faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, konfigurasi_uuid) REFERENCES picu_konfigurasi (faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, koreksi_uuid) REFERENCES picu_dokumentasi (faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS picu_dokumentasi_koreksi_uq ON picu_dokumentasi (faskes_uuid, koreksi_uuid)
          WHERE koreksi_uuid IS NOT NULL AND deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS picu_riwayat (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          episode_uuid VARCHAR(255) NOT NULL, jenis VARCHAR(40) NOT NULL,
          referensi_uuid VARCHAR(255), asal_uuid VARCHAR(255), tujuan_uuid VARCHAR(255),
          alasan TEXT NOT NULL, dibuat_oleh VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES picu_episode (faskes_uuid, uuid)
        );
        CREATE INDEX IF NOT EXISTS picu_riwayat_episode_idx ON picu_riwayat (faskes_uuid, episode_uuid, created_at);
        CREATE TABLE IF NOT EXISTS picu_idempotensi (
          faskes_uuid VARCHAR(255) NOT NULL, kunci VARCHAR(100) NOT NULL, lingkup VARCHAR(255) NOT NULL,
          ringkasan VARCHAR(64) NOT NULL, hasil JSONB, dibuat_oleh VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          PRIMARY KEY (faskes_uuid, kunci, lingkup)
        );
      `, { transaction });
    });
  },
  async down() {
    // Pemulihan menonaktifkan modul melalui pengaturan; riwayat klinis dipertahankan.
  },
};
