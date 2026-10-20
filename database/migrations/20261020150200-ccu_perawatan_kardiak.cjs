'use strict';

// Skema modul CCU (Coronary Care Unit) — STD-0045. Episode CCU memakai tabel episode perawatan intensif bersama
// (icu_perawatans) dengan kolom unit = 'ccu', sehingga serah terima masuk/keluar (tertaut ri_perpindahan), flowsheet
// observasi, balance cairan, dan laporan dasar ICU dipakai ulang tanpa tabel paralel. Tabel ccu_* hanya menampung data
// yang khas kardiologi: data klinis kardiak episode, EKG & irama, penanda jantung, skor risiko, dan intervensi kardiak.
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid dari token, waktu epoch detik, soft delete deleted_at;
// entri klinis dibatalkan berjejak (dibatalkan_pada/oleh + alasan), tidak dihapus fisik. Idempoten.
// Catatan: kolom icu_perawatans.unit juga ditambahkan migrasi HDU (STD-0046) dengan ADD COLUMN IF NOT EXISTS yang sama.
const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;
const BATAL = `dibatalkan_pada BIGINT, dibatalkan_oleh VARCHAR(255), alasan_batal TEXT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE icu_perawatans ADD COLUMN IF NOT EXISTS unit VARCHAR(10) NOT NULL DEFAULT 'icu';
        CREATE INDEX IF NOT EXISTS icu_perawatans_unit_idx ON icu_perawatans (faskes_uuid, unit, status);

        -- Data klinis kardiak per episode (satu baris per episode): sindrom, onset, kontak medis pertama, tiba RS, Killip.
        CREATE TABLE IF NOT EXISTS ccu_klinis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL UNIQUE REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          sindrom VARCHAR(40) NOT NULL, lokasi_infark VARCHAR(200),
          waktu_onset BIGINT, waktu_kontak_medis_pertama BIGINT, waktu_tiba_rs BIGINT,
          kelas_killip SMALLINT CHECK (kelas_killip BETWEEN 1 AND 4), fraksi_ejeksi NUMERIC(4,1),
          faktor_risiko JSONB NOT NULL DEFAULT '[]', catatan TEXT, diubah_oleh VARCHAR(255), ${WAKTU}
        );

        -- EKG 12 sadapan / strip irama. sumber 'perangkat' + status_tinjauan 'perlu_tinjau' disiapkan untuk integrasi
        -- monitor/EKG berikutnya: data perangkat belum terverifikasi tidak dianggap catatan klinis (PRD KF-10/KT-7).
        CREATE TABLE IF NOT EXISTS ccu_ekgs (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          waktu_rekam BIGINT NOT NULL, irama VARCHAR(30) NOT NULL, laju_jantung SMALLINT,
          interval_pr SMALLINT, durasi_qrs SMALLINT, interval_qt SMALLINT, interval_qtc SMALLINT,
          aksis VARCHAR(20), perubahan_st VARCHAR(10) NOT NULL DEFAULT 'tidak_ada' CHECK (perubahan_st IN ('tidak_ada', 'elevasi', 'depresi')),
          lead_st VARCHAR(200), gelombang_q BOOLEAN NOT NULL DEFAULT false, blok_cabang VARCHAR(10), interpretasi TEXT,
          sumber VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'perangkat')),
          status_tinjauan VARCHAR(15) NOT NULL DEFAULT 'terverifikasi' CHECK (status_tinjauan IN ('terverifikasi', 'perlu_tinjau')),
          pencatat VARCHAR(255), ${BATAL}, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ccu_ekgs_perawatan_idx ON ccu_ekgs (faskes_uuid, perawatan_uuid, waktu_rekam);

        -- Penanda jantung & lab kardiak (troponin, CK-MB, NT-proBNP, elektrolit). batas_atas = batas atas rujukan
        -- (mis. persentil 99 troponin) dari laboratorium faskes; sumber 'lab' + referensi_lab bila menyalin hasil LIS.
        CREATE TABLE IF NOT EXISTS ccu_penanda_jantungs (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          waktu_sampel BIGINT NOT NULL, jenis VARCHAR(20) NOT NULL, nilai NUMERIC(12,3) NOT NULL, satuan VARCHAR(20) NOT NULL,
          batas_atas NUMERIC(12,3), sumber VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'lab')),
          referensi_lab VARCHAR(255), catatan TEXT, pencatat VARCHAR(255), ${BATAL}, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ccu_penanda_jantungs_perawatan_idx ON ccu_penanda_jantungs (faskes_uuid, perawatan_uuid, jenis, waktu_sampel);

        -- Skor risiko kardiak (Killip, TIMI UA/NSTEMI, TIMI STEMI). parameter = isian yang dipakai menghitung.
        CREATE TABLE IF NOT EXISTS ccu_skor_risikos (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          waktu_penilaian BIGINT NOT NULL, jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('killip', 'timi_nste', 'timi_stemi')),
          parameter JSONB NOT NULL DEFAULT '{}', total_skor SMALLINT, kategori VARCHAR(100), lengkap BOOLEAN NOT NULL DEFAULT false,
          penilai VARCHAR(255), catatan TEXT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ccu_skor_risikos_perawatan_idx ON ccu_skor_risikos (faskes_uuid, perawatan_uuid, jenis, waktu_penilaian);

        -- Intervensi & terapi kardiak (PCI primer, trombolisis, pacu jantung sementara, IABP, kardioversi, RJP, ...).
        -- Order obat/tindakan & tagihan tetap lewat modul pemiliknya; tabel ini mencatat waktu klinis untuk mutu
        -- (door-to-balloon/needle) dan kesinambungan perawatan.
        CREATE TABLE IF NOT EXISTS ccu_intervensis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          jenis VARCHAR(30) NOT NULL, waktu_mulai BIGINT NOT NULL, waktu_selesai BIGINT,
          operator VARCHAR(255), hasil TEXT, komplikasi TEXT, catatan TEXT, pencatat VARCHAR(255), ${BATAL}, ${WAKTU},
          CHECK (waktu_selesai IS NULL OR waktu_selesai >= waktu_mulai)
        );
        CREATE INDEX IF NOT EXISTS ccu_intervensis_perawatan_idx ON ccu_intervensis (faskes_uuid, perawatan_uuid, waktu_mulai);
        `,
        { transaction },
      );
    });
  },

  async down() {
    // Riwayat klinis dipertahankan; pembalikan memerlukan migrasi pemulihan tersendiri setelah peninjauan.
  },
};
