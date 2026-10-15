'use strict';

// Skema modul Patologi Anatomi (penunjang-service, tabel berprefiks pa_). Alur instalasi PA:
//   order (RME / APS / rujukan luar) → validasi (tagihan ke Pembayaran) → penerimaan jaringan/spesimen (terima/tolak,
//   nomor PA tahunan mis. PA-26-00001 / SIT-26-00001 / FS-26-00001 / IHK-26-00001) → makroskopis (deskripsi, jumlah
//   blok/kaset & slide, foto opsional) → mikroskopis → diagnosis/kesimpulan (ICD-O topografi & morfologi, ICD-10) →
//   verifikasi dokter Sp.PA → selesai & cetak. Blok parafin & slide diarsipkan (lokasi rak, pinjam/kembali).
// Satu item order = satu kasus PA (nomor PA, spesimen, laporan sendiri). IHK merujuk kasus PA induk (blok parafin).
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.
// Nomor PA memakai penghitung penunjang_nomor (prefiks 'NOPA-<prefiks>', tanggal = tahun YYYY).

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        -- Datamaster pemeriksaan PA (tarif, jenis, ICD-9-CM, target waktu selesai dalam hari).
        CREATE TABLE IF NOT EXISTS pa_pemeriksaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(200) NOT NULL,
          jenis VARCHAR(15) NOT NULL CHECK (jenis IN ('histopatologi', 'sitologi', 'potong_beku', 'ihk')),
          kategori VARCHAR(100), harga NUMERIC(14,2) NOT NULL DEFAULT 0, kode_icd9 VARCHAR(20),
          tat_hari INTEGER NOT NULL DEFAULT 5, keterangan TEXT,
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_pemeriksaan_kode_uq ON pa_pemeriksaan (faskes_uuid, kode) WHERE deleted_at IS NULL;

        -- Petugas PA: dokter spesialis patologi anatomi (verifikator) & teknisi/analis histoteknik.
        -- Boleh terhubung ke practitioner (opsional) atau berdiri sendiri (nama + SIP).
        CREATE TABLE IF NOT EXISTS pa_petugas (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          practitioner_uuid VARCHAR(255), nama VARCHAR(200) NOT NULL,
          peran VARCHAR(10) NOT NULL CHECK (peran IN ('dokter', 'teknisi')),
          sip VARCHAR(100), keterangan TEXT, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_petugas_nama_uq ON pa_petugas (faskes_uuid, peran, nama) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS pa_order (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_order VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50), no_reg VARCHAR(50), rekam_medis_uuid VARCHAR(255),
          sumber VARCHAR(10) NOT NULL CHECK (sumber IN ('rme', 'aps', 'rujukan')),
          pelayanan VARCHAR(10) NOT NULL CHECK (pelayanan IN ('rajal', 'ranap', 'igd', 'aps')),
          lokasi_asal_uuid VARCHAR(255), dokter_pengirim_uuid VARCHAR(255),
          dokter_pengirim_luar VARCHAR(200), faskes_perujuk VARCHAR(200),
          payment_method INTEGER NOT NULL DEFAULT 1,
          klinis TEXT, riwayat TEXT, lokasi_anatomi VARCHAR(200), cara_pengambilan VARCHAR(100), catatan TEXT,
          cito BOOLEAN NOT NULL DEFAULT false,
          status VARCHAR(12) NOT NULL DEFAULT 'order' CHECK (status IN ('order', 'valid', 'diproses', 'selesai', 'ditolak', 'batal')),
          alasan_batal TEXT, divalidasi_oleh VARCHAR(255), divalidasi_pada BIGINT, selesai_pada BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_order_no_uq ON pa_order (faskes_uuid, no_order);
        CREATE INDEX IF NOT EXISTS pa_order_status_idx ON pa_order (faskes_uuid, status, created_at);
        CREATE INDEX IF NOT EXISTS pa_order_rm_idx ON pa_order (rekam_medis_uuid);
        CREATE INDEX IF NOT EXISTS pa_order_pasien_idx ON pa_order (patient_uuid);

        -- Item order = kasus PA. status: menunggu (spesimen belum diterima) → diterima → diproses (makroskopis)
        -- → verifikasi (diagnosis menunggu verifikasi Sp.PA) → selesai | ditolak (spesimen ditolak, dapat diterima ulang).
        CREATE TABLE IF NOT EXISTS pa_order_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES pa_order(uuid) ON DELETE CASCADE,
          pemeriksaan_uuid VARCHAR(255) NOT NULL REFERENCES pa_pemeriksaan(uuid),
          nama VARCHAR(200) NOT NULL, jenis VARCHAR(15) NOT NULL, harga NUMERIC(14,2) NOT NULL DEFAULT 0,
          tat_hari INTEGER NOT NULL DEFAULT 5,
          kasus_induk_uuid VARCHAR(255) REFERENCES pa_order_item(uuid),
          no_pa VARCHAR(30), waktu_terima BIGINT, target_selesai BIGINT, waktu_selesai BIGINT,
          status VARCHAR(12) NOT NULL DEFAULT 'menunggu'
            CHECK (status IN ('menunggu', 'diterima', 'diproses', 'verifikasi', 'selesai', 'ditolak')),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS pa_order_item_order_idx ON pa_order_item (order_uuid);
        CREATE UNIQUE INDEX IF NOT EXISTS pa_order_item_no_pa_uq ON pa_order_item (faskes_uuid, no_pa) WHERE no_pa IS NOT NULL;

        -- Penerimaan jaringan/spesimen (riwayat: spesimen ditolak lalu dikirim ulang tercatat semua).
        CREATE TABLE IF NOT EXISTS pa_spesimen (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_item_uuid VARCHAR(255) NOT NULL REFERENCES pa_order_item(uuid) ON DELETE CASCADE,
          status VARCHAR(10) NOT NULL CHECK (status IN ('diterima', 'ditolak')),
          jenis_spesimen VARCHAR(200), lokasi_anatomi VARCHAR(200), lateralitas VARCHAR(10),
          cara_pengambilan VARCHAR(100), jumlah_wadah INTEGER NOT NULL DEFAULT 1,
          fiksasi VARCHAR(20) CHECK (fiksasi IN ('formalin_10', 'alkohol_95', 'tanpa_fiksasi', 'lainnya')),
          waktu_pengambilan BIGINT, waktu_fiksasi BIGINT, waktu_terima BIGINT NOT NULL,
          kondisi TEXT, alasan_tolak TEXT, catatan TEXT, petugas VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS pa_spesimen_item_idx ON pa_spesimen (order_item_uuid);

        -- Laporan PA per kasus. gambar_makro: [{ nama, tipe, data(data URL PNG/JPEG) }].
        CREATE TABLE IF NOT EXISTS pa_laporan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_item_uuid VARCHAR(255) NOT NULL REFERENCES pa_order_item(uuid) ON DELETE CASCADE,
          makroskopis TEXT, jumlah_blok INTEGER NOT NULL DEFAULT 0, jumlah_slide INTEGER NOT NULL DEFAULT 0,
          gambar_makro JSONB NOT NULL DEFAULT '[]', petugas_makroskopis VARCHAR(255), waktu_makroskopis BIGINT,
          mikroskopis TEXT, waktu_mikroskopis BIGINT,
          diagnosis TEXT, icd_o_topografi VARCHAR(20), icd_o_morfologi VARCHAR(20), icd10 VARCHAR(20), icd10_nama VARCHAR(255),
          komentar TEXT, template_uuid VARCHAR(255), waktu_diagnosis BIGINT,
          status VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verifikasi')),
          dokter_pa_uuid VARCHAR(255), dokter_pa_nama VARCHAR(200), dokter_pa_sip VARCHAR(100),
          diverifikasi_oleh VARCHAR(255), waktu_verifikasi BIGINT, revisi INTEGER NOT NULL DEFAULT 0, alasan_revisi TEXT,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_laporan_item_uq ON pa_laporan (order_item_uuid) WHERE deleted_at IS NULL;

        -- Arsip blok parafin & slide. status: ada | dipinjam | dikembalikan (kembali ke arsip setelah dipinjam).
        CREATE TABLE IF NOT EXISTS pa_blok_slide (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_item_uuid VARCHAR(255) NOT NULL REFERENCES pa_order_item(uuid) ON DELETE CASCADE,
          jenis VARCHAR(6) NOT NULL CHECK (jenis IN ('blok', 'slide')),
          kode VARCHAR(60) NOT NULL, pewarnaan VARCHAR(50), keterangan TEXT, lokasi_rak VARCHAR(100),
          status VARCHAR(12) NOT NULL DEFAULT 'ada' CHECK (status IN ('ada', 'dipinjam', 'dikembalikan')),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_blok_slide_kode_uq ON pa_blok_slide (faskes_uuid, kode) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS pa_blok_slide_item_idx ON pa_blok_slide (order_item_uuid);

        -- Peminjaman blok/slide (konsultasi / second opinion / IHK luar).
        CREATE TABLE IF NOT EXISTS pa_peminjaman (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          blok_slide_uuid VARCHAR(255) NOT NULL REFERENCES pa_blok_slide(uuid) ON DELETE CASCADE,
          peminjam VARCHAR(200) NOT NULL, instansi VARCHAR(200), keperluan VARCHAR(30), catatan TEXT,
          waktu_pinjam BIGINT NOT NULL, rencana_kembali DATE, petugas_pinjam VARCHAR(255),
          waktu_kembali BIGINT, petugas_kembali VARCHAR(255), kondisi_kembali TEXT, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS pa_peminjaman_blok_idx ON pa_peminjaman (blok_slide_uuid);

        -- Template laporan (kasus normal/umum) untuk mempercepat pengisian.
        CREATE TABLE IF NOT EXISTS pa_template (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(200) NOT NULL,
          jenis VARCHAR(15) CHECK (jenis IN ('histopatologi', 'sitologi', 'potong_beku', 'ihk')),
          pemeriksaan_uuid VARCHAR(255) REFERENCES pa_pemeriksaan(uuid),
          makroskopis TEXT, mikroskopis TEXT, diagnosis TEXT NOT NULL,
          icd_o_topografi VARCHAR(20), icd_o_morfologi VARCHAR(20), icd10 VARCHAR(20), komentar TEXT,
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pa_template_nama_uq ON pa_template (faskes_uuid, nama) WHERE deleted_at IS NULL;
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS pa_template, pa_peminjaman, pa_blok_slide, pa_laporan, pa_spesimen, pa_order_item, pa_order,
        pa_petugas, pa_pemeriksaan CASCADE;
      DELETE FROM penunjang_nomor WHERE prefiks LIKE 'NOPA-%' OR prefiks = 'OPA';
    `);
  },
};
