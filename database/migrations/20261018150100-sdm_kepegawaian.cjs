'use strict';

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS hr_kepegawaian (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          pegawai_uuid VARCHAR(255) NOT NULL REFERENCES pegawai(uuid),
          status_kepegawaian VARCHAR(20) NOT NULL CHECK (status_kepegawaian IN ('tetap','kontrak','honorer','magang','purna_tugas')),
          unit_uuid VARCHAR(255) REFERENCES lokasi(uuid), jabatan VARCHAR(150), golongan VARCHAR(50),
          tanggal_mulai BIGINT NOT NULL, tanggal_selesai BIGINT, dibuat_oleh VARCHAR(120), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS hr_kepegawaian_pegawai_uq ON hr_kepegawaian (faskes_uuid, pegawai_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS hr_kepegawaian_unit_idx ON hr_kepegawaian (faskes_uuid, unit_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS hr_riwayat_jabatan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kepegawaian_uuid VARCHAR(255) NOT NULL REFERENCES hr_kepegawaian(uuid), jabatan VARCHAR(150) NOT NULL,
          unit_uuid VARCHAR(255) REFERENCES lokasi(uuid), tanggal_mulai BIGINT NOT NULL, tanggal_selesai BIGINT,
          catatan TEXT, dicatat_oleh VARCHAR(120), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS hr_riwayat_kepegawaian_idx ON hr_riwayat_jabatan (faskes_uuid, kepegawaian_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS hr_pendidikan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kepegawaian_uuid VARCHAR(255) NOT NULL REFERENCES hr_kepegawaian(uuid), jenjang VARCHAR(30) NOT NULL,
          institusi VARCHAR(255) NOT NULL, bidang_studi VARCHAR(150), tahun_lulus INTEGER, dicatat_oleh VARCHAR(120), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS hr_pendidikan_kepegawaian_idx ON hr_pendidikan (faskes_uuid, kepegawaian_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS hr_akun_pegawai (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kepegawaian_uuid VARCHAR(255) NOT NULL REFERENCES hr_kepegawaian(uuid), username VARCHAR(120) NOT NULL,
          ditautkan_oleh VARCHAR(120), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS hr_akun_pegawai_username_uq ON hr_akun_pegawai (faskes_uuid, lower(username)) WHERE deleted_at IS NULL;
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS hr_akun_pegawai, hr_pendidikan, hr_riwayat_jabatan, hr_kepegawaian');
  },
};
