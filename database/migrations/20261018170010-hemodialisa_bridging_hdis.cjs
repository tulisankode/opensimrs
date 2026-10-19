'use strict';

// Bridging HDIS (Hemodialysis Information System) per faskes (STD-0033, fitur hd_bridging_hdis): koneksi (URL penerima
// jadwal, API key keluar & kunci masuk terenkripsi — penunjang-service/src/hemodialisa/hdis/kripto.js; hanya hash
// kunci masuk yang dicari), pemetaan mesin HD → kode mesin HDIS per koneksi, dan log pesan masuk/keluar yang
// idempoten (satu baris per koneksi + arah + kunci idempoten; percobaan ulang menambah `percobaan`, bukan baris baru).
// Idempoten (IF NOT EXISTS).

const audit = `created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  updated_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now())::bigint),
  deleted_at bigint`;

const perintah = [
  `CREATE TABLE IF NOT EXISTS hd_hdis_koneksi (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, nama varchar(120) NOT NULL, url_jadwal varchar(500) NOT NULL,
    api_key text, kunci_masuk text, kunci_masuk_hash varchar(64), aktif boolean NOT NULL DEFAULT true, bawaan boolean NOT NULL DEFAULT false,
    diubah_oleh varchar(120), ${audit})`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_hdis_koneksi_kunci_uq ON hd_hdis_koneksi (kunci_masuk_hash) WHERE kunci_masuk_hash IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_hdis_koneksi_bawaan_uq ON hd_hdis_koneksi (faskes_uuid) WHERE bawaan = true AND deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS hd_hdis_koneksi_faskes_idx ON hd_hdis_koneksi (faskes_uuid) WHERE deleted_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS hd_hdis_peta_mesin (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, koneksi_uuid varchar(255) NOT NULL REFERENCES hd_hdis_koneksi(uuid),
    mesin_uuid varchar(255) NOT NULL REFERENCES hd_mesin(uuid), kode_mesin_hdis varchar(60) NOT NULL, diubah_oleh varchar(120), ${audit})`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_hdis_peta_mesin_uq ON hd_hdis_peta_mesin (koneksi_uuid, mesin_uuid) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_hdis_peta_kode_uq ON hd_hdis_peta_mesin (koneksi_uuid, lower(kode_mesin_hdis)) WHERE deleted_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS hd_hdis_pesan (
    uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, koneksi_uuid varchar(255) NOT NULL REFERENCES hd_hdis_koneksi(uuid),
    arah varchar(10) NOT NULL CHECK (arah IN ('masuk','keluar')), jenis varchar(12) NOT NULL CHECK (jenis IN ('jadwal','parameter')),
    kunci_idempoten varchar(200) NOT NULL, jadwal_uuid varchar(255) REFERENCES hd_jadwal(uuid), sesi_uuid varchar(255) REFERENCES hd_sesi(uuid),
    observasi_uuid varchar(255),
    status varchar(20) NOT NULL CHECK (status IN ('sedang_dikirim','terkirim','gagal','tidak_pasti','diterapkan','ditolak')),
    percobaan integer NOT NULL DEFAULT 1, payload jsonb, pesan text, status_http integer, pengguna varchar(120), ${audit})`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hd_hdis_pesan_kunci_uq ON hd_hdis_pesan (koneksi_uuid, arah, kunci_idempoten)`,
  `CREATE INDEX IF NOT EXISTS hd_hdis_pesan_faskes_idx ON hd_hdis_pesan (faskes_uuid, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS hd_hdis_pesan_jadwal_idx ON hd_hdis_pesan (jadwal_uuid)`,
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const sql of perintah) await queryInterface.sequelize.query(sql, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS hd_hdis_pesan, hd_hdis_peta_mesin, hd_hdis_koneksi CASCADE');
  },
};
