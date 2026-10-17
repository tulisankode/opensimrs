'use strict';

// Modul Kamar Operasi (penunjang-service/src/kamar-operasi): skema inti — master ruang OK, order operasi dari Plan
// asesmen RJ/RI/IGD (daftar tunggu, cito diprioritaskan), penjadwalan ruang & tim, pra-operasi (asesmen + penandaan
// lokasi + referensi inform_consents tindakan/anestesi), checklist keselamatan bedah WHO (sign in/time out/sign out),
// laporan operasi & anestesi, serta pemakaian BHP/obat OK (referensi order_alkes farmasi-service: tidak membangun
// mesin stok baru). Lihat dokumen Desain Teknis STD-0004.
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    // Pemakaian BHP/obat OK dibuat sebagai order alkes farmasi-service dengan jenis_pelayanan 'ok' (pemakaian.js).
    // ADD VALUE di luar transaksi (pola sama dengan migrasi fisio/radiologi/mcu/PA).
    await queryInterface.sequelize.query(`ALTER TYPE enum_order_alkes_jenis_pelayanan ADD VALUE IF NOT EXISTS 'ok'`);

    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS ok_ruang (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50) NOT NULL, nama VARCHAR(150) NOT NULL, lokasi_uuid VARCHAR(255),
          jam_mulai VARCHAR(5), jam_selesai VARCHAR(5), aktif BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_ruang_kode_uq ON ok_ruang (faskes_uuid, kode) WHERE deleted_at IS NULL;

        -- Order operasi dari Plan asesmen RJ/RI/IGD (pola order_alkes/fisio_order/pa_order); daftar tunggu diurutkan
        -- cito dahulu lalu created_at (ok_order_antrean_idx).
        CREATE TABLE IF NOT EXISTS ok_order (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_order VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50), no_reg VARCHAR(50), rekam_medis_uuid VARCHAR(255),
          sumber VARCHAR(10) NOT NULL CHECK (sumber IN ('rajal', 'ranap', 'igd')),
          lokasi_asal_uuid VARCHAR(255), dokter_pengirim_uuid VARCHAR(255),
          payment_method INTEGER NOT NULL DEFAULT 1, penjamin_uuid VARCHAR(255),
          diagnosis_kode VARCHAR(20), diagnosis_nama VARCHAR(255),
          jenis_operasi VARCHAR(10) NOT NULL CHECK (jenis_operasi IN ('elektif', 'cito')),
          durasi_estimasi_menit INTEGER NOT NULL CHECK (durasi_estimasi_menit > 0),
          status VARCHAR(20) NOT NULL DEFAULT 'menunggu_jadwal'
            CHECK (status IN ('menunggu_jadwal', 'perlu_klarifikasi', 'terjadwal', 'batal')),
          catatan_klarifikasi TEXT, alasan_batal TEXT, dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_order_no_uq ON ok_order (faskes_uuid, no_order);
        CREATE INDEX IF NOT EXISTS ok_order_antrean_idx ON ok_order (faskes_uuid, status, jenis_operasi, created_at);
        CREATE INDEX IF NOT EXISTS ok_order_rm_idx ON ok_order (rekam_medis_uuid);
        CREATE INDEX IF NOT EXISTS ok_order_pasien_idx ON ok_order (faskes_uuid, patient_uuid);

        CREATE TABLE IF NOT EXISTS ok_order_tindakan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES ok_order(uuid) ON DELETE CASCADE,
          kode_icd9cm VARCHAR(20) NOT NULL, nama_tindakan VARCHAR(255) NOT NULL,
          kelas_operasi VARCHAR(10) CHECK (kelas_operasi IN ('kecil', 'sedang', 'besar', 'khusus')),
          urutan INTEGER NOT NULL DEFAULT 1, ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ok_order_tindakan_order_idx ON ok_order_tindakan (order_uuid);

        -- Satu order aktif hanya boleh memiliki satu jadwal aktif (tidak batal); penjadwalan ulang mengubah baris
        -- yang sama (bukan membuat baris baru) agar riwayat sederhana.
        CREATE TABLE IF NOT EXISTS ok_jadwal (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          order_uuid VARCHAR(255) NOT NULL REFERENCES ok_order(uuid) ON DELETE CASCADE,
          ruang_uuid VARCHAR(255) NOT NULL REFERENCES ok_ruang(uuid),
          waktu_mulai BIGINT NOT NULL, waktu_selesai BIGINT NOT NULL CHECK (waktu_selesai > waktu_mulai),
          status VARCHAR(12) NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('terjadwal', 'selesai', 'batal')),
          alasan_perubahan TEXT, serah_terima TEXT, waktu_selesai_aktual BIGINT,
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_jadwal_order_aktif_uq ON ok_jadwal (order_uuid) WHERE status <> 'batal' AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS ok_jadwal_ruang_idx ON ok_jadwal (faskes_uuid, ruang_uuid, status, waktu_mulai, waktu_selesai);

        CREATE TABLE IF NOT EXISTS ok_jadwal_tim (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jadwal_uuid VARCHAR(255) NOT NULL REFERENCES ok_jadwal(uuid) ON DELETE CASCADE,
          practitioner_uuid VARCHAR(255) NOT NULL,
          peran VARCHAR(20) NOT NULL CHECK (peran IN ('operator', 'asisten', 'anestesi', 'perawat_instrumen', 'perawat_sirkuler')),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ok_jadwal_tim_jadwal_idx ON ok_jadwal_tim (jadwal_uuid);
        CREATE INDEX IF NOT EXISTS ok_jadwal_tim_praktisi_idx ON ok_jadwal_tim (faskes_uuid, practitioner_uuid, deleted_at);

        -- Persetujuan tindakan & anestesi memakai ulang inform_consents yang sudah ada (dua baris, satu per jenis).
        CREATE TABLE IF NOT EXISTS ok_praoperasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jadwal_uuid VARCHAR(255) NOT NULL REFERENCES ok_jadwal(uuid) ON DELETE CASCADE,
          asesmen_pra_bedah TEXT, asesmen_pra_anestesi TEXT, penandaan_lokasi TEXT,
          consent_tindakan_uuid VARCHAR(255), consent_anestesi_uuid VARCHAR(255),
          kebutuhan_darah TEXT, petugas VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_praoperasi_jadwal_uq ON ok_praoperasi (jadwal_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ok_checklist (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jadwal_uuid VARCHAR(255) NOT NULL REFERENCES ok_jadwal(uuid) ON DELETE CASCADE,
          tahap VARCHAR(10) NOT NULL CHECK (tahap IN ('sign_in', 'time_out', 'sign_out')),
          item JSONB NOT NULL DEFAULT '[]', waktu_diisi BIGINT NOT NULL, petugas VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_checklist_tahap_uq ON ok_checklist (jadwal_uuid, tahap) WHERE deleted_at IS NULL;

        -- tagihan_menunggu: daftar komponen (tindakan/sewa/jasa) yang belum terbentuk karena tarif belum dikonfigurasi
        -- (KF-17); diisi ulang setiap kali finalisasi diproses agar tidak menyesatkan bila tarif menyusul dikonfigurasi.
        CREATE TABLE IF NOT EXISTS ok_laporan_operasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jadwal_uuid VARCHAR(255) NOT NULL REFERENCES ok_jadwal(uuid) ON DELETE CASCADE,
          diagnosis_pra TEXT, diagnosis_pasca TEXT, tindakan_dilakukan TEXT, temuan TEXT,
          kirim_pa BOOLEAN NOT NULL DEFAULT false, pa_order_uuid VARCHAR(255),
          status_pa VARCHAR(10) CHECK (status_pa IN ('terkirim', 'tertunda')),
          komplikasi TEXT, jumlah_perdarahan_ml INTEGER,
          status VARCHAR(8) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
          revisi INTEGER NOT NULL DEFAULT 0, alasan_revisi TEXT, tagihan_menunggu JSONB NOT NULL DEFAULT '[]',
          difinalisasi_oleh VARCHAR(255), waktu_finalisasi BIGINT, dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_laporan_operasi_jadwal_uq ON ok_laporan_operasi (jadwal_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS ok_laporan_anestesi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jadwal_uuid VARCHAR(255) NOT NULL REFERENCES ok_jadwal(uuid) ON DELETE CASCADE,
          jenis_anestesi VARCHAR(50), obat JSONB NOT NULL DEFAULT '[]', monitoring JSONB NOT NULL DEFAULT '[]',
          aldrete_masuk SMALLINT CHECK (aldrete_masuk BETWEEN 0 AND 10),
          aldrete_keluar SMALLINT CHECK (aldrete_keluar BETWEEN 0 AND 10),
          waktu_aldrete_masuk BIGINT, waktu_aldrete_keluar BIGINT,
          serah_terima TEXT, petugas VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ok_laporan_anestesi_jadwal_uq ON ok_laporan_anestesi (jadwal_uuid) WHERE deleted_at IS NULL;

        -- Pemakaian BHP/obat OK: order_alkes_uuid menunjuk order alkes farmasi-service yang menjalankan pengurangan
        -- stok otoritatif (reduceQuantity saat verifikasi); tabel ini hanya mencatat kaitan ke operasi untuk laporan.
        CREATE TABLE IF NOT EXISTS ok_pemakaian_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jadwal_uuid VARCHAR(255) NOT NULL REFERENCES ok_jadwal(uuid) ON DELETE CASCADE,
          item_medis_uuid VARCHAR(255) NOT NULL, nama_item VARCHAR(255),
          lokasi_stok_uuid VARCHAR(255) NOT NULL, qty INTEGER NOT NULL CHECK (qty > 0),
          harga_satuan NUMERIC(14, 2) NOT NULL DEFAULT 0,
          order_alkes_uuid VARCHAR(255), petugas VARCHAR(255), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS ok_pemakaian_item_jadwal_idx ON ok_pemakaian_item (jadwal_uuid);

        -- Jejak balik order PA yang berasal dari kamar operasi (KT-17/18).
        ALTER TABLE pa_order ADD COLUMN IF NOT EXISTS ok_laporan_operasi_uuid VARCHAR(255);
        CREATE INDEX IF NOT EXISTS pa_order_ok_laporan_idx ON pa_order (ok_laporan_operasi_uuid) WHERE ok_laporan_operasi_uuid IS NOT NULL;
      `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS pa_order_ok_laporan_idx;
      ALTER TABLE pa_order DROP COLUMN IF EXISTS ok_laporan_operasi_uuid;
      DROP TABLE IF EXISTS ok_pemakaian_item, ok_laporan_anestesi, ok_laporan_operasi, ok_checklist, ok_praoperasi,
        ok_jadwal_tim, ok_jadwal, ok_order_tindakan, ok_order, ok_ruang;
    `);
  },
};
