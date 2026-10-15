'use strict';

// Jenis layanan tagihan APS untuk Patologi Anatomi ('PA') & Mikrobiologi ('MIKRO') (payment-service service_bill.type).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`ALTER TYPE enum_service_bill_type ADD VALUE IF NOT EXISTS 'PA'`);
    await queryInterface.sequelize.query(`ALTER TYPE enum_service_bill_type ADD VALUE IF NOT EXISTS 'MIKRO'`);
  },
  async down() {
    // Nilai enum PostgreSQL tidak dapat dihapus; dibiarkan.
  },
};
