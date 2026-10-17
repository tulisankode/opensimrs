'use strict';

// STD-0016 — Validasi kecocokan ABO/Rh & status kedaluwarsa otomatis BDRS.
// - bdrs_stok.status_imltd         : hasil IMLTD kantong saat penerimaan (G8/KF-12); hanya non_reaktif yang layak
//                                    dialokasikan/di-crossmatch/diserahkan. Backfill: data lama sumber UTD manual
//                                    diasumsikan sudah lolos aksi TERIMA KANTONG → non_reaktif (KF-13, perlu verifikasi
//                                    manual pemilik klinis; lihat CHANGELOG).
// - bdrs_komponen_darah.kelompok   : kelompok komponen untuk memilih matriks kompatibilitas (KF-2/KF-3/KF-4/KF-16).
//                                    Backfill berdasarkan pola kode/nama; komponen yang tidak dapat ditentukan tetap
//                                    'lainnya' dan ditolak saat crossmatch/serah terima (KF-17) sampai admin menetapkannya.
// - bdrs_permintaan.dokter_peminta_uuid/_nama, alasan_batal : dokter peminta (KF-14, wajib untuk permintaan baru lewat
//                                    validasi aplikasi) & alasan pembatalan (KF-15). Nullable agar data historis tetap valid.
// - bdrs_serah_terima.alasan_batal : alasan pembatalan serah terima (KF-15).
// - bdrs_pengaturan.override_darurat_aktif / override_o_pos_aktif : sakelar override darurat per faskes, bawaan mati (KF-7).
// - bdrs_audit                     : jejak audit perubahan IMLTD, override darurat, dan penolakan kantong reaktif (KF-9/KT-13).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        ALTER TABLE bdrs_stok ADD COLUMN IF NOT EXISTS status_imltd VARCHAR(20) NOT NULL DEFAULT 'belum_diperiksa';
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bdrs_stok_status_imltd_ck') THEN
            ALTER TABLE bdrs_stok ADD CONSTRAINT bdrs_stok_status_imltd_ck CHECK (status_imltd IN ('belum_diperiksa', 'non_reaktif', 'reaktif'));
          END IF;
        END $$;
        -- Backfill data lama (sebelum kolom ini ada): sumber UTD manual diasumsikan sudah lolos penerimaan → non_reaktif.
        -- Dibatasi pada baris yang masih bernilai bawaan agar aman dijalankan ulang dan tidak menimpa status yang telah ditetapkan.
        UPDATE bdrs_stok SET status_imltd = 'non_reaktif' WHERE sumber = 'utd_manual' AND status_imltd = 'belum_diperiksa';

        ALTER TABLE bdrs_komponen_darah ADD COLUMN IF NOT EXISTS kelompok VARCHAR(20) NOT NULL DEFAULT 'lainnya';
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bdrs_komponen_kelompok_ck') THEN
            ALTER TABLE bdrs_komponen_darah ADD CONSTRAINT bdrs_komponen_kelompok_ck CHECK (kelompok IN ('sel_darah_merah', 'plasma', 'trombosit', 'lainnya'));
          END IF;
        END $$;
        -- Backfill kelompok dari pola kode/nama (KF-16); hanya baris yang masih bernilai bawaan agar aman diulang.
        UPDATE bdrs_komponen_darah SET kelompok = 'sel_darah_merah'
          WHERE kelompok = 'lainnya' AND (kode ~* '^(PRC|WB|WE)$' OR nama ILIKE '%sel darah merah%');
        UPDATE bdrs_komponen_darah SET kelompok = 'plasma'
          WHERE kelompok = 'lainnya' AND (kode ~* '^(FFP|CRYO)$' OR nama ILIKE '%plasma%' OR nama ILIKE '%kriopresipitat%' OR nama ILIKE '%cryo%');
        UPDATE bdrs_komponen_darah SET kelompok = 'trombosit'
          WHERE kelompok = 'lainnya' AND (kode ~* '^TC$' OR nama ILIKE '%trombosit%');

        ALTER TABLE bdrs_permintaan ADD COLUMN IF NOT EXISTS dokter_peminta_uuid VARCHAR(255);
        ALTER TABLE bdrs_permintaan ADD COLUMN IF NOT EXISTS dokter_peminta_nama VARCHAR(255);
        ALTER TABLE bdrs_permintaan ADD COLUMN IF NOT EXISTS alasan_batal TEXT;

        ALTER TABLE bdrs_serah_terima ADD COLUMN IF NOT EXISTS alasan_batal TEXT;

        ALTER TABLE bdrs_pengaturan ADD COLUMN IF NOT EXISTS override_darurat_aktif BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE bdrs_pengaturan ADD COLUMN IF NOT EXISTS override_o_pos_aktif BOOLEAN NOT NULL DEFAULT false;

        CREATE TABLE IF NOT EXISTS bdrs_audit (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('ubah_imltd', 'override_darurat', 'tolak_imltd_reaktif')),
          stok_uuid VARCHAR(255), permintaan_uuid VARCHAR(255), pengguna VARCHAR(255),
          data JSONB, created_at BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS bdrs_audit_idx ON bdrs_audit (faskes_uuid, jenis, created_at);
      `,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS bdrs_audit;
      ALTER TABLE bdrs_pengaturan DROP COLUMN IF EXISTS override_o_pos_aktif;
      ALTER TABLE bdrs_pengaturan DROP COLUMN IF EXISTS override_darurat_aktif;
      ALTER TABLE bdrs_serah_terima DROP COLUMN IF EXISTS alasan_batal;
      ALTER TABLE bdrs_permintaan DROP COLUMN IF EXISTS alasan_batal;
      ALTER TABLE bdrs_permintaan DROP COLUMN IF EXISTS dokter_peminta_nama;
      ALTER TABLE bdrs_permintaan DROP COLUMN IF EXISTS dokter_peminta_uuid;
      ALTER TABLE bdrs_komponen_darah DROP CONSTRAINT IF EXISTS bdrs_komponen_kelompok_ck;
      ALTER TABLE bdrs_komponen_darah DROP COLUMN IF EXISTS kelompok;
      ALTER TABLE bdrs_stok DROP CONSTRAINT IF EXISTS bdrs_stok_status_imltd_ck;
      ALTER TABLE bdrs_stok DROP COLUMN IF EXISTS status_imltd;
    `);
  },
};
