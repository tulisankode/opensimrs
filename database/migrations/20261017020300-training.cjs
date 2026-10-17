'use strict';

// Skema Training (penunjang-service): kelas olahraga/edukasi berbayar (Zumba, Yoga, Pilates, edukasi), booking,
// pendaftaran/order, dan pembatalan. Order Training membentuk tagihan Pembayaran, bukan kunjungan klinis/RME.
// Satu tabel (training_order) menampung booking maupun order agar keduanya berbagi pemeriksaan kapasitas slot
// (kelas + tanggal + sesi) dan transisi status: booking → order → (batal). Konvensi: uuid varchar (uuidv7 dari
// aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    // Tipe tagihan Training (biaya penunjang kategori 5) untuk order kelas APS. ADD VALUE di luar transaksi.
    await queryInterface.sequelize.query(`ALTER TYPE enum_service_bill_type ADD VALUE IF NOT EXISTS 'TRAINING'`);

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS training_kelas (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL, jenis VARCHAR(100),
          instruktur VARCHAR(200), is_sesi BOOLEAN NOT NULL DEFAULT false,
          jumlah_slot INTEGER NOT NULL DEFAULT 1, harga NUMERIC(14,2) NOT NULL DEFAULT 0,
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS training_kelas_kode_uq ON training_kelas (faskes_uuid, kode) WHERE deleted_at IS NULL;

        -- Daftar sesi per kelas (hanya terisi bila is_sesi = true). Penghapusan sesi tidak menghapus order
        -- yang sudah merujuknya (tanpa ON DELETE CASCADE pada training_order.sesi_uuid).
        CREATE TABLE IF NOT EXISTS training_kelas_sesi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kelas_uuid VARCHAR(255) NOT NULL REFERENCES training_kelas(uuid) ON DELETE CASCADE,
          nama_sesi VARCHAR(100) NOT NULL, jam_mulai VARCHAR(5), jam_selesai VARCHAR(5),
          urutan INTEGER NOT NULL DEFAULT 1, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS training_kelas_sesi_kelas_idx ON training_kelas_sesi (kelas_uuid);

        -- Booking (status booking) & order (status order) peserta kelas; batal = soft delete + status batal.
        CREATE TABLE IF NOT EXISTS training_order (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_order VARCHAR(50) NOT NULL,
          kelas_uuid VARCHAR(255) NOT NULL REFERENCES training_kelas(uuid), sesi_uuid VARCHAR(255),
          tanggal_kelas DATE NOT NULL, patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50),
          payment_method INTEGER, penjamin_uuid VARCHAR(255), harga NUMERIC(14,2) NOT NULL DEFAULT 0,
          status VARCHAR(10) NOT NULL DEFAULT 'booking' CHECK (status IN ('booking', 'order', 'batal')),
          alasan_batal TEXT, dibatalkan_oleh VARCHAR(255), dibatalkan_pada BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS training_order_no_uq ON training_order (faskes_uuid, no_order);
        -- Penghitungan slot: kelas + tanggal (+ sesi) pada order aktif (booking/order, belum dihapus).
        CREATE INDEX IF NOT EXISTS training_order_slot_idx ON training_order (faskes_uuid, kelas_uuid, tanggal_kelas, sesi_uuid, status)
          WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS training_order_pasien_idx ON training_order (patient_uuid);
      `, { transaction });

      await sinkronKatalog(queryInterface, transaction);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS training_order, training_kelas_sesi, training_kelas;
    `);
    // Nilai enum 'TRAINING' tidak dapat dihapus dari tipe PostgreSQL; dibiarkan.
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
