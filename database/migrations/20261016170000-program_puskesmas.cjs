'use strict';

// Modul Program Puskesmas (KIA/KB, imunisasi, MTBS/MTBM, sasaran program, kegiatan UKM, format laporan Dinkes).
// Pelayanan individual tertaut ke `rawat_jalans` (kolom `maternity` dipakai sebagai penanda kunjungan kebidanan;
// tidak ada kolom baru pada tabel itu) dan opsional ke `birth_details` yang sudah ada. Semua tabel memakai uuid
// (uuidv7 dari aplikasi), `faskes_uuid` dari token, waktu epoch detik, serta soft delete (`deleted_at`).
// Tidak ada batasan unik pada `imunisasi` untuk pasien+vaksin+tanggal: dosis berulang hanya diperingatkan oleh
// aplikasi (KT-5), tidak ditolak database.
const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      -- ── KIA ─────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS kia_anc (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        patient_uuid VARCHAR(255) NOT NULL, rawat_jalan_uuid VARCHAR(255) NOT NULL,
        nomor_kunjungan VARCHAR(5) NOT NULL CHECK (nomor_kunjungan IN ('K1','K2','K3','K4','K5','K6')),
        usia_kehamilan_minggu SMALLINT CHECK (usia_kehamilan_minggu IS NULL OR usia_kehamilan_minggu BETWEEN 0 AND 45),
        risiko_tinggi BOOLEAN NOT NULL DEFAULT false,
        hasil_pemeriksaan JSONB NOT NULL DEFAULT '{}',
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS kia_anc_faskes_idx ON kia_anc (faskes_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS kia_anc_pasien_idx ON kia_anc (patient_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS kia_anc_kunjungan_idx ON kia_anc (rawat_jalan_uuid);

      CREATE TABLE IF NOT EXISTS kia_persalinan (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        patient_uuid VARCHAR(255) NOT NULL, rawat_jalan_uuid VARCHAR(255) NOT NULL,
        birth_detail_uuid VARCHAR(255),
        hasil_pemeriksaan JSONB NOT NULL DEFAULT '{}',
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS kia_persalinan_faskes_idx ON kia_persalinan (faskes_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS kia_persalinan_pasien_idx ON kia_persalinan (patient_uuid, deleted_at);

      CREATE TABLE IF NOT EXISTS kia_nifas (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        patient_uuid VARCHAR(255) NOT NULL,
        kia_persalinan_uuid VARCHAR(255) NOT NULL REFERENCES kia_persalinan(uuid),
        kunjungan_ke SMALLINT NOT NULL DEFAULT 1,
        hasil_pemeriksaan JSONB NOT NULL DEFAULT '{}',
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS kia_nifas_faskes_idx ON kia_nifas (faskes_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS kia_nifas_persalinan_idx ON kia_nifas (kia_persalinan_uuid);

      -- ── KB ──────────────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS kb_pelayanan (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        patient_uuid VARCHAR(255) NOT NULL, rawat_jalan_uuid VARCHAR(255),
        metode VARCHAR(30) NOT NULL,
        tanggal_pelayanan DATE NOT NULL,
        rencana_kunjungan_ulang DATE,
        efek_samping VARCHAR(255),
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS kb_pelayanan_faskes_idx ON kb_pelayanan (faskes_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS kb_pelayanan_pasien_idx ON kb_pelayanan (patient_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS kb_pelayanan_ulang_idx ON kb_pelayanan (faskes_uuid, rencana_kunjungan_ulang);

      -- ── IMUNISASI ───────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS imunisasi_jenis_vaksin (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        kode VARCHAR(30) NOT NULL, nama VARCHAR(150) NOT NULL,
        kelompok_sasaran VARCHAR(20) NOT NULL DEFAULT 'bayi' CHECK (kelompok_sasaran IN ('bayi','balita','anak_sekolah','wus')),
        urutan_dosis SMALLINT NOT NULL DEFAULT 1,
        interval_minimal_hari INTEGER,
        usia_minimal_hari INTEGER,
        wajib_dasar_lengkap BOOLEAN NOT NULL DEFAULT false,
        status BOOLEAN NOT NULL DEFAULT true,
        ${WAKTU}
      );
      CREATE UNIQUE INDEX IF NOT EXISTS imunisasi_jenis_vaksin_kode_uq ON imunisasi_jenis_vaksin (faskes_uuid, kode) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS imunisasi (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        patient_uuid VARCHAR(255) NOT NULL, rawat_jalan_uuid VARCHAR(255),
        jenis_vaksin_uuid VARCHAR(255) NOT NULL REFERENCES imunisasi_jenis_vaksin(uuid),
        jenis_vaksin_kode VARCHAR(30) NOT NULL, jenis_vaksin_nama VARCHAR(150) NOT NULL,
        tanggal_pemberian DATE NOT NULL,
        petugas_uuid VARCHAR(255),
        catatan VARCHAR(255),
        status_kirim_satusehat VARCHAR(15) NOT NULL DEFAULT 'tidak_berlaku'
          CHECK (status_kirim_satusehat IN ('tidak_berlaku','menunggu','terkirim','gagal')),
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS imunisasi_faskes_idx ON imunisasi (faskes_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS imunisasi_pasien_idx ON imunisasi (patient_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS imunisasi_tanggal_idx ON imunisasi (faskes_uuid, tanggal_pemberian);

      -- ── MTBS / MTBM ─────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS mtbs_klasifikasi (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        patient_uuid VARCHAR(255) NOT NULL, rawat_jalan_uuid VARCHAR(255) NOT NULL,
        jenis_form VARCHAR(5) NOT NULL CHECK (jenis_form IN ('mtbs','mtbm')),
        temuan JSONB NOT NULL DEFAULT '{}',
        klasifikasi JSONB NOT NULL DEFAULT '{}',
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS mtbs_klasifikasi_faskes_idx ON mtbs_klasifikasi (faskes_uuid, deleted_at);
      CREATE INDEX IF NOT EXISTS mtbs_klasifikasi_kunjungan_idx ON mtbs_klasifikasi (rawat_jalan_uuid);

      -- ── SASARAN PROGRAM ─────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS program_sasaran (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        jenis_sasaran VARCHAR(20) NOT NULL CHECK (jenis_sasaran IN ('ibu_hamil','bayi','balita')),
        patient_uuid VARCHAR(255),
        kelurahan_code VARCHAR(20) NOT NULL REFERENCES kelurahan(code),
        periode VARCHAR(7) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'belum_dilayani' CHECK (status IN ('belum_dilayani','sudah_dilayani')),
        keterangan VARCHAR(255),
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS program_sasaran_filter_idx ON program_sasaran (faskes_uuid, jenis_sasaran, periode, kelurahan_code);
      CREATE INDEX IF NOT EXISTS program_sasaran_pasien_idx ON program_sasaran (patient_uuid);

      -- ── KEGIATAN UKM & LUAR GEDUNG ──────────────────────────────────
      CREATE TABLE IF NOT EXISTS ukm_kegiatan (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        jenis_kegiatan VARCHAR(30) NOT NULL CHECK (jenis_kegiatan IN ('posyandu','penyuluhan','kesling','lainnya')),
        kelurahan_code VARCHAR(20) NOT NULL REFERENCES kelurahan(code),
        tanggal_pelaksanaan DATE NOT NULL,
        pelaksana VARCHAR(150),
        jumlah_sasaran INTEGER NOT NULL DEFAULT 0,
        capaian JSONB NOT NULL DEFAULT '{}',
        catatan VARCHAR(255),
        dibuat_oleh VARCHAR(255), ${WAKTU}
      );
      CREATE INDEX IF NOT EXISTS ukm_kegiatan_filter_idx ON ukm_kegiatan (faskes_uuid, tanggal_pelaksanaan, kelurahan_code);

      -- ── FORMAT LAPORAN DINKES ───────────────────────────────────────
      CREATE TABLE IF NOT EXISTS program_format_laporan (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
        jenis_laporan VARCHAR(15) NOT NULL CHECK (jenis_laporan IN ('lb1','kia','imunisasi','program')),
        format JSONB NOT NULL DEFAULT '{}',
        status BOOLEAN NOT NULL DEFAULT true,
        ${WAKTU}
      );
      CREATE UNIQUE INDEX IF NOT EXISTS program_format_laporan_uq ON program_format_laporan (faskes_uuid, jenis_laporan) WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS program_format_laporan;
      DROP TABLE IF EXISTS ukm_kegiatan;
      DROP TABLE IF EXISTS program_sasaran;
      DROP TABLE IF EXISTS mtbs_klasifikasi;
      DROP TABLE IF EXISTS imunisasi;
      DROP TABLE IF EXISTS imunisasi_jenis_vaksin;
      DROP TABLE IF EXISTS kb_pelayanan;
      DROP TABLE IF EXISTS kia_nifas;
      DROP TABLE IF EXISTS kia_persalinan;
      DROP TABLE IF EXISTS kia_anc;
    `);
  },
};
