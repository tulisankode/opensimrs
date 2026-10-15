'use strict';

// Radiologi — kelengkapan alur operasional instalasi:
// - rad_ruang     : master ruang pemeriksaan & alat (modalitas yang dilayani, merk/tipe alat, jam operasional,
//                   hari operasional, durasi slot). Penjadwalan per ruang.
// - rad_jadwal    : jadwal pemeriksaan satu order pada satu ruang, tanggal & jam (satu slot). Satu jadwal dapat
//                   mencakup beberapa item order (mis. Thorax PA + Cervical di ruang X-Ray yang sama).
//                   Status: terjadwal → hadir (no. antrean per ruang/tanggal) → diperiksa | batal.
//                   Bentrok dicegah di aplikasi (cek tumpang-tindih rentang jam, baris ruang dikunci FOR UPDATE)
//                   dan unique index slot aktif (ruang, tanggal, jam_mulai) sebagai pengaman terakhir.
// - rad_template  : template expertise / bacaan normal (hasil + kesan) per pemeriksaan atau per modalitas.
// - rad_petugas   : daftar dokter radiologi (pembaca expertise) & radiografer dari tabel practitioner.
// - rad_order_item: + jadwal_uuid (jadwal aktif), ruang_uuid (ruang tempat diperiksa), radiografer_uuid.
// - rad_pemeriksaan: + persiapan (instruksi persiapan pasien, dicetak pada slip jadwal).
// Kompatibel dengan data lama: semua kolom baru nullable; item tanpa jadwal tetap dapat dikerjakan.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS rad_ruang (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(30) NOT NULL, nama VARCHAR(150) NOT NULL,
          modalitas VARCHAR(5)[] NOT NULL DEFAULT '{}',
          nama_alat VARCHAR(200), lokasi_uuid VARCHAR(255),
          jam_buka TIME NOT NULL DEFAULT '08:00', jam_tutup TIME NOT NULL DEFAULT '16:00',
          hari_operasional SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
          durasi_slot SMALLINT NOT NULL DEFAULT 15 CHECK (durasi_slot BETWEEN 5 AND 240),
          keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU},
          CHECK (jam_tutup > jam_buka)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rad_ruang_kode_uq ON rad_ruang (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS rad_jadwal (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES rad_order(uuid) ON DELETE CASCADE,
          ruang_uuid VARCHAR(255) NOT NULL REFERENCES rad_ruang(uuid),
          tanggal DATE NOT NULL, jam_mulai TIME NOT NULL, jam_selesai TIME NOT NULL,
          status VARCHAR(12) NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('terjadwal', 'hadir', 'diperiksa', 'batal')),
          no_antrean INTEGER, waktu_hadir BIGINT, segera BOOLEAN NOT NULL DEFAULT false,
          catatan TEXT, alasan_batal TEXT, dibuat_oleh VARCHAR(255), ${WAKTU},
          CHECK (jam_selesai > jam_mulai)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rad_jadwal_slot_uq ON rad_jadwal (faskes_uuid, ruang_uuid, tanggal, jam_mulai)
          WHERE status <> 'batal' AND deleted_at IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS rad_jadwal_antrean_uq ON rad_jadwal (faskes_uuid, ruang_uuid, tanggal, no_antrean)
          WHERE no_antrean IS NOT NULL AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS rad_jadwal_tanggal_idx ON rad_jadwal (faskes_uuid, tanggal, ruang_uuid);
        CREATE INDEX IF NOT EXISTS rad_jadwal_order_idx ON rad_jadwal (order_uuid);

        CREATE TABLE IF NOT EXISTS rad_template (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(200) NOT NULL,
          pemeriksaan_uuid VARCHAR(255) REFERENCES rad_pemeriksaan(uuid),
          modalitas VARCHAR(5),
          hasil TEXT NOT NULL, kesan TEXT NOT NULL,
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS rad_template_pemeriksaan_idx ON rad_template (faskes_uuid, pemeriksaan_uuid);
        CREATE UNIQUE INDEX IF NOT EXISTS rad_template_nama_uq ON rad_template (faskes_uuid, nama) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS rad_petugas (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          practitioner_uuid VARCHAR(255) NOT NULL,
          peran VARCHAR(12) NOT NULL CHECK (peran IN ('dokter', 'radiografer')),
          keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rad_petugas_uq ON rad_petugas (faskes_uuid, practitioner_uuid, peran) WHERE deleted_at IS NULL;

        ALTER TABLE rad_order_item ADD COLUMN IF NOT EXISTS jadwal_uuid VARCHAR(255) REFERENCES rad_jadwal(uuid);
        ALTER TABLE rad_order_item ADD COLUMN IF NOT EXISTS ruang_uuid VARCHAR(255) REFERENCES rad_ruang(uuid);
        ALTER TABLE rad_order_item ADD COLUMN IF NOT EXISTS radiografer_uuid VARCHAR(255);
        CREATE INDEX IF NOT EXISTS rad_order_item_jadwal_idx ON rad_order_item (jadwal_uuid);

        ALTER TABLE rad_pemeriksaan ADD COLUMN IF NOT EXISTS persiapan TEXT;
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE rad_pemeriksaan DROP COLUMN IF EXISTS persiapan;
      ALTER TABLE rad_order_item DROP COLUMN IF EXISTS radiografer_uuid;
      ALTER TABLE rad_order_item DROP COLUMN IF EXISTS ruang_uuid;
      ALTER TABLE rad_order_item DROP COLUMN IF EXISTS jadwal_uuid;
      DROP TABLE IF EXISTS rad_petugas, rad_template, rad_jadwal, rad_ruang;
    `);
  },
};
