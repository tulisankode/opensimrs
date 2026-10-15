'use strict';

// Jenis poli (umum, gigi, mata, …) untuk bagian RME khusus spesialisasi (Setting › Manajemen Modul & Fitur).
// Diisi awal dari kode poli BPJS, lalu dari nama poli; sisanya "umum".
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE lokasi ADD COLUMN IF NOT EXISTS jenis_poli VARCHAR(30);
      UPDATE lokasi SET jenis_poli = CASE UPPER(COALESCE(kd_poli_bpjs, kd_poli_vclaim, ''))
          WHEN 'GIG' THEN 'gigi' WHEN 'MAT' THEN 'mata' WHEN 'ANA' THEN 'anak' WHEN 'OBG' THEN 'kandungan'
          WHEN 'INT' THEN 'penyakit_dalam' WHEN 'BED' THEN 'bedah' WHEN 'THT' THEN 'tht' WHEN 'SAR' THEN 'saraf'
          WHEN 'KLT' THEN 'kulit' WHEN 'JIW' THEN 'jiwa' WHEN 'UMU' THEN 'umum' WHEN '001' THEN 'umum' ELSE NULL END
        WHERE is_poli = true AND jenis_poli IS NULL;
      UPDATE lokasi SET jenis_poli = CASE
          WHEN name ILIKE '%gigi%' THEN 'gigi' WHEN name ILIKE '%mata%' THEN 'mata' WHEN name ILIKE '%anak%' THEN 'anak'
          WHEN name ILIKE '%obgyn%' OR name ILIKE '%kandungan%' OR name ILIKE '%kebidanan%' THEN 'kandungan'
          WHEN name ILIKE '%dalam%' THEN 'penyakit_dalam' WHEN name ILIKE '%bedah%' THEN 'bedah'
          WHEN name ILIKE '%tht%' THEN 'tht' WHEN name ILIKE '%saraf%' OR name ILIKE '%neuro%' THEN 'saraf'
          WHEN name ILIKE '%kulit%' THEN 'kulit' WHEN name ILIKE '%jiwa%' THEN 'jiwa'
          WHEN name ILIKE '%kia%' OR name ILIKE '% kb%' THEN 'kia_kb' ELSE 'umum' END
        WHERE is_poli = true AND jenis_poli IS NULL;
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TABLE lokasi DROP COLUMN IF EXISTS jenis_poli;`);
  },
};
