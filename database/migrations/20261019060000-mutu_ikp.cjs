'use strict';

// Insiden Keselamatan Pasien (IKP) & manajemen risiko (STD-0026) — fitur baru mutu_ikp di modul Mutu & Akreditasi
// yang sudah ada (penunjang-service/src/mutu/ikp*.js). Tidak membuat ulang modul atau tabel mutu yang ada:
//   - mutu_ikp_laporan        laporan insiden (KTD/KNC/KTC/KPC/sentinel), waktu kejadian/diketahui/lapor, unit,
//                             kronologi, tindakan segera, anonimitas pelapor, rujukan pasien opsional (patient_uuid &
//                             no_reg saja — data klinis tidak disalin), status alur, grade aktif & batas investigasi;
//   - mutu_ikp_grading        riwayat grading dampak × probabilitas (baris lama dinonaktifkan, tidak dihapus) beserta
//                             versi matriks yang dipakai;
//   - mutu_ikp_investigasi    investigasi sederhana / RCA (satu per laporan);
//   - mutu_ikp_tindak_lanjut  rekomendasi & tindak lanjut (PIC pegawai, tenggat, progres, verifikasi);
//   - mutu_ikp_lampiran       lampiran laporan (BYTEA, pola berkas mutu);
//   - mutu_ikp_risiko         register risiko unit (opsional ditautkan ke laporan);
//   - mutu_ikp_pengaturan     matriks grading & tenggat per faskes (baris dibuat saat pertama diubah; tanpa baris →
//                             nilai bawaan aplikasi).
// Data IKP terpisah dari rekam medis. Jejak audit memakai tabel mutu_audit yang sudah ada. Unit = lokasi Datamaster
// (tanpa FK lintas layanan, divalidasi aplikasi). Konvensi: uuid varchar (uuidv7 aplikasi), faskes_uuid, waktu epoch
// detik, soft delete deleted_at. Idempoten (IF NOT EXISTS).

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT';
const GRADE = "('biru', 'hijau', 'kuning', 'merah')";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS mutu_ikp_laporan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nomor VARCHAR(50) NOT NULL,
          jenis_insiden VARCHAR(10) NOT NULL CHECK (jenis_insiden IN ('ktd', 'knc', 'ktc', 'kpc', 'sentinel')),
          kategori_insiden VARCHAR(30), layanan VARCHAR(20),
          waktu_kejadian BIGINT NOT NULL, waktu_diketahui BIGINT NOT NULL, waktu_lapor BIGINT NOT NULL,
          unit_uuid VARCHAR(255) NOT NULL, tempat_kejadian VARCHAR(255),
          kronologi TEXT NOT NULL, tindakan_segera TEXT, tindakan_oleh VARCHAR(20),
          akibat VARCHAR(20) CHECK (akibat IS NULL OR akibat IN ('kematian', 'cedera_berat', 'cedera_sedang', 'cedera_ringan', 'tidak_cedera')),
          pernah_terjadi BOOLEAN, keterangan_pernah_terjadi TEXT,
          anonim BOOLEAN NOT NULL DEFAULT false, pelapor_nama VARCHAR(255),
          patient_uuid VARCHAR(255), no_reg VARCHAR(255),
          status VARCHAR(20) NOT NULL DEFAULT 'dilaporkan'
            CHECK (status IN ('dilaporkan', 'perlu_dilengkapi', 'diterima', 'dinilai', 'investigasi', 'ditutup')),
          status_sebelum_tutup VARCHAR(20),
          tenggat_lapor_jam INT NOT NULL, batas_lapor BIGINT NOT NULL, terlambat_lapor BOOLEAN NOT NULL DEFAULT false,
          grade VARCHAR(10) CHECK (grade IS NULL OR grade IN ${GRADE}), skor SMALLINT, dinilai_pada BIGINT, batas_investigasi BIGINT,
          alasan_perlu_lengkap TEXT, catatan_terima TEXT, diterima_oleh VARCHAR(255), diterima_pada BIGINT,
          alasan_tutup TEXT, ditutup_oleh VARCHAR(255), ditutup_pada BIGINT,
          idempotency_key VARCHAR(100), dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_ikp_laporan_nomor_uq ON mutu_ikp_laporan (faskes_uuid, nomor);
        -- Pengiriman ulang dengan kunci yang sama tidak membuat laporan ganda (KT-19).
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_ikp_laporan_kunci_uq ON mutu_ikp_laporan (faskes_uuid, idempotency_key) WHERE idempotency_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS mutu_ikp_laporan_status_idx ON mutu_ikp_laporan (faskes_uuid, status, unit_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_ikp_laporan_waktu_idx ON mutu_ikp_laporan (faskes_uuid, waktu_kejadian) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_ikp_laporan_pelapor_idx ON mutu_ikp_laporan (faskes_uuid, dibuat_oleh) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_ikp_grading (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          laporan_uuid VARCHAR(255) NOT NULL REFERENCES mutu_ikp_laporan(uuid),
          dampak SMALLINT NOT NULL CHECK (dampak BETWEEN 1 AND 5),
          probabilitas SMALLINT NOT NULL CHECK (probabilitas BETWEEN 1 AND 5),
          skor SMALLINT NOT NULL, grade VARCHAR(10) NOT NULL CHECK (grade IN ${GRADE}),
          versi_matriks INT NOT NULL, aktif BOOLEAN NOT NULL DEFAULT true, alasan TEXT,
          dinilai_oleh VARCHAR(255), dinilai_pada BIGINT NOT NULL,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_ikp_grading_aktif_uq ON mutu_ikp_grading (laporan_uuid) WHERE aktif AND deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_ikp_investigasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          laporan_uuid VARCHAR(255) NOT NULL REFERENCES mutu_ikp_laporan(uuid),
          jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('sederhana', 'rca')),
          status VARCHAR(10) NOT NULL DEFAULT 'berjalan' CHECK (status IN ('berjalan', 'selesai')),
          tim TEXT, penyebab_langsung TEXT, akar_masalah TEXT, analisis TEXT, rekomendasi TEXT,
          dicatat_oleh VARCHAR(255), diselesaikan_oleh VARCHAR(255), diselesaikan_pada BIGINT,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_ikp_investigasi_laporan_uq ON mutu_ikp_investigasi (laporan_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_ikp_tindak_lanjut (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          laporan_uuid VARCHAR(255) NOT NULL REFERENCES mutu_ikp_laporan(uuid),
          uraian TEXT NOT NULL, pic_pegawai_uuid VARCHAR(255) NOT NULL, tenggat BIGINT NOT NULL,
          status VARCHAR(15) NOT NULL DEFAULT 'rencana' CHECK (status IN ('rencana', 'berjalan', 'selesai', 'terverifikasi')),
          progres TEXT, hasil TEXT, catatan_verifikasi TEXT,
          diverifikasi_oleh VARCHAR(255), diverifikasi_pada BIGINT, dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mutu_ikp_tindak_lanjut_laporan_idx ON mutu_ikp_tindak_lanjut (laporan_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_ikp_lampiran (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          laporan_uuid VARCHAR(255) NOT NULL REFERENCES mutu_ikp_laporan(uuid),
          nama_berkas VARCHAR(255) NOT NULL, tipe_mime VARCHAR(100) NOT NULL, ukuran_bita INT NOT NULL,
          berkas BYTEA NOT NULL, diunggah_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mutu_ikp_lampiran_laporan_idx ON mutu_ikp_lampiran (laporan_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_ikp_risiko (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          unit_uuid VARCHAR(255) NOT NULL, uraian TEXT NOT NULL, penyebab TEXT, pengendalian_ada TEXT,
          dampak SMALLINT NOT NULL CHECK (dampak BETWEEN 1 AND 5),
          probabilitas SMALLINT NOT NULL CHECK (probabilitas BETWEEN 1 AND 5),
          skor SMALLINT NOT NULL, grade VARCHAR(10) NOT NULL CHECK (grade IN ${GRADE}),
          rencana_mitigasi TEXT, pic_pegawai_uuid VARCHAR(255), tenggat BIGINT,
          status VARCHAR(15) NOT NULL DEFAULT 'terbuka' CHECK (status IN ('terbuka', 'dimitigasi', 'terkendali', 'ditutup')),
          laporan_uuid VARCHAR(255) REFERENCES mutu_ikp_laporan(uuid), dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mutu_ikp_risiko_unit_idx ON mutu_ikp_risiko (faskes_uuid, unit_uuid, status) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_ikp_pengaturan (
          faskes_uuid VARCHAR(255) PRIMARY KEY,
          tenggat_lapor_jam INT NOT NULL DEFAULT 48 CHECK (tenggat_lapor_jam BETWEEN 1 AND 720),
          tenggat_investigasi_hari JSONB NOT NULL, matriks JSONB NOT NULL, versi_matriks INT NOT NULL DEFAULT 1,
          pengingat_penerima TEXT, pengingat_kanal VARCHAR(100),
          diubah_oleh VARCHAR(255), created_at BIGINT NOT NULL, updated_at BIGINT
        );
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS mutu_ikp_pengaturan, mutu_ikp_risiko, mutu_ikp_lampiran, mutu_ikp_tindak_lanjut,
        mutu_ikp_investigasi, mutu_ikp_grading, mutu_ikp_laporan;
    `);
  },
};
