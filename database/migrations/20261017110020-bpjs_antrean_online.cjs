'use strict';

// STD-0018 — Antrean Online BPJS (Mobile JKN): sinkron antrean & task id ke WS Antrean BPJS, ambil antrean dari
// Mobile JKN. Fitur katalog "antrian_online_bpjs" (mati bawaan) — lihat 20261017110000-sinkron_katalog_antrean_bpjs.
// Pemetaan poli/dokter ke kode BPJS memakai kolom yang sudah ada (lokasi.kd_poli_bpjs, practitioner.code_bpjs,
// dipetakan lewat Setting › Konfigurasi Integrasi › BPJS PCare — lihat bpjs-service/src/pcare.js). Pencatatan task id
// memakai tabel pencatat_task_id yang sudah ada di schema.sql.
// - integrations.antrean_*  : konfigurasi WS Antrean per faskes (satu baris per faskes, pola sama dengan pcare_*/
//                             vclaim_*). Rahasia (secret key, user key) disimpan terenkripsi oleh bpjs-service/src/rahasia.js.
// - bpjs_antrean_booking    : jembatan idempotensi antara kode booking lokal (admission_rj.kode_booking) dan
//                             permintaan Mobile JKN/pendaftaran lokal. referensi = kunci dedup dari permintaan BPJS
//                             (nomor identitas+jadwal+tanggal) agar permintaan ambil antrean yang diulang tidak
//                             membuat pendaftaran ganda (KT-8/KT-9).
// - bpjs_antrean_kirim      : jejak pengiriman tambah-antrean/task/batal ke WS Antrean (status, percobaan, respons
//                             tersanitasi) agar petugas bisa memantau & mengirim ulang (KF-7/KF-13).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE integrations
          ADD COLUMN IF NOT EXISTS antrean_bpjs_aktif BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS antrean_bpjs_mode VARCHAR(10) NOT NULL DEFAULT 'mock' CHECK (antrean_bpjs_mode IN ('mock', 'nyata')),
          ADD COLUMN IF NOT EXISTS antrean_bpjs_base_url VARCHAR(255),
          ADD COLUMN IF NOT EXISTS antrean_bpjs_cons_id VARCHAR(100),
          ADD COLUMN IF NOT EXISTS antrean_bpjs_secret_key TEXT,
          ADD COLUMN IF NOT EXISTS antrean_bpjs_user_key TEXT;

        CREATE TABLE IF NOT EXISTS bpjs_antrean_booking (
          uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          faskes_uuid VARCHAR(255) NOT NULL,
          kode_booking VARCHAR(100) NOT NULL,
          referensi VARCHAR(255),
          sumber VARCHAR(20) NOT NULL DEFAULT 'mobile_jkn' CHECK (sumber IN ('mobile_jkn', 'lokal')),
          rawat_jalan_uuid VARCHAR(255),
          jadwal_dokter_uuid VARCHAR(255),
          patient_uuid VARCHAR(255),
          tanggal_periksa BIGINT,
          status_lokal VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status_lokal IN ('aktif', 'batal')),
          status_sinkron VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status_sinkron IN ('menunggu', 'terkirim', 'gagal')),
          payload_ambil JSONB,
          created_at BIGINT NOT NULL,
          updated_at BIGINT,
          deleted_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bpjs_antrean_booking_kode_uq ON bpjs_antrean_booking (faskes_uuid, kode_booking);
        CREATE UNIQUE INDEX IF NOT EXISTS bpjs_antrean_booking_referensi_uq ON bpjs_antrean_booking (faskes_uuid, referensi)
          WHERE referensi IS NOT NULL AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bpjs_antrean_booking_faskes_idx ON bpjs_antrean_booking (faskes_uuid, status_lokal) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bpjs_antrean_kirim (
          uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          faskes_uuid VARCHAR(255) NOT NULL,
          booking_uuid UUID NOT NULL REFERENCES bpjs_antrean_booking (uuid),
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('tambah_antrean', 'task', 'batal')),
          task_id SMALLINT,
          status VARCHAR(20) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'terkirim', 'gagal')),
          percobaan INTEGER NOT NULL DEFAULT 0,
          kode_respons VARCHAR(50),
          pesan TEXT,
          payload JSONB,
          respons JSONB,
          created_at BIGINT NOT NULL,
          updated_at BIGINT
        );
        CREATE INDEX IF NOT EXISTS bpjs_antrean_kirim_booking_idx ON bpjs_antrean_kirim (booking_uuid, jenis, task_id);
        CREATE INDEX IF NOT EXISTS bpjs_antrean_kirim_status_idx ON bpjs_antrean_kirim (faskes_uuid, status);
        CREATE UNIQUE INDEX IF NOT EXISTS bpjs_antrean_kirim_task_uq ON bpjs_antrean_kirim (booking_uuid, task_id) WHERE jenis = 'task';
      `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS bpjs_antrean_kirim;
      DROP TABLE IF EXISTS bpjs_antrean_booking;
      ALTER TABLE integrations
        DROP COLUMN IF EXISTS antrean_bpjs_aktif,
        DROP COLUMN IF EXISTS antrean_bpjs_mode,
        DROP COLUMN IF EXISTS antrean_bpjs_base_url,
        DROP COLUMN IF EXISTS antrean_bpjs_cons_id,
        DROP COLUMN IF EXISTS antrean_bpjs_secret_key,
        DROP COLUMN IF EXISTS antrean_bpjs_user_key;
    `);
  },
};
