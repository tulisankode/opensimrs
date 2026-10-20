'use strict';

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT';
const MASA = 'berlaku_mulai BIGINT NOT NULL, berlaku_sampai BIGINT, CHECK (berlaku_sampai IS NULL OR berlaku_sampai > berlaku_mulai)';
const tabel = {
  komponen: `kode VARCHAR(40) NOT NULL, nama VARCHAR(150) NOT NULL, jenis VARCHAR(30) NOT NULL CHECK (jenis IN ('penghasilan','potongan','iuran_pemberi_kerja')), kategori VARCHAR(40) NOT NULL, perlakuan_pajak VARCHAR(40) NOT NULL, aktif BOOLEAN NOT NULL DEFAULT true`,
  skala: `golongan VARCHAR(50) NOT NULL, masa_kerja_min_bulan INTEGER NOT NULL CHECK (masa_kerja_min_bulan >= 0), masa_kerja_maks_bulan INTEGER, nilai NUMERIC(18,2) NOT NULL CHECK (nilai >= 0), ${MASA}, CHECK (masa_kerja_maks_bulan IS NULL OR masa_kerja_maks_bulan > masa_kerja_min_bulan)`,
  komponen_pegawai: `kepegawaian_uuid VARCHAR(255) NOT NULL, komponen_uuid VARCHAR(255) NOT NULL, nilai NUMERIC(18,2), skala_uuid VARCHAR(255), alasan TEXT NOT NULL, ${MASA}, CHECK ((nilai IS NOT NULL AND nilai >= 0 AND skala_uuid IS NULL) OR (nilai IS NULL AND skala_uuid IS NOT NULL))`,
  konfigurasi: `versi INTEGER NOT NULL, aturan JSONB NOT NULL, kebijakan JSONB NOT NULL, kasus_uji JSONB NOT NULL, dasar_aturan TEXT NOT NULL, hash_konfigurasi VARCHAR(64) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf','disahkan')), dibuat_oleh VARCHAR(120) NOT NULL, disahkan_oleh VARCHAR(120), disahkan_pada BIGINT, bukti_pengesahan TEXT, ${MASA}`,
  profil_pegawai: `kepegawaian_uuid VARCHAR(255) NOT NULL, parameter JSONB NOT NULL, saldo_awal_tahun JSONB NOT NULL, bukti TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draf', dibuat_oleh VARCHAR(120) NOT NULL, disahkan_oleh VARCHAR(120), disahkan_pada BIGINT, bukti_pengesahan TEXT, ${MASA}`,
  rekening: `kepegawaian_uuid VARCHAR(255) NOT NULL, kode_bank VARCHAR(40) NOT NULL, nomor_rekening VARCHAR(50) NOT NULL, nama_pemilik VARCHAR(150) NOT NULL, dibuat_oleh VARCHAR(120) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draf', diverifikasi_oleh VARCHAR(120), diverifikasi_pada BIGINT, ${MASA}`,
  format_bank: `kode VARCHAR(40) NOT NULL, versi INTEGER NOT NULL, spesifikasi JSONB NOT NULL, bukti_spesifikasi TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draf', dibuat_oleh VARCHAR(120) NOT NULL, disahkan_oleh VARCHAR(120), disahkan_pada BIGINT`,
  periode: `tahun INTEGER NOT NULL CHECK (tahun BETWEEN 2000 AND 2200), bulan INTEGER NOT NULL CHECK (bulan BETWEEN 1 AND 12), status VARCHAR(30) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf','verifikasi','menunggu_persetujuan','disetujui','dibayar')), versi INTEGER NOT NULL DEFAULT 1, konfigurasi_uuid VARCHAR(255) NOT NULL, remunerasi_periode_uuid VARCHAR(255) NOT NULL, penghitungan_uuid VARCHAR(255), hash_hitung VARCHAR(64), bruto NUMERIC(18,2) NOT NULL DEFAULT 0, potongan NUMERIC(18,2) NOT NULL DEFAULT 0, iuran_pemberi_kerja NUMERIC(18,2) NOT NULL DEFAULT 0, bersih NUMERIC(18,2) NOT NULL DEFAULT 0, jumlah_pegawai INTEGER NOT NULL DEFAULT 0, jumlah_pengecualian INTEGER NOT NULL DEFAULT 0, dibuat_oleh VARCHAR(120) NOT NULL, dihitung_oleh VARCHAR(120), diverifikasi_oleh VARCHAR(120), disetujui_oleh VARCHAR(120), dibayar_oleh VARCHAR(120), terkunci_pada BIGINT, tanggal_bayar BIGINT, metode_bayar VARCHAR(20), referensi_bayar VARCHAR(255), CHECK (bersih = bruto - potongan)`,
  penghitungan: `periode_uuid VARCHAR(255) NOT NULL, nomor_versi INTEGER NOT NULL, hash_sumber VARCHAR(64) NOT NULL, konfigurasi_uuid VARCHAR(255) NOT NULL, ringkasan JSONB NOT NULL, sumber JSONB NOT NULL, dihitung_oleh VARCHAR(120) NOT NULL, dihitung_pada BIGINT NOT NULL`,
  hasil: `penghitungan_uuid VARCHAR(255) NOT NULL, kepegawaian_uuid VARCHAR(255) NOT NULL, unit_uuid VARCHAR(255), riwayat_uuid VARCHAR(255), bruto NUMERIC(18,2) NOT NULL, potongan NUMERIC(18,2) NOT NULL, iuran_pemberi_kerja NUMERIC(18,2) NOT NULL, bersih NUMERIC(18,2) NOT NULL, status_kelengkapan VARCHAR(30) NOT NULL, alasan TEXT, CHECK (bersih = bruto - potongan)`,
  rincian: `hasil_uuid VARCHAR(255) NOT NULL, komponen_uuid VARCHAR(255), kode VARCHAR(40) NOT NULL, jenis VARCHAR(30) NOT NULL, kategori VARCHAR(40) NOT NULL, nilai NUMERIC(18,2) NOT NULL, sumber_tabel VARCHAR(80) NOT NULL, sumber_uuid VARCHAR(255), dasar_perhitungan JSONB NOT NULL`,
  koreksi: `periode_tujuan_uuid VARCHAR(255) NOT NULL, hasil_asal_uuid VARCHAR(255) NOT NULL, kepegawaian_uuid VARCHAR(255) NOT NULL, komponen_uuid VARCHAR(255) NOT NULL, nilai NUMERIC(18,2) NOT NULL CHECK (nilai <> 0), alasan TEXT NOT NULL`,
  jaspel_sumber: `periode_uuid VARCHAR(255) NOT NULL, remunerasi_periode_uuid VARCHAR(255) NOT NULL, hash_sumber VARCHAR(64) NOT NULL, status VARCHAR(30) NOT NULL CHECK (status IN ('reservasi','dibayar','selesai','dilepas'))`,
  jurnal: `periode_uuid VARCHAR(255) NOT NULL, kunci_sumber VARCHAR(300) NOT NULL, hash_sumber VARCHAR(64) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'menunggu', jurnal_uuid VARCHAR(255), percobaan INTEGER NOT NULL DEFAULT 0, alasan TEXT, dicoba_pada BIGINT`,
  ekspor: `periode_uuid VARCHAR(255) NOT NULL, format_uuid VARCHAR(255) NOT NULL, versi_hitung VARCHAR(255) NOT NULL, hash_berkas VARCHAR(64) NOT NULL, jumlah_pegawai INTEGER NOT NULL, total NUMERIC(18,2) NOT NULL, dibuat_oleh VARCHAR(120) NOT NULL`,
  riwayat_tindakan: `periode_uuid VARCHAR(255), entitas_uuid VARCHAR(255), aksi VARCHAR(80) NOT NULL, pengguna VARCHAR(120) NOT NULL, waktu BIGINT NOT NULL, alasan TEXT, hash_sebelum VARCHAR(64), hash_sesudah VARCHAR(64)`,
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const q = (sql) => queryInterface.sequelize.query(sql, { transaction });
      for (const [nama, kolom] of Object.entries(tabel)) {
        await q(`CREATE TABLE IF NOT EXISTS hr_gaji_${nama} (uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL, ${kolom}, ${WAKTU}, UNIQUE (faskes_uuid, uuid))`);
        await q(`CREATE INDEX IF NOT EXISTS hr_gaji_${nama}_faskes_idx ON hr_gaji_${nama} (faskes_uuid) WHERE deleted_at IS NULL`);
      }
      const unik = {
        komponen: ['kode', true], konfigurasi: ['versi', false], format_bank: ['kode, versi', false],
        periode: ['tahun, bulan', true], penghitungan: ['periode_uuid, nomor_versi', false], hasil: ['penghitungan_uuid, kepegawaian_uuid', false], jurnal: ['periode_uuid', false],
      };
      for (const [nama, [kolom, aktif]] of Object.entries(unik)) await q(`CREATE UNIQUE INDEX IF NOT EXISTS hr_gaji_${nama}_unik ON hr_gaji_${nama} (faskes_uuid, ${kolom}) ${aktif ? 'WHERE deleted_at IS NULL' : ''}`);
      await q(`CREATE UNIQUE INDEX IF NOT EXISTS hr_gaji_jurnal_kunci ON hr_gaji_jurnal (faskes_uuid, kunci_sumber);
        CREATE UNIQUE INDEX IF NOT EXISTS hr_gaji_jaspel_pemilik ON hr_gaji_jaspel_sumber (faskes_uuid, remunerasi_periode_uuid) WHERE status <> 'dilepas';
        CREATE UNIQUE INDEX IF NOT EXISTS hr_gaji_jaspel_periode ON hr_gaji_jaspel_sumber (faskes_uuid, periode_uuid) WHERE status <> 'dilepas';`);
      const relasi = [
        ['komponen_pegawai','komponen_uuid','komponen'], ['komponen_pegawai','skala_uuid','skala'], ['periode','konfigurasi_uuid','konfigurasi'],
        ['penghitungan','periode_uuid','periode'], ['penghitungan','konfigurasi_uuid','konfigurasi'], ['hasil','penghitungan_uuid','penghitungan'],
        ['rincian','hasil_uuid','hasil'], ['rincian','komponen_uuid','komponen'], ['koreksi','periode_tujuan_uuid','periode'],
        ['koreksi','hasil_asal_uuid','hasil'], ['koreksi','komponen_uuid','komponen'], ['jaspel_sumber','periode_uuid','periode'],
        ['jurnal','periode_uuid','periode'], ['ekspor','periode_uuid','periode'], ['ekspor','format_uuid','format_bank'], ['periode','penghitungan_uuid','penghitungan'],
      ];
      for (const [asal, kolom, tujuan] of relasi) {
        const nama = `gaji_${asal}_${kolom}_fk`;
        await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${nama}' AND conrelid = 'hr_gaji_${asal}'::regclass) THEN
          ALTER TABLE hr_gaji_${asal} ADD CONSTRAINT ${nama} FOREIGN KEY (faskes_uuid, ${kolom}) REFERENCES hr_gaji_${tujuan} (faskes_uuid, uuid); END IF; END $$`);
      }
      await q(`CREATE OR REPLACE FUNCTION hr_gaji_lindungi() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE p hr_gaji_periode; r RECORD; h VARCHAR(255);
        BEGIN
          IF TG_TABLE_NAME = 'hr_gaji_riwayat_tindakan' AND TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Riwayat penggajian hanya dapat ditambah'; END IF;
          IF TG_TABLE_NAME IN ('hr_gaji_konfigurasi','hr_gaji_profil_pegawai','hr_gaji_format_bank') THEN
            IF TG_OP <> 'INSERT' THEN
              IF OLD.status = 'disahkan' THEN RAISE EXCEPTION 'Versi disahkan tidak dapat diubah'; END IF;
            END IF;
          END IF;
          IF TG_TABLE_NAME = 'hr_gaji_rekening' THEN
            IF TG_OP <> 'INSERT' THEN
              IF OLD.status = 'terverifikasi' THEN RAISE EXCEPTION 'Rekening terverifikasi tidak dapat diubah'; END IF;
            END IF;
          END IF;
          IF TG_TABLE_NAME = 'hr_gaji_jurnal' THEN
            IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Referensi jurnal tidak dapat dihapus'; END IF;
            IF NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Referensi jurnal tidak dapat dihapus lunak'; END IF;
            IF TG_OP = 'UPDATE' THEN
              IF NEW.periode_uuid <> OLD.periode_uuid OR NEW.kunci_sumber <> OLD.kunci_sumber OR NEW.hash_sumber <> OLD.hash_sumber OR NEW.faskes_uuid <> OLD.faskes_uuid THEN RAISE EXCEPTION 'Niat jurnal tidak dapat diganti'; END IF;
            END IF;
          END IF;
          IF TG_TABLE_NAME = 'hr_gaji_periode' AND TG_OP <> 'INSERT' THEN
            IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Periode hanya boleh dihapus lunak saat draf'; END IF;
            IF OLD.status <> 'draf' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN RAISE EXCEPTION 'Hanya draf yang boleh dibatalkan'; END IF;
            IF OLD.status = 'dibayar' AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN RAISE EXCEPTION 'Pembayaran yang tercatat tidak dapat diubah'; END IF;
            IF OLD.terkunci_pada IS NOT NULL AND
              (to_jsonb(NEW) - ARRAY['status','versi','updated_at','dibayar_oleh','tanggal_bayar','metode_bayar','referensi_bayar']) IS DISTINCT FROM
              (to_jsonb(OLD) - ARRAY['status','versi','updated_at','dibayar_oleh','tanggal_bayar','metode_bayar','referensi_bayar']) THEN RAISE EXCEPTION 'Nominal periode terkunci'; END IF;
            IF OLD.terkunci_pada IS NOT NULL AND NEW.status <> OLD.status AND NOT (OLD.status = 'disetujui' AND NEW.status = 'dibayar') THEN RAISE EXCEPTION 'Status periode terkunci'; END IF;
          END IF;
          IF TG_TABLE_NAME IN ('hr_gaji_penghitungan','hr_gaji_hasil','hr_gaji_rincian') THEN
            IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Hasil penghitungan hanya dapat ditambah'; END IF;
            IF TG_TABLE_NAME = 'hr_gaji_penghitungan' THEN
              SELECT * INTO p FROM hr_gaji_periode WHERE uuid = NEW.periode_uuid AND faskes_uuid = NEW.faskes_uuid FOR UPDATE;
            ELSIF TG_TABLE_NAME = 'hr_gaji_hasil' THEN
              SELECT periode_uuid INTO h FROM hr_gaji_penghitungan WHERE uuid = NEW.penghitungan_uuid AND faskes_uuid = NEW.faskes_uuid;
              SELECT * INTO p FROM hr_gaji_periode WHERE uuid = h AND faskes_uuid = NEW.faskes_uuid FOR UPDATE;
            ELSE
              SELECT g.periode_uuid INTO h FROM hr_gaji_hasil a JOIN hr_gaji_penghitungan g ON g.uuid = a.penghitungan_uuid AND g.faskes_uuid = a.faskes_uuid WHERE a.uuid = NEW.hasil_uuid AND a.faskes_uuid = NEW.faskes_uuid;
              SELECT * INTO p FROM hr_gaji_periode WHERE uuid = h AND faskes_uuid = NEW.faskes_uuid FOR UPDATE;
            END IF;
            IF p.uuid IS NULL OR p.status <> 'draf' OR p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Hasil hanya boleh ditambah ke draf aktif'; END IF;
          END IF;
          IF TG_TABLE_NAME = 'hr_gaji_koreksi' THEN
            IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Koreksi hanya dapat ditambah'; END IF;
            SELECT * INTO p FROM hr_gaji_periode WHERE uuid = NEW.periode_tujuan_uuid AND faskes_uuid = NEW.faskes_uuid FOR UPDATE;
            IF p.uuid IS NULL OR p.status <> 'draf' OR p.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Koreksi hanya untuk draf aktif'; END IF;
            SELECT a.*, g.penghitungan_uuid AS hitung_terkunci, h.penghitungan_uuid AS hitung_asal INTO r
              FROM hr_gaji_hasil h JOIN hr_gaji_penghitungan t ON t.uuid = h.penghitungan_uuid AND t.faskes_uuid = h.faskes_uuid
              JOIN hr_gaji_periode a ON a.uuid = t.periode_uuid AND a.faskes_uuid = t.faskes_uuid
              JOIN hr_gaji_periode g ON g.uuid = a.uuid AND g.faskes_uuid = a.faskes_uuid
              WHERE h.uuid = NEW.hasil_asal_uuid AND h.faskes_uuid = NEW.faskes_uuid AND h.kepegawaian_uuid = NEW.kepegawaian_uuid AND h.deleted_at IS NULL AND a.deleted_at IS NULL;
            IF r.uuid IS NULL OR r.terkunci_pada IS NULL OR r.hitung_terkunci <> r.hitung_asal OR p.tahun * 12 + p.bulan <> r.tahun * 12 + r.bulan + 1 THEN RAISE EXCEPTION 'Asal koreksi harus hasil terkunci periode sebelumnya'; END IF;
          END IF;
          IF TG_TABLE_NAME = 'hr_gaji_jaspel_sumber' THEN
            IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Reservasi jaspel tidak dapat dihapus'; END IF;
            SELECT * INTO p FROM hr_gaji_periode WHERE uuid = NEW.periode_uuid AND faskes_uuid = NEW.faskes_uuid FOR UPDATE;
            IF p.terkunci_pada IS NOT NULL THEN
              IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Periode terkunci tidak menerima reservasi baru'; END IF;
              IF (to_jsonb(NEW) - ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at'])
                OR NOT (NEW.status = OLD.status OR OLD.status = 'reservasi' AND NEW.status = 'dibayar' OR OLD.status = 'dibayar' AND NEW.status = 'selesai') THEN RAISE EXCEPTION 'Sumber periode terkunci'; END IF;
            END IF;
          END IF;
          IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
        END $$`);
      for (const nama of ['periode','penghitungan','hasil','rincian','koreksi','jaspel_sumber','konfigurasi','profil_pegawai','format_bank','rekening','jurnal','riwayat_tindakan']) {
        await q(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hr_gaji_${nama}_lindungi' AND tgrelid = 'hr_gaji_${nama}'::regclass) THEN
          CREATE TRIGGER hr_gaji_${nama}_lindungi BEFORE INSERT OR UPDATE OR DELETE ON hr_gaji_${nama} FOR EACH ROW EXECUTE FUNCTION hr_gaji_lindungi(); END IF; END $$`);
      }
    });
  },
  async down() {
    // Riwayat gaji dan pembayaran dipertahankan. Pemulihan struktur ditinjau manusia.
  },
};
