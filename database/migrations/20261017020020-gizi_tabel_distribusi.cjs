'use strict';

// Modul Gizi (STD-0007): Daftar Distribusi Makan & Rekap Porsi per ruangan (lokasi/bangsal) dan waktu makan.
// Item distribusi menyimpan snapshot lokasi, diet, dan alergi saat daftar dibentuk, agar daftar yang sudah
// dicetak tidak berubah diam-diam walau order/lokasi pasien berubah sesudahnya (riwayat tetap bisa ditelusuri).
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS gizi_distribusi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          ruangan_uuid VARCHAR(255) NOT NULL, tanggal DATE NOT NULL,
          waktu_makan VARCHAR(10) NOT NULL CHECK (waktu_makan IN ('pagi', 'siang', 'sore', 'snack')),
          status VARCHAR(10) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf', 'dicetak', 'selesai')),
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS gizi_distribusi_filter_idx ON gizi_distribusi (faskes_uuid, tanggal, ruangan_uuid, waktu_makan, deleted_at);

        CREATE TABLE IF NOT EXISTS gizi_distribusi_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          distribusi_uuid VARCHAR(255) NOT NULL REFERENCES gizi_distribusi(uuid) ON DELETE CASCADE,
          admission_ri_uuid VARCHAR(255) NOT NULL, order_diet_uuid VARCHAR(255) REFERENCES gizi_order_diet(uuid),
          nama_pasien VARCHAR(200), no_rm VARCHAR(50),
          nama_diet_snapshot VARCHAR(200), bentuk_makanan_snapshot VARCHAR(100), pantangan_snapshot TEXT,
          lokasi_snapshot JSONB NOT NULL DEFAULT '{}', alergi_snapshot TEXT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS gizi_distribusi_item_distribusi_idx ON gizi_distribusi_item (distribusi_uuid);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS gizi_distribusi_item, gizi_distribusi;
    `);
  },
};
