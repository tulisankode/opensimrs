'use strict';

// Modul Akuntansi & Remunerasi — fitur Jurnal & Buku Besar (STD-0031, penunjang-service/src/akuntansi):
//   akuntansi_akun          bagan akun (COA) per faskes: hierarki induk/rinci, kelompok, saldo normal, klasifikasi laporan,
//                           penanda kas & setara kas, kelompok arus kas, dan buku pembantu (piutang/utang) untuk aging
//   akuntansi_pemetaan      aturan event → akun per komponen (mis. tagihan_final/pendapatan:RJ), bertanggal berlaku
//                           (perubahan = baris baru, sehingga jurnal lama tetap dapat dijelaskan dari aturan saat transaksi)
//   akuntansi_periode       periode bulanan (kalender Asia/Jakarta) terbuka/tutup; periode tutup menolak jurnal baru
//   akuntansi_pengaturan    ambang nominal persetujuan tingkat 2 per faskes
//   akuntansi_jurnal        jurnal otomatis/manual/penyesuaian/koreksi; jurnal otomatis memiliki kunci_sumber unik
//                           (jenis event + dokumen sumber) sehingga proses ulang tidak menggandakan jurnal
//   akuntansi_jurnal_baris  baris debit/kredit NUMERIC(18,2) dengan dimensi penjamin/supplier untuk aging
//   akuntansi_persetujuan   keputusan persetujuan berjenjang jurnal manual/penyesuaian/koreksi
//   akuntansi_event         log pemrosesan dokumen sumber (dijurnal/tertahan/konflik/dilewati) beserta hash data saat
//                           dijurnal (hash_data) dan hash data sumber terbaru bila berubah setelah dijurnal (hash_terbaru)
// Keseimbangan D = K dijaga di aplikasi (dalam transaksi) DAN oleh constraint trigger tertunda (DEFERRABLE INITIALLY
// DEFERRED) yang memeriksa setiap jurnal saat COMMIT. Konvensi: uuid varchar (uuidv7 aplikasi), faskes_uuid, waktu
// epoch detik, soft delete deleted_at. Idempoten (IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS).

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE IF NOT EXISTS akuntansi_akun (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(30) NOT NULL, nama VARCHAR(255) NOT NULL,
          induk_uuid VARCHAR(255) REFERENCES akuntansi_akun(uuid),
          kelompok VARCHAR(20) NOT NULL CHECK (kelompok IN ('aset','kewajiban','ekuitas','pendapatan','beban')),
          saldo_normal VARCHAR(10) NOT NULL CHECK (saldo_normal IN ('debit','kredit')),
          klasifikasi VARCHAR(40) NOT NULL CHECK (klasifikasi IN (
            'aset_lancar','aset_tidak_lancar','kewajiban_pendek','kewajiban_panjang','ekuitas',
            'pendapatan_usaha','pendapatan_lain','beban_pelayanan','beban_umum','beban_lain'
          )),
          jenis VARCHAR(10) NOT NULL DEFAULT 'rinci' CHECK (jenis IN ('induk','rinci')),
          kas_setara_kas BOOLEAN NOT NULL DEFAULT false,
          arus_kas VARCHAR(20) CHECK (arus_kas IN ('operasi','investasi','pendanaan')),
          buku_pembantu VARCHAR(20) CHECK (buku_pembantu IN ('piutang','utang')),
          aktif BOOLEAN NOT NULL DEFAULT true,
          bawaan BOOLEAN NOT NULL DEFAULT false,
          keterangan TEXT, dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS akuntansi_akun_kode_uq ON akuntansi_akun (faskes_uuid, kode) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS akuntansi_akun_induk_idx ON akuntansi_akun (induk_uuid);

        CREATE TABLE IF NOT EXISTS akuntansi_pemetaan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis_event VARCHAR(40) NOT NULL, komponen VARCHAR(80) NOT NULL,
          akun_uuid VARCHAR(255) NOT NULL REFERENCES akuntansi_akun(uuid),
          berlaku_mulai BIGINT NOT NULL,
          aktif BOOLEAN NOT NULL DEFAULT true,
          keterangan TEXT, dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS akuntansi_pemetaan_uq ON akuntansi_pemetaan (faskes_uuid, jenis_event, komponen, berlaku_mulai) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS akuntansi_periode (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          tahun INT NOT NULL, bulan INT NOT NULL CHECK (bulan BETWEEN 1 AND 12),
          status VARCHAR(10) NOT NULL DEFAULT 'terbuka' CHECK (status IN ('terbuka','tutup')),
          ringkasan JSONB,
          ditutup_oleh VARCHAR(255), ditutup_pada BIGINT,
          dibuka_oleh VARCHAR(255), dibuka_pada BIGINT, alasan_buka TEXT,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS akuntansi_periode_uq ON akuntansi_periode (faskes_uuid, tahun, bulan) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS akuntansi_pengaturan (
          faskes_uuid VARCHAR(255) PRIMARY KEY,
          ambang_tingkat_2 NUMERIC(18,2) CHECK (ambang_tingkat_2 IS NULL OR ambang_tingkat_2 > 0),
          diubah_oleh VARCHAR(255),
          created_at BIGINT NOT NULL, updated_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS akuntansi_jurnal (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          nomor VARCHAR(40) NOT NULL,
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('otomatis','manual','penyesuaian','koreksi')),
          status VARCHAR(20) NOT NULL CHECK (status IN ('menunggu','final','ditolak','dibatalkan')),
          tanggal BIGINT NOT NULL, tahun INT NOT NULL, bulan INT NOT NULL,
          uraian TEXT, alasan TEXT, referensi VARCHAR(255),
          jenis_event VARCHAR(40), sumber_tabel VARCHAR(80), sumber_uuid VARCHAR(255), sumber_nomor VARCHAR(255),
          kunci_sumber VARCHAR(255),
          jurnal_asal_uuid VARCHAR(255) REFERENCES akuntansi_jurnal(uuid),
          total_debit NUMERIC(18,2) NOT NULL, total_kredit NUMERIC(18,2) NOT NULL,
          tingkat_wajib INT NOT NULL DEFAULT 0, tingkat_disetujui INT NOT NULL DEFAULT 0,
          dibuat_oleh VARCHAR(255), diajukan_pada BIGINT, difinalkan_pada BIGINT,
          ditolak_oleh VARCHAR(255), ditolak_pada BIGINT, alasan_tolak TEXT,
          ${WAKTU},
          CONSTRAINT akuntansi_jurnal_seimbang_chk CHECK (total_debit = total_kredit AND total_debit > 0)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS akuntansi_jurnal_nomor_uq ON akuntansi_jurnal (faskes_uuid, nomor);
        CREATE UNIQUE INDEX IF NOT EXISTS akuntansi_jurnal_kunci_uq ON akuntansi_jurnal (faskes_uuid, kunci_sumber) WHERE kunci_sumber IS NOT NULL;
        CREATE INDEX IF NOT EXISTS akuntansi_jurnal_periode_idx ON akuntansi_jurnal (faskes_uuid, tahun, bulan, status);
        CREATE INDEX IF NOT EXISTS akuntansi_jurnal_tanggal_idx ON akuntansi_jurnal (faskes_uuid, tanggal);
        CREATE INDEX IF NOT EXISTS akuntansi_jurnal_sumber_idx ON akuntansi_jurnal (faskes_uuid, sumber_tabel, sumber_uuid);
        CREATE INDEX IF NOT EXISTS akuntansi_jurnal_asal_idx ON akuntansi_jurnal (jurnal_asal_uuid) WHERE jurnal_asal_uuid IS NOT NULL;

        CREATE TABLE IF NOT EXISTS akuntansi_jurnal_baris (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jurnal_uuid VARCHAR(255) NOT NULL REFERENCES akuntansi_jurnal(uuid),
          urutan INT NOT NULL,
          akun_uuid VARCHAR(255) NOT NULL REFERENCES akuntansi_akun(uuid),
          debit NUMERIC(18,2) NOT NULL DEFAULT 0, kredit NUMERIC(18,2) NOT NULL DEFAULT 0,
          uraian TEXT, komponen VARCHAR(80),
          penjamin_uuid VARCHAR(255), supplier_uuid VARCHAR(255),
          created_at BIGINT NOT NULL,
          CONSTRAINT akuntansi_jurnal_baris_sisi_chk CHECK (debit >= 0 AND kredit >= 0 AND (debit = 0 OR kredit = 0) AND (debit > 0 OR kredit > 0))
        );
        CREATE INDEX IF NOT EXISTS akuntansi_jurnal_baris_jurnal_idx ON akuntansi_jurnal_baris (jurnal_uuid);
        CREATE INDEX IF NOT EXISTS akuntansi_jurnal_baris_akun_idx ON akuntansi_jurnal_baris (faskes_uuid, akun_uuid);

        CREATE TABLE IF NOT EXISTS akuntansi_persetujuan (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jurnal_uuid VARCHAR(255) NOT NULL REFERENCES akuntansi_jurnal(uuid),
          tingkat INT NOT NULL CHECK (tingkat BETWEEN 1 AND 2),
          keputusan VARCHAR(10) NOT NULL CHECK (keputusan IN ('setuju','tolak')),
          oleh VARCHAR(255) NOT NULL, alasan TEXT,
          created_at BIGINT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS akuntansi_persetujuan_tingkat_uq ON akuntansi_persetujuan (jurnal_uuid, tingkat) WHERE keputusan = 'setuju';
        CREATE INDEX IF NOT EXISTS akuntansi_persetujuan_jurnal_idx ON akuntansi_persetujuan (jurnal_uuid);

        CREATE TABLE IF NOT EXISTS akuntansi_event (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis_event VARCHAR(40) NOT NULL, kunci VARCHAR(255) NOT NULL,
          sumber_tabel VARCHAR(80), sumber_uuid VARCHAR(255), sumber_nomor VARCHAR(255),
          tanggal BIGINT NOT NULL, tahun INT NOT NULL, bulan INT NOT NULL,
          nilai NUMERIC(18,2), hash_data VARCHAR(64) NOT NULL, hash_terbaru VARCHAR(64),
          status VARCHAR(10) NOT NULL CHECK (status IN ('dijurnal','tertahan','konflik','dilewati')),
          alasan TEXT, jurnal_uuid VARCHAR(255) REFERENCES akuntansi_jurnal(uuid),
          percobaan INT NOT NULL DEFAULT 1, diproses_oleh VARCHAR(255),
          created_at BIGINT NOT NULL, updated_at BIGINT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS akuntansi_event_kunci_uq ON akuntansi_event (faskes_uuid, kunci);
        CREATE INDEX IF NOT EXISTS akuntansi_event_periode_idx ON akuntansi_event (faskes_uuid, tahun, bulan, status);

        CREATE OR REPLACE FUNCTION akuntansi_cek_seimbang() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
          j VARCHAR(255) := COALESCE(NEW.jurnal_uuid, OLD.jurnal_uuid);
          d NUMERIC; k NUMERIC; td NUMERIC; tk NUMERIC;
        BEGIN
          SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(kredit), 0) INTO d, k FROM akuntansi_jurnal_baris WHERE jurnal_uuid = j;
          SELECT total_debit, total_kredit INTO td, tk FROM akuntansi_jurnal WHERE uuid = j;
          IF td IS NOT NULL AND (d <> k OR d <> td OR k <> tk) THEN
            RAISE EXCEPTION 'Jurnal % tidak seimbang: debit % kredit % (total jurnal % / %)', j, d, k, td, tk USING ERRCODE = '23514';
          END IF;
          RETURN NULL;
        END $$;
        DROP TRIGGER IF EXISTS akuntansi_jurnal_baris_seimbang_trg ON akuntansi_jurnal_baris;
        CREATE CONSTRAINT TRIGGER akuntansi_jurnal_baris_seimbang_trg AFTER INSERT OR UPDATE OR DELETE ON akuntansi_jurnal_baris
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION akuntansi_cek_seimbang();
      `,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS akuntansi_event, akuntansi_persetujuan, akuntansi_jurnal_baris, akuntansi_jurnal,
        akuntansi_pengaturan, akuntansi_periode, akuntansi_pemetaan, akuntansi_akun;
      DROP FUNCTION IF EXISTS akuntansi_cek_seimbang();
    `);
  },
};
