'use strict';

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS hr_kredensial (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kepegawaian_uuid VARCHAR(255) NOT NULL REFERENCES hr_kepegawaian(uuid),
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('str','sip','sertifikat_kompetensi','lainnya')),
          nomor VARCHAR(100) NOT NULL, penerbit VARCHAR(255), tanggal_terbit BIGINT, tanggal_berakhir BIGINT,
          status_verifikasi VARCHAR(20) NOT NULL DEFAULT 'belum_diverifikasi' CHECK (status_verifikasi IN ('belum_diverifikasi','terverifikasi','ditolak')),
          diverifikasi_oleh VARCHAR(120), diverifikasi_pada BIGINT, catatan_verifikasi TEXT, dicatat_oleh VARCHAR(120), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS hr_kredensial_jatuh_tempo_idx ON hr_kredensial (faskes_uuid, tanggal_berakhir) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS hr_kredensial_pegawai_idx ON hr_kredensial (faskes_uuid, kepegawaian_uuid) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS hr_berkas (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis_berkas VARCHAR(30) NOT NULL CHECK (jenis_berkas IN ('dokumen_kredensial','sertifikat_pelatihan')),
          kredensial_uuid VARCHAR(255) REFERENCES hr_kredensial(uuid), pelatihan_uuid VARCHAR(255),
          nama_berkas VARCHAR(255) NOT NULL, tipe_mime VARCHAR(100) NOT NULL, ukuran_bita INTEGER NOT NULL CHECK (ukuran_bita > 0),
          data BYTEA NOT NULL, diunggah_oleh VARCHAR(120), ${WAKTU},
          CHECK ((jenis_berkas = 'dokumen_kredensial' AND kredensial_uuid IS NOT NULL AND pelatihan_uuid IS NULL)
             OR (jenis_berkas = 'sertifikat_pelatihan' AND pelatihan_uuid IS NOT NULL AND kredensial_uuid IS NULL))
        );
        CREATE INDEX IF NOT EXISTS hr_berkas_kredensial_idx ON hr_berkas (faskes_uuid, kredensial_uuid) WHERE deleted_at IS NULL;
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS hr_berkas, hr_kredensial');
  },
};
