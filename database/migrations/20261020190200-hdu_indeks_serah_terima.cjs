'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS hdu_serah_terima_daftar_idx
          ON hdu_serah_terima(faskes_uuid, created_at DESC, uuid DESC)
          WHERE deleted_at IS NULL;
      `, { transaction });
    });
  },
  async down() {
    // Indeks pembacaan dipertahankan agar pembalikan tidak mengganggu daftar serah terima.
  },
};
