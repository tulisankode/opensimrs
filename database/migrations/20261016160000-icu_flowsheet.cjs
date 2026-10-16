'use strict';

// Skema modul ICU / Intensif (rawat-inap-service, tabel berprefiks icu_). Alur ICU:
//   perpindahan masuk (ri_perpindahan yang sudah ada) → serah terima masuk → icu_perawatans (episode ICU) aktif
//   → observasi flowsheet per jam/interval (+ koreksi berjejak) → intake-output (balance dihitung dari entri, bukan
//   kolom agregat) → skor SOFA saat masuk & harian → serah terima keluar → perpindahan keluar (ri_perpindahan) →
//   icu_perawatans ditutup. icu_perawatans TIDAK membuat status perpindahan paralel; ia hanya menautkan episode ICU
//   ke transaksi perpindahans yang berlaku di rawat-inap-service.
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid dari token, waktu epoch detik, soft delete deleted_at.
// Tabel inti rawat inap (rawat_inaps, perpindahans, room_monitorings, ruangan) tidak di-FK langsung agar modul ini
// tetap lepas dari skema model-sdk; hanya disimpan sebagai uuid dengan indeks.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        -- Episode perawatan ICU: dibuka saat serah terima masuk dikonfirmasi, ditutup saat perpindahan keluar selesai.
        CREATE TABLE IF NOT EXISTS icu_perawatans (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          rawat_inap_uuid VARCHAR(255) NOT NULL, perpindahan_masuk_uuid VARCHAR(255) NOT NULL,
          perpindahan_keluar_uuid VARCHAR(255), room_monitoring_uuid VARCHAR(255) NOT NULL, ruangan_uuid VARCHAR(255),
          diagnosis_ringkas TEXT,
          status VARCHAR(10) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'selesai')),
          -- kondisi_keluar: definisi operasional sementara untuk angka kematian ICU (lihat laporan), menunggu
          -- ketetapan pemilik klinis/manajemen final (PRD STD-0008 §13 pertanyaan terbuka #6).
          kondisi_keluar VARCHAR(10) CHECK (kondisi_keluar IN ('hidup', 'meninggal')),
          waktu_masuk BIGINT NOT NULL, waktu_keluar BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS icu_perawatans_faskes_idx ON icu_perawatans (faskes_uuid, status);
        CREATE INDEX IF NOT EXISTS icu_perawatans_rawat_inap_idx ON icu_perawatans (rawat_inap_uuid);
        -- Satu admisi rawat inap hanya boleh punya satu episode ICU aktif; satu bed hanya boleh satu pasien ICU aktif.
        CREATE UNIQUE INDEX IF NOT EXISTS icu_perawatans_ri_aktif_uq ON icu_perawatans (rawat_inap_uuid)
          WHERE status = 'aktif' AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS icu_perawatans_bed_aktif_uq ON icu_perawatans (room_monitoring_uuid)
          WHERE status = 'aktif' AND deleted_at IS NULL;

        -- Serah terima terstruktur (masuk/keluar), tertaut ke transaksi ri_perpindahan yang berlaku.
        CREATE TABLE IF NOT EXISTS icu_serah_terimas (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          perpindahan_uuid VARCHAR(255) NOT NULL,
          jenis VARCHAR(6) NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
          kriteria TEXT, kondisi TEXT, tindakan TEXT, terapi_berjalan TEXT, alergi_relevan TEXT,
          akses_alat TEXT, tindak_lanjut TEXT,
          pencatat VARCHAR(255), waktu_konfirmasi BIGINT, dikonfirmasi_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS icu_serah_terimas_perawatan_idx ON icu_serah_terimas (perawatan_uuid, jenis);
        CREATE INDEX IF NOT EXISTS icu_serah_terimas_perpindahan_idx ON icu_serah_terimas (perpindahan_uuid);

        -- Observasi flowsheet. sumber 'manual' pada rilis ini; 'otomatis' disiapkan untuk integrasi bedside monitor
        -- fase berikutnya tanpa migrasi struktural ulang.
        CREATE TABLE IF NOT EXISTS icu_observasis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          waktu_pengukuran BIGINT NOT NULL,
          tekanan_sistolik SMALLINT, tekanan_diastolik SMALLINT, nadi SMALLINT, suhu NUMERIC(4,1),
          laju_napas SMALLINT, spo2 SMALLINT,
          gcs_e SMALLINT, gcs_v SMALLINT, gcs_m SMALLINT, gcs_total SMALLINT, skala_nyeri SMALLINT,
          ventilator_terpasang BOOLEAN NOT NULL DEFAULT false, ventilator_mode VARCHAR(50),
          ventilator_fio2 NUMERIC(5,2), ventilator_peep NUMERIC(5,2), ventilator_tidal_volume NUMERIC(6,1),
          ventilator_laju_napas SMALLINT,
          obat_drip JSONB NOT NULL DEFAULT '[]',
          sumber VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'otomatis')),
          catatan TEXT, pencatat VARCHAR(255), dikoreksi BOOLEAN NOT NULL DEFAULT false, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS icu_observasis_tren_idx ON icu_observasis (faskes_uuid, perawatan_uuid, waktu_pengukuran);

        -- Jejak koreksi observasi (nilai sebelum/sesudah tidak pernah ditimpa/hapus).
        CREATE TABLE IF NOT EXISTS icu_observasi_koreksis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          observasi_uuid VARCHAR(255) NOT NULL REFERENCES icu_observasis(uuid) ON DELETE CASCADE,
          nilai_sebelum JSONB NOT NULL, nilai_sesudah JSONB NOT NULL, alasan TEXT,
          pelaku VARCHAR(255), created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS icu_observasi_koreksis_observasi_idx ON icu_observasi_koreksis (observasi_uuid);

        -- Entri intake/output. Balance dihitung dari penjumlahan entri aktif (deleted_at IS NULL), bukan kolom agregat.
        CREATE TABLE IF NOT EXISTS icu_intake_outputs (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          waktu_pencatatan BIGINT NOT NULL,
          jenis VARCHAR(7) NOT NULL CHECK (jenis IN ('intake', 'output')),
          kategori VARCHAR(100) NOT NULL, jumlah_ml NUMERIC(8,1) NOT NULL,
          keterangan TEXT, observasi_uuid VARCHAR(255), pencatat VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS icu_intake_outputs_periode_idx ON icu_intake_outputs (faskes_uuid, perawatan_uuid, waktu_pencatatan);

        -- Penilaian skor SOFA. parameter = nilai input per organ yang dipakai (untuk ditinjau ulang).
        CREATE TABLE IF NOT EXISTS icu_skor_sofas (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          perawatan_uuid VARCHAR(255) NOT NULL REFERENCES icu_perawatans(uuid) ON DELETE CASCADE,
          waktu_penilaian BIGINT NOT NULL,
          respirasi_skor SMALLINT, koagulasi_skor SMALLINT, hepar_skor SMALLINT,
          kardiovaskular_skor SMALLINT, saraf_pusat_skor SMALLINT, ginjal_skor SMALLINT,
          parameter JSONB NOT NULL DEFAULT '{}', total_skor SMALLINT,
          lengkap BOOLEAN NOT NULL DEFAULT false, versi_rumus VARCHAR(20) NOT NULL DEFAULT 'sofa-1996',
          penilai VARCHAR(255), catatan TEXT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS icu_skor_sofas_perawatan_idx ON icu_skor_sofas (faskes_uuid, perawatan_uuid, waktu_penilaian);

        -- Konfigurasi rentang nilai kritis per parameter (ditetapkan & ditinjau pemilik klinis faskes).
        CREATE TABLE IF NOT EXISTS icu_nilai_kritis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          parameter VARCHAR(50) NOT NULL, satuan VARCHAR(20),
          batas_bawah NUMERIC(8,2), batas_atas NUMERIC(8,2), ruangan_uuid VARCHAR(255),
          keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS icu_nilai_kritis_parameter_uq
          ON icu_nilai_kritis (faskes_uuid, parameter, COALESCE(ruangan_uuid, '')) WHERE deleted_at IS NULL;
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS icu_nilai_kritis, icu_skor_sofas, icu_intake_outputs, icu_observasi_koreksis,
        icu_observasis, icu_serah_terimas, icu_perawatans CASCADE;
    `);
  },
};
