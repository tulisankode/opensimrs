'use strict';

const DASAR = `uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
  versi INTEGER NOT NULL DEFAULT 1 CHECK (versi > 0), created_by VARCHAR(255) NOT NULL,
  updated_by VARCHAR(255), deleted_by VARCHAR(255), created_at BIGINT NOT NULL,
  updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS pacu_protokol (
          ${DASAR}, kode VARCHAR(80) NOT NULL, nomor_versi INTEGER NOT NULL,
          aktif BOOLEAN NOT NULL DEFAULT false, definisi JSONB NOT NULL,
          UNIQUE (faskes_uuid, kode, nomor_versi), UNIQUE (faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_jadwal_faskes_pacu_uq ON ok_jadwal(faskes_uuid, uuid);
        CREATE TABLE IF NOT EXISTS pacu_episode (
          ${DASAR}, jadwal_operasi_uuid VARCHAR(255) NOT NULL REFERENCES ok_jadwal(uuid),
          kunjungan_uuid VARCHAR(255) NOT NULL, sumber VARCHAR(10) NOT NULL,
          protokol_uuid VARCHAR(255) NOT NULL, protokol_snapshot JSONB NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'menunggu_masuk'
            CHECK (status IN ('menunggu_masuk','berada_di_pacu','dalam_pemantauan','siap_dipindahkan','selesai')),
          waktu_tiba BIGINT, waktu_mulai_pemantauan BIGINT, waktu_siap_pindah BIGINT, waktu_keluar BIGINT,
          unit_tujuan_uuid VARCHAR(255), UNIQUE (faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, jadwal_operasi_uuid) REFERENCES ok_jadwal(faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, protokol_uuid) REFERENCES pacu_protokol(faskes_uuid, uuid),
          CHECK (waktu_tiba IS NULL OR waktu_tiba > 0),
          CHECK (waktu_mulai_pemantauan IS NULL OR waktu_mulai_pemantauan >= waktu_tiba),
          CHECK (waktu_siap_pindah IS NULL OR waktu_siap_pindah >= waktu_mulai_pemantauan),
          CHECK (waktu_keluar IS NULL OR waktu_keluar >= waktu_siap_pindah)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pacu_episode_jadwal_uq ON pacu_episode(faskes_uuid, jadwal_operasi_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS pacu_episode_antrean_idx ON pacu_episode(faskes_uuid, status, created_at) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS pacu_catatan (
          ${DASAR}, episode_uuid VARCHAR(255) NOT NULL,
          jenis VARCHAR(30) NOT NULL CHECK (jenis IN ('pemantauan','asesmen','intervensi','serah_terima_masuk','serah_terima_keluar')),
          waktu_kejadian BIGINT NOT NULL CHECK (waktu_kejadian > 0), data JSONB NOT NULL,
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES pacu_episode(faskes_uuid, uuid)
        );
        CREATE INDEX IF NOT EXISTS pacu_catatan_episode_idx ON pacu_catatan(faskes_uuid, episode_uuid, waktu_kejadian) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS pacu_riwayat (
          ${DASAR}, episode_uuid VARCHAR(255), entitas VARCHAR(40) NOT NULL, entitas_uuid VARCHAR(255) NOT NULL,
          aksi VARCHAR(80) NOT NULL, nilai_sebelum JSONB, nilai_sesudah JSONB, alasan TEXT,
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES pacu_episode(faskes_uuid, uuid)
        );
        CREATE TABLE IF NOT EXISTS pacu_biaya (
          ${DASAR}, episode_uuid VARCHAR(255) NOT NULL, kunci_idempoten VARCHAR(255) NOT NULL,
          konfigurasi_snapshot JSONB NOT NULL, status_kirim VARCHAR(30) NOT NULL DEFAULT 'tertunda'
            CHECK (status_kirim IN ('tertunda','terkirim','gagal','perlu_rekonsiliasi')),
          referensi_tagihan VARCHAR(255), jumlah_percobaan INTEGER NOT NULL DEFAULT 0, kesalahan_terakhir TEXT,
          UNIQUE (faskes_uuid, kunci_idempoten),
          FOREIGN KEY (faskes_uuid, episode_uuid) REFERENCES pacu_episode(faskes_uuid, uuid)
        );
        CREATE TABLE IF NOT EXISTS pacu_tagihan_referensi (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL, kunci_idempoten VARCHAR(255) NOT NULL,
          hasil JSONB NOT NULL, created_by VARCHAR(255) NOT NULL, updated_by VARCHAR(255), deleted_by VARCHAR(255),
          created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
          UNIQUE (faskes_uuid, kunci_idempoten)
        );
      `, { transaction });
      // Pastikan tabel yang telah ada memiliki kolom kontrak; hentikan bila skema tidak cocok.
      await queryInterface.sequelize.query(`SELECT e.protokol_snapshot, c.data, b.kunci_idempoten, r.nilai_sebelum
        FROM pacu_episode e, pacu_catatan c, pacu_biaya b, pacu_riwayat r LIMIT 0`, { transaction });
    });
  },
  async down() {
    // Catatan klinis dipertahankan; pembatalan skema memerlukan migrasi terpisah.
  },
};
