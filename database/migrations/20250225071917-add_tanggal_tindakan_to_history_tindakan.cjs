"use strict";

/**
 * Salinan migrasi laporan-service (nama file sama → tercatat sekali di SequelizeMeta).
 * Idempoten: dilewati bila kolom sudah ada.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("history_tindakan");
    if (table.tanggal_tindakan) return;
    await queryInterface.addColumn("history_tindakan", "tanggal_tindakan", {
      type: Sequelize.DataTypes.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("history_tindakan", "tanggal_tindakan");
  },
};
