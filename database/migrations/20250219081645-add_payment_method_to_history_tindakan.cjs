"use strict";

/**
 * Salinan migrasi laporan-service (nama file sama → tercatat sekali di SequelizeMeta).
 * Idempoten: dilewati bila kolom sudah ada.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("history_tindakan");
    if (table.payment_method) return;
    await queryInterface.addColumn("history_tindakan", "payment_method", {
      type: Sequelize.DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("history_tindakan", "payment_method");
  },
};
