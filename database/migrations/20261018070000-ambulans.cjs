'use strict';

// Modul Manajemen Ambulans (STD-0024, penunjang-service/src/ambulans): armada & kru, permintaan & penugasan,
// perjalanan (jarak/BBM/catatan pendamping), tarif, biaya/penerusan tagihan & kuitansi umum, riwayat servis.
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ambulans_armada (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nomor_polisi VARCHAR(20) NOT NULL,
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('transport', 'gawat_darurat', 'jenazah')),
          kelengkapan JSONB,
          status VARCHAR(20) NOT NULL DEFAULT 'siap' CHECK (status IN ('siap', 'bertugas', 'servis')),
          jadwal_servis_berikutnya BIGINT, pajak_stnk_berlaku_sampai BIGINT,
          catatan_status TEXT, diubah_status_oleh VARCHAR(255), diubah_status_pada BIGINT,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_armada_nopol_uq ON ambulans_armada (faskes_uuid, nomor_polisi) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS ambulans_armada_status_idx ON ambulans_armada (faskes_uuid, status) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_kru (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          pegawai_uuid VARCHAR(255) NOT NULL,
          peran VARCHAR(20) NOT NULL CHECK (peran IN ('sopir', 'perawat')),
          aktif BOOLEAN NOT NULL DEFAULT true,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_kru_pegawai_uq ON ambulans_kru (faskes_uuid, pegawai_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_jadwal_jaga (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kru_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_kru(uuid),
          waktu_mulai BIGINT NOT NULL, waktu_selesai BIGINT NOT NULL CHECK (waktu_selesai > waktu_mulai),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ambulans_jadwal_jaga_kru_idx ON ambulans_jadwal_jaga (kru_uuid, waktu_mulai) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_permintaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nomor_permintaan VARCHAR(50) NOT NULL,
          sumber VARCHAR(20) NOT NULL CHECK (sumber IN ('igd', 'ruangan', 'telepon', 'rujukan')),
          jenis_layanan VARCHAR(20) NOT NULL CHECK (jenis_layanan IN ('gawat_darurat', 'rujukan', 'pemulangan', 'jenazah')),
          patient_uuid VARCHAR(255), no_reg VARCHAR(255),
          lokasi_jemput TEXT, tujuan TEXT NOT NULL,
          prioritas VARCHAR(20) NOT NULL CHECK (prioritas IN ('darurat', 'segera', 'biasa')),
          waktu_permintaan BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'ditugaskan', 'proses', 'selesai', 'batal')),
          alasan_batal TEXT, dibatalkan_oleh VARCHAR(255), dibatalkan_pada BIGINT,
          dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_permintaan_nomor_uq ON ambulans_permintaan (faskes_uuid, nomor_permintaan) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS ambulans_permintaan_status_idx ON ambulans_permintaan (faskes_uuid, status) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS ambulans_permintaan_waktu_idx ON ambulans_permintaan (faskes_uuid, waktu_permintaan);

        CREATE TABLE IF NOT EXISTS ambulans_penugasan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_permintaan(uuid),
          armada_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_armada(uuid),
          waktu_penugasan BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'selesai', 'batal')),
          alasan_batal TEXT, dibatalkan_oleh VARCHAR(255), dibatalkan_pada BIGINT,
          ditugaskan_oleh VARCHAR(255),
          ${WAKTU}
        );
        -- KF-6/KT-7: satu armada tidak boleh memiliki lebih dari satu penugasan aktif sekaligus.
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_penugasan_armada_aktif_uq ON ambulans_penugasan (armada_uuid)
          WHERE status = 'aktif' AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS ambulans_penugasan_permintaan_idx ON ambulans_penugasan (permintaan_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_penugasan_kru (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          penugasan_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_penugasan(uuid),
          kru_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_kru(uuid),
          peran VARCHAR(20) NOT NULL CHECK (peran IN ('sopir', 'perawat')),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ambulans_penugasan_kru_penugasan_idx ON ambulans_penugasan_kru (penugasan_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_perjalanan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          penugasan_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_penugasan(uuid),
          berangkat_pada BIGINT, tiba_lokasi_pada BIGINT, berangkat_tujuan_pada BIGINT, tiba_tujuan_pada BIGINT, kembali_pada BIGINT,
          km_awal NUMERIC(10, 1), km_akhir NUMERIC(10, 1), jarak_km NUMERIC(10, 1),
          bbm_nilai NUMERIC(10, 2), bbm_satuan VARCHAR(20),
          catatan_pendamping TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'berjalan' CHECK (status IN ('berjalan', 'selesai')),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_perjalanan_penugasan_uq ON ambulans_perjalanan (penugasan_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_tarif (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis_layanan VARCHAR(20) NOT NULL CHECK (jenis_layanan IN ('gawat_darurat', 'rujukan', 'pemulangan', 'jenazah')),
          metode_hitung VARCHAR(20) NOT NULL CHECK (metode_hitung IN ('jenis', 'per_km', 'zona')),
          nilai NUMERIC(14, 2) NOT NULL CHECK (nilai >= 0),
          zona VARCHAR(100),
          berlaku_mulai BIGINT NOT NULL, berlaku_sampai BIGINT,
          aktif BOOLEAN NOT NULL DEFAULT true,
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ambulans_tarif_cari_idx ON ambulans_tarif (faskes_uuid, jenis_layanan, metode_hitung, aktif) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_biaya (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_permintaan(uuid),
          tarif_uuid VARCHAR(255) REFERENCES ambulans_tarif(uuid),
          metode_hitung VARCHAR(20), dasar_hitung JSONB,
          jumlah NUMERIC(14, 2),
          status_penerusan VARCHAR(20) NOT NULL DEFAULT 'belum_dihitung'
            CHECK (status_penerusan IN ('belum_dihitung', 'menunggu', 'terkirim', 'gagal')),
          referensi_pembayaran VARCHAR(255), kunci_idempoten VARCHAR(255), pesan_galat TEXT,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_biaya_permintaan_uq ON ambulans_biaya (permintaan_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_kuitansi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_permintaan(uuid),
          nomor_kuitansi VARCHAR(50) NOT NULL,
          jumlah NUMERIC(14, 2) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'terbit' CHECK (status IN ('terbit', 'batal')),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_kuitansi_permintaan_uq ON ambulans_kuitansi (permintaan_uuid) WHERE deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ambulans_kuitansi_nomor_uq ON ambulans_kuitansi (faskes_uuid, nomor_kuitansi) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ambulans_riwayat_servis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          armada_uuid VARCHAR(255) NOT NULL REFERENCES ambulans_armada(uuid),
          tanggal_servis BIGINT NOT NULL, uraian TEXT NOT NULL, work_order_uuid VARCHAR(255),
          dicatat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ambulans_riwayat_servis_armada_idx ON ambulans_riwayat_servis (armada_uuid) WHERE deleted_at IS NULL;
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS ambulans_riwayat_servis, ambulans_kuitansi, ambulans_biaya, ambulans_tarif,
        ambulans_perjalanan, ambulans_penugasan_kru, ambulans_penugasan, ambulans_permintaan,
        ambulans_jadwal_jaga, ambulans_kru, ambulans_armada;
    `);
  },
};
