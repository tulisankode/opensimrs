'use strict';

// Bridging LIS (adamLIS) untuk laboratorium:
// - lab_lis_koneksi : satu faskes boleh punya lebih dari satu LIS. API key keluar & kunci masuk disimpan
//                     terenkripsi oleh lab-service; kunci masuk juga disimpan sebagai hash untuk pencarian.
// - lab_lis_kirim   : registrasi order lab yang dikirim ke LIS (permintaan, respons, no. lab LIS)
// - lab_lis_hasil   : hasil yang dikirim LIS ke SIMRS (payload asli + ringkasan pemetaan)
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS lab_lis_koneksi (
        id                BIGSERIAL PRIMARY KEY,
        uuid              UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        faskes_uuid       VARCHAR(255) NOT NULL,
        nama              VARCHAR(100) NOT NULL,
        url_registrasi    VARCHAR(500) NOT NULL,
        api_key           TEXT,
        kode_rs           VARCHAR(50),
        kunci_masuk       TEXT,
        kunci_masuk_hash  VARCHAR(64) UNIQUE,
        aktif             BOOLEAN NOT NULL DEFAULT true,
        bawaan            BOOLEAN NOT NULL DEFAULT false,
        created_at        BIGINT NOT NULL,
        updated_at        BIGINT NOT NULL,
        deleted_at        BIGINT
      );
      CREATE INDEX IF NOT EXISTS lab_lis_koneksi_faskes_idx ON lab_lis_koneksi (faskes_uuid) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS lab_lis_kirim (
        id               BIGSERIAL PRIMARY KEY,
        uuid             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        faskes_uuid      VARCHAR(255) NOT NULL,
        koneksi_uuid     UUID NOT NULL,
        order_lab_uuid   VARCHAR(255) NOT NULL,
        no_registrasi    VARCHAR(100) NOT NULL,     -- nomor yang dikirim ke LIS (no. order lab)
        lis_no_lab       VARCHAR(100),              -- payload.registrasi.no_lab dari LIS
        lis_no_registrasi VARCHAR(100),             -- payload.registrasi.no_registrasi dari LIS
        status           VARCHAR(20) NOT NULL,      -- terkirim | gagal
        pesan            TEXT,
        permintaan       JSONB,
        respons          JSONB,
        percobaan        INT NOT NULL DEFAULT 1,
        dikirim_oleh     VARCHAR(255),
        created_at       BIGINT NOT NULL,
        updated_at       BIGINT NOT NULL,
        CONSTRAINT lab_lis_kirim_unik UNIQUE (faskes_uuid, order_lab_uuid, koneksi_uuid)
      );
      CREATE INDEX IF NOT EXISTS lab_lis_kirim_noreg_idx ON lab_lis_kirim (faskes_uuid, no_registrasi);

      CREATE TABLE IF NOT EXISTS lab_lis_hasil (
        id               BIGSERIAL PRIMARY KEY,
        uuid             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        faskes_uuid      VARCHAR(255),
        koneksi_uuid     UUID,
        order_lab_uuid   VARCHAR(255),
        no_registrasi    VARCHAR(100),
        no_laboratorium  VARCHAR(100),
        status           VARCHAR(20) NOT NULL,      -- diterima | sebagian | gagal
        pesan            TEXT,
        jumlah_hasil     INT NOT NULL DEFAULT 0,
        jumlah_terpetakan INT NOT NULL DEFAULT 0,
        tidak_terpetakan JSONB,
        payload          JSONB,
        created_at       BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS lab_lis_hasil_order_idx ON lab_lis_hasil (faskes_uuid, order_lab_uuid);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS lab_lis_hasil;
      DROP TABLE IF EXISTS lab_lis_kirim;
      DROP TABLE IF EXISTS lab_lis_koneksi;
    `);
  },
};
