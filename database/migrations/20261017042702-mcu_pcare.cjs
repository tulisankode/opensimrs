'use strict';

// STD-0020 — MCU PCare (BPJS): pelaporan hasil MCU peserta JKN ke layanan MCU PCare.
// Tabel baru saja (tidak mengubah mcu_peserta/mcu_pemeriksaan yang sudah ada). Satu baris per peserta MCU
// (faskes_uuid + peserta_uuid unik, KF-6/KT-12): kunci idempotensi pengiriman/ubah/hapus. Penulisan baris ini
// hanya dilakukan oleh bpjs-service (lihat bpjs-service/src/pcare.js); penunjang-service hanya membaca untuk
// menampilkan status pada peserta & laporan MCU (penunjang-service/src/mcu/peserta.js, laporan.js).
// Fitur katalog mcu_pcare juga diaktifkan (tersedia: true) lewat sinkronKatalog; tetap mati bawaan di semua segmen
// (lihat database/data/katalog-modul.json preset.fitur_mati) dan mensyaratkan modul bpjs_fktp.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS mcu_pcare_kirim (
          uuid VARCHAR(255) PRIMARY KEY,
          faskes_uuid VARCHAR(255) NOT NULL,
          peserta_uuid VARCHAR(255) NOT NULL,
          rawat_jalan_uuid VARCHAR(255),
          no_kunjungan VARCHAR(100),
          status VARCHAR(20) NOT NULL DEFAULT 'belum'
            CHECK (status IN ('belum', 'mengirim', 'terkirim', 'gagal', 'tidak_pasti')),
          operasi_terakhir VARCHAR(10) CHECK (operasi_terakhir IN ('tambah', 'ubah', 'hapus')),
          no_referensi_pcare VARCHAR(100),
          mode VARCHAR(10) NOT NULL DEFAULT 'mock' CHECK (mode IN ('mock', 'nyata')),
          percobaan INTEGER NOT NULL DEFAULT 0,
          percobaan_pada BIGINT,
          pesan TEXT,
          payload JSONB,
          dikirim_oleh VARCHAR(255),
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mcu_pcare_kirim_peserta_uq ON mcu_pcare_kirim (faskes_uuid, peserta_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mcu_pcare_kirim_status_idx ON mcu_pcare_kirim (faskes_uuid, status) WHERE deleted_at IS NULL;
      `,
        { transaction },
      );
      const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');
      await sinkronKatalog(queryInterface, transaction);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS mcu_pcare_kirim;`);
  },
};
