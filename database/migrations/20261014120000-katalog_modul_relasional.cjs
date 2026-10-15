'use strict';

// Manajemen Modul & Fitur relasional: katalog (segmen → modul → fitur → bagian), preset segmen, dan
// pengaturan per faskes disimpan di tabel ber-FK (sebelumnya katalog di kode & override sebagai JSON).
// Data katalog dimuat dari database/data/katalog-modul.json; konfigurasi faskes_modul lama dipindahkan.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => queryInterface.sequelize.query(sql, { replacements, transaction });

      await q(`
        CREATE TABLE IF NOT EXISTS ref_jenis_poli (
          kode VARCHAR(30) PRIMARY KEY,
          nama VARCHAR(100) NOT NULL,
          urutan INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS ref_segmen (
          kode VARCHAR(50) PRIMARY KEY,
          nama VARCHAR(100) NOT NULL,
          urutan INTEGER NOT NULL,
          ringkas TEXT
        );
        CREATE TABLE IF NOT EXISTS ref_modul (
          kode VARCHAR(50) PRIMARY KEY,
          nama VARCHAR(150) NOT NULL,
          kelompok VARCHAR(50) NOT NULL,
          deskripsi TEXT,
          inti BOOLEAN NOT NULL DEFAULT false,
          tersedia BOOLEAN NOT NULL DEFAULT true,
          urutan INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS ref_modul_menu (
          modul_kode VARCHAR(50) NOT NULL REFERENCES ref_modul(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          judul VARCHAR(100) NOT NULL,
          PRIMARY KEY (modul_kode, judul)
        );
        CREATE TABLE IF NOT EXISTS ref_fitur (
          kode VARCHAR(50) PRIMARY KEY,
          modul_kode VARCHAR(50) NOT NULL REFERENCES ref_modul(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          nama VARCHAR(150) NOT NULL,
          deskripsi TEXT,
          wajib BOOLEAN NOT NULL DEFAULT false,
          tersedia BOOLEAN NOT NULL DEFAULT true,
          urutan INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS ref_fitur_modul_idx ON ref_fitur (modul_kode);
        CREATE TABLE IF NOT EXISTS ref_bagian (
          kode VARCHAR(50) PRIMARY KEY,
          fitur_kode VARCHAR(50) NOT NULL REFERENCES ref_fitur(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          label VARCHAR(150) NOT NULL,
          nama VARCHAR(150) NOT NULL,
          wajib BOOLEAN NOT NULL DEFAULT false,
          modul_syarat VARCHAR(50) REFERENCES ref_modul(kode) ON UPDATE CASCADE ON DELETE SET NULL,
          urutan INTEGER NOT NULL DEFAULT 0,
          UNIQUE (fitur_kode, label)
        );
        CREATE TABLE IF NOT EXISTS ref_bagian_poli (
          bagian_kode VARCHAR(50) NOT NULL REFERENCES ref_bagian(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          jenis_poli VARCHAR(30) NOT NULL REFERENCES ref_jenis_poli(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          PRIMARY KEY (bagian_kode, jenis_poli)
        );
        -- Rute frontend milik tepat satu modul ATAU satu fitur.
        CREATE TABLE IF NOT EXISTS ref_rute (
          id SERIAL PRIMARY KEY,
          modul_kode VARCHAR(50) REFERENCES ref_modul(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          fitur_kode VARCHAR(50) REFERENCES ref_fitur(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          rute VARCHAR(255) NOT NULL UNIQUE,
          CHECK ((modul_kode IS NULL) <> (fitur_kode IS NULL))
        );

        CREATE TABLE IF NOT EXISTS preset_segmen_modul (
          segmen_kode VARCHAR(50) NOT NULL REFERENCES ref_segmen(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          modul_kode VARCHAR(50) NOT NULL REFERENCES ref_modul(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          PRIMARY KEY (segmen_kode, modul_kode)
        );
        CREATE TABLE IF NOT EXISTS preset_segmen_fitur_mati (
          segmen_kode VARCHAR(50) NOT NULL REFERENCES ref_segmen(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          fitur_kode VARCHAR(50) NOT NULL REFERENCES ref_fitur(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          PRIMARY KEY (segmen_kode, fitur_kode)
        );
        CREATE TABLE IF NOT EXISTS preset_segmen_bagian_mati (
          segmen_kode VARCHAR(50) NOT NULL REFERENCES ref_segmen(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          bagian_kode VARCHAR(50) NOT NULL REFERENCES ref_bagian(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          PRIMARY KEY (segmen_kode, bagian_kode)
        );

        -- Pengaturan per faskes: segmen + override (aktif=true menambah di luar preset, false menonaktifkan).
        CREATE TABLE IF NOT EXISTS faskes_segmen (
          faskes_uuid VARCHAR(255) PRIMARY KEY REFERENCES faskes(uuid) ON DELETE CASCADE,
          segmen_kode VARCHAR(50) NOT NULL REFERENCES ref_segmen(kode) ON UPDATE CASCADE ON DELETE RESTRICT,
          diubah_oleh VARCHAR(255),
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS faskes_modul_override (
          faskes_uuid VARCHAR(255) NOT NULL REFERENCES faskes_segmen(faskes_uuid) ON DELETE CASCADE,
          modul_kode VARCHAR(50) NOT NULL REFERENCES ref_modul(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          aktif BOOLEAN NOT NULL,
          PRIMARY KEY (faskes_uuid, modul_kode)
        );
        CREATE TABLE IF NOT EXISTS faskes_fitur_override (
          faskes_uuid VARCHAR(255) NOT NULL REFERENCES faskes_segmen(faskes_uuid) ON DELETE CASCADE,
          fitur_kode VARCHAR(50) NOT NULL REFERENCES ref_fitur(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          aktif BOOLEAN NOT NULL,
          PRIMARY KEY (faskes_uuid, fitur_kode)
        );
        CREATE TABLE IF NOT EXISTS faskes_bagian_override (
          faskes_uuid VARCHAR(255) NOT NULL REFERENCES faskes_segmen(faskes_uuid) ON DELETE CASCADE,
          bagian_kode VARCHAR(50) NOT NULL REFERENCES ref_bagian(kode) ON UPDATE CASCADE ON DELETE CASCADE,
          aktif BOOLEAN NOT NULL,
          PRIMARY KEY (faskes_uuid, bagian_kode)
        );
      `);

      await sinkronKatalog(queryInterface, transaction);

      // Jenis poli lokasi: nilai di luar referensi → 'lainnya', lalu pasang FK.
      await q(`UPDATE lokasi SET jenis_poli = 'lainnya' WHERE jenis_poli IS NOT NULL AND jenis_poli NOT IN (SELECT kode FROM ref_jenis_poli)`);
      await q(`ALTER TABLE lokasi DROP CONSTRAINT IF EXISTS lokasi_jenis_poli_fk;
               ALTER TABLE lokasi ADD CONSTRAINT lokasi_jenis_poli_fk FOREIGN KEY (jenis_poli)
                 REFERENCES ref_jenis_poli(kode) ON UPDATE CASCADE ON DELETE SET NULL`);

      // Pindahkan konfigurasi lama (faskes_modul: JSON) → faskes_segmen + override.
      const [ada] = await q(`SELECT to_regclass('public.faskes_modul') AS t`);
      if (ada[0]?.t) {
        const [lama] = await q(`SELECT * FROM faskes_modul WHERE faskes_uuid IN (SELECT uuid FROM faskes)
                                 AND segmen IN (SELECT kode FROM ref_segmen)`);
        for (const r of lama) {
          await q(`INSERT INTO faskes_segmen (faskes_uuid, segmen_kode, diubah_oleh, created_at, updated_at)
                   VALUES (:f, :s, :o, :c, :u) ON CONFLICT (faskes_uuid) DO NOTHING`,
            { f: r.faskes_uuid, s: r.segmen, o: r.diubah_oleh, c: r.created_at, u: r.updated_at });
          const pindah = async (kode, aktif) => {
            const tabel = (await q(`SELECT 1 FROM ref_modul WHERE kode = :k`, { k: kode }))[0].length ? ['faskes_modul_override', 'modul_kode']
              : (await q(`SELECT 1 FROM ref_fitur WHERE kode = :k`, { k: kode }))[0].length ? ['faskes_fitur_override', 'fitur_kode']
              : (await q(`SELECT 1 FROM ref_bagian WHERE kode = :k`, { k: kode }))[0].length ? ['faskes_bagian_override', 'bagian_kode']
              : null;
            if (!tabel) return;
            await q(`INSERT INTO ${tabel[0]} (faskes_uuid, ${tabel[1]}, aktif) VALUES (:f, :k, ${aktif})
                     ON CONFLICT DO NOTHING`, { f: r.faskes_uuid, k: kode });
          };
          for (const k of r.modul_tambahan ?? []) await pindah(k, true);
          for (const k of r.modul_nonaktif ?? []) await pindah(k, false);
          for (const k of r.fitur_tambahan ?? []) await pindah(k, true);
          for (const k of r.fitur_nonaktif ?? []) await pindah(k, false);
        }
        await q(`DROP TABLE faskes_modul`);
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE lokasi DROP CONSTRAINT IF EXISTS lokasi_jenis_poli_fk;
      DROP TABLE IF EXISTS faskes_bagian_override, faskes_fitur_override, faskes_modul_override, faskes_segmen,
        preset_segmen_bagian_mati, preset_segmen_fitur_mati, preset_segmen_modul, ref_rute, ref_bagian_poli,
        ref_bagian, ref_fitur, ref_modul_menu, ref_modul, ref_segmen, ref_jenis_poli;
      CREATE TABLE IF NOT EXISTS faskes_modul (
        faskes_uuid VARCHAR(255) PRIMARY KEY, segmen VARCHAR(50) NOT NULL,
        modul_tambahan JSONB NOT NULL DEFAULT '[]'::jsonb, modul_nonaktif JSONB NOT NULL DEFAULT '[]'::jsonb,
        fitur_tambahan JSONB NOT NULL DEFAULT '[]'::jsonb, fitur_nonaktif JSONB NOT NULL DEFAULT '[]'::jsonb,
        diubah_oleh VARCHAR(255), created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
    `);
  },
};
