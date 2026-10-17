'use strict';

// STD-0021 — Rencana Kontrol & SPRI via VClaim (bpjs-service).
// Satu tabel untuk kedua jenis surat (jenis: rencana_kontrol | spri):
// - no_surat tetap NULL sampai VClaim mengonfirmasi (status_operasi='terkonfirmasi'); nomor yang belum
//   terkonfirmasi tidak boleh dipakai untuk cetak final atau diisi ke noSuratKontrol SEP.
// - idempotency_key: kunci yang dikirim klien saat membuat surat; dipakai untuk mendeteksi permintaan
//   berulang sebelum memanggil VClaim lagi (KF-7 — hindari surat ganda pada respons yang tidak pasti).
// - status_pakai ditandai 'dipakai' oleh bpjs-service sendiri (lihat vclaim.js: buatSep) setelah SEP yang
//   memakai surat ini berhasil dibuat; SEP yang gagal tidak mengubah status_pakai.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS bpjs_vclaim_surat (
        id              BIGSERIAL PRIMARY KEY,
        uuid            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        faskes_uuid     VARCHAR(255) NOT NULL,
        jenis           VARCHAR(20)  NOT NULL,      -- rencana_kontrol | spri
        no_surat        VARCHAR(30),                -- nomor VClaim; NULL = belum terkonfirmasi
        no_kartu        VARCHAR(30)  NOT NULL,
        no_rm           VARCHAR(50),
        patient_uuid    VARCHAR(255),
        sumber          VARCHAR(30),                -- rawat_jalan | rawat_inap | igd
        sumber_uuid     VARCHAR(255),               -- kunjungan/rawat inap OpenSIMRS asal
        dpjp            VARCHAR(30),                -- kode dokter DPJP BPJS
        poli_tujuan     VARCHAR(20),                -- kode poli VClaim (rencana kontrol)
        tgl_rencana     DATE,
        status_operasi  VARCHAR(20) NOT NULL DEFAULT 'diajukan',       -- diajukan|terkonfirmasi|gagal|tidak_pasti|dihapus
        status_pakai    VARCHAR(20) NOT NULL DEFAULT 'belum_dipakai',  -- belum_dipakai|dipakai
        simulasi        BOOLEAN NOT NULL DEFAULT false,
        idempotency_key VARCHAR(100) NOT NULL,
        sep_no_sep      VARCHAR(30),
        sep_uuid        VARCHAR(255),
        pesan_galat     TEXT,
        permintaan      JSONB,
        respons         JSONB,
        dibuat_oleh     VARCHAR(255),
        diubah_oleh     VARCHAR(255),
        dihapus_oleh    VARCHAR(255),
        created_at      BIGINT NOT NULL,
        updated_at      BIGINT NOT NULL,
        deleted_at      BIGINT,
        CONSTRAINT bpjs_vclaim_surat_idempoten_uq UNIQUE (faskes_uuid, jenis, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS bpjs_vclaim_surat_kartu_idx ON bpjs_vclaim_surat (faskes_uuid, no_kartu) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS bpjs_vclaim_surat_no_surat_idx ON bpjs_vclaim_surat (faskes_uuid, no_surat) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS bpjs_vclaim_surat_pasien_idx ON bpjs_vclaim_surat (faskes_uuid, patient_uuid) WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS bpjs_vclaim_surat;`);
  },
};
