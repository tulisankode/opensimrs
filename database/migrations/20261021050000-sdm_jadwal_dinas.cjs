'use strict';

const tabel = {
  hr_pola_shift: `unit_uuid VARCHAR(255), kode VARCHAR(30) NOT NULL, nama VARCHAR(150) NOT NULL,
    mulai_menit INTEGER NOT NULL CHECK (mulai_menit BETWEEN 0 AND 1439), selesai_menit INTEGER NOT NULL CHECK (selesai_menit BETWEEN 0 AND 1439),
    lintas_hari BOOLEAN NOT NULL, libur BOOLEAN NOT NULL, aktif BOOLEAN NOT NULL DEFAULT true, versi_kunci INTEGER NOT NULL DEFAULT 1,
    CHECK ((libur AND mulai_menit = 0 AND selesai_menit = 0 AND NOT lintas_hari) OR
      (NOT libur AND selesai_menit - mulai_menit + CASE WHEN lintas_hari THEN 1440 ELSE 0 END BETWEEN 1 AND 1439))`,
  hr_aturan_jadwal: `unit_uuid VARCHAR(255) NOT NULL, istirahat_minimum_menit INTEGER NOT NULL CHECK (istirahat_minimum_menit BETWEEN 0 AND 10080),
    batas_kerja_mingguan_menit INTEGER NOT NULL CHECK (batas_kerja_mingguan_menit BETWEEN 1 AND 10080),
    jenis_minggu VARCHAR(20) NOT NULL CHECK (jenis_minggu IN ('kalender','tetap')), jangkar_minggu BIGINT,
    tingkat_istirahat VARCHAR(20) NOT NULL CHECK (tingkat_istirahat IN ('pemblokir','peringatan')),
    tingkat_jam_mingguan VARCHAR(20) NOT NULL CHECK (tingkat_jam_mingguan IN ('pemblokir','peringatan')),
    tingkat_staf VARCHAR(20) NOT NULL CHECK (tingkat_staf IN ('pemblokir','peringatan')), versi_kunci INTEGER NOT NULL DEFAULT 1,
    CHECK (jenis_minggu <> 'tetap' OR jangkar_minggu IS NOT NULL)`,
  hr_kebutuhan_shift: `aturan_uuid VARCHAR(255) NOT NULL, pola_shift_uuid VARCHAR(255) NOT NULL,
    hari_minggu INTEGER CHECK (hari_minggu BETWEEN 0 AND 6), tanggal_kerja BIGINT, minimum_staf INTEGER NOT NULL CHECK (minimum_staf >= 0),
    CHECK (tanggal_kerja IS NOT NULL OR hari_minggu IS NOT NULL)`,
  hr_rotasi_shift: `unit_uuid VARCHAR(255) NOT NULL, nama VARCHAR(150) NOT NULL, urutan_pola JSONB NOT NULL CHECK (jsonb_array_length(urutan_pola) > 0),
    aktif BOOLEAN NOT NULL DEFAULT true, versi_kunci INTEGER NOT NULL DEFAULT 1`,
  hr_kewenangan_jadwal: `unit_uuid VARCHAR(255) NOT NULL, username VARCHAR(255) NOT NULL,
    kewenangan VARCHAR(20) NOT NULL CHECK (kewenangan IN ('lihat','susun','setujui','terbit','putus_tukar')),
    berlaku_mulai BIGINT NOT NULL, berlaku_sampai BIGINT, CHECK (berlaku_sampai IS NULL OR berlaku_sampai > berlaku_mulai)`,
  hr_jadwal_dinas: `unit_uuid VARCHAR(255) NOT NULL, periode_mulai BIGINT NOT NULL, versi_aktif_uuid VARCHAR(255)`,
  hr_jadwal_versi: `jadwal_uuid VARCHAR(255) NOT NULL, nomor_versi INTEGER NOT NULL CHECK (nomor_versi > 0), versi_asal_uuid VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('draf','diajukan','disetujui','terbit')), versi_kunci INTEGER NOT NULL DEFAULT 1,
    alasan_revisi TEXT, potret_aturan JSONB, dibuat_oleh VARCHAR(255) NOT NULL, diajukan_oleh VARCHAR(255), disetujui_oleh VARCHAR(255),
    diajukan_pada BIGINT, disetujui_pada BIGINT, diterbitkan_pada BIGINT, ditolak_oleh VARCHAR(255), ditolak_pada BIGINT`,
  hr_penempatan_shift: `versi_uuid VARCHAR(255) NOT NULL, kepegawaian_uuid VARCHAR(255) NOT NULL, pola_shift_uuid VARCHAR(255) NOT NULL,
    tanggal_kerja BIGINT NOT NULL, mulai_epoch BIGINT, selesai_epoch BIGINT, libur BOOLEAN NOT NULL, potret_shift JSONB NOT NULL,
    CHECK ((libur AND mulai_epoch IS NULL AND selesai_epoch IS NULL) OR (NOT libur AND mulai_epoch IS NOT NULL AND selesai_epoch IS NOT NULL AND selesai_epoch > mulai_epoch AND selesai_epoch - mulai_epoch < 86400))`,
  hr_validasi_jadwal: `versi_uuid VARCHAR(255) NOT NULL, versi_kunci_diperiksa INTEGER NOT NULL, diperiksa_pada BIGINT NOT NULL,
    aturan_diperiksa JSONB, temuan JSONB NOT NULL, boleh_diajukan BOOLEAN NOT NULL`,
  hr_tukar_dinas: `penempatan_asal_uuid VARCHAR(255) NOT NULL, penempatan_pengganti_uuid VARCHAR(255) NOT NULL,
    versi_asal_uuid VARCHAR(255) NOT NULL, versi_pengganti_uuid VARCHAR(255) NOT NULL,
    pemohon_kepegawaian_uuid VARCHAR(255) NOT NULL, pengganti_kepegawaian_uuid VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('menunggu_pengganti','menunggu_kepala','ditolak','dibatalkan','diterapkan')),
    alasan TEXT NOT NULL, alasan_keputusan TEXT, ditanggapi_oleh VARCHAR(255), ditanggapi_pada BIGINT,
    diputuskan_oleh VARCHAR(255), diputuskan_pada BIGINT, versi_kunci INTEGER NOT NULL DEFAULT 1,
    CHECK (pemohon_kepegawaian_uuid <> pengganti_kepegawaian_uuid AND penempatan_asal_uuid <> penempatan_pengganti_uuid)`,
  hr_peristiwa_jadwal: `jadwal_uuid VARCHAR(255), versi_uuid VARCHAR(255), tukar_uuid VARCHAR(255), jenis VARCHAR(80) NOT NULL,
    pelaku VARCHAR(255) NOT NULL, status_sebelum VARCHAR(30), status_sesudah VARCHAR(30), alasan TEXT, ringkasan JSONB`,
};
const relasi = [
  ['hr_kebutuhan_shift','aturan_uuid','hr_aturan_jadwal'], ['hr_kebutuhan_shift','pola_shift_uuid','hr_pola_shift'],
  ['hr_jadwal_dinas','versi_aktif_uuid','hr_jadwal_versi'], ['hr_jadwal_versi','jadwal_uuid','hr_jadwal_dinas'],
  ['hr_jadwal_versi','versi_asal_uuid','hr_jadwal_versi'], ['hr_penempatan_shift','versi_uuid','hr_jadwal_versi'],
  ['hr_penempatan_shift','pola_shift_uuid','hr_pola_shift'], ['hr_validasi_jadwal','versi_uuid','hr_jadwal_versi'],
  ['hr_tukar_dinas','penempatan_asal_uuid','hr_penempatan_shift'], ['hr_tukar_dinas','penempatan_pengganti_uuid','hr_penempatan_shift'],
  ['hr_tukar_dinas','versi_asal_uuid','hr_jadwal_versi'], ['hr_tukar_dinas','versi_pengganti_uuid','hr_jadwal_versi'],
  ['hr_peristiwa_jadwal','jadwal_uuid','hr_jadwal_dinas'], ['hr_peristiwa_jadwal','versi_uuid','hr_jadwal_versi'], ['hr_peristiwa_jadwal','tukar_uuid','hr_tukar_dinas'],
];
module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    await sq.transaction(async (transaction) => {
      const q = (sql) => sq.query(sql, { transaction });
      for (const [nama, kolom] of Object.entries(tabel)) await q(`CREATE TABLE IF NOT EXISTS ${nama} (
        uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, ${kolom},
        created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT, UNIQUE (faskes_uuid, uuid))`);
      for (const [asal, kolom, tujuan] of relasi) {
        const nama = `${asal}_${kolom}_fk`;
        await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${nama}' AND conrelid = '${asal}'::regclass)
          THEN ALTER TABLE ${asal} ADD CONSTRAINT ${nama} FOREIGN KEY (faskes_uuid, ${kolom}) REFERENCES ${tujuan} (faskes_uuid, uuid); END IF; END $$`);
      }
      const indeks = [
        ['pola_kode', 'hr_pola_shift', 'faskes_uuid, COALESCE(unit_uuid, \'\'), kode', true],
        ['aturan_unit', 'hr_aturan_jadwal', 'faskes_uuid, unit_uuid', true],
        ['jadwal_bulan', 'hr_jadwal_dinas', 'faskes_uuid, unit_uuid, periode_mulai', true],
        ['versi_nomor', 'hr_jadwal_versi', 'faskes_uuid, jadwal_uuid, nomor_versi', true],
        ['versi_kerja', 'hr_jadwal_versi', 'faskes_uuid, jadwal_uuid', true, " AND status IN ('draf','diajukan','disetujui')"],
        ['penempatan_hari', 'hr_penempatan_shift', 'faskes_uuid, versi_uuid, kepegawaian_uuid, tanggal_kerja', true],
        ['penempatan_rentang', 'hr_penempatan_shift', 'faskes_uuid, kepegawaian_uuid, mulai_epoch, selesai_epoch'],
        ['kewenangan_akun', 'hr_kewenangan_jadwal', 'faskes_uuid, username, unit_uuid'],
        ['tukar_peserta', 'hr_tukar_dinas', 'faskes_uuid, status, pemohon_kepegawaian_uuid, pengganti_kepegawaian_uuid'],
        ['peristiwa_versi', 'hr_peristiwa_jadwal', 'faskes_uuid, versi_uuid, created_at'],
        ['validasi_versi', 'hr_validasi_jadwal', 'faskes_uuid, versi_uuid, diperiksa_pada'],
      ];
      for (const [nama, tabel, kolom, unik, tambahan = ''] of indeks) await q(`CREATE ${unik ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS hr_jd_${nama}_idx ON ${tabel} (${kolom}) WHERE deleted_at IS NULL${tambahan}`);
    });
  },
  async down() {
    // Riwayat dipertahankan; koreksi struktur memakai migrasi baru.
  },
};
