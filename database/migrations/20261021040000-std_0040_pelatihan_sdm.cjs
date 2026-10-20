'use strict';

const UMUM = `uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
  versi INTEGER NOT NULL DEFAULT 1 CHECK (versi > 0), dibuat_oleh VARCHAR(255),
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT,
  UNIQUE (faskes_uuid, uuid)`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS sdm_pelatihan_katalog (
          ${UMUM}, kode VARCHAR(60) NOT NULL, nama VARCHAR(255) NOT NULL,
          kategori VARCHAR(20) NOT NULL CHECK (kategori IN ('internal','eksternal')),
          wajib BOOLEAN NOT NULL, jam NUMERIC(8,2) NOT NULL CHECK (jam > 0),
          masa_berlaku_tahun INTEGER CHECK (masa_berlaku_tahun > 0), keterangan TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS sdm_pelatihan_kode_uq ON sdm_pelatihan_katalog (faskes_uuid, lower(kode)) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS sdm_pelatihan_cakupan (
          ${UMUM}, katalog_uuid VARCHAR(255) NOT NULL,
          jenis_cakupan VARCHAR(20) NOT NULL CHECK (jenis_cakupan IN ('semua','unit','jenis_pegawai','pegawai')),
          referensi_uuid VARCHAR(255), mulai_berlaku BIGINT NOT NULL, akhir_berlaku BIGINT,
          CHECK ((jenis_cakupan = 'semua') = (referensi_uuid IS NULL)),
          CHECK (akhir_berlaku IS NULL OR akhir_berlaku > mulai_berlaku),
          FOREIGN KEY (faskes_uuid, katalog_uuid) REFERENCES sdm_pelatihan_katalog(faskes_uuid, uuid)
        );
        CREATE INDEX IF NOT EXISTS sdm_pelatihan_cakupan_idx ON sdm_pelatihan_cakupan (faskes_uuid, katalog_uuid, mulai_berlaku) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS sdm_pelatihan_kebijakan (
          ${UMUM}, tahun INTEGER NOT NULL CHECK (tahun BETWEEN 2000 AND 2200),
          zona_waktu VARCHAR(60) NOT NULL, dasar_jam VARCHAR(20) NOT NULL CHECK (dasar_jam IN ('hadir','lulus')),
          aturan_sebagian VARCHAR(20) NOT NULL CHECK (aturan_sebagian IN ('tidak_dihitung','jam_hadir')),
          hari_peringatan INTEGER NOT NULL CHECK (hari_peringatan BETWEEN 0 AND 3650),
          izinkan_ekspor_kosong BOOLEAN NOT NULL, syarat_sertifikat BOOLEAN NOT NULL,
          prioritas_target VARCHAR(40) NOT NULL CHECK (prioritas_target IN ('pegawai_unit_jenis_semua','hanya_semua')),
          dasar_cakupan VARCHAR(30) NOT NULL CHECK (dasar_cakupan = 'saat_laporan')
        );
        CREATE INDEX IF NOT EXISTS sdm_pelatihan_kebijakan_idx ON sdm_pelatihan_kebijakan (faskes_uuid, tahun, created_at DESC) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS sdm_pelatihan_target (
          ${UMUM}, kebijakan_uuid VARCHAR(255) NOT NULL,
          jenis_cakupan VARCHAR(20) NOT NULL CHECK (jenis_cakupan IN ('semua','unit','jenis_pegawai','pegawai')),
          referensi_uuid VARCHAR(255), target_jam NUMERIC(8,2) NOT NULL CHECK (target_jam > 0),
          CHECK ((jenis_cakupan = 'semua') = (referensi_uuid IS NULL)),
          FOREIGN KEY (faskes_uuid, kebijakan_uuid) REFERENCES sdm_pelatihan_kebijakan(faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS sdm_pelatihan_target_uq ON sdm_pelatihan_target
          (faskes_uuid, kebijakan_uuid, jenis_cakupan, COALESCE(referensi_uuid, '')) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS sdm_pelatihan_kegiatan (
          ${UMUM}, katalog_uuid VARCHAR(255) NOT NULL, kebijakan_uuid VARCHAR(255) NOT NULL,
          nama_pelatihan VARCHAR(255) NOT NULL, kategori VARCHAR(20) NOT NULL CHECK (kategori IN ('internal','eksternal')),
          jam NUMERIC(8,2) NOT NULL CHECK (jam > 0), masa_berlaku_tahun INTEGER CHECK (masa_berlaku_tahun > 0),
          jadwal_mulai BIGINT NOT NULL, jadwal_selesai BIGINT NOT NULL CHECK (jadwal_selesai > jadwal_mulai),
          lokasi VARCHAR(255), penyelenggara VARCHAR(255), keterangan TEXT, kapasitas INTEGER CHECK (kapasitas > 0),
          status VARCHAR(20) NOT NULL DEFAULT 'rencana' CHECK (status IN ('rencana','terjadwal','berlangsung','selesai','dibatalkan')),
          alasan_koreksi TEXT,
          FOREIGN KEY (faskes_uuid, katalog_uuid) REFERENCES sdm_pelatihan_katalog(faskes_uuid, uuid),
          FOREIGN KEY (faskes_uuid, kebijakan_uuid) REFERENCES sdm_pelatihan_kebijakan(faskes_uuid, uuid)
        );
        CREATE INDEX IF NOT EXISTS sdm_pelatihan_kegiatan_idx ON sdm_pelatihan_kegiatan (faskes_uuid, jadwal_selesai, status) WHERE deleted_at IS NULL;
        CREATE TABLE IF NOT EXISTS sdm_pelatihan_peserta (
          ${UMUM}, kegiatan_uuid VARCHAR(255) NOT NULL, pegawai_uuid VARCHAR(255) NOT NULL REFERENCES hr_kepegawaian(uuid),
          status_pendaftaran VARCHAR(20) NOT NULL DEFAULT 'terdaftar' CHECK (status_pendaftaran IN ('terdaftar','dibatalkan')),
          kehadiran VARCHAR(20) NOT NULL DEFAULT 'belum_dicatat' CHECK (kehadiran IN ('belum_dicatat','hadir','sebagian','tidak_hadir')),
          hasil VARCHAR(20) NOT NULL DEFAULT 'belum_dinilai' CHECK (hasil IN ('belum_dinilai','lulus','tidak_lulus')),
          jam_hadir NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (jam_hadir >= 0),
          jam_diakui NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (jam_diakui >= 0),
          status_verifikasi VARCHAR(30) NOT NULL DEFAULT 'belum_diverifikasi' CHECK (status_verifikasi IN ('belum_diverifikasi','terverifikasi')),
          diverifikasi_oleh VARCHAR(255), diverifikasi_at BIGINT, alasan_koreksi TEXT,
          kredensial_uuid VARCHAR(255) REFERENCES mutu_kredensial(uuid),
          FOREIGN KEY (faskes_uuid, kegiatan_uuid) REFERENCES sdm_pelatihan_kegiatan(faskes_uuid, uuid)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS sdm_pelatihan_peserta_uq ON sdm_pelatihan_peserta (faskes_uuid, kegiatan_uuid, pegawai_uuid) WHERE deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS sdm_pelatihan_kredensial_uq ON sdm_pelatihan_peserta (faskes_uuid, kredensial_uuid) WHERE deleted_at IS NULL AND kredensial_uuid IS NOT NULL;
        CREATE INDEX IF NOT EXISTS sdm_pelatihan_rekap_idx ON sdm_pelatihan_peserta (faskes_uuid, pegawai_uuid, kegiatan_uuid, status_verifikasi) WHERE deleted_at IS NULL;
      `, { transaction });
    });
  },
  async down() {
    // Data pelatihan dan bukti akreditasi dipertahankan; pembatalan skema memerlukan migrasi koreksi tersendiri.
  },
};
