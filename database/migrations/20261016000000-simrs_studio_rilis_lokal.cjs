'use strict';

// SIMRS Studio — rilis lokal (tanpa push/PR): perubahan item digabung ke branch lokal yang dipakai aplikasi RS.
// diterapkan_pada/branch_lokal/sha_lokal = penerapan terakhir; dibatalkan dengan git revert (sha_batal).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_item
        ADD COLUMN IF NOT EXISTS branch_lokal   VARCHAR(255),
        ADD COLUMN IF NOT EXISTS sha_lokal      VARCHAR(64),
        ADD COLUMN IF NOT EXISTS diterapkan_pada BIGINT,
        ADD COLUMN IF NOT EXISTS sha_batal      VARCHAR(64);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE studio_item DROP COLUMN IF EXISTS branch_lokal, DROP COLUMN IF EXISTS sha_lokal,
        DROP COLUMN IF EXISTS diterapkan_pada, DROP COLUMN IF EXISTS sha_batal;
    `);
  },
};
