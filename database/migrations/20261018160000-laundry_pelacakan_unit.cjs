'use strict';

// Pelacakan per unit linen dengan QR/barcode (STD-0030, penunjang-service), lanjutan modul Laundry & Linen
// (20261018090000-laundry). Hibrida dengan buku stok jumlah: jenis linen bertanda cara_pencatatan "per_unit" tetap
// dihitung di laundry_transaksi_stok yang sama — setiap unit yang dipindai pada serah terima, batch, distribusi, dan
// penerimaan ruangan menggerakkan buku stok tepat satu lembar (tanpa dobel). Jenis lama tetap "per_jumlah" (tidak ada
// konversi otomatis saldo lama). Idempoten (IF NOT EXISTS).
//
//   laundry_unit           satu baris per lembar linen: kode unik per faskes, status, siklus cuci, posisi terakhir
//                          (lokasi_tipe + lokasi_uuid + dokumen/rincian alur yang sedang memegang unit)
//   laundry_unit_pengenal  nilai yang dibaca pemindai → unit (QR/barcode sekarang; siap RFID nanti tanpa ubah skema)
//   laundry_unit_riwayat   jejak perjalanan & perubahan status per unit (tidak pernah dihapus/ditimpa)
//   laundry_unit_lokasi    riwayat tautan opsional unit ↔ bed/kamar (tanpa identitas pasien)
const audit = `created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  updated_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  deleted_at bigint`;

const kolom = [
  `ALTER TABLE laundry_jenis_linen ADD COLUMN IF NOT EXISTS cara_pencatatan varchar(20) NOT NULL DEFAULT 'per_jumlah'
     CHECK (cara_pencatatan IN ('per_jumlah','per_unit'))`,
  `ALTER TABLE laundry_jenis_linen ADD COLUMN IF NOT EXISTS batas_siklus integer CHECK (batas_siklus IS NULL OR batas_siklus > 0)`,
  `ALTER TABLE laundry_jenis_linen ADD COLUMN IF NOT EXISTS peringatan_siklus integer CHECK (peringatan_siklus IS NULL OR peringatan_siklus > 0)`,
];

// lokasi_tipe unit: ruangan (lokasi_uuid = ruangan) · serah_kotor (diserahkan, menunggu konfirmasi laundry) · kotor
// (antrean cuci) · batch (dokumen_uuid = batch) · laundry (stok bersih, lokasi_uuid NULL) · dalam_perjalanan
// (distribusi menunggu konfirmasi ruangan tujuan). Selain "laundry", lokasi_uuid = ruangan terakhir yang terkait.
const tabel = [
  `CREATE TABLE IF NOT EXISTS laundry_unit (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, jenis_linen_uuid varchar(255) NOT NULL, kode_unit varchar(60) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','rusak','hilang','dimusnahkan')),
    siklus_cuci integer NOT NULL DEFAULT 0 CHECK (siklus_cuci >= 0),
    lokasi_tipe varchar(20) NOT NULL CHECK (lokasi_tipe IN ('ruangan','serah_kotor','kotor','batch','laundry','dalam_perjalanan')),
    lokasi_uuid varchar(255), dokumen_uuid varchar(255), rincian_uuid varchar(255), bed_uuid varchar(255), kamar_uuid varchar(255),
    waktu_registrasi bigint NOT NULL, waktu_cuci_terakhir bigint, waktu_status bigint, alasan_status text, ${audit},
    CHECK (lokasi_tipe = 'laundry' OR lokasi_uuid IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS laundry_unit_pengenal (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, unit_uuid varchar(255) NOT NULL,
    jenis_pengenal varchar(20) NOT NULL CHECK (jenis_pengenal IN ('qr','barcode','rfid')), nilai varchar(160) NOT NULL,
    aktif boolean NOT NULL DEFAULT true, berlaku_mulai bigint NOT NULL, berlaku_sampai bigint, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_unit_riwayat (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, unit_uuid varchar(255) NOT NULL, peristiwa varchar(40) NOT NULL,
    dokumen_tipe varchar(30), dokumen_uuid varchar(255),
    lokasi_tipe_sebelum varchar(20), lokasi_uuid_sebelum varchar(255), lokasi_tipe_sesudah varchar(20), lokasi_uuid_sesudah varchar(255),
    status_sebelum varchar(20), status_sesudah varchar(20), siklus_sesudah integer, bed_uuid varchar(255),
    alasan text, pelaku_uuid varchar(120), waktu bigint NOT NULL, ${audit})`,
  `CREATE TABLE IF NOT EXISTS laundry_unit_lokasi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, unit_uuid varchar(255) NOT NULL, lokasi_uuid varchar(255) NOT NULL,
    bed_uuid varchar(255), kamar_uuid varchar(255), waktu_mulai bigint NOT NULL, waktu_selesai bigint, pelaku_uuid varchar(120), alasan text, ${audit})`,
];

const indeks = [
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_unit_kode_aktif ON laundry_unit (faskes_uuid, upper(kode_unit)) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_unit_posisi ON laundry_unit (faskes_uuid, jenis_linen_uuid, lokasi_tipe, lokasi_uuid, status) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_unit_dokumen ON laundry_unit (faskes_uuid, dokumen_uuid) WHERE deleted_at IS NULL AND dokumen_uuid IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_unit_rincian ON laundry_unit (faskes_uuid, rincian_uuid) WHERE deleted_at IS NULL AND rincian_uuid IS NOT NULL`,
  // Satu nilai pindai aktif = satu unit per faskes (lintas jenis pengenal agar hasil pindai tidak ambigu).
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_unit_pengenal_aktif ON laundry_unit_pengenal (faskes_uuid, upper(nilai)) WHERE aktif AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_unit_pengenal_unit ON laundry_unit_pengenal (unit_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_unit_riwayat_unit ON laundry_unit_riwayat (faskes_uuid, unit_uuid, waktu) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_unit_riwayat_waktu ON laundry_unit_riwayat (faskes_uuid, waktu, peristiwa) WHERE deleted_at IS NULL`,
  // Siklus cuci bertambah tepat sekali per unit per batch (pengaman tingkat DB di samping kunci baris batch).
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_unit_siklus_batch ON laundry_unit_riwayat (faskes_uuid, unit_uuid, dokumen_uuid)
     WHERE peristiwa = 'selesai_cuci' AND deleted_at IS NULL`,
  // Satu tautan bed/kamar berjalan per unit.
  `CREATE UNIQUE INDEX IF NOT EXISTS laundry_unit_lokasi_berjalan ON laundry_unit_lokasi (faskes_uuid, unit_uuid) WHERE waktu_selesai IS NULL AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS laundry_unit_lokasi_bed ON laundry_unit_lokasi (faskes_uuid, bed_uuid, waktu_mulai) WHERE deleted_at IS NULL`,
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of [...kolom, ...tabel, ...indeks]) await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down() {
    // Tabel unit & riwayat tidak dihapus (jejak audit perjalanan linen), sama dengan 20261018090000-laundry.
  },
};
