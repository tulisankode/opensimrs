'use strict';

// Modul UTD / UPTD Produksi Darah (penunjang-service, tabel berprefiks utd_): donor, seleksi, aftap, uji saring
// IMLTD, pengolahan komponen, permintaan & distribusi, pemusnahan, dan log pelaporan. Rantai vein-to-vein:
// donor -> riwayat seleksi -> aftap (kantong, status karantina) -> imltd (per kantong) -> komponen (per aftap) ->
// permintaan/distribusi (per komponen) -> pemusnahan (kantong/komponen reaktif atau kedaluwarsa).
//
// - utd_donor           : master donor per faskes, nomor donor unik, status aktif/ditahan.
// - utd_donor_riwayat   : satu baris per kunjungan seleksi (kuesioner, pemeriksaan, keputusan layak/tunda/tolak).
// - utd_pengaturan      : parameter klinis yang dikonfigurasi per faskes (interval minimal donor), bukan hardcode.
// - utd_aftap           : pengambilan darah; nomor kantong unik, status_kantong (karantina/karantina_reaktif/tersedia/dimusnahkan).
// - utd_imltd           : hasil uji saring 4 parameter (HIV, HBsAg, HCV, sifilis) + konfirmasi, satu per kantong.
// - utd_komponen        : komponen hasil olahan (PRC/TC/FFP/cryo), label unik, status, tanggal kedaluwarsa.
// - utd_permintaan      : permintaan komponen dari BDRS internal / RS lain.
// - utd_distribusi      : distribusi komponen ke permintaan; ref_penerimaan_bdrs = kunci idempoten integrasi BDRS.
// - utd_pemusnahan      : pemusnahan kantong/komponen (reaktif/kedaluwarsa/lain); menolak barang yang sudah terdistribusi.
// - utd_pelaporan_log   : jejak pembentukan laporan (jenis, periode, pembuat) agar hasil dapat ditelusuri.
// - utd_akses_log       : jejak upaya akses hasil IMLTD reaktif oleh pengguna tanpa izin (tanpa menyimpan nilai hasil).

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS utd_donor (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          no_donor VARCHAR(30) NOT NULL, nik VARCHAR(20), nama VARCHAR(200) NOT NULL,
          tanggal_lahir DATE, jenis_kelamin VARCHAR(1) CHECK (jenis_kelamin IN ('L', 'P')),
          golongan_darah VARCHAR(3) CHECK (golongan_darah IN ('A', 'B', 'AB', 'O')),
          rhesus VARCHAR(8) CHECK (rhesus IN ('positif', 'negatif')),
          telepon VARCHAR(20), alamat TEXT,
          status_aktif VARCHAR(10) NOT NULL DEFAULT 'aktif' CHECK (status_aktif IN ('aktif', 'ditahan')),
          alasan_ditahan TEXT, perlu_notifikasi BOOLEAN NOT NULL DEFAULT false,
          notifikasi_selesai BOOLEAN NOT NULL DEFAULT false, catatan_notifikasi TEXT, notifikasi_pada BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS utd_donor_no_uq ON utd_donor (faskes_uuid, no_donor) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS utd_donor_nik_idx ON utd_donor (faskes_uuid, nik) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS utd_donor_nama_idx ON utd_donor (faskes_uuid, nama);

        -- Parameter klinis per faskes (interval minimal antar-donor, dsb.); dikonfigurasi, bukan dihardcode di kode.
        -- interval_minimal_hari: nilai awal 90 hari adalah bawaan yang wajib ditinjau pemilik proses sesuai pedoman
        -- resmi (PMI/Kemenkes) sebelum dipakai secara produksi (lihat PRD STD-0011 bagian 13 pertanyaan terbuka).
        CREATE TABLE IF NOT EXISTS utd_pengaturan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          interval_minimal_hari SMALLINT NOT NULL DEFAULT 90 CHECK (interval_minimal_hari > 0),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS utd_pengaturan_faskes_uq ON utd_pengaturan (faskes_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS utd_donor_riwayat (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          donor_uuid VARCHAR(255) NOT NULL REFERENCES utd_donor(uuid),
          kuesioner JSONB NOT NULL DEFAULT '{}',
          hb NUMERIC(4,1), tekanan_sistolik SMALLINT, tekanan_diastolik SMALLINT,
          berat_badan NUMERIC(5,1), nadi SMALLINT, suhu NUMERIC(4,1),
          status VARCHAR(8) NOT NULL DEFAULT 'proses' CHECK (status IN ('proses', 'layak', 'tunda', 'tolak')),
          alasan TEXT, tanggal_layak_berikutnya DATE,
          pemeriksa_uuid VARCHAR(255), waktu_keputusan BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS utd_donor_riwayat_donor_idx ON utd_donor_riwayat (donor_uuid, created_at);
        CREATE INDEX IF NOT EXISTS utd_donor_riwayat_faskes_idx ON utd_donor_riwayat (faskes_uuid, status, created_at);

        CREATE TABLE IF NOT EXISTS utd_aftap (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          donor_uuid VARCHAR(255) NOT NULL REFERENCES utd_donor(uuid),
          riwayat_uuid VARCHAR(255) NOT NULL REFERENCES utd_donor_riwayat(uuid),
          no_kantong VARCHAR(30) NOT NULL, volume_ml SMALLINT NOT NULL CHECK (volume_ml > 0),
          golongan_darah VARCHAR(3) CHECK (golongan_darah IN ('A', 'B', 'AB', 'O')),
          rhesus VARCHAR(8) CHECK (rhesus IN ('positif', 'negatif')),
          waktu_mulai BIGINT, waktu_selesai BIGINT, petugas_uuid VARCHAR(255),
          reaksi_donor VARCHAR(12) NOT NULL DEFAULT 'tidak_ada' CHECK (reaksi_donor IN ('tidak_ada', 'ringan', 'sedang', 'berat')),
          catatan_reaksi TEXT, kegiatan VARCHAR(200), lokasi_mobile VARCHAR(200),
          status_kantong VARCHAR(20) NOT NULL DEFAULT 'karantina'
            CHECK (status_kantong IN ('karantina', 'karantina_reaktif', 'tersedia', 'dimusnahkan')),
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS utd_aftap_no_kantong_uq ON utd_aftap (faskes_uuid, no_kantong) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS utd_aftap_donor_idx ON utd_aftap (donor_uuid, created_at);
        CREATE INDEX IF NOT EXISTS utd_aftap_status_idx ON utd_aftap (faskes_uuid, status_kantong, created_at);

        CREATE TABLE IF NOT EXISTS utd_imltd (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          aftap_uuid VARCHAR(255) NOT NULL REFERENCES utd_aftap(uuid),
          hiv_hasil VARCHAR(11) CHECK (hiv_hasil IN ('reaktif', 'non_reaktif')), hiv_metode VARCHAR(100), hiv_waktu BIGINT,
          hbsag_hasil VARCHAR(11) CHECK (hbsag_hasil IN ('reaktif', 'non_reaktif')), hbsag_metode VARCHAR(100), hbsag_waktu BIGINT,
          hcv_hasil VARCHAR(11) CHECK (hcv_hasil IN ('reaktif', 'non_reaktif')), hcv_metode VARCHAR(100), hcv_waktu BIGINT,
          sifilis_hasil VARCHAR(11) CHECK (sifilis_hasil IN ('reaktif', 'non_reaktif')), sifilis_metode VARCHAR(100), sifilis_waktu BIGINT,
          analis_uuid VARCHAR(255), hasil_konfirmasi JSONB NOT NULL DEFAULT '[]',
          status_akhir VARCHAR(11) NOT NULL DEFAULT 'pending' CHECK (status_akhir IN ('pending', 'non_reaktif', 'reaktif')),
          dilepas_oleh VARCHAR(255), dilepas_pada BIGINT, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS utd_imltd_aftap_uq ON utd_imltd (aftap_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS utd_imltd_status_idx ON utd_imltd (faskes_uuid, status_akhir);

        CREATE TABLE IF NOT EXISTS utd_komponen (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          aftap_uuid VARCHAR(255) NOT NULL REFERENCES utd_aftap(uuid),
          jenis_komponen VARCHAR(5) NOT NULL CHECK (jenis_komponen IN ('PRC', 'TC', 'FFP', 'CRYO')),
          label_unik VARCHAR(40) NOT NULL, volume_ml SMALLINT NOT NULL CHECK (volume_ml > 0),
          golongan_darah VARCHAR(3) CHECK (golongan_darah IN ('A', 'B', 'AB', 'O')),
          rhesus VARCHAR(8) CHECK (rhesus IN ('positif', 'negatif')),
          tanggal_kedaluwarsa DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'karantina'
            CHECK (status IN ('karantina', 'tersedia', 'dialokasikan', 'didistribusikan', 'dimusnahkan', 'kedaluwarsa')),
          dilepas_oleh VARCHAR(255), dilepas_pada BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS utd_komponen_label_uq ON utd_komponen (faskes_uuid, label_unik) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS utd_komponen_aftap_idx ON utd_komponen (aftap_uuid);
        CREATE INDEX IF NOT EXISTS utd_komponen_stok_idx ON utd_komponen (faskes_uuid, status, jenis_komponen, golongan_darah, tanggal_kedaluwarsa);

        CREATE TABLE IF NOT EXISTS utd_permintaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          penerima_tipe VARCHAR(20) NOT NULL CHECK (penerima_tipe IN ('bdrs_internal', 'eksternal')),
          nama_penerima VARCHAR(200) NOT NULL,
          golongan_darah VARCHAR(3) NOT NULL CHECK (golongan_darah IN ('A', 'B', 'AB', 'O')),
          jenis_komponen VARCHAR(5) NOT NULL CHECK (jenis_komponen IN ('PRC', 'TC', 'FFP', 'CRYO')),
          jumlah_diminta SMALLINT NOT NULL CHECK (jumlah_diminta > 0),
          keterangan_klinis TEXT,
          status VARCHAR(10) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'sebagian', 'terpenuhi', 'ditolak')),
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS utd_permintaan_faskes_idx ON utd_permintaan (faskes_uuid, status, created_at);

        CREATE TABLE IF NOT EXISTS utd_distribusi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES utd_permintaan(uuid),
          komponen_uuid VARCHAR(255) NOT NULL REFERENCES utd_komponen(uuid),
          penerima_tipe VARCHAR(20) NOT NULL CHECK (penerima_tipe IN ('bdrs_internal', 'eksternal')),
          nama_penerima VARCHAR(200) NOT NULL, waktu_serah_terima BIGINT, petugas_uuid VARCHAR(255),
          status VARCHAR(20) NOT NULL DEFAULT 'terkirim' CHECK (status IN ('terkirim', 'menunggu_integrasi', 'gagal_integrasi')),
          ref_penerimaan_bdrs VARCHAR(100), catatan_integrasi TEXT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS utd_distribusi_komponen_uq ON utd_distribusi (komponen_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS utd_distribusi_permintaan_idx ON utd_distribusi (permintaan_uuid);
        CREATE INDEX IF NOT EXISTS utd_distribusi_faskes_idx ON utd_distribusi (faskes_uuid, status, created_at);

        CREATE TABLE IF NOT EXISTS utd_pemusnahan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kantong_uuid VARCHAR(255) REFERENCES utd_aftap(uuid), komponen_uuid VARCHAR(255) REFERENCES utd_komponen(uuid),
          alasan VARCHAR(20) NOT NULL CHECK (alasan IN ('reaktif', 'kedaluwarsa', 'lain')),
          catatan TEXT, petugas_uuid VARCHAR(255), waktu_musnah BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU},
          CONSTRAINT utd_pemusnahan_target_chk CHECK (kantong_uuid IS NOT NULL OR komponen_uuid IS NOT NULL)
        );
        CREATE INDEX IF NOT EXISTS utd_pemusnahan_faskes_idx ON utd_pemusnahan (faskes_uuid, created_at);
        CREATE INDEX IF NOT EXISTS utd_pemusnahan_komponen_idx ON utd_pemusnahan (komponen_uuid) WHERE komponen_uuid IS NOT NULL;
        CREATE INDEX IF NOT EXISTS utd_pemusnahan_kantong_idx ON utd_pemusnahan (kantong_uuid) WHERE kantong_uuid IS NOT NULL;

        CREATE TABLE IF NOT EXISTS utd_pelaporan_log (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis_laporan VARCHAR(20) NOT NULL
            CHECK (jenis_laporan IN ('donor', 'produksi', 'uji_saring', 'distribusi', 'pemusnahan', 'bulanan')),
          periode_awal BIGINT NOT NULL, periode_akhir BIGINT NOT NULL, parameter JSONB NOT NULL DEFAULT '{}',
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS utd_pelaporan_log_faskes_idx ON utd_pelaporan_log (faskes_uuid, jenis_laporan, created_at);

        -- Jejak akses hasil IMLTD reaktif (KF-18/KT-13): dicatat setiap kali pengguna tanpa izin "Lihat Hasil Reaktif"
        -- membuka kantong dengan hasil reaktif; nilai hasil & identitas donor tidak pernah masuk ke log ini.
        CREATE TABLE IF NOT EXISTS utd_akses_log (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          aftap_uuid VARCHAR(255) REFERENCES utd_aftap(uuid), username VARCHAR(255),
          keterangan VARCHAR(200) NOT NULL, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS utd_akses_log_faskes_idx ON utd_akses_log (faskes_uuid, created_at);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS utd_akses_log, utd_pelaporan_log, utd_pemusnahan, utd_distribusi, utd_permintaan, utd_komponen,
        utd_imltd, utd_aftap, utd_donor_riwayat, utd_pengaturan, utd_donor;
    `);
  },
};
