'use strict';

// Modul Laundry & Linen (STD-0023, penunjang-service): master jenis linen, par level ruangan, buku transaksi stok
// (saldo = Σ masuk − Σ keluar per lokasi/jenis), serah terima linen kotor dua petugas, batch & tahapan proses,
// permintaan & distribusi linen bersih. Idempoten (IF NOT EXISTS), lalu sinkron katalog (modul "laundry").
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

const audit = `created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  updated_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  deleted_at bigint`;

const tabel = [
  `CREATE TABLE IF NOT EXISTS laundry_jenis_linen (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, kode varchar(40) NOT NULL, nama varchar(120) NOT NULL,
    satuan varchar(30) NOT NULL, aktif boolean NOT NULL DEFAULT true, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_stok_lokasi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, lokasi_uuid varchar(255) NOT NULL, jenis_linen_uuid varchar(255) NOT NULL,
    par_level numeric(14,2) NOT NULL DEFAULT 0 CHECK (par_level >= 0), ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_transaksi_stok (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL,
    lokasi_tipe varchar(20) NOT NULL CHECK (lokasi_tipe IN ('ruangan','laundry')), lokasi_uuid varchar(255),
    jenis_linen_uuid varchar(255) NOT NULL, sumber_tipe varchar(40) NOT NULL, sumber_uuid varchar(255),
    arah varchar(10) NOT NULL CHECK (arah IN ('masuk','keluar')), jumlah numeric(14,2) NOT NULL CHECK (jumlah > 0),
    alasan text, petugas_uuid varchar(120), waktu_transaksi bigint NOT NULL, ${audit},
    CHECK ((lokasi_tipe = 'laundry' AND lokasi_uuid IS NULL) OR (lokasi_tipe = 'ruangan' AND lokasi_uuid IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS laundry_penerimaan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, lokasi_uuid varchar(255) NOT NULL, waktu_serah bigint NOT NULL,
    waktu_terima bigint, status varchar(30) NOT NULL, petugas_penyerah varchar(120) NOT NULL, petugas_penerima varchar(120), catatan text, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_penerimaan_rincian (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, penerimaan_uuid varchar(255) NOT NULL, jenis_linen_uuid varchar(255) NOT NULL,
    jumlah_diserahkan numeric(14,2) NOT NULL CHECK (jumlah_diserahkan > 0), jumlah_diterima numeric(14,2) CHECK (jumlah_diterima >= 0),
    kategori varchar(30) NOT NULL CHECK (kategori IN ('biasa','infeksius','bernoda_berat')), alasan_selisih text, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_batch (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, kode varchar(60) NOT NULL, status varchar(20) NOT NULL,
    kategori varchar(30) NOT NULL, berat_kg numeric(14,3) NOT NULL CHECK (berat_kg > 0), waktu_mulai bigint NOT NULL, waktu_selesai bigint,
    petugas_uuid varchar(120), catatan text, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_batch_asal (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, batch_uuid varchar(255) NOT NULL, rincian_penerimaan_uuid varchar(255) NOT NULL,
    jumlah_diproses numeric(14,2) NOT NULL CHECK (jumlah_diproses > 0), ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_batch_tahap (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, batch_uuid varchar(255) NOT NULL, tahap varchar(30) NOT NULL,
    status varchar(20) NOT NULL, waktu_mulai bigint, waktu_selesai bigint, petugas_uuid varchar(120), catatan text, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_permintaan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, lokasi_uuid varchar(255) NOT NULL, status varchar(20) NOT NULL,
    waktu_permintaan bigint NOT NULL, petugas_peminta varchar(120) NOT NULL, catatan text, alasan_batal text, waktu_batal bigint, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_permintaan_rincian (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, permintaan_uuid varchar(255) NOT NULL, jenis_linen_uuid varchar(255) NOT NULL,
    jumlah_diminta numeric(14,2) NOT NULL CHECK (jumlah_diminta > 0), jumlah_terpenuhi numeric(14,2) NOT NULL DEFAULT 0 CHECK (jumlah_terpenuhi >= 0), ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_distribusi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, lokasi_uuid varchar(255) NOT NULL, permintaan_uuid varchar(255),
    status varchar(30) NOT NULL, petugas_pengirim varchar(120) NOT NULL, petugas_penerima varchar(120), waktu_kirim bigint NOT NULL,
    waktu_terima bigint, catatan text, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_distribusi_rincian (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, distribusi_uuid varchar(255) NOT NULL, jenis_linen_uuid varchar(255) NOT NULL,
    jumlah_dikirim numeric(14,2) NOT NULL CHECK (jumlah_dikirim > 0), jumlah_diterima numeric(14,2) CHECK (jumlah_diterima >= 0), alasan_selisih text, ${audit})`,
];

const indeks = [
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_jenis_faskes_kode_aktif ON laundry_jenis_linen (faskes_uuid, lower(kode)) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_stok_lokasi_aktif ON laundry_stok_lokasi (faskes_uuid, lokasi_uuid, jenis_linen_uuid) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_batch_tahap_aktif ON laundry_batch_tahap (batch_uuid, tahap) WHERE deleted_at IS NULL`,
  // Saldo awal hanya sekali per lokasi/jenis (lokasi_uuid NULL = stok bersih laundry → COALESCE agar tetap unik).
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_saldo_awal_unik ON laundry_transaksi_stok (faskes_uuid, lokasi_tipe, COALESCE(lokasi_uuid, ''), jenis_linen_uuid)
     WHERE sumber_tipe = 'saldo_awal' AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_stok_riwayat ON laundry_transaksi_stok (faskes_uuid, lokasi_tipe, lokasi_uuid, jenis_linen_uuid, waktu_transaksi) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_transaksi_sumber ON laundry_transaksi_stok (faskes_uuid, sumber_tipe, waktu_transaksi) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_penerimaan_faskes_waktu ON laundry_penerimaan (faskes_uuid, status, waktu_serah) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_penerimaan_rincian_induk ON laundry_penerimaan_rincian (penerimaan_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_batch_faskes_waktu ON laundry_batch (faskes_uuid, status, waktu_mulai) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_batch_asal_rincian ON laundry_batch_asal (rincian_penerimaan_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_batch_asal_batch ON laundry_batch_asal (batch_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_permintaan_faskes_waktu ON laundry_permintaan (faskes_uuid, status, waktu_permintaan) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_permintaan_rincian_induk ON laundry_permintaan_rincian (permintaan_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_distribusi_faskes_waktu ON laundry_distribusi (faskes_uuid, status, waktu_kirim) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_distribusi_rincian_induk ON laundry_distribusi_rincian (distribusi_uuid) WHERE deleted_at IS NULL`,
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of [...tabel, ...indeks]) await queryInterface.sequelize.query(sql, { transaction });
      await sinkronKatalog(queryInterface, transaction);
    });
  },

  async down() {
    // Tabel transaksi Laundry tidak dihapus (riwayat stok = jejak audit). Katalog mengikuti JSON; kembalikan JSON
    // lalu jalankan migrasi sinkron baru.
  },
};
