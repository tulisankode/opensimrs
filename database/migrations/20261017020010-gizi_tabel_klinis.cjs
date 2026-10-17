'use strict';

// Modul Gizi (STD-0007): Skrining Gizi, Asesmen & Asuhan Gizi (PAGT), dan Order Diet rawat inap.
// admission_ri_uuid merujuk rawat_inaps.uuid (tabel di luar layanan ini, tidak diberi FK lintas layanan).
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        -- Skrining gizi awal rawat inap (mis. MST/NRS-2002). Satu episode bisa diskrining ulang (riwayat tersimpan);
        -- skrining paling baru yang dipakai untuk menentukan status "sudah diskrining" & daftar kerja ahli gizi.
        CREATE TABLE IF NOT EXISTS gizi_skrining (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          admission_ri_uuid VARCHAR(255) NOT NULL,
          instrumen VARCHAR(10) NOT NULL CHECK (instrumen IN ('mst', 'nrs2002')),
          jawaban JSONB NOT NULL DEFAULT '[]',
          skor INTEGER NOT NULL DEFAULT 0,
          kategori_risiko VARCHAR(15) NOT NULL CHECK (kategori_risiko IN ('berisiko', 'tidak_berisiko')),
          petugas VARCHAR(255), waktu_skrining BIGINT NOT NULL, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS gizi_skrining_admission_idx ON gizi_skrining (faskes_uuid, admission_ri_uuid, created_at);

        -- Asesmen & asuhan gizi (PAGT) oleh ahli gizi/dietisien; bisa diperbarui (monitoring-evaluasi berjalan).
        CREATE TABLE IF NOT EXISTS gizi_asesmen (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          admission_ri_uuid VARCHAR(255) NOT NULL, skrining_uuid VARCHAR(255) REFERENCES gizi_skrining(uuid),
          ahli_gizi_uuid VARCHAR(255), asesmen TEXT, diagnosis_gizi TEXT, intervensi TEXT, monitoring_evaluasi TEXT,
          dibuat_oleh VARCHAR(255), diubah_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS gizi_asesmen_admission_idx ON gizi_asesmen (faskes_uuid, admission_ri_uuid, created_at);

        -- Order diet DPJP. status 'aktif' = berlaku saat ini; membuat order baru membatalkan order aktif sebelumnya
        -- pada episode yang sama (riwayat tetap tersimpan, bisa ditelusuri).
        CREATE TABLE IF NOT EXISTS gizi_order_diet (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          admission_ri_uuid VARCHAR(255) NOT NULL,
          diet_uuid VARCHAR(255) NOT NULL REFERENCES gizi_master_diet(uuid),
          bentuk_makanan_uuid VARCHAR(255) NOT NULL REFERENCES gizi_master_bentuk_makanan(uuid),
          kalori INTEGER, rute VARCHAR(10) NOT NULL DEFAULT 'oral' CHECK (rute IN ('oral', 'enteral', 'parenteral')),
          pantangan TEXT, waktu_mulai BIGINT NOT NULL,
          status VARCHAR(10) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'dibatalkan')),
          alasan_batal TEXT, dibuat_oleh VARCHAR(255), diubah_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS gizi_order_diet_admission_idx ON gizi_order_diet (faskes_uuid, admission_ri_uuid, status, created_at);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS gizi_order_diet, gizi_asesmen, gizi_skrining;
    `);
  },
};
