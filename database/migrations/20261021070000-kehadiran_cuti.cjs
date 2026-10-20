'use strict';

// STD-0039: referensi pegawai tetap memakai hr_kepegawaian; tidak membuat identitas baru.
const tabel = {
  hr_jenis_cuti: `kode varchar(50) NOT NULL, nama varchar(150) NOT NULL, memotong_saldo boolean NOT NULL,
    lampiran_wajib boolean NOT NULL, aktif boolean NOT NULL DEFAULT true, versi integer NOT NULL DEFAULT 1`,
  hr_kebijakan_cuti: `tahun integer NOT NULL, data jsonb NOT NULL, versi integer NOT NULL`,
  hr_atasan_pegawai: `kepegawaian_uuid varchar(255) NOT NULL, atasan_uuid varchar(255) NOT NULL`,
  hr_cakupan_unit: `username varchar(120) NOT NULL, unit_uuid varchar(255) NOT NULL, aksi varchar(50) NOT NULL`,
  hr_kehadiran: `kepegawaian_uuid varchar(255) NOT NULL, waktu bigint NOT NULL, tanggal_operasional varchar(10) NOT NULL,
    jenis varchar(10) NOT NULL CHECK (jenis IN ('masuk', 'pulang')), sumber varchar(20) NOT NULL,
    kode_mesin varchar(100), catatan_lokasi varchar(500), kunci_deduplikasi varchar(64) NOT NULL,
    impor_uuid varchar(255), versi integer NOT NULL DEFAULT 1`,
  hr_kehadiran_koreksi: `kehadiran_uuid varchar(255) NOT NULL, sebelum jsonb, sesudah jsonb NOT NULL, alasan text NOT NULL`,
  hr_absensi_impor: `pemilik varchar(120) NOT NULL, pemetaan jsonb NOT NULL, kode_mesin varchar(100) NOT NULL,
    status varchar(20) NOT NULL, ringkasan jsonb, kedaluwarsa bigint NOT NULL`,
  hr_absensi_impor_baris: `impor_uuid varchar(255) NOT NULL, nomor_baris integer NOT NULL,
    normalisasi jsonb, status varchar(20) NOT NULL, pesan text`,
  hr_lampiran_cuti: `pemilik varchar(120) NOT NULL, pengajuan_uuid varchar(255), berkas bytea NOT NULL,
    tipe varchar(100) NOT NULL, ukuran integer NOT NULL, hash varchar(64) NOT NULL, kedaluwarsa bigint NOT NULL`,
  hr_pengajuan_cuti: `kepegawaian_uuid varchar(255) NOT NULL, pemohon varchar(120) NOT NULL,
    jenis_uuid varchar(255) NOT NULL, tanggal_mulai varchar(10) NOT NULL, tanggal_selesai varchar(10) NOT NULL,
    alasan text NOT NULL, status varchar(30) NOT NULL, atasan_uuid varchar(255) NOT NULL,
    potret jsonb NOT NULL, hari jsonb NOT NULL, memotong_saldo boolean NOT NULL,
    pembatalan boolean NOT NULL DEFAULT false, versi integer NOT NULL DEFAULT 1, kunci_idempotensi varchar(120) NOT NULL`,
  hr_pengajuan_cuti_keputusan: `pengajuan_uuid varchar(255) NOT NULL, tahap varchar(40) NOT NULL,
    aksi varchar(40) NOT NULL, catatan text`,
  hr_saldo_cuti_tahun: `kepegawaian_uuid varchar(255) NOT NULL, tahun integer NOT NULL, kebijakan_uuid varchar(255) NOT NULL,
    kedaluwarsa_carry bigint NOT NULL`,
  hr_saldo_cuti_mutasi: `saldo_uuid varchar(255) NOT NULL, pengajuan_uuid varchar(255), sumber varchar(20) NOT NULL,
    jenis varchar(30) NOT NULL, jumlah_hari numeric(8,2) NOT NULL, kedaluwarsa bigint,
    alasan text, kunci_idempotensi varchar(180) NOT NULL`,
  hr_saldo_cuti_reservasi: `saldo_uuid varchar(255) NOT NULL, pengajuan_uuid varchar(255) NOT NULL,
    jumlah_hari numeric(8,2) NOT NULL, aktif boolean NOT NULL DEFAULT true`,
  hr_kehadiran_ekspor: `pemilik varchar(120) NOT NULL, parameter jsonb NOT NULL, kedaluwarsa bigint NOT NULL`,
};
const indeks = [
  ['hr_jenis_cuti_kode', 'hr_jenis_cuti', 'faskes_uuid, kode', ' WHERE deleted_at IS NULL'],
  ['hr_kebijakan_cuti_versi', 'hr_kebijakan_cuti', 'faskes_uuid, tahun, versi', ''],
  ['hr_atasan_pegawai_aktif', 'hr_atasan_pegawai', 'faskes_uuid, kepegawaian_uuid', ' WHERE deleted_at IS NULL'],
  ['hr_cakupan_unit_aktif', 'hr_cakupan_unit', 'faskes_uuid, username, unit_uuid, aksi', ' WHERE deleted_at IS NULL'],
  ['hr_kehadiran_deduplikasi', 'hr_kehadiran', 'faskes_uuid, kunci_deduplikasi', ''],
  ['hr_absensi_impor_nomor', 'hr_absensi_impor_baris', 'faskes_uuid, impor_uuid, nomor_baris', ''],
  ['hr_pengajuan_cuti_idempotensi', 'hr_pengajuan_cuti', 'faskes_uuid, pemohon, kunci_idempotensi', ''],
  ['hr_saldo_cuti_tahun_unik', 'hr_saldo_cuti_tahun', 'faskes_uuid, kepegawaian_uuid, tahun', ''],
  ['hr_saldo_mutasi_idempotensi', 'hr_saldo_cuti_mutasi', 'faskes_uuid, kunci_idempotensi', ''],
  ['hr_saldo_reservasi_unik', 'hr_saldo_cuti_reservasi', 'faskes_uuid, saldo_uuid, pengajuan_uuid', ''],
];
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const sql = (s) => queryInterface.sequelize.query(s, { transaction });
      for (const [namaTabel, definisi] of Object.entries(tabel)) {
        await sql(`CREATE TABLE IF NOT EXISTS ${namaTabel} (
          uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, ${definisi},
          dibuat_oleh varchar(120), created_at bigint NOT NULL, updated_at bigint NOT NULL, deleted_at bigint
        )`);
        // Gagal secara jelas bila tabel yang sudah ada mempunyai bentuk berbeda.
        const struktur = await queryInterface.describeTable(namaTabel, { transaction });
        const kolom = `uuid varchar(255) PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, ${definisi}, dibuat_oleh varchar(120), created_at bigint NOT NULL, updated_at bigint NOT NULL, deleted_at bigint`;
        const tipeBaku = (v) => v.toUpperCase().replace(/CHARACTER VARYING/g, 'VARCHAR').replace(/DECIMAL/g, 'NUMERIC').replace(/\s/g, '').replace(/NUMERIC\(\d+,\d+\)/g, 'NUMERIC');
        for (const bagian of kolom.split(/,(?![^()]*\))/)) {
          const [, nama, tipe] = bagian.trim().match(/^(\w+)\s+(\w+(?:\([^)]*\))?)/) ?? [];
          if (!nama || !struktur[nama] || tipeBaku(struktur[nama].type) !== tipeBaku(tipe) || (/NOT NULL|PRIMARY KEY/.test(bagian) && struktur[nama].allowNull)) {
            throw new Error(`Skema ${namaTabel} tidak sesuai pada kolom ${nama ?? bagian}`);
          }
          if (tipe.startsWith('numeric')) {
            const [rincian] = await queryInterface.sequelize.query(`SELECT numeric_precision, numeric_scale FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = :tabel AND column_name = :kolom`,
              { replacements: { tabel: namaTabel, kolom: nama }, transaction });
            if (Number(rincian[0]?.numeric_precision) !== 8 || Number(rincian[0]?.numeric_scale) !== 2) throw new Error(`Presisi ${namaTabel}.${nama} harus NUMERIC(8,2)`);
          }
        }
        await sql(`CREATE INDEX IF NOT EXISTS ${namaTabel}_faskes_aktif ON ${namaTabel} (faskes_uuid) WHERE deleted_at IS NULL`);
      }
      for (const [nama, tabel, kolom, syarat] of indeks) await sql(`CREATE UNIQUE INDEX IF NOT EXISTS ${nama} ON ${tabel} (${kolom})${syarat}`);
      await sql(`CREATE INDEX IF NOT EXISTS hr_kehadiran_periode ON hr_kehadiran (faskes_uuid, kepegawaian_uuid, waktu) WHERE deleted_at IS NULL`);
      await sql(`CREATE INDEX IF NOT EXISTS hr_pengajuan_cuti_periode ON hr_pengajuan_cuti (faskes_uuid, kepegawaian_uuid, tanggal_mulai, tanggal_selesai) WHERE deleted_at IS NULL`);
    });
  },
  async down() {
    // Data kehadiran dan riwayat saldo dipertahankan; pemulihan memakai migrasi koreksi baru.
  },
};
