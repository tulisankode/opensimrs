'use strict';

// Skema modul Koding & Rekam Medis (penunjang-service, tabel berprefiks koding_/rm_). Alur:
//   kunjungan RJ/RI/IGD pulang → worklist koding (koding_kunjungan) → koder menetapkan diagnosis ICD-10
//   (koding_diagnosis) & tindakan ICD-9-CM (koding_tindakan) sebagai snapshot bernomor versi (append-only,
//   versi terbaru = koding_kunjungan.versi_terakhir) → klarifikasi ke DPJP bila perlu (koding_klarifikasi) →
//   checklist kelengkapan berkas (koding_checklist_item master, koding_checklist_kunjungan status per kunjungan) →
//   bila diagnosis utama ada, checklist wajib lengkap, dan tidak ada klarifikasi menghalangi yang terbuka,
//   kunjungan difinalisasi (status 'siap_klaim'). Diagnosis dokter asal tetap di RME (MongoDB, dibaca via
//   rekamedis-service); hanya referensinya (sumber_dokter_uuid) yang dicatat di sini.
// Peminjaman & retensi berkas fisik (rm_peminjaman, rm_jenis_berkas, rm_retensi_usulan) berdiri sendiri, mengikuti
// gaya pencatatan pa_peminjaman tetapi untuk berkas rekam medis (per no_rm), bukan blok/slide PA.
// Konvensi: uuid varchar (uuidv7 dari aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at
// (kecuali koding_diagnosis/koding_tindakan yang append-only sehingga tidak pernah diubah/dihapus).

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        -- Agregat koding per kunjungan. kunjungan_tipe + kunjungan_uuid menunjuk ke rawat_jalans/rawat_inaps/
        -- instalasi_gawat_darurats (tiga tabel sumber berbeda, tanpa FK lintas tabel yang kaku).
        CREATE TABLE IF NOT EXISTS koding_kunjungan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kunjungan_tipe VARCHAR(3) NOT NULL CHECK (kunjungan_tipe IN ('rj', 'ri', 'igd')),
          kunjungan_uuid VARCHAR(255) NOT NULL, no_reg VARCHAR(50), no_rm VARCHAR(50), patient_uuid VARCHAR(255),
          status VARCHAR(12) NOT NULL DEFAULT 'proses' CHECK (status IN ('proses', 'siap_klaim')),
          versi_terakhir INTEGER NOT NULL DEFAULT 0,
          finalisasi_at BIGINT, koder_uuid VARCHAR(255),
          dibuat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS koding_kunjungan_uq
          ON koding_kunjungan (faskes_uuid, kunjungan_tipe, kunjungan_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS koding_kunjungan_status_idx ON koding_kunjungan (faskes_uuid, status, finalisasi_at);
        CREATE INDEX IF NOT EXISTS koding_kunjungan_no_rm_idx ON koding_kunjungan (faskes_uuid, no_rm);

        -- Riwayat diagnosis hasil koding, append-only per versi (versi terbaru = koding_kunjungan.versi_terakhir).
        -- Satu versi hanya boleh memiliki satu baris peran 'utama' (ditegakkan di lapisan layanan, bukan constraint,
        -- karena beberapa baris sekunder memakai versi yang sama).
        CREATE TABLE IF NOT EXISTS koding_diagnosis (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          koding_kunjungan_uuid VARCHAR(255) NOT NULL REFERENCES koding_kunjungan(uuid) ON DELETE CASCADE,
          versi INTEGER NOT NULL, diagnosis_uuid VARCHAR(255) NOT NULL, kode VARCHAR(20) NOT NULL, nama VARCHAR(255),
          peran VARCHAR(10) NOT NULL CHECK (peran IN ('utama', 'sekunder')),
          sumber_dokter_uuid VARCHAR(255), alasan TEXT, koder_uuid VARCHAR(255),
          created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS koding_diagnosis_kunjungan_idx ON koding_diagnosis (koding_kunjungan_uuid, versi);

        -- Riwayat tindakan hasil koding, append-only per versi (ICD-9-CM).
        CREATE TABLE IF NOT EXISTS koding_tindakan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          koding_kunjungan_uuid VARCHAR(255) NOT NULL REFERENCES koding_kunjungan(uuid) ON DELETE CASCADE,
          versi INTEGER NOT NULL, icd9_uuid VARCHAR(255) NOT NULL, kode VARCHAR(20) NOT NULL, nama VARCHAR(255),
          alasan TEXT, koder_uuid VARCHAR(255), created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS koding_tindakan_kunjungan_idx ON koding_tindakan (koding_kunjungan_uuid, versi);

        -- Master item checklist kelengkapan per faskes. berlaku_kunjungan_tipe NULL = berlaku untuk semua jenis kunjungan.
        CREATE TABLE IF NOT EXISTS koding_checklist_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nama VARCHAR(200) NOT NULL, berlaku_kunjungan_tipe VARCHAR(3)[], wajib BOOLEAN NOT NULL DEFAULT true,
          urutan INTEGER NOT NULL DEFAULT 0, status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS koding_checklist_item_nama_uq
          ON koding_checklist_item (faskes_uuid, nama) WHERE deleted_at IS NULL;

        -- Status checklist per kunjungan (mutable, bukan riwayat): lengkap | tidak_lengkap | tidak_berlaku.
        CREATE TABLE IF NOT EXISTS koding_checklist_kunjungan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          koding_kunjungan_uuid VARCHAR(255) NOT NULL REFERENCES koding_kunjungan(uuid) ON DELETE CASCADE,
          checklist_item_uuid VARCHAR(255) NOT NULL REFERENCES koding_checklist_item(uuid),
          status VARCHAR(13) NOT NULL DEFAULT 'tidak_lengkap' CHECK (status IN ('lengkap', 'tidak_lengkap', 'tidak_berlaku')),
          alasan TEXT, petugas_uuid VARCHAR(255), updated_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS koding_checklist_kunjungan_uq
          ON koding_checklist_kunjungan (koding_kunjungan_uuid, checklist_item_uuid);

        -- Klarifikasi koder ↔ DPJP per kunjungan. menghalangi = status 'siap_klaim' ditahan sampai klarifikasi ditutup.
        CREATE TABLE IF NOT EXISTS koding_klarifikasi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          koding_kunjungan_uuid VARCHAR(255) NOT NULL REFERENCES koding_kunjungan(uuid) ON DELETE CASCADE,
          practitioner_uuid VARCHAR(255) NOT NULL, pengirim_uuid VARCHAR(255),
          pertanyaan TEXT NOT NULL, jawaban TEXT, menghalangi BOOLEAN NOT NULL DEFAULT true,
          status VARCHAR(10) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'terjawab', 'ditutup')),
          dikirim_at BIGINT NOT NULL, dijawab_at BIGINT, ditutup_at BIGINT, ditutup_oleh VARCHAR(255), catatan_tutup TEXT,
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS koding_klarifikasi_kunjungan_idx ON koding_klarifikasi (koding_kunjungan_uuid, status);
        CREATE INDEX IF NOT EXISTS koding_klarifikasi_dpjp_idx ON koding_klarifikasi (practitioner_uuid, status);

        -- Master jenis berkas & masa retensi (tahun) per faskes.
        CREATE TABLE IF NOT EXISTS rm_jenis_berkas (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, nama VARCHAR(200) NOT NULL,
          masa_retensi_aktif_tahun INTEGER NOT NULL DEFAULT 5, masa_retensi_inaktif_tahun INTEGER NOT NULL DEFAULT 2,
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rm_jenis_berkas_nama_uq ON rm_jenis_berkas (faskes_uuid, nama) WHERE deleted_at IS NULL;

        -- Peminjaman & pengembalian berkas rekam medis fisik per no_rm. Peminjaman aktif = waktu_kembali masih NULL;
        -- satu no_rm hanya boleh punya satu peminjaman aktif per faskes (indeks unik parsial).
        CREATE TABLE IF NOT EXISTS rm_peminjaman (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255), peminjam VARCHAR(200) NOT NULL, unit VARCHAR(200), keperluan VARCHAR(200), catatan TEXT,
          waktu_pinjam BIGINT NOT NULL, rencana_kembali BIGINT NOT NULL, petugas_pinjam VARCHAR(255),
          waktu_kembali BIGINT, petugas_kembali VARCHAR(255), kondisi_kembali TEXT,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS rm_peminjaman_aktif_uq
          ON rm_peminjaman (faskes_uuid, no_rm) WHERE waktu_kembali IS NULL AND deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS rm_peminjaman_tenggat_idx ON rm_peminjaman (faskes_uuid, rencana_kembali) WHERE waktu_kembali IS NULL;

        -- Usulan & keputusan pemusnahan berkas. Status "diusulkan" (keputusan NULL) bukan "dimusnahkan"; tidak ada
        -- transisi otomatis ke pelaksanaan pemusnahan.
        CREATE TABLE IF NOT EXISTS rm_retensi_usulan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50) NOT NULL,
          jenis_berkas_uuid VARCHAR(255) NOT NULL REFERENCES rm_jenis_berkas(uuid), alasan TEXT,
          diusulkan_oleh VARCHAR(255), diusulkan_at BIGINT NOT NULL,
          keputusan VARCHAR(10) CHECK (keputusan IN ('disetujui', 'ditolak', 'ditunda')),
          keputusan_oleh VARCHAR(255), keputusan_at BIGINT,
          keputusan_alasan TEXT, berita_acara_ref VARCHAR(200), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS rm_retensi_usulan_status_idx ON rm_retensi_usulan (faskes_uuid, keputusan);
        CREATE INDEX IF NOT EXISTS rm_retensi_usulan_no_rm_idx ON rm_retensi_usulan (faskes_uuid, no_rm);
        `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS rm_retensi_usulan, rm_peminjaman, rm_jenis_berkas, koding_klarifikasi,
        koding_checklist_kunjungan, koding_checklist_item, koding_tindakan, koding_diagnosis, koding_kunjungan CASCADE;
    `);
  },
};
