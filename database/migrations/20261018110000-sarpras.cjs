'use strict';

// Modul Sarana dan Prasarana / IPSRS (STD-0022, penunjang-service/src/sarpras): register aset & riwayat, laporan
// kerusakan (work order) + suku cadang, jadwal & pelaksanaan pemeliharaan preventif, kalibrasi + sertifikat, berkas
// (foto kerusakan/sertifikat, BYTEA), pengaturan ambang kalibrasi, dan catatan meter utilitas. Idempoten
// (IF NOT EXISTS). Katalog modul disinkronkan migrasi 20261018110010, izin di 20261018110020.
// Kolom *_oleh / pelapor / pengguna berisi username (JWT tidak memuat uuid pengguna), sama seperti modul Laundry.

const audit = `created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  updated_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  deleted_at bigint`;

const tabel = [
  `CREATE TABLE IF NOT EXISTS sarpras_aset (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, kode_inventaris varchar(50) NOT NULL,
    kategori varchar(20) NOT NULL CHECK (kategori IN ('alat_medis','non_medis','gedung_utilitas','kendaraan')),
    nama varchar(255) NOT NULL, lokasi_uuid varchar(255) NOT NULL REFERENCES lokasi(uuid),
    merek varchar(100), tipe varchar(100), nomor_seri varchar(100), tahun_perolehan integer, nilai_perolehan numeric(16,2) CHECK (nilai_perolehan >= 0),
    status varchar(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','rusak','dalam_perbaikan','dihapuskan')),
    penanggung_jawab_uuid varchar(255), wajib_kalibrasi boolean NOT NULL DEFAULT false, keterangan text,
    alasan_dihapuskan text, dihapuskan_oleh varchar(120), dihapuskan_pada bigint, dibuat_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS sarpras_riwayat_aset (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, aset_uuid varchar(255) NOT NULL REFERENCES sarpras_aset(uuid),
    jenis_peristiwa varchar(50) NOT NULL, data_perubahan jsonb, pengguna varchar(120), waktu_peristiwa bigint NOT NULL, ${audit})`,
  `CREATE TABLE IF NOT EXISTS sarpras_jadwal_pemeliharaan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, aset_uuid varchar(255) NOT NULL REFERENCES sarpras_aset(uuid),
    frekuensi varchar(20) NOT NULL CHECK (frekuensi IN ('harian','mingguan','bulanan','tahunan')), checklist jsonb NOT NULL,
    tanggal_berikutnya bigint NOT NULL, status varchar(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','nonaktif')),
    alasan_nonaktif text, dinonaktifkan_oleh varchar(120), dinonaktifkan_pada bigint, dibuat_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS sarpras_pelaksanaan_pemeliharaan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL,
    jadwal_uuid varchar(255) NOT NULL REFERENCES sarpras_jadwal_pemeliharaan(uuid), aset_uuid varchar(255) NOT NULL REFERENCES sarpras_aset(uuid),
    checklist_hasil jsonb, waktu_mulai bigint NOT NULL, waktu_selesai bigint, hasil text, catatan text, biaya numeric(14,2) CHECK (biaya >= 0),
    pelaksana_uuid varchar(255), dicatat_oleh varchar(120), jatuh_tempo bigint, terlambat boolean NOT NULL DEFAULT false, ${audit})`,
  `CREATE TABLE IF NOT EXISTS sarpras_laporan_kerusakan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, nomor_laporan varchar(50) NOT NULL,
    aset_uuid varchar(255) NOT NULL REFERENCES sarpras_aset(uuid), lokasi_kejadian_uuid varchar(255) REFERENCES lokasi(uuid),
    uraian text NOT NULL, prioritas varchar(20) NOT NULL CHECK (prioritas IN ('darurat','tinggi','sedang','rendah')),
    status varchar(30) NOT NULL DEFAULT 'baru' CHECK (status IN ('baru','diproses','menunggu_suku_cadang','selesai','tidak_dapat_diperbaiki')),
    pelapor varchar(120), pelapor_nama varchar(255), waktu_laporan bigint NOT NULL,
    teknisi_uuid varchar(255), waktu_penugasan bigint, ditugaskan_oleh varchar(120),
    tindakan text, hasil text, alasan_tidak_dapat_diperbaiki text, biaya numeric(14,2) CHECK (biaya >= 0),
    waktu_selesai bigint, ditutup_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS sarpras_suku_cadang (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, laporan_uuid varchar(255) NOT NULL REFERENCES sarpras_laporan_kerusakan(uuid),
    item_uuid varchar(255), nama_barang varchar(255) NOT NULL, jumlah numeric(10,2) NOT NULL CHECK (jumlah > 0), biaya numeric(14,2) CHECK (biaya >= 0),
    lokasi_stok_uuid varchar(255), jenis_stok_uuid varchar(255), referensi_transaksi_inventory varchar(255), dicatat_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS sarpras_kalibrasi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, aset_uuid varchar(255) NOT NULL REFERENCES sarpras_aset(uuid),
    lembaga_penguji varchar(255), tanggal_jadwal bigint, tanggal_kalibrasi bigint,
    hasil varchar(20) CHECK (hasil IN ('lulus','tidak_lulus','perlu_tindak_lanjut')),
    nomor_sertifikat varchar(100), tanggal_berlaku bigint, catatan_tindak_lanjut text, dicatat_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS sarpras_berkas (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL,
    jenis_berkas varchar(30) NOT NULL CHECK (jenis_berkas IN ('foto_kerusakan','sertifikat_kalibrasi')),
    laporan_uuid varchar(255) REFERENCES sarpras_laporan_kerusakan(uuid), kalibrasi_uuid varchar(255) REFERENCES sarpras_kalibrasi(uuid),
    nama_berkas varchar(255) NOT NULL, tipe_mime varchar(100) NOT NULL, ukuran_bita integer NOT NULL CHECK (ukuran_bita > 0),
    data bytea NOT NULL, diunggah_oleh varchar(120), ${audit},
    CHECK ((jenis_berkas = 'foto_kerusakan' AND laporan_uuid IS NOT NULL AND kalibrasi_uuid IS NULL)
        OR (jenis_berkas = 'sertifikat_kalibrasi' AND kalibrasi_uuid IS NOT NULL AND laporan_uuid IS NULL)))`,
  `CREATE TABLE IF NOT EXISTS sarpras_pengaturan (
    faskes_uuid varchar(255) PRIMARY KEY, ambang_kalibrasi_hari integer NOT NULL DEFAULT 30 CHECK (ambang_kalibrasi_hari > 0),
    diubah_oleh varchar(120),
    created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint), updated_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint))`,
  `CREATE TABLE IF NOT EXISTS sarpras_utilitas_catatan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, lokasi_uuid varchar(255) NOT NULL REFERENCES lokasi(uuid),
    jenis_utilitas varchar(30) NOT NULL CHECK (jenis_utilitas IN ('listrik','air','genset','oksigen_sentral')),
    waktu_catat bigint NOT NULL, nilai_meter numeric(14,2) NOT NULL CHECK (nilai_meter >= 0), satuan varchar(20) NOT NULL,
    catatan text, dicatat_oleh varchar(120), ${audit})`,
];

const indeks = [
  `CREATE UNIQUE INDEX IF NOT EXISTS sarpras_aset_kode_uq ON sarpras_aset (faskes_uuid, lower(kode_inventaris)) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_aset_status_idx ON sarpras_aset (faskes_uuid, status) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_aset_lokasi_idx ON sarpras_aset (lokasi_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_aset_wajib_kalibrasi_idx ON sarpras_aset (faskes_uuid) WHERE deleted_at IS NULL AND wajib_kalibrasi = true`,
  `CREATE INDEX IF NOT EXISTS sarpras_riwayat_aset_aset_idx ON sarpras_riwayat_aset (aset_uuid, waktu_peristiwa DESC)`,
  `CREATE INDEX IF NOT EXISTS sarpras_jadwal_pemeliharaan_jatuh_tempo_idx ON sarpras_jadwal_pemeliharaan (faskes_uuid, tanggal_berikutnya) WHERE status = 'aktif' AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_jadwal_pemeliharaan_aset_idx ON sarpras_jadwal_pemeliharaan (aset_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_pelaksanaan_pemeliharaan_jadwal_idx ON sarpras_pelaksanaan_pemeliharaan (jadwal_uuid, waktu_mulai) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_pelaksanaan_pemeliharaan_waktu_idx ON sarpras_pelaksanaan_pemeliharaan (faskes_uuid, waktu_mulai) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sarpras_laporan_nomor_uq ON sarpras_laporan_kerusakan (faskes_uuid, nomor_laporan) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_laporan_status_idx ON sarpras_laporan_kerusakan (faskes_uuid, status) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_laporan_aset_idx ON sarpras_laporan_kerusakan (aset_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_laporan_waktu_idx ON sarpras_laporan_kerusakan (faskes_uuid, waktu_laporan)`,
  `CREATE INDEX IF NOT EXISTS sarpras_suku_cadang_laporan_idx ON sarpras_suku_cadang (laporan_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_kalibrasi_aset_idx ON sarpras_kalibrasi (aset_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_kalibrasi_jatuh_tempo_idx ON sarpras_kalibrasi (faskes_uuid, tanggal_berlaku) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_berkas_laporan_idx ON sarpras_berkas (laporan_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_berkas_kalibrasi_idx ON sarpras_berkas (kalibrasi_uuid) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS sarpras_utilitas_catatan_idx ON sarpras_utilitas_catatan (faskes_uuid, lokasi_uuid, waktu_catat) WHERE deleted_at IS NULL`,
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of [...tabel, ...indeks]) await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS sarpras_utilitas_catatan, sarpras_pengaturan, sarpras_berkas, sarpras_kalibrasi, sarpras_suku_cadang,
         sarpras_laporan_kerusakan, sarpras_pelaksanaan_pemeliharaan, sarpras_jadwal_pemeliharaan, sarpras_riwayat_aset, sarpras_aset`,
    );
  },
};
