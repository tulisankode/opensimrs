'use strict';

// Pemetaan referensi OpenSIMRS → kode master di LIS untuk registrasi: unit asal (lokasi), dokter pengirim
// (practitioner) dan penjamin. ref_uuid 'TUNAI' = pasien umum/tunai (tanpa penjamin).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS lab_lis_peta_ref (
        faskes_uuid VARCHAR(50) NOT NULL,
        jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('unit', 'dokter', 'penjamin')),
        ref_uuid VARCHAR(50) NOT NULL,
        kode_lis VARCHAR(50) NOT NULL,
        nama_lis VARCHAR(200),
        updated_at BIGINT,
        PRIMARY KEY (faskes_uuid, jenis, ref_uuid)
      );`);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS lab_lis_peta_ref;`);
  },
};
