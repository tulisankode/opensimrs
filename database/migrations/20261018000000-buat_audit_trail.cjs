'use strict';

// Audit Trail terpusat (STD-0029): jejak login, akses rekam medis, dan perubahan data lintas layanan.
// Tabel append-only, ditulis langsung oleh tiap layanan lewat helper bersama (bukan lewat layanan audit tersendiri —
// seluruh layanan berbagi satu database `opensimrs`). Dibaca lewat setting-service di /api/v3/setting/audit-trail.
// Rantai hash per faskes_uuid: hash_baris = sha256(kanonik(baris) + hash_sebelumnya), urutan dijamin dengan
// pg_advisory_xact_lock(hashtext('audit:' || faskes_uuid)) pada transaksi penulisan (lihat packages/model-sdk/umum).
const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS audit_trail (
          id BIGSERIAL,
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          waktu_epoch BIGINT NOT NULL,
          pengguna_uuid VARCHAR(255),
          identitas_akun VARCHAR(255),
          peran JSONB,
          layanan VARCHAR(100) NOT NULL,
          aksi VARCHAR(30) NOT NULL
            CHECK (aksi IN ('login', 'login_gagal', 'logout', 'ganti_sandi', 'baca', 'buat', 'ubah', 'hapus', 'ekspor', 'cetak', 'ubah_izin')),
          entitas VARCHAR(100),
          entitas_uuid VARCHAR(255),
          patient_uuid VARCHAR(255),
          ringkasan_perubahan JSONB,
          alamat_ip VARCHAR(64),
          user_agent VARCHAR(512),
          request_id VARCHAR(100),
          hash_sebelumnya CHAR(64),
          hash_baris CHAR(64) NOT NULL,
          ${WAKTU}
        );
        -- id BIGSERIAL dipakai sebagai penanda urutan penulisan yang deterministik per faskes (tie-break rantai hash);
        -- uuid (uuidv7, dibuat aplikasi) tetap primary key sesuai konvensi repo.
        CREATE UNIQUE INDEX IF NOT EXISTS audit_trail_id_uq ON audit_trail (id);
        CREATE INDEX IF NOT EXISTS audit_trail_faskes_waktu_idx ON audit_trail (faskes_uuid, waktu_epoch, id);
        CREATE INDEX IF NOT EXISTS audit_trail_faskes_pasien_idx ON audit_trail (faskes_uuid, patient_uuid, waktu_epoch) WHERE patient_uuid IS NOT NULL;
        CREATE INDEX IF NOT EXISTS audit_trail_faskes_pengguna_idx ON audit_trail (faskes_uuid, pengguna_uuid, waktu_epoch) WHERE pengguna_uuid IS NOT NULL;
        CREATE INDEX IF NOT EXISTS audit_trail_faskes_entitas_idx ON audit_trail (faskes_uuid, entitas, entitas_uuid, waktu_epoch) WHERE entitas IS NOT NULL;
        CREATE INDEX IF NOT EXISTS audit_trail_faskes_aksi_idx ON audit_trail (faskes_uuid, aksi, waktu_epoch);
        -- Rantai hash per faskes: baris sebelumnya harus bisa ditemukan lewat (faskes_uuid, id) secara cepat.
        CREATE INDEX IF NOT EXISTS audit_trail_rantai_idx ON audit_trail (faskes_uuid, id DESC);
      `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS audit_trail;`);
  },
};
