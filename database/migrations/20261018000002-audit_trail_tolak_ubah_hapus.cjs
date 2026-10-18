'use strict';

// STD-0029 — Audit Trail terpusat: pertahanan berlapis untuk sifat append-only (KF-6/KT-16). Pemeriksaan di level
// aplikasi (tidak ada endpoint UPDATE/DELETE) sudah cukup untuk jalur API, tetapi trigger database ini menolak
// UPDATE/DELETE langsung pada tabel `audit_trail` dari jalur mana pun (mis. kesalahan kode di masa depan, akses
// basis data langsung), kecuali sesi memakai `SET LOCAL audit_trail.izinkan_tulis_sistem = 'on'` (dipakai migrasi
// pemeliharaan resmi yang dijalankan lewat prosedur migrasi, bukan dari kode aplikasi).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION audit_trail_tolak_ubah_hapus() RETURNS trigger AS $$
      BEGIN
        IF current_setting('audit_trail.izinkan_tulis_sistem', true) = 'on' THEN
          RETURN COALESCE(NEW, OLD);
        END IF;
        RAISE EXCEPTION 'audit_trail bersifat append-only: UPDATE/DELETE tidak diizinkan (STD-0029 KF-6)';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS audit_trail_tolak_ubah_hapus_trg ON audit_trail;
      CREATE TRIGGER audit_trail_tolak_ubah_hapus_trg
        BEFORE UPDATE OR DELETE ON audit_trail
        FOR EACH ROW EXECUTE FUNCTION audit_trail_tolak_ubah_hapus();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS audit_trail_tolak_ubah_hapus_trg ON audit_trail;
      DROP FUNCTION IF EXISTS audit_trail_tolak_ubah_hapus();
    `);
  },
};
