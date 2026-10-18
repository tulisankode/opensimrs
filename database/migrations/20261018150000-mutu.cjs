'use strict';

// Modul Mutu & Akreditasi — fitur Dokumen Akreditasi & Kredensial Staf (STD-0028, penunjang-service/src/mutu):
//   - instrumen akreditasi milik faskes (bab → standar → elemen penilaian; isi TIDAK disediakan sistem),
//   - dokumen akreditasi + riwayat versi (rantai versi_sebelumnya_uuid, akar_uuid = versi pertama) + pemetaan bukti,
//   - kredensial staf (STR/SIP/sertifikat/RKK/SPK) tertaut pegawai/practitioner Datamaster,
//   - jejak audit perubahan (pengguna, waktu, data sebelum/sesudah).
// Berkas disimpan BYTEA + info JSONB di baris dokumen/kredensial (pola observation_item.berkas_hasil_rujukan); setiap
// versi dokumen punya berkasnya sendiri sehingga versi lama tidak pernah tertimpa.
// Konvensi: uuid varchar (uuidv7 aplikasi), faskes_uuid, waktu epoch detik, soft delete deleted_at. Tidak ada FK
// lintas-layanan ke pegawai/practitioner (divalidasi di aplikasi, pola ambulans_kru). Idempoten (IF NOT EXISTS).

const WAKTU = 'created_at BIGINT NOT NULL, updated_at BIGINT, deleted_at BIGINT';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS mutu_instrumen (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          kode VARCHAR(50), nama VARCHAR(255) NOT NULL, periode VARCHAR(50), keterangan TEXT,
          aktif BOOLEAN NOT NULL DEFAULT true,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_instrumen_kode_uq ON mutu_instrumen (faskes_uuid, kode) WHERE deleted_at IS NULL AND kode IS NOT NULL;
        CREATE INDEX IF NOT EXISTS mutu_instrumen_faskes_idx ON mutu_instrumen (faskes_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_bab (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          instrumen_uuid VARCHAR(255) NOT NULL REFERENCES mutu_instrumen(uuid),
          kode VARCHAR(50) NOT NULL, nama VARCHAR(255) NOT NULL, urutan INT NOT NULL DEFAULT 0,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_bab_kode_uq ON mutu_bab (instrumen_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_standar (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          bab_uuid VARCHAR(255) NOT NULL REFERENCES mutu_bab(uuid),
          kode VARCHAR(50) NOT NULL, nama VARCHAR(255) NOT NULL, urutan INT NOT NULL DEFAULT 0,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_standar_kode_uq ON mutu_standar (bab_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_elemen_penilaian (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          standar_uuid VARCHAR(255) NOT NULL REFERENCES mutu_standar(uuid),
          kode VARCHAR(50) NOT NULL, uraian TEXT NOT NULL, urutan INT NOT NULL DEFAULT 0,
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_elemen_kode_uq ON mutu_elemen_penilaian (standar_uuid, kode) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_dokumen (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('kebijakan', 'pedoman', 'spo', 'program', 'bukti')),
          unit_pemilik VARCHAR(255), nomor VARCHAR(100) NOT NULL, judul VARCHAR(255) NOT NULL,
          versi VARCHAR(20) NOT NULL DEFAULT '1',
          tanggal_terbit BIGINT NOT NULL, tanggal_tinjau_ulang BIGINT,
          status VARCHAR(20) NOT NULL DEFAULT 'draf' CHECK (status IN ('draf', 'disahkan', 'kedaluwarsa', 'dicabut')),
          versi_sebelumnya_uuid VARCHAR(255) REFERENCES mutu_dokumen(uuid),
          akar_uuid VARCHAR(255) NOT NULL, urutan_versi INT NOT NULL DEFAULT 1,
          catatan_status TEXT, catatan_tinjauan TEXT, ditinjau_oleh VARCHAR(255), ditinjau_pada BIGINT,
          disahkan_oleh VARCHAR(255), disahkan_pada BIGINT,
          berkas BYTEA NOT NULL, berkas_info JSONB NOT NULL,
          dibagikan_surveior BOOLEAN NOT NULL DEFAULT false, dibagikan_sampai BIGINT,
          dibuat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_dokumen_nomor_versi_uq ON mutu_dokumen (faskes_uuid, nomor, versi) WHERE deleted_at IS NULL;
        -- Rantai versi lurus: satu versi hanya boleh punya satu revisi aktif.
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_dokumen_revisi_uq ON mutu_dokumen (versi_sebelumnya_uuid) WHERE deleted_at IS NULL AND versi_sebelumnya_uuid IS NOT NULL;
        CREATE INDEX IF NOT EXISTS mutu_dokumen_akar_idx ON mutu_dokumen (akar_uuid, urutan_versi) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_dokumen_status_idx ON mutu_dokumen (faskes_uuid, status) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_dokumen_tinjau_idx ON mutu_dokumen (faskes_uuid, tanggal_tinjau_ulang) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_dokumen_elemen (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          dokumen_uuid VARCHAR(255) NOT NULL REFERENCES mutu_dokumen(uuid),
          elemen_uuid VARCHAR(255) NOT NULL REFERENCES mutu_elemen_penilaian(uuid),
          dibuat_oleh VARCHAR(255), dihapus_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE UNIQUE INDEX IF NOT EXISTS mutu_dokumen_elemen_uq ON mutu_dokumen_elemen (dokumen_uuid, elemen_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_dokumen_elemen_elemen_idx ON mutu_dokumen_elemen (elemen_uuid) WHERE deleted_at IS NULL;

        CREATE TABLE IF NOT EXISTS mutu_kredensial (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          pegawai_uuid VARCHAR(255) NOT NULL, practitioner_uuid VARCHAR(255),
          jenis VARCHAR(20) NOT NULL CHECK (jenis IN ('str', 'sip', 'sertifikat', 'rkk', 'spk')),
          nomor VARCHAR(100), uraian TEXT,
          tanggal_mulai BIGINT, tanggal_berakhir BIGINT,
          status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'dicabut')),
          alasan_cabut TEXT, dicabut_oleh VARCHAR(255), dicabut_pada BIGINT,
          berkas BYTEA, berkas_info JSONB, dicatat_oleh VARCHAR(255),
          ${WAKTU}
        );
        CREATE INDEX IF NOT EXISTS mutu_kredensial_pegawai_idx ON mutu_kredensial (faskes_uuid, pegawai_uuid) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS mutu_kredensial_berakhir_idx ON mutu_kredensial (faskes_uuid, tanggal_berakhir) WHERE deleted_at IS NULL AND status = 'aktif';

        CREATE TABLE IF NOT EXISTS mutu_audit (
          uuid VARCHAR(255) PRIMARY KEY, faskes_uuid VARCHAR(255) NOT NULL,
          entitas VARCHAR(50) NOT NULL, entitas_uuid VARCHAR(255) NOT NULL, aksi VARCHAR(50) NOT NULL,
          data_sebelum JSONB, data_sesudah JSONB, aktor VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL, updated_at BIGINT
        );
        CREATE INDEX IF NOT EXISTS mutu_audit_entitas_idx ON mutu_audit (faskes_uuid, entitas, entitas_uuid);
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS mutu_audit, mutu_kredensial, mutu_dokumen_elemen, mutu_dokumen,
        mutu_elemen_penilaian, mutu_standar, mutu_bab, mutu_instrumen;
    `);
  },
};
