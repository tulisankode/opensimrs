'use strict';

// Modul Unit Hemodialisa (STD-0033, penunjang-service/src/hemodialisa): datamaster mesin & shift, aturan batas pemakaian
// dializer per item BHP, registrasi HD akut/kronis, jadwal per mesin/shift/tanggal (satu kali/rutin), resep HD
// (draft → sah), sesi (asesmen pra-HD → berjalan → selesai), observasi intradialitik (manual/HDIS, koreksi beraudit via
// revisi_dari), adekuasi (Kt/V & URR), dializer per pasien (reuse terbatas), dan pemakaian dializer/BHP per sesi.
// Idempoten (IF NOT EXISTS). Tabel bridging HDIS di 20261018170010, katalog di 20261018170020, izin di 20261018170030.
// Kolom *_oleh / petugas berisi username (JWT tidak memuat uuid pengguna), sama seperti modul Sarpras/Laundry.

const audit = `created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  updated_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  deleted_at bigint`;

const tabel = [
  `CREATE TABLE IF NOT EXISTS hd_mesin (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, kode varchar(40) NOT NULL, nama varchar(120) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','perawatan','nonaktif')), keterangan text, ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_shift (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, kode varchar(40) NOT NULL, nama varchar(100) NOT NULL,
    jam_mulai time NOT NULL, jam_selesai time NOT NULL, urutan integer NOT NULL DEFAULT 0, aktif boolean NOT NULL DEFAULT true, ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_dializer_aturan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, item_medis_uuid varchar(255) NOT NULL REFERENCES item_medis(uuid),
    pemakaian_maksimal integer NOT NULL CHECK (pemakaian_maksimal >= 1), dasar_kebijakan text, diubah_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_registrasi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, patient_uuid varchar(255) NOT NULL REFERENCES patients(uuid),
    no_reg_hd varchar(60) NOT NULL, jenis varchar(12) NOT NULL CHECK (jenis IN ('akut','kronis')), no_reg varchar(255),
    payment_method integer, status varchar(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','nonaktif')), catatan text,
    alasan_nonaktif text, dibuat_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_jadwal (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, registrasi_uuid varchar(255) NOT NULL REFERENCES hd_registrasi(uuid),
    mesin_uuid varchar(255) NOT NULL REFERENCES hd_mesin(uuid), shift_uuid varchar(255) NOT NULL REFERENCES hd_shift(uuid),
    tanggal date NOT NULL, pola varchar(12) NOT NULL CHECK (pola IN ('rutin','satu_kali')), rencana_uuid varchar(255), no_reg varchar(255), versi integer NOT NULL DEFAULT 1,
    status varchar(20) NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('terjadwal','hadir','berjalan','selesai','batal')),
    catatan text, hadir_pada bigint, alasan_batal text, dibatalkan_oleh varchar(120), dibuat_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_resep (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, registrasi_uuid varchar(255) NOT NULL REFERENCES hd_registrasi(uuid),
    durasi_menit integer NOT NULL CHECK (durasi_menit > 0), qb_ml_menit numeric(8,2) NOT NULL CHECK (qb_ml_menit > 0),
    qd_ml_menit numeric(8,2) NOT NULL CHECK (qd_ml_menit > 0), uf_goal_ml numeric(8,1) NOT NULL CHECK (uf_goal_ml >= 0),
    antikoagulan text NOT NULL, dialisat text NOT NULL, akses_vaskular text NOT NULL, catatan text,
    status varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sah','nonaktif')),
    dibuat_oleh varchar(120), disahkan_oleh varchar(120), disahkan_pada bigint, ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_sesi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, jadwal_uuid varchar(255) NOT NULL REFERENCES hd_jadwal(uuid),
    resep_uuid varchar(255) NOT NULL REFERENCES hd_resep(uuid),
    status varchar(20) NOT NULL DEFAULT 'asesmen' CHECK (status IN ('asesmen','berjalan','selesai','batal')),
    asesmen_pra jsonb, asesmen_oleh varchar(120), asesmen_pada bigint, mulai_pada bigint, selesai_pada bigint, catatan_pasca jsonb,
    dibuka_oleh varchar(120), dimulai_oleh varchar(120), ditutup_oleh varchar(120), alasan_batal text,
    status_tagihan varchar(12) NOT NULL DEFAULT 'belum' CHECK (status_tagihan IN ('belum','terkirim','gagal','tertunda')),
    pesan_tagihan text, ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_observasi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, sesi_uuid varchar(255) NOT NULL REFERENCES hd_sesi(uuid),
    waktu_pengukuran bigint NOT NULL, parameter jsonb NOT NULL, keluhan text, komplikasi jsonb NOT NULL DEFAULT '[]'::jsonb, tindakan text,
    sumber varchar(10) NOT NULL CHECK (sumber IN ('manual','hdis')), dicatat_oleh varchar(120), koneksi_uuid varchar(255),
    kunci_idempoten varchar(200), perlu_tinjau boolean NOT NULL DEFAULT false, revisi_dari varchar(255) REFERENCES hd_observasi(uuid),
    alasan_koreksi text, digantikan boolean NOT NULL DEFAULT false, ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_adekuasi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, sesi_uuid varchar(255) NOT NULL REFERENCES hd_sesi(uuid),
    metode varchar(120), input jsonb, kt_v numeric(5,2), urr numeric(5,2),
    status varchar(20) NOT NULL CHECK (status IN ('tersedia','belum_tersedia')), alasan text, riwayat jsonb NOT NULL DEFAULT '[]'::jsonb,
    dihitung_oleh varchar(120), dihitung_pada bigint, ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_dializer (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, registrasi_uuid varchar(255) NOT NULL REFERENCES hd_registrasi(uuid),
    item_medis_uuid varchar(255) NOT NULL REFERENCES item_medis(uuid), serial varchar(100) NOT NULL,
    pemakaian_maksimal integer NOT NULL CHECK (pemakaian_maksimal >= 1),
    jumlah_pakai integer NOT NULL DEFAULT 0 CHECK (jumlah_pakai >= 0 AND jumlah_pakai <= pemakaian_maksimal),
    status varchar(12) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','berhenti')), alasan_berhenti text, dibuat_oleh varchar(120), ${audit})`,
  `CREATE TABLE IF NOT EXISTS hd_pemakaian (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, sesi_uuid varchar(255) NOT NULL REFERENCES hd_sesi(uuid),
    jenis varchar(12) NOT NULL CHECK (jenis IN ('dializer','bhp')), dializer_uuid varchar(255) REFERENCES hd_dializer(uuid),
    item_medis_uuid varchar(255) REFERENCES item_medis(uuid), nama_item varchar(255), qty integer NOT NULL CHECK (qty > 0),
    pemakaian_ke integer, lokasi_stok_uuid varchar(255), harga_satuan numeric(14,2), order_alkes_uuid varchar(255),
    status_stok varchar(12) NOT NULL CHECK (status_stok IN ('diorder','reuse')),
    status_tagihan varchar(12) NOT NULL DEFAULT 'belum' CHECK (status_tagihan IN ('belum','terkirim','gagal','tanpa_biaya')), pesan_tagihan text,
    petugas varchar(120), ${audit},
    CHECK ((jenis = 'dializer' AND dializer_uuid IS NOT NULL) OR (jenis = 'bhp' AND dializer_uuid IS NULL)))`,
];

const indeks = [
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_mesin_kode_uq ON hd_mesin (faskes_uuid, lower(kode)) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_shift_kode_uq ON hd_shift (faskes_uuid, lower(kode)) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_dializer_aturan_item_uq ON hd_dializer_aturan (faskes_uuid, item_medis_uuid) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_registrasi_nomor_uq ON hd_registrasi (faskes_uuid, no_reg_hd)`,
  // Satu registrasi aktif per pasien per faskes (jenis akut/kronis diubah lewat registrasi yang sama).
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_registrasi_pasien_aktif_uq ON hd_registrasi (faskes_uuid, patient_uuid) WHERE status = 'aktif' AND deleted_at IS NULL`,
  // Cegah bentrok kapasitas: satu mesin hanya satu pasien per shift per tanggal; satu pasien tidak dijadwalkan dua kali di shift yang sama.
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_jadwal_slot_uq ON hd_jadwal (faskes_uuid, mesin_uuid, shift_uuid, tanggal) WHERE status <> 'batal' AND deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_jadwal_pasien_uq ON hd_jadwal (faskes_uuid, registrasi_uuid, shift_uuid, tanggal) WHERE status <> 'batal' AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS hd_jadwal_tanggal_idx ON hd_jadwal (faskes_uuid, tanggal) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS hd_resep_registrasi_idx ON hd_resep (registrasi_uuid, status) WHERE deleted_at IS NULL`,
  // Satu sesi klinis per jadwal (kecuali yang dibatalkan).
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_sesi_jadwal_uq ON hd_sesi (jadwal_uuid) WHERE status <> 'batal' AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS hd_sesi_faskes_status_idx ON hd_sesi (faskes_uuid, status, selesai_pada) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS hd_observasi_sesi_waktu_idx ON hd_observasi (faskes_uuid, sesi_uuid, waktu_pengukuran) WHERE deleted_at IS NULL`,
  // Idempotensi data HDIS: satu kunci per koneksi tidak pernah membuat observasi kedua.
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_observasi_idempoten_uq ON hd_observasi (koneksi_uuid, kunci_idempoten) WHERE kunci_idempoten IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_adekuasi_sesi_uq ON hd_adekuasi (sesi_uuid) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_dializer_serial_uq ON hd_dializer (faskes_uuid, lower(serial)) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS hd_dializer_registrasi_idx ON hd_dializer (registrasi_uuid) WHERE deleted_at IS NULL`,
  // Satu dializer dipakai paling banyak sekali per sesi.
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_pemakaian_dializer_sesi_uq ON hd_pemakaian (sesi_uuid, dializer_uuid) WHERE jenis = 'dializer' AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS hd_pemakaian_sesi_idx ON hd_pemakaian (sesi_uuid) WHERE deleted_at IS NULL`,
];

const urutanHapus = ['hd_pemakaian', 'hd_dializer', 'hd_adekuasi', 'hd_observasi', 'hd_sesi', 'hd_resep', 'hd_jadwal', 'hd_registrasi', 'hd_dializer_aturan', 'hd_shift', 'hd_mesin'];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of [...tabel, ...indeks]) await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down(queryInterface) {
    for (const nama of urutanHapus) await queryInterface.sequelize.query(`DROP TABLE IF EXISTS ${nama} CASCADE`);
  },
};
