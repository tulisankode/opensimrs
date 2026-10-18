'use strict';

module.exports = {
  async up(q) {
    await q.sequelize.query(`
      CREATE TABLE IF NOT EXISTS mutu_indikator (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, kode VARCHAR(50) NOT NULL, judul VARCHAR(255) NOT NULL,
        jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('inm','imp_rs','impu')), dimensi_mutu VARCHAR(100),
        definisi_operasional TEXT NOT NULL, definisi_numerator TEXT NOT NULL, definisi_denominator TEXT NOT NULL,
        kriteria_inklusi TEXT, kriteria_eksklusi TEXT, frekuensi VARCHAR(20) NOT NULL CHECK (frekuensi IN ('harian','bulanan','triwulan')),
        unit_lokasi_uuid VARCHAR(255) NOT NULL REFERENCES lokasi(uuid), validasi_numerator_maks_denominator BOOLEAN NOT NULL DEFAULT true,
        sumber_data VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber_data IN ('manual','otomatis')), kode_perhitungan_otomatis VARCHAR(50),
        parameter_otomatis JSONB, status_tinjauan_otomatis VARCHAR(20) NOT NULL DEFAULT 'tidak_berlaku' CHECK (status_tinjauan_otomatis IN ('tidak_berlaku','menunggu_tinjauan','disetujui')),
        target_nilai NUMERIC(8,2), target_satuan VARCHAR(20) DEFAULT 'persen', target_sumber VARCHAR(20) CHECK (target_sumber IN ('regulasi','faskes')),
        regulasi_acuan VARCHAR(255), regulasi_acuan_tanggal DATE, bawaan BOOLEAN NOT NULL DEFAULT false, aktif BOOLEAN NOT NULL DEFAULT true,
        dibuat_oleh VARCHAR(255), created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
        CHECK (sumber_data <> 'otomatis' OR kode_perhitungan_otomatis IS NOT NULL), CHECK (target_sumber IS NULL OR target_nilai IS NOT NULL),
        CHECK (target_sumber <> 'regulasi' OR (regulasi_acuan IS NOT NULL AND regulasi_acuan_tanggal IS NOT NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS mutu_indikator_kode_uq ON mutu_indikator(faskes_uuid,kode) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS mutu_indikator_jenis_idx ON mutu_indikator(faskes_uuid,jenis,aktif) WHERE deleted_at IS NULL;
      CREATE TABLE IF NOT EXISTS mutu_indikator_unit (uuid VARCHAR(255) PRIMARY KEY,faskes_uuid VARCHAR(255) NOT NULL,indikator_uuid VARCHAR(255) NOT NULL REFERENCES mutu_indikator(uuid),unit_lokasi_uuid VARCHAR(255) NOT NULL REFERENCES lokasi(uuid),aktif BOOLEAN NOT NULL DEFAULT true,created_at BIGINT NOT NULL,updated_at BIGINT,deleted_at BIGINT);
      CREATE UNIQUE INDEX IF NOT EXISTS mutu_indikator_unit_uq ON mutu_indikator_unit(indikator_uuid,unit_lokasi_uuid) WHERE deleted_at IS NULL;
      CREATE TABLE IF NOT EXISTS mutu_pic_unit (uuid VARCHAR(255) PRIMARY KEY,faskes_uuid VARCHAR(255) NOT NULL,unit_lokasi_uuid VARCHAR(255) NOT NULL REFERENCES lokasi(uuid),pengguna_uuid VARCHAR(255) NOT NULL REFERENCES users(uuid),aktif BOOLEAN NOT NULL DEFAULT true,created_at BIGINT NOT NULL,updated_at BIGINT,deleted_at BIGINT);
      CREATE UNIQUE INDEX IF NOT EXISTS mutu_pic_unit_uq ON mutu_pic_unit(unit_lokasi_uuid,pengguna_uuid) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS mutu_pic_unit_pengguna_idx ON mutu_pic_unit(pengguna_uuid) WHERE deleted_at IS NULL;
      CREATE TABLE IF NOT EXISTS mutu_pengumpulan (uuid VARCHAR(255) PRIMARY KEY,faskes_uuid VARCHAR(255) NOT NULL,indikator_uuid VARCHAR(255) NOT NULL REFERENCES mutu_indikator(uuid),unit_lokasi_uuid VARCHAR(255) NOT NULL REFERENCES lokasi(uuid),tanggal_periode DATE NOT NULL,numerator NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(numerator>=0),denominator NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(denominator>=0),nilai_hasil NUMERIC(8,2),sumber_data VARCHAR(10) NOT NULL CHECK(sumber_data IN ('manual','otomatis')),otomatis_numerator NUMERIC(14,2),otomatis_denominator NUMERIC(14,2),ditimpa_manual BOOLEAN NOT NULL DEFAULT false,status VARCHAR(20) NOT NULL DEFAULT 'draf' CHECK(status IN ('draf','perlu_revisi','diajukan','tervalidasi','terkunci')),catatan TEXT,revisi INT NOT NULL DEFAULT 0,diisi_oleh VARCHAR(255),diajukan_oleh VARCHAR(255),diajukan_pada BIGINT,divalidasi_oleh VARCHAR(255),divalidasi_pada BIGINT,dikunci_oleh VARCHAR(255),dikunci_pada BIGINT,alasan_revisi TEXT,created_at BIGINT NOT NULL,updated_at BIGINT,deleted_at BIGINT);
      CREATE UNIQUE INDEX IF NOT EXISTS mutu_pengumpulan_periode_uq ON mutu_pengumpulan(indikator_uuid,unit_lokasi_uuid,tanggal_periode) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS mutu_pengumpulan_status_idx ON mutu_pengumpulan(faskes_uuid,status) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS mutu_pengumpulan_periode_idx ON mutu_pengumpulan(indikator_uuid,tanggal_periode);
      CREATE TABLE IF NOT EXISTS mutu_pengumpulan_jejak (uuid VARCHAR(255) PRIMARY KEY,faskes_uuid VARCHAR(255) NOT NULL,pengumpulan_uuid VARCHAR(255) NOT NULL REFERENCES mutu_pengumpulan(uuid),indikator_uuid VARCHAR(255) NOT NULL REFERENCES mutu_indikator(uuid),status_sebelum VARCHAR(20),status_sesudah VARCHAR(20) NOT NULL,aktor VARCHAR(255) NOT NULL,alasan TEXT,perubahan JSONB,created_at BIGINT NOT NULL);
      CREATE INDEX IF NOT EXISTS mutu_pengumpulan_jejak_pengumpulan_idx ON mutu_pengumpulan_jejak(pengumpulan_uuid);
      CREATE TABLE IF NOT EXISTS mutu_analisis_pdsa (uuid VARCHAR(255) PRIMARY KEY,faskes_uuid VARCHAR(255) NOT NULL,indikator_uuid VARCHAR(255) NOT NULL REFERENCES mutu_indikator(uuid),unit_lokasi_uuid VARCHAR(255) REFERENCES lokasi(uuid),periode VARCHAR(7) NOT NULL,capaian_nilai NUMERIC(8,2),analisis TEXT NOT NULL,rencana_tindak_lanjut TEXT NOT NULL,penanggung_jawab VARCHAR(255) NOT NULL,waktu_evaluasi BIGINT NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'berjalan' CHECK(status IN ('berjalan','selesai')),dibuat_oleh VARCHAR(255),created_at BIGINT NOT NULL,updated_at BIGINT,deleted_at BIGINT);
      CREATE INDEX IF NOT EXISTS mutu_analisis_pdsa_cari_idx ON mutu_analisis_pdsa(faskes_uuid,indikator_uuid,periode) WHERE deleted_at IS NULL;
    `);
  },
  async down(q) {
    await q.sequelize.query('DROP TABLE IF EXISTS mutu_analisis_pdsa, mutu_pengumpulan_jejak, mutu_pengumpulan, mutu_pic_unit, mutu_indikator_unit, mutu_indikator CASCADE');
  },
};
