'use strict';

// Modul Akuntansi & Remunerasi — fitur Remunerasi / jasa pelayanan (STD-0032, penunjang-service/src/akuntansi/remunerasi):
//   remunerasi_skema         konfigurasi jaspel per faskes, BERVERSI (porsi per jenis layanan × kategori item, porsi
//                            langsung/kebersamaan, indeks profesi, bobot indeks, rentang kinerja). Draf dapat diubah;
//                            setelah disahkan tidak dapat diubah (perubahan = versi baru). Nilai bawaan = contoh.
//   remunerasi_penerima      dokter/nakes penerima (practitioner) per faskes: profesi, unit, indeks (pendidikan, risiko,
//                            jabatan, masa kerja), ikut pool kebersamaan, aktif
//   remunerasi_periode       periode bulanan (Asia/Jakarta): draf → dihitung → diverifikasi → disetujui → dibayar, dengan
//                            versi skema & hash masukan perhitungan, pelaku tiap tahap, dan jurnal akuntansi terkait
//   remunerasi_sumber        item tagihan lunas yang menjadi dasar (atau dikecualikan) beserta porsi & jasa per item
//   remunerasi_rincian       hasil per penerima (jasa langsung, kebersamaan, koreksi, total) + snapshot rumus/indeks
//   remunerasi_kinerja       capaian kinerja per penerima per periode (bawaan 100%)
//   remunerasi_koreksi       koreksi beralasan (± nominal) per penerima, dicatat di periode draf (rujukan periode lama)
//   remunerasi_penyelesaian  penanganan pengecualian per item: tetapkan penerima / abaikan, beralasan
// Uang NUMERIC(18,2) (dihitung dalam sen di aplikasi). Konvensi: uuid varchar (uuidv7 aplikasi), faskes_uuid, waktu
// epoch detik, soft delete deleted_at. Idempoten (IF NOT EXISTS).

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS remunerasi_skema (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          versi INT NOT NULL CHECK (versi > 0),
          nama VARCHAR(255) NOT NULL,
          berlaku_mulai BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf','disahkan')),
          contoh BOOLEAN NOT NULL DEFAULT false,
          konfigurasi JSONB NOT NULL,
          catatan TEXT,
          dasar_pengesahan TEXT, disahkan_oleh VARCHAR(255), disahkan_pada BIGINT,
          dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS remunerasi_skema_versi_uq ON remunerasi_skema (faskes_uuid, versi);
        CREATE INDEX IF NOT EXISTS remunerasi_skema_berlaku_idx ON remunerasi_skema (faskes_uuid, status, berlaku_mulai);

        CREATE TABLE IF NOT EXISTS remunerasi_penerima (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          practitioner_uuid VARCHAR(255) NOT NULL,
          profesi VARCHAR(40) NOT NULL,
          unit VARCHAR(255),
          indeks JSONB NOT NULL DEFAULT '{}'::jsonb,
          ikut_kebersamaan BOOLEAN NOT NULL DEFAULT true,
          aktif BOOLEAN NOT NULL DEFAULT true,
          catatan TEXT, dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS remunerasi_penerima_uq ON remunerasi_penerima (faskes_uuid, practitioner_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS remunerasi_periode (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nomor VARCHAR(40) NOT NULL,
          tahun INT NOT NULL, bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
          status VARCHAR(20) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf','dihitung','diverifikasi','disetujui','dibayar')),
          skema_uuid VARCHAR(255) REFERENCES remunerasi_skema(uuid), skema_versi INT,
          hash_hitung VARCHAR(64),
          ringkasan JSONB,
          total_dasar NUMERIC(18,2) NOT NULL DEFAULT 0, total_jaspel NUMERIC(18,2) NOT NULL DEFAULT 0,
          total_langsung NUMERIC(18,2) NOT NULL DEFAULT 0, total_kebersamaan NUMERIC(18,2) NOT NULL DEFAULT 0,
          total_koreksi NUMERIC(18,2) NOT NULL DEFAULT 0, total NUMERIC(18,2) NOT NULL DEFAULT 0,
          jumlah_penerima INT NOT NULL DEFAULT 0, jumlah_pengecualian INT NOT NULL DEFAULT 0,
          catatan TEXT, dibuat_oleh VARCHAR(255),
          dihitung_oleh VARCHAR(255), dihitung_pada BIGINT,
          diverifikasi_oleh VARCHAR(255), diverifikasi_pada BIGINT, catatan_verifikasi TEXT,
          disetujui_oleh VARCHAR(255), disetujui_pada BIGINT, catatan_persetujuan TEXT, jurnal_uuid VARCHAR(255),
          dikembalikan_oleh VARCHAR(255), dikembalikan_pada BIGINT, alasan_kembali TEXT,
          dibayar_oleh VARCHAR(255), dibayar_pada BIGINT, tanggal_bayar BIGINT, metode_bayar VARCHAR(20),
          referensi_bayar VARCHAR(255), jurnal_bayar_uuid VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS remunerasi_periode_uq ON remunerasi_periode (faskes_uuid, tahun, bulan) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS remunerasi_periode_status_idx ON remunerasi_periode (faskes_uuid, status);

        CREATE TABLE IF NOT EXISTS remunerasi_sumber (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          periode_uuid VARCHAR(255) NOT NULL REFERENCES remunerasi_periode(uuid),
          bill_item_uuid VARCHAR(255) NOT NULL, bill_uuid VARCHAR(255), induk_uuid VARCHAR(255), service_bill_uuid VARCHAR(255),
          invoice_code VARCHAR(255), no_reg VARCHAR(255), patient_uuid VARCHAR(255),
          jenis_layanan VARCHAR(20), kategori VARCHAR(20), nama_item VARCHAR(255),
          tanggal_layanan BIGINT, tanggal_lunas BIGINT,
          nilai NUMERIC(18,2) NOT NULL, persen_bp INT NOT NULL,
          jaspel NUMERIC(18,2) NOT NULL, langsung NUMERIC(18,2) NOT NULL DEFAULT 0, kebersamaan NUMERIC(18,2) NOT NULL DEFAULT 0,
          practitioner_uuid VARCHAR(255), pelaksana_uuid VARCHAR(255),
          status VARCHAR(20) NOT NULL CHECK (status IN ('dihitung','pengecualian','diabaikan','tertahan_penjamin','periode_lain')),
          alasan TEXT,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS remunerasi_sumber_uq ON remunerasi_sumber (periode_uuid, bill_item_uuid);
        CREATE INDEX IF NOT EXISTS remunerasi_sumber_item_idx ON remunerasi_sumber (faskes_uuid, bill_item_uuid);
        CREATE INDEX IF NOT EXISTS remunerasi_sumber_pelaksana_idx ON remunerasi_sumber (periode_uuid, pelaksana_uuid);

        CREATE TABLE IF NOT EXISTS remunerasi_rincian (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          periode_uuid VARCHAR(255) NOT NULL REFERENCES remunerasi_periode(uuid),
          practitioner_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(255), profesi VARCHAR(40), unit VARCHAR(255),
          jumlah_layanan INT NOT NULL DEFAULT 0, nilai_dasar NUMERIC(18,2) NOT NULL DEFAULT 0,
          langsung NUMERIC(18,2) NOT NULL DEFAULT 0, kebersamaan NUMERIC(18,2) NOT NULL DEFAULT 0,
          koreksi NUMERIC(18,2) NOT NULL DEFAULT 0, total NUMERIC(18,2) NOT NULL DEFAULT 0,
          rumus JSONB,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS remunerasi_rincian_uq ON remunerasi_rincian (periode_uuid, practitioner_uuid);

        CREATE TABLE IF NOT EXISTS remunerasi_kinerja (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          periode_uuid VARCHAR(255) NOT NULL REFERENCES remunerasi_periode(uuid),
          practitioner_uuid VARCHAR(255) NOT NULL,
          nilai_bp INT NOT NULL CHECK (nilai_bp >= 0),
          catatan TEXT, diisi_oleh VARCHAR(255),
          created_at BIGINT NOT NULL, updated_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS remunerasi_kinerja_uq ON remunerasi_kinerja (periode_uuid, practitioner_uuid);

        CREATE TABLE IF NOT EXISTS remunerasi_koreksi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          periode_uuid VARCHAR(255) NOT NULL REFERENCES remunerasi_periode(uuid),
          practitioner_uuid VARCHAR(255) NOT NULL,
          nilai NUMERIC(18,2) NOT NULL CHECK (nilai <> 0),
          alasan TEXT NOT NULL,
          rujukan_periode_uuid VARCHAR(255) REFERENCES remunerasi_periode(uuid),
          dibuat_oleh VARCHAR(255), dihapus_oleh VARCHAR(255), alasan_hapus TEXT,
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS remunerasi_koreksi_periode_idx ON remunerasi_koreksi (periode_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS remunerasi_penyelesaian (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          periode_uuid VARCHAR(255) NOT NULL REFERENCES remunerasi_periode(uuid),
          bill_item_uuid VARCHAR(255) NOT NULL,
          tindakan VARCHAR(20) NOT NULL CHECK (tindakan IN ('tetapkan','abaikan')),
          practitioner_uuid VARCHAR(255),
          alasan TEXT NOT NULL,
          dibuat_oleh VARCHAR(255),
          created_at BIGINT NOT NULL, updated_at BIGINT,
          CONSTRAINT remunerasi_penyelesaian_penerima_chk CHECK (tindakan = 'abaikan' OR practitioner_uuid IS NOT NULL)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS remunerasi_penyelesaian_uq ON remunerasi_penyelesaian (periode_uuid, bill_item_uuid);
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS remunerasi_penyelesaian, remunerasi_koreksi, remunerasi_kinerja, remunerasi_rincian,
        remunerasi_sumber, remunerasi_periode, remunerasi_penerima, remunerasi_skema;
    `);
  },
};
