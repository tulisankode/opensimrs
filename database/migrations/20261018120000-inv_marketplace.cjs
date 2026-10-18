'use strict';

// STD-0019 — Pembelian BMHP via marketplace mitra dari Gudang & Pengadaan. Fitur katalog "inv_marketplace"
// (modul inventory, mati bawaan di semua segmen — lihat 20261018120100-sinkron_katalog_inv_marketplace; izin submodul di 20261018120200-izin_inv_marketplace).
// Tabel baru (semua berkolom faskes_uuid, waktu epoch detik, dan soft delete bila relevan):
// - inventory_marketplace_koneksi    : konfigurasi koneksi mitra per faskes. Kunci API & kunci masuk webhook
//                                      disimpan terenkripsi oleh inventory-service/src/helpers/rahasia-marketplace.js
//                                      (pola sama dengan lab-service/src/lis/rahasia.js).
// - inventory_marketplace_pemetaan   : pemetaan produk mitra -> master barang (item_medis) & satuan pembelian.
// - inventory_marketplace_pesanan    : permintaan/pesanan internal (persetujuan -> checkout -> status mitra).
//                                      pembelian_barang_supplier_uuid ditautkan saat checkout berhasil agar
//                                      penerimaan memakai alur Penerimaan Pembelian (PO) yang sudah ada, bukan
//                                      alur tersendiri (lihat inventory-service/src/services/marketplace-service.js).
// - inventory_marketplace_pesanan_item : snapshot item & penawaran yang menjadi dasar persetujuan.
// - inventory_marketplace_persetujuan  : jejak persetujuan berjenjang (pola sama dengan verifikasi PO).
// - inventory_marketplace_peristiwa    : jejak pembaruan status (webhook/tarik) untuk idempotensi & audit.
// - inventory_marketplace_tagihan      : catatan tagihan mitra untuk keuangan (bukan bukti pembayaran).
// Status/enum disimpan sebagai VARCHAR + CHECK (bukan tipe ENUM Postgres) agar migrasi tidak bergantung pada nama
// tipe enum yang biasanya dibuat otomatis oleh Sequelize sync().
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS inventory_marketplace_koneksi (
          id SERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          mitra_kode VARCHAR(50) NOT NULL,
          nama_mitra VARCHAR(255) NOT NULL,
          base_url VARCHAR(255) NOT NULL,
          akun_afiliasi VARCHAR(255),
          supplier_uuid VARCHAR(255) NOT NULL REFERENCES master_supplier (uuid) ON UPDATE CASCADE,
          api_key_enc TEXT,
          kunci_masuk_enc TEXT,
          mode_mock BOOLEAN NOT NULL DEFAULT true,
          aktif BOOLEAN NOT NULL DEFAULT false,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS inv_mp_koneksi_faskes_mitra_uq
          ON inventory_marketplace_koneksi (faskes_uuid, mitra_kode) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS inv_mp_koneksi_faskes_idx ON inventory_marketplace_koneksi (faskes_uuid);

        CREATE TABLE IF NOT EXISTS inventory_marketplace_pemetaan (
          id SERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          mitra_kode VARCHAR(50) NOT NULL,
          produk_mitra_id VARCHAR(100) NOT NULL,
          nama_produk_mitra VARCHAR(255),
          kemasan_mitra VARCHAR(100),
          item_uuid VARCHAR(255) NOT NULL,
          satuan_uuid VARCHAR(255) NOT NULL,
          konversi_uuid VARCHAR(255),
          konversi FLOAT,
          aktif BOOLEAN NOT NULL DEFAULT true,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS inv_mp_pemetaan_produk_uq
          ON inventory_marketplace_pemetaan (faskes_uuid, mitra_kode, produk_mitra_id) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS inv_mp_pemetaan_faskes_idx ON inventory_marketplace_pemetaan (faskes_uuid);

        CREATE TABLE IF NOT EXISTS inventory_marketplace_pesanan (
          id SERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          mitra_kode VARCHAR(50) NOT NULL,
          nomor_internal VARCHAR(50) NOT NULL,
          nomor_pesanan_mitra VARCHAR(100),
          pemohon_uuid VARCHAR(255) NOT NULL,
          pemohon_nama VARCHAR(255),
          jenis_stok_uuid VARCHAR(255) NOT NULL REFERENCES jenis_stok (uuid) ON UPDATE CASCADE,
          lokasi_stok_uuid VARCHAR(255) NOT NULL REFERENCES lokasi_stok (uuid) ON UPDATE CASCADE,
          kategori_item VARCHAR(20) NOT NULL CHECK (kategori_item IN ('medis', 'non-medis')),
          jenis_item VARCHAR(20) NOT NULL CHECK (jenis_item IN ('obat', 'alkes')),
          metode_pembelian VARCHAR(20) NOT NULL CHECK (metode_pembelian IN ('tunai', 'kredit')),
          catatan VARCHAR(255),
          nilai_perkiraan DOUBLE PRECISION NOT NULL DEFAULT 0,
          status_persetujuan VARCHAR(20) NOT NULL DEFAULT 'menunggu'
            CHECK (status_persetujuan IN ('menunggu', 'disetujui', 'ditolak')),
          status_pesanan VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status_pesanan IN (
            'draft', 'menunggu_konfirmasi', 'dibayar', 'dikemas', 'dikirim',
            'diterima_sebagian', 'diterima', 'dibatalkan'
          )),
          alasan_batal VARCHAR(255),
          pembelian_barang_supplier_uuid VARCHAR(255),
          diajukan_pada BIGINT,
          checkout_pada BIGINT,
          sinkron_terakhir_pada BIGINT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS inv_mp_pesanan_nomor_uq
          ON inventory_marketplace_pesanan (faskes_uuid, nomor_internal);
        CREATE INDEX IF NOT EXISTS inv_mp_pesanan_faskes_idx
          ON inventory_marketplace_pesanan (faskes_uuid, status_pesanan) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS inventory_marketplace_pesanan_item (
          id SERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          pesanan_uuid VARCHAR(255) NOT NULL REFERENCES inventory_marketplace_pesanan (uuid),
          produk_mitra_id VARCHAR(100) NOT NULL,
          nama_produk_mitra VARCHAR(255),
          item_uuid VARCHAR(255) NOT NULL,
          satuan_uuid VARCHAR(255) NOT NULL,
          konversi_uuid VARCHAR(255),
          konversi FLOAT NOT NULL DEFAULT 1,
          jumlah INTEGER NOT NULL CHECK (jumlah > 0),
          harga_satuan DOUBLE PRECISION NOT NULL,
          total_harga DOUBLE PRECISION NOT NULL,
          stok_penawaran INTEGER,
          estimasi_kirim VARCHAR(100),
          penawaran_diambil_pada BIGINT,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE INDEX IF NOT EXISTS inv_mp_pesanan_item_pesanan_idx
          ON inventory_marketplace_pesanan_item (pesanan_uuid);

        CREATE TABLE IF NOT EXISTS inventory_marketplace_persetujuan (
          id SERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          pesanan_uuid VARCHAR(255) NOT NULL REFERENCES inventory_marketplace_pesanan (uuid),
          urutan INTEGER NOT NULL DEFAULT 1,
          pemberi_uuid VARCHAR(255) NOT NULL,
          pemberi_nama VARCHAR(255),
          keputusan VARCHAR(20) NOT NULL CHECK (keputusan IN ('setujui', 'tolak')),
          alasan VARCHAR(255),
          diputuskan_pada BIGINT NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS inv_mp_persetujuan_jenjang_uq
          ON inventory_marketplace_persetujuan (pesanan_uuid, urutan);

        CREATE TABLE IF NOT EXISTS inventory_marketplace_peristiwa (
          id SERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          pesanan_uuid VARCHAR(255) NOT NULL REFERENCES inventory_marketplace_pesanan (uuid),
          sumber VARCHAR(20) NOT NULL CHECK (sumber IN ('webhook', 'tarik')),
          peristiwa_mitra_id VARCHAR(100),
          status_mitra VARCHAR(50),
          status_lokal VARCHAR(50),
          valid BOOLEAN NOT NULL DEFAULT true,
          catatan VARCHAR(255),
          payload JSONB,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS inv_mp_peristiwa_dedup_uq
          ON inventory_marketplace_peristiwa (faskes_uuid, sumber, peristiwa_mitra_id) WHERE peristiwa_mitra_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS inv_mp_peristiwa_pesanan_idx ON inventory_marketplace_peristiwa (pesanan_uuid);

        CREATE TABLE IF NOT EXISTS inventory_marketplace_tagihan (
          id SERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          pesanan_uuid VARCHAR(255) NOT NULL REFERENCES inventory_marketplace_pesanan (uuid),
          referensi_tagihan VARCHAR(100),
          nilai DOUBLE PRECISION,
          tanggal BIGINT,
          status_dikonfirmasi VARCHAR(20) NOT NULL DEFAULT 'belum'
            CHECK (status_dikonfirmasi IN ('belum', 'sebagian', 'lunas')),
          metadata JSONB,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE INDEX IF NOT EXISTS inv_mp_tagihan_pesanan_idx ON inventory_marketplace_tagihan (pesanan_uuid);
      `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS inventory_marketplace_tagihan;
      DROP TABLE IF EXISTS inventory_marketplace_peristiwa;
      DROP TABLE IF EXISTS inventory_marketplace_persetujuan;
      DROP TABLE IF EXISTS inventory_marketplace_pesanan_item;
      DROP TABLE IF EXISTS inventory_marketplace_pesanan;
      DROP TABLE IF EXISTS inventory_marketplace_pemetaan;
      DROP TABLE IF EXISTS inventory_marketplace_koneksi;
    `);
  },
};
