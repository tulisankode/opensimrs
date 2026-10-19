'use strict';

// Dashboard Eksekutif (STD-0034, laporan-service): target KPI per faskes. Satu baris aktif per (faskes, kode
// indikator); kode mengikuti KATALOG_INDIKATOR di laporan-service/src/helpers/indikator-eksekutif.js.
//   target_min / target_maks : rentang sasaran (boleh salah satu kosong: hanya batas bawah atau batas atas);
//                              indikator volume (skala per_30_hari) dinyatakan per 30 hari dan disesuaikan panjang periode;
//   toleransi_persen         : pita kuning di luar rentang (persen dari batas yang dilanggar), di luar itu merah.
// Target diisi pimpinan/admin berizin Dashboard › Eksekutif › ATUR TARGET; sistem tidak mengisi target otomatis.
// Konvensi: uuid varchar (uuidv7 aplikasi), waktu epoch detik, soft delete deleted_at. Idempoten (IF NOT EXISTS).

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS dashboard_target_kpi (
        uuid VARCHAR(255) PRIMARY KEY,
        faskes_uuid VARCHAR(255) NOT NULL,
        kode VARCHAR(50) NOT NULL,
        target_min NUMERIC(18, 4),
        target_maks NUMERIC(18, 4),
        toleransi_persen NUMERIC(6, 2) NOT NULL DEFAULT 10,
        catatan TEXT,
        diubah_oleh VARCHAR(255),
        created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT,
        CONSTRAINT dashboard_target_kpi_rentang_ck CHECK (target_min IS NULL OR target_maks IS NULL OR target_min <= target_maks),
        CONSTRAINT dashboard_target_kpi_toleransi_ck CHECK (toleransi_persen >= 0 AND toleransi_persen <= 100)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_target_kpi_kode_uq ON dashboard_target_kpi (faskes_uuid, kode) WHERE deleted_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS dashboard_target_kpi;`);
  },
};
