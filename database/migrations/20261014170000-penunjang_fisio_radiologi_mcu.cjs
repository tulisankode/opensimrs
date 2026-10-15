'use strict';

// Skema penunjang-service: Fisioterapi / Rehabilitasi Medik (acuan PRD Fisioterapi), Radiologi, dan Medical
// Check Up (MCU). Tabel lama `order_fisio` (satu baris = order + satu jadwal + discharge) tidak dipakai lagi;
// order fisio kini bisa memiliki banyak sesi terjadwal dan evaluasi per sesi.
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    // Tipe layanan tagihan untuk pasien langsung (APS) radiologi & MCU perorangan. ADD VALUE di luar transaksi.
    await queryInterface.sequelize.query(`ALTER TYPE enum_service_bill_type ADD VALUE IF NOT EXISTS 'RAD'`);
    await queryInterface.sequelize.query(`ALTER TYPE enum_service_bill_type ADD VALUE IF NOT EXISTS 'MCU'`);

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        -- Penghitung nomor dokumen per faskes/prefiks/tanggal (FIS-, RAD-, MCU-, INV-MCU-)
        CREATE TABLE IF NOT EXISTS penunjang_nomor (
          faskes_uuid VARCHAR(255) NOT NULL, prefiks VARCHAR(20) NOT NULL, tanggal VARCHAR(8) NOT NULL,
          terakhir INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (faskes_uuid, prefiks, tanggal)
        );

        -- ── FISIOTERAPI ─────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS fisio_bed (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(150) NOT NULL, ruangan VARCHAR(150),
          lokasi_uuid VARCHAR(255), keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS fisio_bed_kode_uq ON fisio_bed (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS fisio_tindakan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL, harga NUMERIC(14,2) NOT NULL DEFAULT 0,
          jenis_fisio VARCHAR(20), status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS fisio_tindakan_kode_uq ON fisio_tindakan (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS fisio_order (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_order VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50), no_reg VARCHAR(50), rekam_medis_uuid VARCHAR(255),
          sumber VARCHAR(10) NOT NULL CHECK (sumber IN ('rme', 'aps', 'booking')),
          pelayanan VARCHAR(10) NOT NULL CHECK (pelayanan IN ('rajal', 'ranap', 'igd', 'aps')),
          lokasi_asal_uuid VARCHAR(255), dokter_pengirim_uuid VARCHAR(255),
          payment_method INTEGER NOT NULL DEFAULT 1, penjamin_uuid VARCHAR(255),
          jenis_fisio VARCHAR(20) NOT NULL CHECK (jenis_fisio IN ('sport', 'saraf', 'orto', 'anak', 'geriatri')),
          diagnosis TEXT, keluhan TEXT, catatan TEXT, jumlah_sesi INTEGER NOT NULL DEFAULT 1,
          status VARCHAR(15) NOT NULL DEFAULT 'order' CHECK (status IN ('order', 'valid', 'terjadwal', 'selesai', 'batal')),
          alasan_batal TEXT, divalidasi_oleh VARCHAR(255), divalidasi_pada BIGINT, dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS fisio_order_no_uq ON fisio_order (faskes_uuid, no_order);
        CREATE INDEX IF NOT EXISTS fisio_order_status_idx ON fisio_order (faskes_uuid, status, created_at);
        CREATE INDEX IF NOT EXISTS fisio_order_rm_idx ON fisio_order (rekam_medis_uuid);

        CREATE TABLE IF NOT EXISTS fisio_order_tindakan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES fisio_order(uuid) ON DELETE CASCADE,
          tindakan_uuid VARCHAR(255) NOT NULL REFERENCES fisio_tindakan(uuid),
          nama VARCHAR(200) NOT NULL, harga NUMERIC(14,2) NOT NULL DEFAULT 0, qty INTEGER NOT NULL DEFAULT 1, ${WAKTU}
        );

        -- Satu baris = satu sesi terapi pada tanggal + slot jam (1..6: 08-10, 10-12, ... 18-20) + bed.
        -- Booking boleh tanpa order (pasien belum terdaftar: nama & no_hp).
        CREATE TABLE IF NOT EXISTS fisio_jadwal (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) REFERENCES fisio_order(uuid) ON DELETE CASCADE,
          patient_uuid VARCHAR(255), nama_pasien VARCHAR(200), no_hp VARCHAR(30),
          tanggal DATE NOT NULL, jam_slot SMALLINT NOT NULL CHECK (jam_slot BETWEEN 1 AND 6),
          bed_uuid VARCHAR(255) NOT NULL REFERENCES fisio_bed(uuid), sesi_ke INTEGER,
          status VARCHAR(12) NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('booking', 'terjadwal', 'hadir', 'selesai', 'batal')),
          catatan TEXT, dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        -- Bed tidak bisa dipakai dua jadwal aktif pada tanggal & jam yang sama.
        CREATE UNIQUE INDEX IF NOT EXISTS fisio_jadwal_slot_uq ON fisio_jadwal (faskes_uuid, tanggal, jam_slot, bed_uuid)
          WHERE status <> 'batal' AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS fisio_jadwal_order_idx ON fisio_jadwal (order_uuid);

        CREATE TABLE IF NOT EXISTS fisio_evaluasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES fisio_order(uuid) ON DELETE CASCADE,
          jadwal_uuid VARCHAR(255) REFERENCES fisio_jadwal(uuid),
          subjektif TEXT, objektif TEXT, asesmen TEXT, intervensi TEXT, evaluasi TEXT, edukasi TEXT,
          fase_rehabilitasi VARCHAR(3) CHECK (fase_rehabilitasi IN ('1', '2a', '2b', '3a', '3b', '4', '5')),
          persetujuan JSONB, terapis VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS fisio_evaluasi_order_idx ON fisio_evaluasi (order_uuid);

        -- ── RADIOLOGI ───────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS rad_pemeriksaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL,
          modalitas VARCHAR(5) NOT NULL CHECK (modalitas IN ('XR', 'US', 'CT', 'MR', 'FL', 'MG', 'DX', 'LAIN')),
          bagian_tubuh VARCHAR(100), harga NUMERIC(14,2) NOT NULL DEFAULT 0, kode_icd9 VARCHAR(20),
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rad_pemeriksaan_kode_uq ON rad_pemeriksaan (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS rad_order (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_order VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50), no_reg VARCHAR(50), rekam_medis_uuid VARCHAR(255),
          sumber VARCHAR(10) NOT NULL CHECK (sumber IN ('rme', 'aps', 'mcu')),
          pelayanan VARCHAR(10) NOT NULL CHECK (pelayanan IN ('rajal', 'ranap', 'igd', 'aps', 'mcu')),
          lokasi_asal_uuid VARCHAR(255), dokter_pengirim_uuid VARCHAR(255), payment_method INTEGER NOT NULL DEFAULT 1,
          klinis TEXT, catatan TEXT, cito BOOLEAN NOT NULL DEFAULT false,
          tanpa_tagihan BOOLEAN NOT NULL DEFAULT false, mcu_peserta_uuid VARCHAR(255),
          status VARCHAR(12) NOT NULL DEFAULT 'order' CHECK (status IN ('order', 'valid', 'diperiksa', 'selesai', 'batal')),
          alasan_batal TEXT, divalidasi_oleh VARCHAR(255), divalidasi_pada BIGINT, selesai_pada BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rad_order_no_uq ON rad_order (faskes_uuid, no_order);
        CREATE INDEX IF NOT EXISTS rad_order_status_idx ON rad_order (faskes_uuid, status, created_at);
        CREATE INDEX IF NOT EXISTS rad_order_rm_idx ON rad_order (rekam_medis_uuid);

        CREATE TABLE IF NOT EXISTS rad_order_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES rad_order(uuid) ON DELETE CASCADE,
          pemeriksaan_uuid VARCHAR(255) NOT NULL REFERENCES rad_pemeriksaan(uuid),
          nama VARCHAR(200) NOT NULL, modalitas VARCHAR(5), harga NUMERIC(14,2) NOT NULL DEFAULT 0,
          status VARCHAR(10) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'diperiksa', 'selesai')),
          radiografer VARCHAR(255), waktu_periksa BIGINT, dokter_radiologi_uuid VARCHAR(255),
          hasil TEXT, kesan TEXT, waktu_hasil BIGINT, lampiran JSONB NOT NULL DEFAULT '[]', ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS rad_order_item_order_idx ON rad_order_item (order_uuid);

        -- ── MEDICAL CHECK UP ────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS mcu_perusahaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL, alamat TEXT, pic VARCHAR(150),
          telepon VARCHAR(30), email VARCHAR(150), status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mcu_perusahaan_kode_uq ON mcu_perusahaan (faskes_uuid, kode) WHERE deleted_at IS NULL;

        -- stasiun: daftar kode stasiun pemeriksaan dalam paket, mis. ["anamnesis","fisik","visus","lab","radiologi","ekg"]
        CREATE TABLE IF NOT EXISTS mcu_paket (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL, deskripsi TEXT,
          harga NUMERIC(14,2) NOT NULL DEFAULT 0,
          jenis VARCHAR(12) NOT NULL DEFAULT 'semua' CHECK (jenis IN ('perorangan', 'korporasi', 'semua')),
          stasiun JSONB NOT NULL DEFAULT '[]', status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mcu_paket_kode_uq ON mcu_paket (faskes_uuid, kode) WHERE deleted_at IS NULL;

        -- Isi paket: pemeriksaan lab (tarif_lab), radiologi (rad_pemeriksaan) atau tindakan (tarif).
        CREATE TABLE IF NOT EXISTS mcu_paket_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          paket_uuid VARCHAR(255) NOT NULL REFERENCES mcu_paket(uuid) ON DELETE CASCADE,
          jenis VARCHAR(10) NOT NULL CHECK (jenis IN ('lab', 'radiologi', 'tindakan')),
          ref_uuid VARCHAR(255) NOT NULL, nama VARCHAR(200) NOT NULL, ${WAKTU}
        );

        CREATE TABLE IF NOT EXISTS mcu_invoice (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_invoice VARCHAR(50) NOT NULL,
          perusahaan_uuid VARCHAR(255) NOT NULL REFERENCES mcu_perusahaan(uuid),
          periode_mulai DATE, periode_selesai DATE, total NUMERIC(16,2) NOT NULL DEFAULT 0,
          status VARCHAR(8) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'terbit', 'lunas', 'batal')),
          catatan TEXT, dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mcu_invoice_no_uq ON mcu_invoice (faskes_uuid, no_invoice);

        CREATE TABLE IF NOT EXISTS mcu_peserta (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_mcu VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50),
          perusahaan_uuid VARCHAR(255) REFERENCES mcu_perusahaan(uuid),
          paket_uuid VARCHAR(255) NOT NULL REFERENCES mcu_paket(uuid),
          tanggal DATE NOT NULL, harga NUMERIC(14,2) NOT NULL DEFAULT 0,
          cara_bayar VARCHAR(12) NOT NULL DEFAULT 'perorangan' CHECK (cara_bayar IN ('perorangan', 'korporasi')),
          payment_method INTEGER NOT NULL DEFAULT 1,
          status VARCHAR(10) NOT NULL DEFAULT 'terdaftar' CHECK (status IN ('terdaftar', 'proses', 'selesai', 'batal')),
          kesimpulan VARCHAR(12) CHECK (kesimpulan IN ('fit', 'fit_catatan', 'unfit')),
          saran TEXT, catatan_kesimpulan TEXT, dokter_pemeriksa_uuid VARCHAR(255), selesai_pada BIGINT,
          rad_order_uuid VARCHAR(255), invoice_uuid VARCHAR(255) REFERENCES mcu_invoice(uuid),
          alasan_batal TEXT, dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mcu_peserta_no_uq ON mcu_peserta (faskes_uuid, no_mcu);
        CREATE INDEX IF NOT EXISTS mcu_peserta_tgl_idx ON mcu_peserta (faskes_uuid, tanggal, status);

        -- Hasil per stasiun (data bebas per stasiun, mis. tanda vital, visus OD/OS, audiometri, hasil lab).
        CREATE TABLE IF NOT EXISTS mcu_pemeriksaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          peserta_uuid VARCHAR(255) NOT NULL REFERENCES mcu_peserta(uuid) ON DELETE CASCADE,
          stasiun VARCHAR(30) NOT NULL, data JSONB NOT NULL DEFAULT '{}',
          status VARCHAR(8) NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'selesai')),
          petugas VARCHAR(255), waktu BIGINT, ${WAKTU},
          UNIQUE (peserta_uuid, stasiun)
        );
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS mcu_pemeriksaan, mcu_peserta, mcu_invoice, mcu_paket_item, mcu_paket, mcu_perusahaan,
        rad_order_item, rad_order, rad_pemeriksaan,
        fisio_evaluasi, fisio_jadwal, fisio_order_tindakan, fisio_order, fisio_tindakan, fisio_bed,
        penunjang_nomor;
    `);
    // Nilai enum 'RAD'/'MCU' tidak dapat dihapus dari tipe PostgreSQL; dibiarkan.
  },
};
