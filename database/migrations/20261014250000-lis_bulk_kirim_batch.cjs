'use strict';

// Kirim order lab ke LIS secara massal (bulk), mis. peserta MCU:
// - lab_lis_koneksi : mode kirim per koneksi — 'per_order' (satu request per order, maks_paralel request bersamaan)
//                     atau 'bulk' (array registrasi per request ke url_registrasi_bulk, mis. gateway adamLIS
//                     /adam-lis/api/v1/registrasi_bulk_mcu/create?kode_rs=&kode_lab=). ukuran_batch < 150 (batas LIS).
// - lab_lis_kirim   : klaim atomik per order agar order tidak pernah dikirim dobel (dua klik, dua petugas, retry
//                     saat batch berjalan): status baru | mengirim | terkirim | gagal | tidak_pasti; diklaim_pada/oleh =
//                     pemegang klaim 'mengirim'. tidak_pasti = request terkirim tetapi respons tidak diterima (timeout)
//                     → wajib "Cek status" dulu sebelum boleh dikirim ulang.
// - lab_lis_batch / lab_lis_batch_item : antrean proses di server (asinkron, tahan restart lab-service).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE lab_lis_koneksi
        ADD COLUMN IF NOT EXISTS mode_kirim VARCHAR(10) NOT NULL DEFAULT 'per_order',
        ADD COLUMN IF NOT EXISTS url_registrasi_bulk VARCHAR(500),
        ADD COLUMN IF NOT EXISTS kode_lab VARCHAR(50),
        ADD COLUMN IF NOT EXISTS ukuran_batch INT NOT NULL DEFAULT 100,
        ADD COLUMN IF NOT EXISTS jeda_ms INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS maks_paralel INT NOT NULL DEFAULT 2;
      DO $$ BEGIN
        ALTER TABLE lab_lis_koneksi ADD CONSTRAINT lab_lis_koneksi_mode_cek CHECK (mode_kirim IN ('per_order', 'bulk'));
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        ALTER TABLE lab_lis_koneksi ADD CONSTRAINT lab_lis_koneksi_batch_cek
          CHECK (ukuran_batch BETWEEN 1 AND 149 AND jeda_ms BETWEEN 0 AND 60000 AND maks_paralel BETWEEN 1 AND 10);
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      ALTER TABLE lab_lis_kirim
        ADD COLUMN IF NOT EXISTS diklaim_pada BIGINT,
        ADD COLUMN IF NOT EXISTS diklaim_oleh VARCHAR(100),
        ADD COLUMN IF NOT EXISTS batch_uuid UUID;
      CREATE INDEX IF NOT EXISTS lab_lis_kirim_order_idx ON lab_lis_kirim (order_lab_uuid);
      CREATE INDEX IF NOT EXISTS lab_lis_kirim_klaim_idx ON lab_lis_kirim (diklaim_pada) WHERE status = 'mengirim';

      CREATE TABLE IF NOT EXISTS lab_lis_batch (
        id            BIGSERIAL PRIMARY KEY,
        uuid          UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        faskes_uuid   VARCHAR(255) NOT NULL,
        koneksi_uuid  UUID,
        sumber        VARCHAR(20) NOT NULL DEFAULT 'mcu',      -- mcu | lab
        jenis         VARCHAR(10) NOT NULL DEFAULT 'kirim',    -- kirim | hasil | cek
        mode_kirim    VARCHAR(10),                             -- per_order | bulk (salinan saat batch dibuat)
        judul         VARCHAR(255),
        opsi          JSONB NOT NULL DEFAULT '{}'::jsonb,      -- { periksa_now, hanya_gagal }
        induk_uuid    UUID,                                    -- batch asal (kirim ulang)
        jumlah        INT NOT NULL DEFAULT 0,
        berhasil      INT NOT NULL DEFAULT 0,
        gagal         INT NOT NULL DEFAULT 0,
        dilewati      INT NOT NULL DEFAULT 0,
        tidak_pasti   INT NOT NULL DEFAULT 0,
        status        VARCHAR(10) NOT NULL DEFAULT 'antri',    -- antri | proses | selesai | dihentikan
        pesan         TEXT,
        pemroses      VARCHAR(100),                            -- instans lab-service yang memproses
        detak         BIGINT,                                  -- detak terakhir pemroses (deteksi macet/restart)
        dibuat_oleh   VARCHAR(255),
        created_at    BIGINT NOT NULL,
        updated_at    BIGINT NOT NULL,
        selesai_pada  BIGINT
      );
      CREATE INDEX IF NOT EXISTS lab_lis_batch_faskes_idx ON lab_lis_batch (faskes_uuid, created_at DESC);
      CREATE INDEX IF NOT EXISTS lab_lis_batch_proses_idx ON lab_lis_batch (status) WHERE status IN ('antri', 'proses');

      CREATE TABLE IF NOT EXISTS lab_lis_batch_item (
        id             BIGSERIAL PRIMARY KEY,
        batch_uuid     UUID NOT NULL REFERENCES lab_lis_batch (uuid) ON DELETE CASCADE,
        order_lab_uuid VARCHAR(255) NOT NULL,
        ref_uuid       VARCHAR(255),                           -- mis. uuid peserta MCU
        urutan         INT NOT NULL DEFAULT 0,
        status         VARCHAR(12) NOT NULL DEFAULT 'antri',   -- antri | terkirim | gagal | dilewati | tidak_pasti | diterima | sebagian
        pesan          TEXT,
        lis_no_lab     VARCHAR(100),
        updated_at     BIGINT,
        CONSTRAINT lab_lis_batch_item_unik UNIQUE (batch_uuid, order_lab_uuid)
      );
      CREATE INDEX IF NOT EXISTS lab_lis_batch_item_antri_idx ON lab_lis_batch_item (batch_uuid, urutan) WHERE status = 'antri';
      CREATE INDEX IF NOT EXISTS lab_lis_batch_item_ref_idx ON lab_lis_batch_item (ref_uuid);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS lab_lis_batch_item;
      DROP TABLE IF EXISTS lab_lis_batch;
      DROP INDEX IF EXISTS lab_lis_kirim_klaim_idx;
      DROP INDEX IF EXISTS lab_lis_kirim_order_idx;
      ALTER TABLE lab_lis_kirim DROP COLUMN IF EXISTS batch_uuid, DROP COLUMN IF EXISTS diklaim_oleh, DROP COLUMN IF EXISTS diklaim_pada;
      ALTER TABLE lab_lis_koneksi DROP CONSTRAINT IF EXISTS lab_lis_koneksi_batch_cek, DROP CONSTRAINT IF EXISTS lab_lis_koneksi_mode_cek;
      ALTER TABLE lab_lis_koneksi DROP COLUMN IF EXISTS maks_paralel, DROP COLUMN IF EXISTS jeda_ms, DROP COLUMN IF EXISTS ukuran_batch,
        DROP COLUMN IF EXISTS kode_lab, DROP COLUMN IF EXISTS url_registrasi_bulk, DROP COLUMN IF EXISTS mode_kirim;
    `);
  },
};
