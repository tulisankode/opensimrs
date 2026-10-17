'use strict';

// Modul Gizi (STD-0007): Master Diet, Bentuk Makanan & Standar Porsi (penunjang-service/src/gizi).
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS gizi_master_diet (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama_diet VARCHAR(200) NOT NULL, deskripsi TEXT,
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS gizi_master_diet_kode_uq ON gizi_master_diet (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS gizi_master_bentuk_makanan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(100) NOT NULL, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS gizi_master_bentuk_makanan_nama_uq ON gizi_master_bentuk_makanan (faskes_uuid, nama) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS gizi_master_standar_porsi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          diet_uuid VARCHAR(255) NOT NULL REFERENCES gizi_master_diet(uuid),
          bentuk_makanan_uuid VARCHAR(255) NOT NULL REFERENCES gizi_master_bentuk_makanan(uuid),
          takaran VARCHAR(100) NOT NULL, satuan VARCHAR(50), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS gizi_standar_porsi_uq ON gizi_master_standar_porsi (faskes_uuid, diet_uuid, bentuk_makanan_uuid)
          WHERE deleted_at IS NULL;
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS gizi_master_standar_porsi, gizi_master_bentuk_makanan, gizi_master_diet;
    `);
  },
};
