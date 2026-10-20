'use strict';

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT';
const IDENTITAS = `uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS nicu_tempat (
          ${IDENTITAS}, unit_uuid VARCHAR(255) NOT NULL, room_monitoring_uuid VARCHAR(255) NOT NULL,
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('bed', 'inkubator')),
          status_alat VARCHAR(20) NOT NULL CHECK (status_alat IN ('siap', 'pembersihan', 'pemeliharaan', 'rusak')),
          versi INTEGER NOT NULL DEFAULT 1, pencatat VARCHAR(255) NOT NULL, ${WAKTU}, UNIQUE (faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS nicu_tempat_sumber_uq ON nicu_tempat(faskes_uuid, room_monitoring_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS nicu_konfigurasi_versi (
          ${IDENTITAS}, unit_uuid VARCHAR(255) NOT NULL, jenis VARCHAR(30) NOT NULL,
          definisi JSONB NOT NULL, status VARCHAR(10) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf', 'terbit')),
          referensi_pengesahan TEXT, diterbitkan_oleh VARCHAR(255), diterbitkan_at BIGINT,
          versi INTEGER NOT NULL DEFAULT 1, pencatat VARCHAR(255) NOT NULL, ${WAKTU}, UNIQUE (faskes_uuid, uuid)
        );
        CREATE TABLE IF NOT EXISTS nicu_episode (
          ${IDENTITAS}, pasien_uuid VARCHAR(255) NOT NULL, rawat_inap_uuid VARCHAR(255) NOT NULL,
          perpindahan_masuk_uuid VARCHAR(255) NOT NULL, perpindahan_keluar_uuid VARCHAR(255),
          status VARCHAR(10) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'selesai')),
          masuk_at BIGINT NOT NULL, keluar_at BIGINT, serah_terima_masuk TEXT NOT NULL, serah_terima_keluar TEXT,
          versi INTEGER NOT NULL DEFAULT 1, pencatat VARCHAR(255) NOT NULL, ${WAKTU}, UNIQUE (faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS nicu_episode_aktif_uq ON nicu_episode(faskes_uuid, rawat_inap_uuid) WHERE status = 'aktif' AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS nicu_episode_masuk_uq ON nicu_episode(faskes_uuid, perpindahan_masuk_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS nicu_episode_daftar_idx ON nicu_episode(faskes_uuid, status, masuk_at) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS nicu_penempatan (
          ${IDENTITAS}, episode_uuid VARCHAR(255) NOT NULL, tempat_uuid VARCHAR(255) NOT NULL,
          perpindahan_uuid VARCHAR(255) NOT NULL, mulai_at BIGINT NOT NULL, selesai_at BIGINT,
          pencatat VARCHAR(255) NOT NULL, ${WAKTU},
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES nicu_episode(faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, tempat_uuid) REFERENCES nicu_tempat(faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS nicu_penempatan_episode_uq ON nicu_penempatan(faskes_uuid, episode_uuid) WHERE selesai_at IS NULL AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS nicu_penempatan_tempat_uq ON nicu_penempatan(faskes_uuid, tempat_uuid) WHERE selesai_at IS NULL AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS nicu_penempatan_transaksi_uq ON nicu_penempatan(faskes_uuid, perpindahan_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS nicu_dokumen (
          ${IDENTITAS}, episode_uuid VARCHAR(255) NOT NULL, konfigurasi_versi_uuid VARCHAR(255) NOT NULL,
          isi JSONB NOT NULL, waktu_pencatatan BIGINT NOT NULL, versi INTEGER NOT NULL DEFAULT 1,
          pencatat VARCHAR(255) NOT NULL, ${WAKTU}, UNIQUE (faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES nicu_episode(faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, konfigurasi_versi_uuid) REFERENCES nicu_konfigurasi_versi(faskes_uuid, uuid)
        );
        CREATE INDEX IF NOT EXISTS nicu_dokumen_histori_idx ON nicu_dokumen(faskes_uuid, episode_uuid, waktu_pencatatan) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS nicu_dokumen_revisi (
          ${IDENTITAS}, dokumen_uuid VARCHAR(255) NOT NULL, nomor_revisi INTEGER NOT NULL,
          sebelum JSONB NOT NULL, sesudah JSONB NOT NULL, alasan TEXT NOT NULL, pencatat VARCHAR(255) NOT NULL, ${WAKTU},
          FOREIGN KEY (faskes_uuid, dokumen_uuid) REFERENCES nicu_dokumen(faskes_uuid, uuid),
          UNIQUE (faskes_uuid, dokumen_uuid, nomor_revisi)
        );
        CREATE TABLE IF NOT EXISTS nicu_operasi (
          ${IDENTITAS}, jenis VARCHAR(100) NOT NULL, kunci VARCHAR(100) NOT NULL, hash_permintaan VARCHAR(64) NOT NULL,
          hasil JSONB NOT NULL, pencatat VARCHAR(255) NOT NULL, ${WAKTU}, UNIQUE (faskes_uuid, jenis, kunci)
        );
      `, { transaction });
    });
  },
  async down() {
    // Rekaman pelayanan dan audit dipertahankan; pemulihan dilakukan dengan menonaktifkan modul.
  },
};
