'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        -- Keunikan berlaku untuk seluruh penempatan rawat inap, termasuk pasien di luar HDU.
        -- Konflik data lama harus ditinjau manusia; migrasi tidak mengubah penempatan yang sudah ada.
        CREATE UNIQUE INDEX IF NOT EXISTS rawat_inaps_bed_aktif_hdu_uq
          ON rawat_inaps(faskes_uuid, monitoring_room_uuid)
          WHERE deleted_at IS NULL AND discharge_date IS NULL AND status_ri IN (1, 2, 3);
        CREATE TABLE IF NOT EXISTS hdu_konfigurasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          ruangan_uuid VARCHAR(255) NOT NULL, nama VARCHAR(150) NOT NULL, aktif BOOLEAN NOT NULL,
          versi INTEGER NOT NULL DEFAULT 1, pencatat VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          UNIQUE (faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS hdu_konfigurasi_ruangan_uq ON hdu_konfigurasi(faskes_uuid, ruangan_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS hdu_episode (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          konfigurasi_uuid VARCHAR(255) NOT NULL, pasien_uuid VARCHAR(255) NOT NULL,
          rawat_inap_uuid VARCHAR(255) NOT NULL, rekam_medis_uuid VARCHAR(255), room_monitoring_uuid VARCHAR(255) NOT NULL,
          perpindahan_masuk_uuid VARCHAR(255) NOT NULL, perpindahan_keluar_uuid VARCHAR(255),
          status VARCHAR(10) NOT NULL CHECK (status IN ('aktif', 'selesai')),
          waktu_masuk BIGINT NOT NULL, waktu_keluar BIGINT, versi INTEGER NOT NULL DEFAULT 1,
          pencatat VARCHAR(255) NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          UNIQUE (faskes_uuid, uuid), UNIQUE (faskes_uuid, perpindahan_masuk_uuid),
          FOREIGN KEY (faskes_uuid, konfigurasi_uuid) REFERENCES hdu_konfigurasi(faskes_uuid, uuid),
          CHECK (waktu_keluar IS NULL OR waktu_keluar >= waktu_masuk)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS hdu_episode_pasien_aktif_uq ON hdu_episode(faskes_uuid, pasien_uuid) WHERE status = 'aktif' AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS hdu_episode_bed_aktif_uq ON hdu_episode(faskes_uuid, room_monitoring_uuid) WHERE status = 'aktif' AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS hdu_episode_daftar_idx ON hdu_episode(faskes_uuid, status, konfigurasi_uuid, waktu_masuk) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS hdu_instruksi_observasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          konfigurasi_uuid VARCHAR(255) NOT NULL, episode_uuid VARCHAR(255),
          interval_detik INTEGER NOT NULL CHECK (interval_detik BETWEEN 1 AND 604800),
          berlaku_mulai BIGINT NOT NULL, alasan TEXT NOT NULL, versi INTEGER NOT NULL,
          pencatat VARCHAR(255) NOT NULL, created_at BIGINT NOT NULL, deleted_at BIGINT,
          FOREIGN KEY (faskes_uuid, konfigurasi_uuid) REFERENCES hdu_konfigurasi(faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES hdu_episode(faskes_uuid, uuid)
        );
        CREATE INDEX IF NOT EXISTS hdu_instruksi_waktu_idx ON hdu_instruksi_observasi(faskes_uuid, konfigurasi_uuid, episode_uuid, berlaku_mulai DESC);
        CREATE TABLE IF NOT EXISTS hdu_serah_terima (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          episode_uuid VARCHAR(255), perpindahan_uuid VARCHAR(255) NOT NULL,
          arah VARCHAR(6) NOT NULL CHECK (arah IN ('masuk', 'keluar')),
          ringkasan JSONB NOT NULL, tujuan_icu BOOLEAN NOT NULL DEFAULT false,
          pengirim VARCHAR(255) NOT NULL, penerima VARCHAR(255),
          waktu_kejadian BIGINT NOT NULL, waktu_konfirmasi BIGINT, waktu_penerimaan BIGINT,
          versi INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          UNIQUE (faskes_uuid, perpindahan_uuid, arah),
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES hdu_episode(faskes_uuid, uuid)
        );
        CREATE TABLE IF NOT EXISTS hdu_operasi (
          faskes_uuid VARCHAR(255) NOT NULL, pelaku VARCHAR(255) NOT NULL, kunci VARCHAR(255) NOT NULL,
          operasi TEXT NOT NULL, sidik VARCHAR(64) NOT NULL, hasil JSONB NOT NULL, created_at BIGINT NOT NULL,
          PRIMARY KEY (faskes_uuid, pelaku, kunci)
        );
      `, { transaction });
    });
  },
  async down() {
    // Riwayat klinis dipertahankan; pembalikan memerlukan migrasi pemulihan tersendiri.
  },
};
