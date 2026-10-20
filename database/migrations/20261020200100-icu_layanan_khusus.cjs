'use strict';

const waktu = 'created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT';
const pelaku = 'dibuat_oleh VARCHAR(255), diubah_oleh VARCHAR(255)';
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS icu_layanans (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(10) NOT NULL CHECK (kode IN ('umum','burn','neuro')), nama VARCHAR(100) NOT NULL,
          aktif BOOLEAN NOT NULL DEFAULT false, revisi INTEGER NOT NULL DEFAULT 1, ${pelaku}, ${waktu}, UNIQUE(faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS icu_layanan_kode_uq ON icu_layanans(faskes_uuid,kode) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS icu_layanan_beds (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, layanan_uuid VARCHAR(255) NOT NULL,
          room_monitoring_uuid VARCHAR(255) NOT NULL, ruangan_uuid VARCHAR(255) NOT NULL,
          berlaku_mulai BIGINT NOT NULL, berlaku_sampai BIGINT, revisi INTEGER NOT NULL DEFAULT 1,
          ${pelaku}, ${waktu}, CHECK(berlaku_sampai IS NULL OR berlaku_sampai >= berlaku_mulai),
          FOREIGN KEY(faskes_uuid,layanan_uuid) REFERENCES icu_layanans(faskes_uuid,uuid)
        );
        CREATE INDEX IF NOT EXISTS icu_layanan_bed_waktu_idx ON icu_layanan_beds(faskes_uuid,room_monitoring_uuid,berlaku_mulai);
        CREATE TABLE IF NOT EXISTS icu_akses_units (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, role_uuid VARCHAR(255) NOT NULL,
          ruangan_uuid VARCHAR(255) NOT NULL, revisi INTEGER NOT NULL DEFAULT 1, ${pelaku}, ${waktu}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS icu_akses_unit_uq ON icu_akses_units(faskes_uuid,role_uuid,ruangan_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS icu_template_versis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, layanan_uuid VARCHAR(255) NOT NULL,
          kode_template VARCHAR(64) NOT NULL, nomor_versi INTEGER NOT NULL, nama VARCHAR(200) NOT NULL,
          status VARCHAR(20) NOT NULL CHECK(status IN ('draf','ditetapkan','diarsipkan')),
          definisi JSONB NOT NULL, aturan_kelengkapan JSONB NOT NULL DEFAULT '[]', revisi INTEGER NOT NULL DEFAULT 1,
          ditetapkan_oleh VARCHAR(255), waktu_penetapan BIGINT, ${pelaku}, ${waktu},
          UNIQUE(faskes_uuid,uuid), UNIQUE(faskes_uuid,layanan_uuid,kode_template,nomor_versi),
          FOREIGN KEY(faskes_uuid,layanan_uuid) REFERENCES icu_layanans(faskes_uuid,uuid)
        );
        CREATE INDEX IF NOT EXISTS icu_template_layanan_idx ON icu_template_versis(faskes_uuid,layanan_uuid,status);
        ALTER TABLE icu_perawatans ADD COLUMN IF NOT EXISTS layanan_kode VARCHAR(10) CHECK(layanan_kode IN ('umum','burn','neuro'));
        ALTER TABLE icu_perawatans ADD COLUMN IF NOT EXISTS template_versi_uuid VARCHAR(255);
        ALTER TABLE icu_perawatans ADD COLUMN IF NOT EXISTS perawatan_sebelumnya_uuid VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS icu_perawatan_faskes_uuid_uq ON icu_perawatans(faskes_uuid,uuid);
        DO $$ BEGIN
          IF EXISTS(SELECT 1 FROM icu_perawatans WHERE deleted_at IS NULL GROUP BY faskes_uuid,perpindahan_masuk_uuid HAVING COUNT(*) > 1) THEN
            RAISE EXCEPTION 'Duplikasi perpindahan masuk ICU: lakukan rekonsiliasi manusia sebelum melanjutkan migrasi';
          END IF;
        END $$;
        CREATE UNIQUE INDEX IF NOT EXISTS icu_perawatan_perpindahan_uq ON icu_perawatans(faskes_uuid,perpindahan_masuk_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS icu_perawatan_layanan_unit_idx ON icu_perawatans(faskes_uuid,layanan_kode,ruangan_uuid,waktu_masuk);
        CREATE INDEX IF NOT EXISTS icu_perawatan_template_idx ON icu_perawatans(faskes_uuid,template_versi_uuid);
        ALTER TABLE icu_observasis ADD COLUMN IF NOT EXISTS template_versi_uuid VARCHAR(255);
        ALTER TABLE icu_observasis ADD COLUMN IF NOT EXISTS parameter_tambahan JSONB NOT NULL DEFAULT '[]';
        ALTER TABLE icu_observasis ADD COLUMN IF NOT EXISTS revisi INTEGER NOT NULL DEFAULT 1;
        DO $$ BEGIN
          IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='icu_episode_template_fk' AND conrelid='icu_perawatans'::regclass) THEN
            ALTER TABLE icu_perawatans ADD CONSTRAINT icu_episode_template_fk FOREIGN KEY(faskes_uuid,template_versi_uuid) REFERENCES icu_template_versis(faskes_uuid,uuid);
          END IF;
          IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='icu_episode_sebelumnya_fk' AND conrelid='icu_perawatans'::regclass) THEN
            ALTER TABLE icu_perawatans ADD CONSTRAINT icu_episode_sebelumnya_fk FOREIGN KEY(faskes_uuid,perawatan_sebelumnya_uuid) REFERENCES icu_perawatans(faskes_uuid,uuid);
          END IF;
          IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='icu_observasi_template_fk' AND conrelid='icu_observasis'::regclass) THEN
            ALTER TABLE icu_observasis ADD CONSTRAINT icu_observasi_template_fk FOREIGN KEY(faskes_uuid,template_versi_uuid) REFERENCES icu_template_versis(faskes_uuid,uuid);
          END IF;
        END $$;
        CREATE TABLE IF NOT EXISTS icu_dokumentasis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, perawatan_uuid VARCHAR(255) NOT NULL,
          template_versi_uuid VARCHAR(255) NOT NULL, kode_dokumen VARCHAR(64) NOT NULL,
          waktu_pencatatan BIGINT NOT NULL, nilai JSONB NOT NULL, revisi INTEGER NOT NULL DEFAULT 1, pencatat VARCHAR(255), ${waktu},
          UNIQUE(faskes_uuid,uuid), FOREIGN KEY(faskes_uuid,perawatan_uuid) REFERENCES icu_perawatans(faskes_uuid,uuid),
          FOREIGN KEY(faskes_uuid,template_versi_uuid) REFERENCES icu_template_versis(faskes_uuid,uuid)
        );
        CREATE INDEX IF NOT EXISTS icu_dokumentasi_episode_idx ON icu_dokumentasis(faskes_uuid,perawatan_uuid,waktu_pencatatan);
        CREATE TABLE IF NOT EXISTS icu_dokumentasi_koreksis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, dokumentasi_uuid VARCHAR(255) NOT NULL,
          nilai_sebelum JSONB NOT NULL, nilai_sesudah JSONB NOT NULL, alasan TEXT NOT NULL, pelaku VARCHAR(255), created_at BIGINT NOT NULL,
          FOREIGN KEY(faskes_uuid,dokumentasi_uuid) REFERENCES icu_dokumentasis(faskes_uuid,uuid)
        );
        CREATE INDEX IF NOT EXISTS icu_dokumentasi_koreksi_idx ON icu_dokumentasi_koreksis(faskes_uuid,dokumentasi_uuid,created_at);
        CREATE TABLE IF NOT EXISTS icu_konfigurasi_riwayats (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, jenis_entitas VARCHAR(40) NOT NULL,
          entitas_uuid VARCHAR(255) NOT NULL, nilai_sebelum JSONB, nilai_sesudah JSONB, alasan TEXT NOT NULL,
          pelaku VARCHAR(255), created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS icu_konfigurasi_riwayat_idx ON icu_konfigurasi_riwayats(faskes_uuid,created_at);
      `, { transaction });
    });
  },
  async down() { /* Pemulihan melalui migrasi korektif baru agar riwayat klinis tetap tersedia. */ },
};
