'use strict';

// Modul Bank Darah RS / BDRS (penunjang-service, tabel berprefiks bdrs_). Lihat PRD & Desain Teknis STD-0009.
//
// Master:
// - bdrs_komponen_darah : komponen darah per faskes (PRC/WB/TC/FFP bawaan, dapat ditambah — PRD KF-14).
// - bdrs_pengaturan     : satu baris per faskes — ambang peringatan kedaluwarsa (hari) & tarif pengolahan/crossmatch
//                         yang dikirim ke tagihan kunjungan saat serah terima selesai. Dibuat otomatis (nilai bawaan)
//                         saat pertama kali diakses (lihat penunjang-service/src/bank-darah/pengaturan.js).
// Transaksi:
// - bdrs_permintaan        : permintaan darah ruangan (RJ/RI/IGD) pada kunjungan aktif pasien. Alur status: baru →
//                            diproses → (perlu_dilengkapi → diproses) → dipenuhi_sebagian/diserahkan, atau
//                            baru/diproses → dibatalkan/ditolak.
// - bdrs_pemeriksaan       : golongan ABO/Rhesus & skrining antibodi pasien, dicatat per permintaan (bukan atribut
//                            permanen pasien — aturan bisnis #5).
// - bdrs_stok              : satu baris per kantong darah (penerimaan manual dari UTD). Status: tersedia →
//                            dialokasikan → diserahkan, atau tersedia/kedaluwarsa → dimusnahkan/dikembalikan.
// - bdrs_crossmatch        : hasil uji silang serasi (mayor/minor) per pasangan permintaan+kantong. Kantong hanya
//                            layak diserahkan bila kompatibel & status_validasi = berlaku (lihat G11/KF-9).
// - bdrs_serah_terima      : transaksi serah terima (header) — mensyaratkan konfirmasi dua akun berbeda (penyerah
//                            BDRS & penerima ruangan) sebelum status menjadi selesai & stok benar-benar berkurang.
// - bdrs_serah_terima_item : kantong yang termasuk satu transaksi serah terima (satu kantong aktif hanya pada satu
//                            item non-terhapus — G9).
// - bdrs_transfusi         : pemantauan mulai/selesai transfusi per item serah terima.
// - bdrs_reaksi_transfusi  : laporan reaksi transfusi (hemovigilans), tertaut ke catatan transfusi.

const WAKTU = `created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS bdrs_komponen_darah (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(20) NOT NULL, nama VARCHAR(100) NOT NULL, keterangan TEXT,
          status BOOLEAN NOT NULL DEFAULT true, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_komponen_kode_uq ON bdrs_komponen_darah (faskes_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bdrs_pengaturan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          ambang_kedaluwarsa_hari SMALLINT NOT NULL DEFAULT 3 CHECK (ambang_kedaluwarsa_hari BETWEEN 1 AND 90),
          tarif_pengolahan NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tarif_pengolahan >= 0),
          tarif_crossmatch NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tarif_crossmatch >= 0),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_pengaturan_faskes_uq ON bdrs_pengaturan (faskes_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bdrs_permintaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_permintaan VARCHAR(50) NOT NULL,
          patient_uuid VARCHAR(255) NOT NULL, no_rm VARCHAR(50), no_reg VARCHAR(50), rekam_medis_uuid VARCHAR(255),
          sumber_kunjungan VARCHAR(10) NOT NULL CHECK (sumber_kunjungan IN ('rajal', 'ranap', 'igd')),
          lokasi_asal_uuid VARCHAR(255), komponen_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_komponen_darah(uuid),
          golongan_diminta VARCHAR(2) NOT NULL CHECK (golongan_diminta IN ('A', 'B', 'AB', 'O')),
          rhesus_diminta VARCHAR(8) NOT NULL CHECK (rhesus_diminta IN ('positif', 'negatif')),
          jumlah_diminta SMALLINT NOT NULL CHECK (jumlah_diminta BETWEEN 1 AND 20),
          jumlah_dipenuhi SMALLINT NOT NULL DEFAULT 0 CHECK (jumlah_dipenuhi >= 0),
          indikasi TEXT NOT NULL, cito BOOLEAN NOT NULL DEFAULT false,
          status VARCHAR(18) NOT NULL DEFAULT 'baru'
            CHECK (status IN ('baru', 'diproses', 'perlu_dilengkapi', 'dipenuhi_sebagian', 'diserahkan', 'dibatalkan', 'ditolak')),
          alasan_kembali TEXT, dibuat_oleh VARCHAR(255), diproses_oleh VARCHAR(255), waktu_diproses BIGINT,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_permintaan_no_uq ON bdrs_permintaan (faskes_uuid, no_permintaan) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bdrs_permintaan_antrian_idx ON bdrs_permintaan (faskes_uuid, status, cito, created_at);
        CREATE INDEX IF NOT EXISTS bdrs_permintaan_rm_idx ON bdrs_permintaan (rekam_medis_uuid);
        CREATE INDEX IF NOT EXISTS bdrs_permintaan_reg_idx ON bdrs_permintaan (no_reg);
        CREATE INDEX IF NOT EXISTS bdrs_permintaan_pasien_idx ON bdrs_permintaan (patient_uuid);

        CREATE TABLE IF NOT EXISTS bdrs_pemeriksaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_permintaan(uuid), patient_uuid VARCHAR(255) NOT NULL,
          golongan_abo VARCHAR(2) NOT NULL CHECK (golongan_abo IN ('A', 'B', 'AB', 'O')),
          rhesus VARCHAR(8) NOT NULL CHECK (rhesus IN ('positif', 'negatif')),
          hasil_skrining_antibodi VARCHAR(8) NOT NULL CHECK (hasil_skrining_antibodi IN ('negatif', 'positif')),
          catatan TEXT, petugas VARCHAR(255), waktu_periksa BIGINT NOT NULL, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_pemeriksaan_permintaan_uq ON bdrs_pemeriksaan (permintaan_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bdrs_pemeriksaan_pasien_idx ON bdrs_pemeriksaan (patient_uuid);

        CREATE TABLE IF NOT EXISTS bdrs_stok (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, no_kantong VARCHAR(50) NOT NULL,
          komponen_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_komponen_darah(uuid),
          golongan_abo VARCHAR(2) NOT NULL CHECK (golongan_abo IN ('A', 'B', 'AB', 'O')),
          rhesus VARCHAR(8) NOT NULL CHECK (rhesus IN ('positif', 'negatif')),
          volume_ml NUMERIC(10,2) CHECK (volume_ml IS NULL OR volume_ml > 0),
          tanggal_produksi BIGINT NOT NULL, tanggal_kedaluwarsa BIGINT NOT NULL,
          lokasi_penyimpanan VARCHAR(255),
          sumber VARCHAR(14) NOT NULL DEFAULT 'utd_manual' CHECK (sumber IN ('utd_manual', 'utd_otomatis')),
          utd_referensi_uuid VARCHAR(255),
          status VARCHAR(14) NOT NULL DEFAULT 'tersedia'
            CHECK (status IN ('tersedia', 'dialokasikan', 'diserahkan', 'kedaluwarsa', 'dimusnahkan', 'dikembalikan')),
          alasan_keluar TEXT, diterima_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_stok_no_uq ON bdrs_stok (faskes_uuid, no_kantong) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bdrs_stok_cari_idx ON bdrs_stok (faskes_uuid, status, golongan_abo, rhesus, komponen_uuid, tanggal_kedaluwarsa);

        CREATE TABLE IF NOT EXISTS bdrs_crossmatch (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_permintaan(uuid),
          stok_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_stok(uuid),
          hasil_mayor VARCHAR(12) NOT NULL CHECK (hasil_mayor IN ('kompatibel', 'inkompatibel')),
          hasil_minor VARCHAR(12) NOT NULL CHECK (hasil_minor IN ('kompatibel', 'inkompatibel')),
          kompatibel BOOLEAN NOT NULL,
          status_validasi VARCHAR(14) NOT NULL DEFAULT 'berlaku' CHECK (status_validasi IN ('berlaku', 'perlu_tinjau')),
          petugas VARCHAR(255), waktu_periksa BIGINT NOT NULL, catatan TEXT, ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_crossmatch_uq ON bdrs_crossmatch (faskes_uuid, permintaan_uuid, stok_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bdrs_crossmatch_permintaan_idx ON bdrs_crossmatch (permintaan_uuid);
        CREATE INDEX IF NOT EXISTS bdrs_crossmatch_stok_idx ON bdrs_crossmatch (stok_uuid);

        CREATE TABLE IF NOT EXISTS bdrs_serah_terima (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          permintaan_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_permintaan(uuid),
          petugas_penyerah VARCHAR(255), waktu_konfirmasi_penyerah BIGINT,
          petugas_penerima VARCHAR(255), waktu_konfirmasi_penerima BIGINT,
          status VARCHAR(10) NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'selesai', 'batal')),
          status_tagihan VARCHAR(10) NOT NULL DEFAULT 'belum' CHECK (status_tagihan IN ('belum', 'terkirim', 'gagal')),
          pesan_tagihan TEXT,
          CONSTRAINT bdrs_serah_terima_beda_petugas CHECK (petugas_penyerah IS NULL OR petugas_penerima IS NULL OR petugas_penyerah <> petugas_penerima),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS bdrs_serah_terima_permintaan_idx ON bdrs_serah_terima (permintaan_uuid);
        CREATE INDEX IF NOT EXISTS bdrs_serah_terima_status_idx ON bdrs_serah_terima (faskes_uuid, status);

        CREATE TABLE IF NOT EXISTS bdrs_serah_terima_item (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          serah_terima_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_serah_terima(uuid) ON DELETE CASCADE,
          stok_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_stok(uuid),
          crossmatch_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_crossmatch(uuid), ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS bdrs_sti_st_idx ON bdrs_serah_terima_item (serah_terima_uuid);
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_sti_stok_uq ON bdrs_serah_terima_item (stok_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS bdrs_transfusi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          serah_terima_item_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_serah_terima_item(uuid) ON DELETE CASCADE,
          waktu_mulai BIGINT NOT NULL, waktu_selesai BIGINT,
          status VARCHAR(20) NOT NULL DEFAULT 'berlangsung' CHECK (status IN ('berlangsung', 'selesai_tanpa_reaksi', 'reaksi')),
          hasil_pemantauan TEXT, dicatat_oleh VARCHAR(255), ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS bdrs_transfusi_item_uq ON bdrs_transfusi (serah_terima_item_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS bdrs_transfusi_status_idx ON bdrs_transfusi (faskes_uuid, status);

        CREATE TABLE IF NOT EXISTS bdrs_reaksi_transfusi (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          transfusi_uuid VARCHAR(255) NOT NULL REFERENCES bdrs_transfusi(uuid) ON DELETE CASCADE,
          jenis_reaksi VARCHAR(100) NOT NULL, gejala TEXT NOT NULL, tindak_lanjut TEXT,
          dilaporkan_oleh VARCHAR(255), diterima_bdrs_oleh VARCHAR(255),
          status_tindak_lanjut VARCHAR(16) NOT NULL DEFAULT 'baru' CHECK (status_tindak_lanjut IN ('baru', 'ditindaklanjuti', 'selesai')),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS bdrs_reaksi_transfusi_idx ON bdrs_reaksi_transfusi (transfusi_uuid);
        CREATE INDEX IF NOT EXISTS bdrs_reaksi_status_idx ON bdrs_reaksi_transfusi (faskes_uuid, status_tindak_lanjut);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS bdrs_reaksi_transfusi, bdrs_transfusi, bdrs_serah_terima_item, bdrs_serah_terima,
        bdrs_crossmatch, bdrs_stok, bdrs_pemeriksaan, bdrs_permintaan, bdrs_pengaturan, bdrs_komponen_darah;
    `);
  },
};
