'use strict';

// Mikrobiologi Klinik (penunjang-service, tabel berprefiks mikro_).
//
// Master:
// - mikro_pemeriksaan      : jenis pemeriksaan (kultur & sensitivitas, kultur darah/urin/jamur, pewarnaan Gram, BTA,
//                            KOH, tes cepat molekuler, dll.) + jenis spesimen yang diizinkan, tarif, TAT (hari).
//                            Bendera dengan_pewarnaan / dengan_kultur / dengan_ast menentukan tahap form hasil.
// - mikro_organisme        : daftar organisme (kode, nama, Gram, bentuk, kelompok panel AST, kode WHONET opsional).
// - mikro_antibiotik       : antibiotik (kode WHONET, nama, golongan/kelas) + breakpoint umum opsional.
// - mikro_panel_antibiotik : panel AST standar per kelompok organisme (Enterobacterales, Staphylococcus, ...),
//                            urutan tampil + breakpoint khusus kelompok (opsional, menimpa breakpoint umum).
// Transaksi:
// - mikro_order / mikro_order_item : order dari RME (kunjungan) atau APS; satu item = satu pemeriksaan atas satu
//                            spesimen (jenis + lokasi/sumber). Alur item: menunggu → diterima → diproses →
//                            sementara → selesai | ditolak (spesimen dapat diterima ulang).
// - mikro_spesimen         : riwayat penerimaan/penolakan spesimen per item (nomor mikro otomatis, waktu ambil/terima,
//                            kualitas, alasan tolak).
// - mikro_hasil            : satu per item: pewarnaan (Gram/BTA/KOH), kultur (status, media, inkubasi), laporan
//                            sementara, kesimpulan, verifikasi Sp.MK, status draft/sementara/final, sumber manual|lis.
// - mikro_isolat           : organisme hasil identifikasi (≥1 per hasil), jumlah koloni, penanda resistensi (ESBL/MRSA/...).
// - mikro_kepekaan         : uji kepekaan antibiotik per isolat: MIC / zona hambat (mm) + interpretasi S/I/R.
// Kolom `sumber` ('manual' | 'lis') & `ref_lis` disiapkan untuk integrasi alat/LIS kelak.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS mikro_pemeriksaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(30) NOT NULL, nama VARCHAR(200) NOT NULL,
          jenis VARCHAR(12) NOT NULL DEFAULT 'kultur' CHECK (jenis IN ('kultur', 'pewarnaan', 'molekuler', 'serologi', 'lain')),
          spesimen VARCHAR(30)[] NOT NULL DEFAULT '{}',
          dengan_pewarnaan VARCHAR(12) CHECK (dengan_pewarnaan IN ('gram', 'bta', 'koh', 'tinta_india', 'lain')),
          dengan_kultur BOOLEAN NOT NULL DEFAULT false, dengan_ast BOOLEAN NOT NULL DEFAULT false,
          metode TEXT, harga NUMERIC(14,2) NOT NULL DEFAULT 0, tat_hari SMALLINT NOT NULL DEFAULT 1 CHECK (tat_hari BETWEEN 0 AND 90),
          kode_lis VARCHAR(50), keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mikro_pemeriksaan_kode_uq ON mikro_pemeriksaan (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mikro_organisme (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(30) NOT NULL, nama VARCHAR(200) NOT NULL,
          gram VARCHAR(10) NOT NULL DEFAULT 'lain' CHECK (gram IN ('positif', 'negatif', 'jamur', 'bta', 'lain')),
          bentuk VARCHAR(12) CHECK (bentuk IN ('batang', 'kokus', 'kokobasil', 'spiral', 'ragi', 'kapang', 'lain')),
          kelompok VARCHAR(30) NOT NULL DEFAULT 'LAIN',
          kode_whonet VARCHAR(20), keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mikro_organisme_kode_uq ON mikro_organisme (faskes_uuid, kode) WHERE deleted_at IS NULL;

        -- Breakpoint: zona (mm) S bila ≥ bp_zona_s, R bila ≤ bp_zona_r; MIC (µg/mL) S bila ≤ bp_mic_s, R bila ≥ bp_mic_r.
        CREATE TABLE IF NOT EXISTS mikro_antibiotik (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(20) NOT NULL, nama VARCHAR(150) NOT NULL, golongan VARCHAR(100),
          potensi_disk VARCHAR(20),
          bp_zona_s NUMERIC(6,2), bp_zona_r NUMERIC(6,2), bp_mic_s NUMERIC(10,4), bp_mic_r NUMERIC(10,4), standar_bp VARCHAR(50),
          keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mikro_antibiotik_kode_uq ON mikro_antibiotik (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mikro_panel_antibiotik (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kelompok VARCHAR(30) NOT NULL,
          antibiotik_uuid VARCHAR(255) NOT NULL REFERENCES mikro_antibiotik(uuid),
          urutan SMALLINT NOT NULL DEFAULT 0,
          bp_zona_s NUMERIC(6,2), bp_zona_r NUMERIC(6,2), bp_mic_s NUMERIC(10,4), bp_mic_r NUMERIC(10,4), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mikro_panel_uq ON mikro_panel_antibiotik (faskes_uuid, kelompok, antibiotik_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mikro_order (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_order VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50), no_reg VARCHAR(50), rekam_medis_uuid VARCHAR(255),
          sumber VARCHAR(10) NOT NULL CHECK (sumber IN ('rme', 'aps')),
          pelayanan VARCHAR(10) NOT NULL CHECK (pelayanan IN ('rajal', 'ranap', 'igd', 'aps')),
          lokasi_asal_uuid VARCHAR(255), dokter_pengirim_uuid VARCHAR(255), payment_method INTEGER NOT NULL DEFAULT 1,
          klinis TEXT, antibiotik_sedang TEXT, catatan TEXT, cito BOOLEAN NOT NULL DEFAULT false,
          status VARCHAR(12) NOT NULL DEFAULT 'order' CHECK (status IN ('order', 'valid', 'diproses', 'selesai', 'batal')),
          alasan_batal TEXT, divalidasi_oleh VARCHAR(255), divalidasi_pada BIGINT, selesai_pada BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mikro_order_no_uq ON mikro_order (faskes_uuid, no_order);
        CREATE INDEX IF NOT EXISTS mikro_order_status_idx ON mikro_order (faskes_uuid, status, created_at);
        CREATE INDEX IF NOT EXISTS mikro_order_rm_idx ON mikro_order (rekam_medis_uuid);
        CREATE INDEX IF NOT EXISTS mikro_order_pasien_idx ON mikro_order (patient_uuid);

        CREATE TABLE IF NOT EXISTS mikro_order_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES mikro_order(uuid) ON DELETE CASCADE,
          pemeriksaan_uuid VARCHAR(255) NOT NULL REFERENCES mikro_pemeriksaan(uuid),
          nama VARCHAR(200) NOT NULL, jenis VARCHAR(12), harga NUMERIC(14,2) NOT NULL DEFAULT 0, tat_hari SMALLINT,
          jenis_spesimen VARCHAR(30) NOT NULL, lokasi_spesimen VARCHAR(200),
          status VARCHAR(10) NOT NULL DEFAULT 'menunggu'
            CHECK (status IN ('menunggu', 'diterima', 'ditolak', 'diproses', 'sementara', 'selesai')),
          spesimen_uuid VARCHAR(255), no_mikro VARCHAR(50), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mikro_order_item_order_idx ON mikro_order_item (order_uuid);

        CREATE TABLE IF NOT EXISTS mikro_spesimen (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          item_uuid VARCHAR(255) NOT NULL REFERENCES mikro_order_item(uuid) ON DELETE CASCADE,
          no_mikro VARCHAR(50), jenis_spesimen VARCHAR(30) NOT NULL, lokasi_spesimen VARCHAR(200),
          waktu_ambil BIGINT, waktu_terima BIGINT NOT NULL, diambil_oleh VARCHAR(255), diterima_oleh VARCHAR(255),
          volume VARCHAR(50), wadah VARCHAR(100), kualitas VARCHAR(100),
          status VARCHAR(10) NOT NULL CHECK (status IN ('diterima', 'ditolak')), alasan_tolak TEXT, catatan TEXT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mikro_spesimen_item_idx ON mikro_spesimen (item_uuid);
        CREATE UNIQUE INDEX IF NOT EXISTS mikro_spesimen_no_uq ON mikro_spesimen (faskes_uuid, no_mikro) WHERE no_mikro IS NOT NULL;

        CREATE TABLE IF NOT EXISTS mikro_hasil (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          item_uuid VARCHAR(255) NOT NULL REFERENCES mikro_order_item(uuid) ON DELETE CASCADE,
          spesimen_uuid VARCHAR(255) REFERENCES mikro_spesimen(uuid),
          -- Pewarnaan
          pewarnaan_jenis VARCHAR(12), gram_temuan JSONB NOT NULL DEFAULT '[]',
          sel_leukosit VARCHAR(20), sel_epitel VARCHAR(20), hasil_pewarnaan TEXT,
          -- Kultur
          kultur_status VARCHAR(14) CHECK (kultur_status IN ('dalam_proses', 'tidak_tumbuh', 'tumbuh', 'kontaminan', 'flora_normal')),
          media TEXT, mulai_inkubasi BIGINT, lama_inkubasi_jam INTEGER, keterangan_kultur TEXT,
          -- Hasil umum (molekuler / lain) & laporan
          hasil_teks TEXT, laporan_sementara TEXT, kesimpulan TEXT, catatan TEXT,
          status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sementara', 'final')),
          sementara_pada BIGINT, sementara_oleh VARCHAR(255),
          dokter_mikro_uuid VARCHAR(255), diverifikasi_oleh VARCHAR(255), diverifikasi_pada BIGINT,
          diisi_oleh VARCHAR(255), sumber VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'lis')),
          ref_lis VARCHAR(100), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mikro_hasil_item_uq ON mikro_hasil (item_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mikro_isolat (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          hasil_uuid VARCHAR(255) NOT NULL REFERENCES mikro_hasil(uuid) ON DELETE CASCADE,
          urutan SMALLINT NOT NULL DEFAULT 1,
          organisme_uuid VARCHAR(255) REFERENCES mikro_organisme(uuid),
          nama_organisme VARCHAR(200) NOT NULL, kelompok VARCHAR(30),
          jumlah_koloni VARCHAR(100), koloni_cfu NUMERIC(14,0),
          penanda VARCHAR(10)[] NOT NULL DEFAULT '{}', catatan TEXT,
          sumber VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'lis')), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mikro_isolat_hasil_idx ON mikro_isolat (hasil_uuid);
        CREATE INDEX IF NOT EXISTS mikro_isolat_organisme_idx ON mikro_isolat (faskes_uuid, organisme_uuid);

        CREATE TABLE IF NOT EXISTS mikro_kepekaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          isolat_uuid VARCHAR(255) NOT NULL REFERENCES mikro_isolat(uuid) ON DELETE CASCADE,
          antibiotik_uuid VARCHAR(255) REFERENCES mikro_antibiotik(uuid),
          kode VARCHAR(20), nama VARCHAR(150) NOT NULL, urutan SMALLINT NOT NULL DEFAULT 0,
          metode VARCHAR(6) CHECK (metode IN ('disk', 'mic', 'etest', 'lain')),
          mic VARCHAR(20), zona NUMERIC(6,2),
          interpretasi VARCHAR(1) CHECK (interpretasi IN ('S', 'I', 'R')),
          dilaporkan BOOLEAN NOT NULL DEFAULT true,
          sumber VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (sumber IN ('manual', 'lis')), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mikro_kepekaan_isolat_idx ON mikro_kepekaan (isolat_uuid);
        CREATE INDEX IF NOT EXISTS mikro_kepekaan_ab_idx ON mikro_kepekaan (faskes_uuid, antibiotik_uuid);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS mikro_kepekaan, mikro_isolat, mikro_hasil, mikro_spesimen, mikro_order_item, mikro_order,
        mikro_panel_antibiotik, mikro_antibiotik, mikro_organisme, mikro_pemeriksaan;
    `);
  },
};
