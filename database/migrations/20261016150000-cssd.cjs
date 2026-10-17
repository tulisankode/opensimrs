'use strict';

// Modul CSSD — Sterilisasi Alat & Pelacakan Set Instrumen (penunjang-service, tabel berprefiks cssd_).
//
// Master:
// - cssd_master_set          : template jenis set (komposisi & aturan), bukan instans fisik. Kode unik per faskes.
// - cssd_master_set_instrumen: daftar instrumen penyusun satu jenis set.
// - cssd_mesin               : mesin sterilisasi (autoklaf/plasma/EO).
// - cssd_bowie_dick          : uji Bowie-Dick harian per mesin (satu hasil per mesin/tanggal).
// Transaksi:
// - cssd_set            : set fisik individual yang dilacak (barcode unik per faskes), status & lokasi berjalan.
// - cssd_load/cssd_load_set : satu siklus sterilisasi beserta set yang dimuat (relasi banyak-ke-banyak).
// - cssd_serah_terima   : seluruh perpindahan fisik set (terima kotor, distribusi, pengembalian, recall).
// - cssd_dekontaminasi  : pencatatan dekontaminasi, kelengkapan instrumen, dan pengemasan per set.
// - cssd_permintaan     : permintaan set steril dari unit; tidak mengurangi stok sampai serah terima tercatat.
// - cssd_pemakaian      : pemakaian set pada pasien/kunjungan, tertaut ke load asal untuk kebutuhan recall.
// - cssd_recall/cssd_recall_set : satu recall per load gagal beserta tindak lanjut per set terdampak.
//
// Status set: kotor → dekontaminasi dicatat → dikemas (lengkap) atau menunggu_tindakan (tidak lengkap/rusak)
// → menunggu_keputusan (masuk load) → layak (indikator lulus) atau tidak_layak (indikator gagal, otomatis
// untuk seluruh set dalam load yang sama) → dikarantina/hilang/rusak bila ditarik dari peredaran.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS cssd_master_set (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode_set VARCHAR(30) NOT NULL, nama_set VARCHAR(200) NOT NULL,
          metode_sterilisasi_default VARCHAR(10) NOT NULL DEFAULT 'autoklaf'
            CHECK (metode_sterilisasi_default IN ('autoklaf', 'plasma', 'eo', 'lain')),
          masa_berlaku_steril_jam INTEGER NOT NULL DEFAULT 168 CHECK (masa_berlaku_steril_jam > 0),
          status_aktif BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_master_set_kode_uq ON cssd_master_set (faskes_uuid, kode_set) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS cssd_master_set_instrumen (
          uuid VARCHAR(255) PRIMARY KEY,
          master_set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_master_set(uuid) ON DELETE CASCADE,
          nama_instrumen VARCHAR(200) NOT NULL, jumlah INTEGER NOT NULL DEFAULT 1 CHECK (jumlah > 0),
          satuan VARCHAR(30) NOT NULL DEFAULT 'pcs', urutan SMALLINT NOT NULL DEFAULT 0, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS cssd_master_set_instrumen_set_idx ON cssd_master_set_instrumen (master_set_uuid);

        CREATE TABLE IF NOT EXISTS cssd_mesin (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nama_mesin VARCHAR(150) NOT NULL, nomor_seri VARCHAR(100),
          metode VARCHAR(10) NOT NULL DEFAULT 'autoklaf' CHECK (metode IN ('autoklaf', 'plasma', 'eo', 'lain')),
          status_aktif BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_mesin_seri_uq ON cssd_mesin (faskes_uuid, nomor_seri) WHERE deleted_at IS NULL AND nomor_seri IS NOT NULL;

        -- Satu hasil uji Bowie-Dick per mesin per tanggal (koreksi hari yang sama memakai UPSERT).
        CREATE TABLE IF NOT EXISTS cssd_bowie_dick (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          mesin_uuid VARCHAR(255) NOT NULL REFERENCES cssd_mesin(uuid), tanggal DATE NOT NULL,
          hasil VARCHAR(6) NOT NULL CHECK (hasil IN ('lulus', 'gagal')),
          petugas_uuid VARCHAR(255), catatan TEXT, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_bowie_dick_uq ON cssd_bowie_dick (mesin_uuid, tanggal);

        CREATE TABLE IF NOT EXISTS cssd_set (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          master_set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_master_set(uuid),
          kode_set_fisik VARCHAR(100) NOT NULL, kode_barcode VARCHAR(100) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'kotor' CHECK (status IN (
            'kotor', 'dekontaminasi', 'dikemas', 'menunggu_tindakan', 'dalam_load', 'menunggu_keputusan',
            'layak', 'tidak_layak', 'dikarantina', 'hilang', 'rusak'
          )),
          lokasi_tipe VARCHAR(6) NOT NULL DEFAULT 'cssd' CHECK (lokasi_tipe IN ('cssd', 'unit')),
          lokasi_uuid VARCHAR(255), load_terakhir_uuid VARCHAR(255), tanggal_kedaluwarsa_steril BIGINT, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_set_barcode_uq ON cssd_set (faskes_uuid, kode_barcode) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS cssd_set_master_idx ON cssd_set (master_set_uuid);
        CREATE INDEX IF NOT EXISTS cssd_set_status_idx ON cssd_set (faskes_uuid, status);
        CREATE INDEX IF NOT EXISTS cssd_set_kedaluwarsa_idx ON cssd_set (faskes_uuid, tanggal_kedaluwarsa_steril);

        CREATE TABLE IF NOT EXISTS cssd_load (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          mesin_uuid VARCHAR(255) NOT NULL REFERENCES cssd_mesin(uuid), nomor_load VARCHAR(50) NOT NULL,
          metode VARCHAR(10) NOT NULL CHECK (metode IN ('autoklaf', 'plasma', 'eo', 'lain')),
          parameter_suhu NUMERIC(6,2), parameter_tekanan NUMERIC(6,2), parameter_durasi_menit INTEGER,
          waktu_mulai BIGINT, waktu_selesai BIGINT,
          hasil_indikator_kimia VARCHAR(6) CHECK (hasil_indikator_kimia IN ('lulus', 'gagal')),
          hasil_indikator_biologi VARCHAR(6) CHECK (hasil_indikator_biologi IN ('lulus', 'gagal')),
          status VARCHAR(14) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf', 'menunggu_hasil', 'lulus', 'gagal')),
          petugas_uuid VARCHAR(255), catatan TEXT, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_load_nomor_uq ON cssd_load (faskes_uuid, mesin_uuid, nomor_load) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS cssd_load_mesin_idx ON cssd_load (mesin_uuid, waktu_mulai);
        CREATE INDEX IF NOT EXISTS cssd_load_status_idx ON cssd_load (faskes_uuid, status);

        CREATE TABLE IF NOT EXISTS cssd_load_set (
          uuid VARCHAR(255) PRIMARY KEY,
          load_uuid VARCHAR(255) NOT NULL REFERENCES cssd_load(uuid) ON DELETE CASCADE,
          set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_set(uuid), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_load_set_uq ON cssd_load_set (load_uuid, set_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS cssd_load_set_set_idx ON cssd_load_set (set_uuid);

        CREATE TABLE IF NOT EXISTS cssd_serah_terima (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_set(uuid),
          jenis VARCHAR(14) NOT NULL CHECK (jenis IN ('terima_kotor', 'distribusi', 'pengembalian', 'recall')),
          unit_asal_uuid VARCHAR(255), unit_tujuan_uuid VARCHAR(255),
          kondisi VARCHAR(12) NOT NULL DEFAULT 'baik' CHECK (kondisi IN ('baik', 'tidak_lengkap', 'rusak')),
          catatan_kondisi TEXT, permintaan_uuid VARCHAR(255),
          petugas_serah_uuid VARCHAR(255), petugas_terima_uuid VARCHAR(255), waktu BIGINT NOT NULL,
          dikonfirmasi_oleh VARCHAR(255), dikonfirmasi_pada BIGINT, catatan_konfirmasi TEXT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS cssd_serah_terima_set_idx ON cssd_serah_terima (set_uuid, waktu);
        CREATE INDEX IF NOT EXISTS cssd_serah_terima_faskes_idx ON cssd_serah_terima (faskes_uuid, jenis, waktu);

        CREATE TABLE IF NOT EXISTS cssd_dekontaminasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_set(uuid),
          petugas_uuid VARCHAR(255), waktu_mulai BIGINT NOT NULL, waktu_selesai BIGINT,
          hasil_kelengkapan VARCHAR(14) NOT NULL CHECK (hasil_kelengkapan IN ('lengkap', 'tidak_lengkap')),
          instrumen_kurang JSONB NOT NULL DEFAULT '[]', catatan TEXT,
          waktu_pengemasan BIGINT, petugas_pengemasan_uuid VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS cssd_dekontaminasi_set_idx ON cssd_dekontaminasi (set_uuid, waktu_mulai);

        CREATE TABLE IF NOT EXISTS cssd_permintaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          unit_uuid VARCHAR(255) NOT NULL, master_set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_master_set(uuid),
          jumlah INTEGER NOT NULL CHECK (jumlah > 0),
          status VARCHAR(10) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak', 'selesai')),
          alasan_penolakan TEXT, petugas_uuid VARCHAR(255), waktu_permintaan BIGINT NOT NULL, waktu_selesai BIGINT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS cssd_permintaan_faskes_idx ON cssd_permintaan (faskes_uuid, status, waktu_permintaan);
        CREATE INDEX IF NOT EXISTS cssd_permintaan_unit_idx ON cssd_permintaan (unit_uuid);

        CREATE TABLE IF NOT EXISTS cssd_pemakaian (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_set(uuid), load_asal_uuid VARCHAR(255) REFERENCES cssd_load(uuid),
          kunjungan_uuid VARCHAR(255), pasien_uuid VARCHAR(255) NOT NULL,
          nama_tindakan VARCHAR(255) NOT NULL, unit_uuid VARCHAR(255) NOT NULL,
          waktu_pakai BIGINT NOT NULL, petugas_uuid VARCHAR(255), catatan TEXT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS cssd_pemakaian_set_idx ON cssd_pemakaian (set_uuid);
        CREATE INDEX IF NOT EXISTS cssd_pemakaian_load_idx ON cssd_pemakaian (load_asal_uuid);
        CREATE INDEX IF NOT EXISTS cssd_pemakaian_pasien_idx ON cssd_pemakaian (faskes_uuid, pasien_uuid);

        CREATE TABLE IF NOT EXISTS cssd_recall (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          load_uuid VARCHAR(255) NOT NULL REFERENCES cssd_load(uuid),
          status VARCHAR(16) NOT NULL DEFAULT 'dibuka' CHECK (status IN ('dibuka', 'ditindaklanjuti', 'selesai')),
          catatan TEXT, dibuka_oleh VARCHAR(255), waktu_dibuka BIGINT NOT NULL, waktu_selesai BIGINT, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_recall_load_uq ON cssd_recall (load_uuid);

        CREATE TABLE IF NOT EXISTS cssd_recall_set (
          uuid VARCHAR(255) PRIMARY KEY,
          recall_uuid VARCHAR(255) NOT NULL REFERENCES cssd_recall(uuid) ON DELETE CASCADE,
          set_uuid VARCHAR(255) NOT NULL REFERENCES cssd_set(uuid),
          status_penanganan VARCHAR(20) NOT NULL DEFAULT 'belum_ditindaklanjuti' CHECK (status_penanganan IN (
            'belum_ditindaklanjuti', 'ditemukan', 'dikarantina', 'dimusnahkan', 'tindak_lanjut_klinis'
          )),
          catatan TEXT, petugas_uuid VARCHAR(255), waktu BIGINT, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cssd_recall_set_uq ON cssd_recall_set (recall_uuid, set_uuid);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS cssd_recall_set, cssd_recall, cssd_pemakaian, cssd_permintaan, cssd_dekontaminasi,
        cssd_serah_terima, cssd_load_set, cssd_load, cssd_set, cssd_bowie_dick, cssd_mesin,
        cssd_master_set_instrumen, cssd_master_set;
    `);
  },
};
