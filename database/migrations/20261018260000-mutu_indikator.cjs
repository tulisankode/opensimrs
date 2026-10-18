'use strict';

// Indikator Mutu (STD-0025) — fitur baru mutu_indikator di modul Mutu & Akreditasi yang sudah ada (STD-0028,
// penunjang-service/src/mutu/indikator*.js). Tidak membuat ulang modul atau tabel mutu yang ada:
//   - mutu_indikator               profil indikator INM/IMP-RS/IMPU milik faskes (definisi, numerator/denominator,
//                                  target & arah, frekuensi, sumber data manual/otomatis). INM bawaan dipasang faskes
//                                  lewat aplikasi (kode_bawaan), tidak diisi migrasi;
//   - mutu_indikator_data          data per (indikator, unit, tanggal awal hari WIB) + alur validasi
//                                  draf → diajukan → tervalidasi | dikembalikan;
//   - mutu_indikator_tindak_lanjut analisis & rencana tindak lanjut per periode (YYYY-MM / YYYY-Qn).
// Jejak audit memakai tabel mutu_audit yang sudah ada. Unit = lokasi Datamaster (tanpa FK lintas layanan, divalidasi
// aplikasi; pola ambulans_kru). Konvensi: uuid varchar (uuidv7 aplikasi), faskes_uuid, waktu epoch detik, soft delete
// deleted_at. Idempoten (IF NOT EXISTS).

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS mutu_indikator (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, judul VARCHAR(255) NOT NULL,
          jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('inm', 'imp_rs', 'impu')),
          kode_bawaan VARCHAR(50), dimensi_mutu VARCHAR(100),
          definisi_operasional TEXT NOT NULL, definisi_numerator TEXT NOT NULL, definisi_denominator TEXT NOT NULL,
          kriteria_inklusi TEXT, kriteria_eksklusi TEXT,
          satuan VARCHAR(10) NOT NULL DEFAULT 'persen' CHECK (satuan IN ('persen', 'nilai')),
          target_nilai NUMERIC(12, 2), arah VARCHAR(5) NOT NULL DEFAULT 'naik' CHECK (arah IN ('naik', 'turun')),
          target_sumber VARCHAR(10) CHECK (target_sumber IN ('regulasi', 'faskes')), regulasi_acuan VARCHAR(255),
          frekuensi VARCHAR(10) NOT NULL DEFAULT 'bulanan' CHECK (frekuensi IN ('harian', 'bulanan')),
          unit_pj_uuid VARCHAR(255),
          sumber_data VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber_data IN ('manual', 'otomatis')),
          kode_otomatis VARCHAR(50), parameter_otomatis JSONB,
          numerator_maks_denominator BOOLEAN NOT NULL DEFAULT true,
          aktif BOOLEAN NOT NULL DEFAULT true, dibuat_oleh VARCHAR(255),
          ${WAKTU},
          CHECK (sumber_data <> 'otomatis' OR kode_otomatis IS NOT NULL),
          CHECK (target_sumber IS NULL OR target_nilai IS NOT NULL)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_indikator_kode_uq ON mutu_indikator (faskes_uuid, kode) WHERE deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_indikator_bawaan_uq ON mutu_indikator (faskes_uuid, kode_bawaan) WHERE deleted_at IS NULL AND kode_bawaan IS NOT NULL;
        CREATE INDEX IF NOT EXISTS mutu_indikator_jenis_idx ON mutu_indikator (faskes_uuid, jenis, aktif) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_indikator_data (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          indikator_uuid VARCHAR(255) NOT NULL REFERENCES mutu_indikator(uuid),
          unit_uuid VARCHAR(255), tanggal BIGINT NOT NULL, periode_bulan VARCHAR(7) NOT NULL,
          numerator NUMERIC(14, 2) NOT NULL CHECK (numerator >= 0), denominator NUMERIC(14, 2) NOT NULL CHECK (denominator >= 0),
          catatan TEXT,
          sumber VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'otomatis')), rincian_otomatis JSONB,
          status VARCHAR(15) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf', 'diajukan', 'tervalidasi', 'dikembalikan')),
          diisi_oleh VARCHAR(255), diajukan_oleh VARCHAR(255), diajukan_pada BIGINT,
          divalidasi_oleh VARCHAR(255), divalidasi_pada BIGINT, catatan_validasi TEXT,
          ${WAKTU}
        );
        -- Satu data per indikator, unit (kosong = tingkat faskes), dan tanggal.
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_indikator_data_uq ON mutu_indikator_data (indikator_uuid, COALESCE(unit_uuid, ''), tanggal) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_indikator_data_periode_idx ON mutu_indikator_data (faskes_uuid, periode_bulan) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_indikator_data_status_idx ON mutu_indikator_data (faskes_uuid, status) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_indikator_data_tanggal_idx ON mutu_indikator_data (indikator_uuid, tanggal) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_indikator_tindak_lanjut (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          indikator_uuid VARCHAR(255) NOT NULL REFERENCES mutu_indikator(uuid),
          unit_uuid VARCHAR(255), periode VARCHAR(7) NOT NULL,
          capaian NUMERIC(14, 2), target_nilai NUMERIC(12, 2),
          analisis TEXT NOT NULL, rencana TEXT NOT NULL, penanggung_jawab VARCHAR(255) NOT NULL, tenggat BIGINT,
          status VARCHAR(10) NOT NULL DEFAULT 'rencana' CHECK (status IN ('rencana', 'berjalan', 'selesai')),
          hasil_evaluasi TEXT, dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mutu_indikator_tl_cari_idx ON mutu_indikator_tindak_lanjut (faskes_uuid, indikator_uuid, periode) WHERE deleted_at IS NULL;
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS mutu_indikator_tindak_lanjut, mutu_indikator_data, mutu_indikator;`);
  },
};
