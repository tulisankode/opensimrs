'use strict';

// SIMRS Studio (mode pengembang berbasis AI) — rancangan docs/rancangan/STUDIO-PENGEMBANG.md.
// Tingkat instalasi (bukan per faskes): Studio mengubah kode aplikasi yang dipakai semua faskes.
// - studio_pengaturan : kunci-nilai (mode_pengembang, branch_dasar, model per tahap, aturan instalasi)
// - studio_item       : satu permintaan; tahap permintaan → usecase → prd → desain → coding → qa → rilis → selesai
// - studio_artefak    : dokumen per tahap, berversi (tidak pernah ditimpa)
// - studio_pesan      : diskusi pengguna ↔ AI per tahap
// - studio_persetujuan: gerbang manusia per tahap (setuju | revisi | tolak)
// - studio_tugas      : satu eksekusi agen (Claude Code CLI) / cek otomatis; studio_tugas_log = langkahnya
// - studio_audit      : jejak semua tindakan (append-only)
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS studio_pengaturan (
        kunci        VARCHAR(100) PRIMARY KEY,
        nilai        JSONB,
        diubah_oleh  VARCHAR(255),
        updated_at   BIGINT NOT NULL
      );

      CREATE SEQUENCE IF NOT EXISTS studio_item_nomor_seq;
      CREATE TABLE IF NOT EXISTS studio_item (
        id              BIGSERIAL PRIMARY KEY,
        uuid            UUID NOT NULL UNIQUE,
        nomor           INT NOT NULL UNIQUE DEFAULT nextval('studio_item_nomor_seq'),
        judul           VARCHAR(255) NOT NULL,
        jenis           VARCHAR(20) NOT NULL DEFAULT 'fitur',      -- fitur | perbaikan | laporan | modul
        tahap           VARCHAR(20) NOT NULL DEFAULT 'permintaan', -- permintaan | usecase | prd | desain | coding | qa | rilis | selesai | dibatalkan
        risiko          VARCHAR(10) NOT NULL DEFAULT 'sedang',     -- rendah | sedang | tinggi | kritis
        prioritas       VARCHAR(5) NOT NULL DEFAULT 'P2',
        permintaan      JSONB NOT NULL DEFAULT '{}'::jsonb,        -- isian formulir pengusul
        branch          VARCHAR(255),
        branch_asal     VARCHAR(255),
        berkas          JSONB NOT NULL DEFAULT '[]'::jsonb,        -- berkas yang diubah agen
        snapshot        JSONB,                                     -- status berkas kotor sebelum coding
        pesan_commit    TEXT,                                      -- usulan agen (tahap coding/rilis)
        commit_sha      VARCHAR(64),
        pr_url          VARCHAR(500),
        faskes_uuid     VARCHAR(255),
        dibuat_oleh     VARCHAR(255),
        created_at      BIGINT NOT NULL,
        updated_at      BIGINT NOT NULL,
        deleted_at      BIGINT
      );
      CREATE INDEX IF NOT EXISTS studio_item_tahap_idx ON studio_item (tahap) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS studio_artefak (
        id          BIGSERIAL PRIMARY KEY,
        uuid        UUID NOT NULL UNIQUE,
        item_uuid   UUID NOT NULL,
        tahap       VARCHAR(20) NOT NULL,
        versi       INT NOT NULL,
        isi         TEXT NOT NULL,
        dibuat_oleh VARCHAR(255),                                   -- username atau 'agen'
        tugas_uuid  UUID,
        created_at  BIGINT NOT NULL,
        UNIQUE (item_uuid, tahap, versi)
      );

      CREATE TABLE IF NOT EXISTS studio_pesan (
        id          BIGSERIAL PRIMARY KEY,
        uuid        UUID NOT NULL UNIQUE,
        item_uuid   UUID NOT NULL,
        tahap       VARCHAR(20) NOT NULL,
        dari        VARCHAR(10) NOT NULL,                           -- pengguna | ai | sistem
        isi         TEXT NOT NULL,
        pengguna    VARCHAR(255),
        tugas_uuid  UUID,
        created_at  BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS studio_pesan_item_idx ON studio_pesan (item_uuid, created_at);

      CREATE TABLE IF NOT EXISTS studio_persetujuan (
        id          BIGSERIAL PRIMARY KEY,
        uuid        UUID NOT NULL UNIQUE,
        item_uuid   UUID NOT NULL,
        tahap       VARCHAR(20) NOT NULL,
        keputusan   VARCHAR(10) NOT NULL,                           -- setuju | revisi | tolak
        alasan      TEXT,
        pengguna    VARCHAR(255) NOT NULL,
        created_at  BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS studio_tugas (
        id            BIGSERIAL PRIMARY KEY,
        uuid          UUID NOT NULL UNIQUE,
        item_uuid     UUID,
        tahap         VARCHAR(20),
        jenis         VARCHAR(10) NOT NULL,                         -- dokumen | coding | cek | uji
        status        VARCHAR(12) NOT NULL DEFAULT 'antri',         -- antri | jalan | selesai | gagal | dibatalkan
        model         VARCHAR(100),
        session_id    VARCHAR(100),
        instruksi     TEXT,
        hasil         TEXT,
        pesan_galat   TEXT,
        biaya_usd     NUMERIC(12,4) NOT NULL DEFAULT 0,
        token_masuk   BIGINT NOT NULL DEFAULT 0,
        token_keluar  BIGINT NOT NULL DEFAULT 0,
        kuota         JSONB,                                        -- rate_limit_event terakhir dari CLI
        pid           INT,
        dibuat_oleh   VARCHAR(255),
        mulai         BIGINT,
        selesai       BIGINT,
        created_at    BIGINT NOT NULL,
        updated_at    BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS studio_tugas_item_idx ON studio_tugas (item_uuid, created_at);

      CREATE TABLE IF NOT EXISTS studio_tugas_log (
        id          BIGSERIAL PRIMARY KEY,
        tugas_uuid  UUID NOT NULL,
        jenis       VARCHAR(12) NOT NULL,                           -- info | teks | alat | hasil | galat
        teks        TEXT NOT NULL,
        waktu       BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS studio_tugas_log_tugas_idx ON studio_tugas_log (tugas_uuid, id);

      CREATE TABLE IF NOT EXISTS studio_audit (
        id          BIGSERIAL PRIMARY KEY,
        item_uuid   UUID,
        aksi        VARCHAR(100) NOT NULL,
        pelaku      VARCHAR(255) NOT NULL,
        rincian     JSONB,
        waktu       BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS studio_audit_waktu_idx ON studio_audit (waktu DESC);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS studio_audit, studio_tugas_log, studio_tugas, studio_persetujuan, studio_pesan,
        studio_artefak, studio_item, studio_pengaturan;
      DROP SEQUENCE IF EXISTS studio_item_nomor_seq;
    `);
  },
};
