'use strict';

// Order lab dari rekam medis rawat jalan dulu diberi No. Reg baru oleh lab-service sehingga terputus dari
// kunjungannya. Sambungkan kembali: pasien sama & tanggal rekam medis = tanggal kunjungan RJ, hanya bila
// No. Reg lama tidak merujuk kunjungan mana pun. Nomor lama disimpan di catatan audit (tidak dapat dibalik otomatis).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE order_lab o SET noreg = rj.no_reg
      FROM rawat_jalans rj
      WHERE o.pelayanan = 'rajal' AND o.deleted_at IS NULL
        AND rj.patient_uuid = o.patient_uuid AND rj.faskes_uuid = o.faskes_uuid AND rj.deleted_at IS NULL
        AND to_char(to_timestamp(rj.jadwal_periksa) AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') = o.rekam_medis_date
        AND o.noreg IS DISTINCT FROM rj.no_reg
        AND NOT EXISTS (SELECT 1 FROM rawat_jalans x WHERE x.no_reg = o.noreg);
    `);
  },
  async down() {},
};
