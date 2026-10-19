"use strict";
// Virtual Office (STD-0042) kini membaca transaksi nyata: deskripsi fitur katalog `dashboard_virtual_office` diperbarui
// dari "prototipe simulasi". Hanya memanggil sinkronKatalog (upsert idempoten dari database/data/katalog-modul.json).
const { sinkronKatalog } = require("../lib/sinkron-katalog.cjs");
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },
  async down() {
    // Katalog mengikuti JSON; pemulihan memakai migrasi sinkron baru.
  },
};
