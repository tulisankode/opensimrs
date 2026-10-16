'use strict';

// SIMRS Studio tahap 2 (rancangan docs/rancangan/STUDIO-PENGEMBANG.md fase 0–5):
// - studio_item         : triase (modul terdampak), tunda, batas bawah risiko otomatis, worktree, PR/CI/tag, riwayat commit
// - studio_persetujuan  : gerbang per peran (product, pengusul, klinis, programmer, qa, rilis, maintainer)
// - studio_konektor     : konektor agen (claude_code | anthropic | openai | openai_kompatibel), kunci API terenkripsi
// - studio_aturan       : aturan prompt lapis area (awalan path/modul) & tambahan template per tahap, berversi
// - studio_pengetahuan  : basis pengetahuan instalasi (catatan yang ikut ke setiap prompt)
// - studio_lampiran     : lampiran permintaan (disimpan di disk studio-service/data, bukan di DB)
// - studio_uji          : checklist kasus uji QA per item
// - ekstensi            : ekstensi tanpa kode (laporan, template cetak, formulir) — dipakai runtime di setting-service
// - ekstensi_formulir_isian : isian formulir tambahan per faskes/pasien/kunjungan
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_item
        ADD COLUMN IF NOT EXISTS modul_terdampak JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS tahap_mulai     BIGINT,
        ADD COLUMN IF NOT EXISTS tahap_sebelum   VARCHAR(20),
        ADD COLUMN IF NOT EXISTS risiko_min      VARCHAR(10) NOT NULL DEFAULT 'rendah',
        ADD COLUMN IF NOT EXISTS worktree        VARCHAR(500),
        ADD COLUMN IF NOT EXISTS pr_nomor        INT,
        ADD COLUMN IF NOT EXISTS pr_status       VARCHAR(20),
        ADD COLUMN IF NOT EXISTS ci_status       VARCHAR(20),
        ADD COLUMN IF NOT EXISTS merge_sha       VARCHAR(64),
        ADD COLUMN IF NOT EXISTS tag_rilis       VARCHAR(100),
        ADD COLUMN IF NOT EXISTS riwayat_commit  JSONB NOT NULL DEFAULT '[]'::jsonb;

      ALTER TABLE studio_persetujuan
        ADD COLUMN IF NOT EXISTS peran        VARCHAR(20),
        ADD COLUMN IF NOT EXISTS artefak_uuid UUID;
      CREATE INDEX IF NOT EXISTS studio_persetujuan_item_idx ON studio_persetujuan (item_uuid, tahap, created_at);

      CREATE TABLE IF NOT EXISTS studio_konektor (
        id            BIGSERIAL PRIMARY KEY,
        uuid          UUID NOT NULL UNIQUE,
        nama          VARCHAR(100) NOT NULL,
        penyedia      VARCHAR(20) NOT NULL,          -- claude_code | anthropic | openai | openai_kompatibel
        endpoint      VARCHAR(500),
        kunci_api     TEXT,                          -- enc:v1:… (AES-256-GCM)
        model         VARCHAR(100),
        harga_masuk   NUMERIC(12,4),                 -- US$ per 1 juta token masuk (opsional, untuk estimasi biaya)
        harga_keluar  NUMERIC(12,4),
        aktif         BOOLEAN NOT NULL DEFAULT true,
        dibuat_oleh   VARCHAR(255),
        created_at    BIGINT NOT NULL,
        updated_at    BIGINT NOT NULL,
        deleted_at    BIGINT
      );

      CREATE TABLE IF NOT EXISTS studio_aturan (
        id           BIGSERIAL PRIMARY KEY,
        uuid         UUID NOT NULL UNIQUE,
        lapis        VARCHAR(10) NOT NULL,           -- area | tahap
        kunci        VARCHAR(255) NOT NULL,          -- area: awalan path (farmasi-service/) atau nama modul; tahap: kode tahap
        judul        VARCHAR(255) NOT NULL,
        isi          TEXT NOT NULL,
        versi        INT NOT NULL DEFAULT 1,
        aktif        BOOLEAN NOT NULL DEFAULT true,
        diubah_oleh  VARCHAR(255),
        created_at   BIGINT NOT NULL,
        updated_at   BIGINT NOT NULL,
        deleted_at   BIGINT
      );

      CREATE TABLE IF NOT EXISTS studio_pengetahuan (
        id           BIGSERIAL PRIMARY KEY,
        uuid         UUID NOT NULL UNIQUE,
        judul        VARCHAR(255) NOT NULL,
        isi          TEXT NOT NULL,
        aktif        BOOLEAN NOT NULL DEFAULT true,
        diubah_oleh  VARCHAR(255),
        created_at   BIGINT NOT NULL,
        updated_at   BIGINT NOT NULL,
        deleted_at   BIGINT
      );

      CREATE TABLE IF NOT EXISTS studio_lampiran (
        id           BIGSERIAL PRIMARY KEY,
        uuid         UUID NOT NULL UNIQUE,
        item_uuid    UUID NOT NULL,
        nama         VARCHAR(255) NOT NULL,
        mime         VARCHAR(100),
        ukuran       INT NOT NULL DEFAULT 0,
        lokasi       VARCHAR(500) NOT NULL,
        disamarkan   BOOLEAN NOT NULL DEFAULT false,
        dibuat_oleh  VARCHAR(255),
        created_at   BIGINT NOT NULL,
        deleted_at   BIGINT
      );
      CREATE INDEX IF NOT EXISTS studio_lampiran_item_idx ON studio_lampiran (item_uuid);

      CREATE TABLE IF NOT EXISTS studio_uji (
        id           BIGSERIAL PRIMARY KEY,
        uuid         UUID NOT NULL UNIQUE,
        item_uuid    UUID NOT NULL,
        artefak_uuid UUID,
        kode         VARCHAR(20) NOT NULL,
        kt           VARCHAR(50),
        skenario     TEXT NOT NULL,
        peran        VARCHAR(255),
        langkah      TEXT,
        harapan      TEXT,
        otomatis     BOOLEAN NOT NULL DEFAULT false,
        status       VARCHAR(10) NOT NULL DEFAULT 'belum',  -- belum | lulus | gagal | na
        catatan      TEXT,
        diuji_oleh   VARCHAR(255),
        created_at   BIGINT NOT NULL,
        updated_at   BIGINT NOT NULL,
        deleted_at   BIGINT
      );
      CREATE INDEX IF NOT EXISTS studio_uji_item_idx ON studio_uji (item_uuid) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS ekstensi (
        id             BIGSERIAL PRIMARY KEY,
        uuid           UUID NOT NULL UNIQUE,
        kode           VARCHAR(100) NOT NULL,
        jenis          VARCHAR(20) NOT NULL,                 -- laporan | cetak | formulir
        nama           VARCHAR(255) NOT NULL,
        deskripsi      TEXT,
        versi          VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        definisi       JSONB NOT NULL,
        status         VARCHAR(12) NOT NULL DEFAULT 'draf',  -- draf | terpasang | dicopot
        faskes         JSONB,                                 -- null = semua faskes; atau daftar faskes_uuid
        item_uuid      UUID,
        sumber         VARCHAR(10) NOT NULL DEFAULT 'lokal',  -- lokal | impor
        tanda_tangan   TEXT,
        dibuat_oleh    VARCHAR(255),
        dipasang_oleh  VARCHAR(255),
        dipasang_pada  BIGINT,
        created_at     BIGINT NOT NULL,
        updated_at     BIGINT NOT NULL,
        deleted_at     BIGINT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ekstensi_kode_idx ON ekstensi (kode) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS ekstensi_formulir_isian (
        id             BIGSERIAL PRIMARY KEY,
        uuid           UUID NOT NULL UNIQUE,
        ekstensi_uuid  UUID NOT NULL,
        faskes_uuid    VARCHAR(255) NOT NULL,
        patient_uuid   VARCHAR(255),
        no_reg         VARCHAR(100),
        isian          JSONB NOT NULL DEFAULT '{}'::jsonb,
        dibuat_oleh    VARCHAR(255),
        diubah_oleh    VARCHAR(255),
        created_at     BIGINT NOT NULL,
        updated_at     BIGINT NOT NULL,
        deleted_at     BIGINT
      );
      CREATE INDEX IF NOT EXISTS ekstensi_formulir_isian_idx ON ekstensi_formulir_isian (ekstensi_uuid, faskes_uuid) WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS ekstensi_formulir_isian, ekstensi, studio_uji, studio_lampiran, studio_pengetahuan, studio_aturan, studio_konektor;
      DROP INDEX IF EXISTS studio_persetujuan_item_idx;
      ALTER TABLE studio_persetujuan DROP COLUMN IF EXISTS peran, DROP COLUMN IF EXISTS artefak_uuid;
      ALTER TABLE studio_item DROP COLUMN IF EXISTS modul_terdampak, DROP COLUMN IF EXISTS tahap_mulai, DROP COLUMN IF EXISTS tahap_sebelum,
        DROP COLUMN IF EXISTS risiko_min, DROP COLUMN IF EXISTS worktree, DROP COLUMN IF EXISTS pr_nomor, DROP COLUMN IF EXISTS pr_status,
        DROP COLUMN IF EXISTS ci_status, DROP COLUMN IF EXISTS merge_sha, DROP COLUMN IF EXISTS tag_rilis, DROP COLUMN IF EXISTS riwayat_commit;
    `);
  },
};
