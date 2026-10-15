"use strict";

/**
 * Kolom kuota & jumlah antrian JKN/non-JKN yang dipakai antrian-service
 * (src/models/report-antrian.model.js, jadwal-dokter.repository.js) tetapi belum ada di schema.sql.
 * Idempoten: kolom yang sudah ada dilewati.
 * @type {import('sequelize-cli').Migration}
 */
const COLUMNS = ["kuota_jkn", "kuota_non_jkn", "jumlah_jkn_aktif", "jumlah_non_jkn_aktif"];

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("report_antrian");
    for (const column of COLUMNS) {
      if (table[column]) continue;
      await queryInterface.addColumn("report_antrian", column, {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    for (const column of COLUMNS) {
      await queryInterface.removeColumn("report_antrian", column);
    }
  },
};
