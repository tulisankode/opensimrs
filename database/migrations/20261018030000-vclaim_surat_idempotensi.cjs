'use strict';

// STD-0021 (perbaikan) — kolom tambahan bpjs_vclaim_surat untuk idempotensi atomik & rekonsiliasi:
// - sidik            : SHA-256 isi permintaan pembuatan surat; kunci idempotensi sama dengan isi berbeda ditolak (409);
// - no_sep_asal      : SEP kunjungan asal Rencana Kontrol (payload VClaim noSEP; lihat bpjs-service/src/vclaim-peta.js);
// - operasi_terakhir : buat | ubah | hapus — dipakai "Cek status di VClaim" untuk menyelaraskan baris 'tidak_pasti'.
// Idempoten (ADD COLUMN/CREATE INDEX IF NOT EXISTS); migrasi 20261017110040 tidak diubah.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE bpjs_vclaim_surat ADD COLUMN IF NOT EXISTS sidik VARCHAR(64);
      ALTER TABLE bpjs_vclaim_surat ADD COLUMN IF NOT EXISTS no_sep_asal VARCHAR(30);
      ALTER TABLE bpjs_vclaim_surat ADD COLUMN IF NOT EXISTS operasi_terakhir VARCHAR(10);
      CREATE INDEX IF NOT EXISTS bpjs_vclaim_surat_status_idx
        ON bpjs_vclaim_surat (faskes_uuid, jenis, status_operasi, status_pakai, tgl_rencana) WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS bpjs_vclaim_surat_status_idx;
      ALTER TABLE bpjs_vclaim_surat DROP COLUMN IF EXISTS operasi_terakhir;
      ALTER TABLE bpjs_vclaim_surat DROP COLUMN IF EXISTS no_sep_asal;
      ALTER TABLE bpjs_vclaim_surat DROP COLUMN IF EXISTS sidik;
    `);
  },
};
