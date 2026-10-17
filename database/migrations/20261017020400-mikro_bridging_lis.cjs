'use strict';

// Bridging LIS Mikrobiologi (STD-0014) — pola sama dengan Bridging LIS laboratorium klinik (lab_lis_*), konteks
// terpisah karena mikrobiologi punya isolat jamak per spesimen, hasil bertahap (sementara → final), dan mapping
// tambahan untuk organisme & antibiotik (bukan hanya item pemeriksaan). uuid memakai VARCHAR + uuidv7 dari aplikasi,
// konsisten dengan tabel mikro_* yang sudah ada (migrasi 20261014232000-mikrobiologi.cjs — tidak diubah).
// - mikro_koneksi_lis      : koneksi LIS mikrobiologi per faskes (boleh lebih dari satu; satu bawaan).
// - mikro_kiriman_lis      : registrasi order yang dikirim ke LIS (unik per faskes+order+koneksi → anti kirim dobel).
// - mikro_hasil_lis_mentah : payload hasil mentah dari LIS (audit + idempotensi berdasarkan identitas hasil LIS).
// - mikro_spesimen_jenis_lis, mikro_pemetaan_ref : mapping kode LIS untuk jenis spesimen & referensi (unit/dokter/penjamin).
// - mikro_organisme.kode_lis, mikro_antibiotik.kode_lis : mapping kode LIS, terpisah dari kode_whonet yang sudah ada.
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

const ALLOW_BARU = {
  'Konfigurasi LIS Mikrobiologi': ['LIHAT', 'KELOLA'],
  'Mapping LIS Mikrobiologi': ['LIHAT', 'KELOLA'],
  'Pengiriman LIS Mikrobiologi': ['LIHAT', 'KIRIM ULANG', 'CEK STATUS'],
};

// Tambah/hapus sub-modul baru pada modul Mikrobiologi yang sudah dimiliki peran/pengguna (kolom permissions = JSON teks).
const ubahIzin = (teks, tambah) => {
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  let berubah = false;
  for (const m of data.filter((x) => x?.module === 'Mikrobiologi' && Array.isArray(x.subModules))) {
    for (const [nama, allows] of Object.entries(ALLOW_BARU)) {
      const ada = m.subModules.findIndex((s) => s?.name === nama);
      if (tambah && ada < 0) {
        m.subModules.push({ name: nama, allows: [...allows] });
        berubah = true;
      } else if (!tambah && ada >= 0) {
        m.subModules.splice(ada, 1);
        berubah = true;
      }
    }
  }
  return berubah ? JSON.stringify(data) : null;
};

const prosesIzin = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%"Mikrobiologi"%'`);
    for (const r of rows) {
      const baru = ubahIzin(r.permissions, tambah);
      if (baru) await sq.query(`UPDATE "${tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: baru, u: r.uuid } });
    }
  }
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS mikro_koneksi_lis (
        uuid              VARCHAR(255) PRIMARY KEY,
        faskes_uuid       VARCHAR(255) NOT NULL,
        nama              VARCHAR(100) NOT NULL,
        kode_rs           VARCHAR(50),
        url_registrasi    VARCHAR(500) NOT NULL,
        url_hasil         VARCHAR(500),
        api_key           TEXT,
        kunci_masuk       TEXT,
        kunci_masuk_hash  VARCHAR(64) UNIQUE,
        aktif             BOOLEAN NOT NULL DEFAULT true,
        bawaan            BOOLEAN NOT NULL DEFAULT false,
        maks_paralel      INT NOT NULL DEFAULT 2,
        jeda_ms           INT NOT NULL DEFAULT 0,
        created_at        BIGINT NOT NULL,
        updated_at        BIGINT,
        deleted_at        BIGINT
      );
      CREATE INDEX IF NOT EXISTS mikro_koneksi_lis_faskes_idx ON mikro_koneksi_lis (faskes_uuid) WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS mikro_kiriman_lis (
        uuid            VARCHAR(255) PRIMARY KEY,
        faskes_uuid     VARCHAR(255) NOT NULL,
        order_uuid      VARCHAR(255) NOT NULL,
        koneksi_uuid    VARCHAR(255) NOT NULL,
        no_registrasi   VARCHAR(100) NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'baru', -- baru | mengirim | terkirim | gagal | tidak_pasti
        status_hasil    VARCHAR(20),                          -- hasil_diterima | hasil_sebagian
        percobaan       INT NOT NULL DEFAULT 0,
        pesan           TEXT,
        permintaan      JSONB,
        respons         JSONB,
        diklaim_pada    BIGINT,
        diklaim_oleh    VARCHAR(255),
        dikirim_oleh    VARCHAR(255),
        created_at      BIGINT NOT NULL,
        updated_at      BIGINT,
        deleted_at      BIGINT,
        CONSTRAINT mikro_kiriman_lis_unik UNIQUE (faskes_uuid, order_uuid, koneksi_uuid)
      );
      CREATE INDEX IF NOT EXISTS mikro_kiriman_lis_noreg_idx ON mikro_kiriman_lis (faskes_uuid, no_registrasi);

      CREATE TABLE IF NOT EXISTS mikro_hasil_lis_mentah (
        uuid                VARCHAR(255) PRIMARY KEY,
        faskes_uuid         VARCHAR(255) NOT NULL,
        koneksi_uuid        VARCHAR(255),
        order_uuid          VARCHAR(255),
        item_uuid           VARCHAR(255),
        no_registrasi       VARCHAR(100),
        identitas_hasil_lis VARCHAR(100) NOT NULL,
        status_proses       VARCHAR(20) NOT NULL, -- hasil_diterima | hasil_sebagian | gagal
        pesan               TEXT,
        payload             JSONB,
        sumber              VARCHAR(10) NOT NULL DEFAULT 'push', -- push | tarik
        diterima_pada       BIGINT NOT NULL,
        CONSTRAINT mikro_hasil_lis_mentah_unik UNIQUE (koneksi_uuid, no_registrasi, identitas_hasil_lis)
      );
      CREATE INDEX IF NOT EXISTS mikro_hasil_lis_mentah_order_idx ON mikro_hasil_lis_mentah (faskes_uuid, order_uuid);

      CREATE TABLE IF NOT EXISTS mikro_spesimen_jenis_lis (
        faskes_uuid     VARCHAR(255) NOT NULL,
        jenis_spesimen  VARCHAR(50) NOT NULL,
        kode_lis        VARCHAR(50) NOT NULL,
        nama_lis        VARCHAR(100),
        updated_at      BIGINT,
        PRIMARY KEY (faskes_uuid, jenis_spesimen)
      );

      CREATE TABLE IF NOT EXISTS mikro_pemetaan_ref (
        faskes_uuid VARCHAR(255) NOT NULL,
        jenis       VARCHAR(20) NOT NULL CHECK (jenis IN ('unit', 'dokter', 'penjamin')),
        ref_uuid    VARCHAR(255) NOT NULL,
        kode_lis    VARCHAR(50) NOT NULL,
        nama_lis    VARCHAR(200),
        updated_at  BIGINT,
        PRIMARY KEY (faskes_uuid, jenis, ref_uuid)
      );

      ALTER TABLE mikro_organisme ADD COLUMN IF NOT EXISTS kode_lis VARCHAR(50);
      ALTER TABLE mikro_antibiotik ADD COLUMN IF NOT EXISTS kode_lis VARCHAR(50);
    `);

    // Fitur katalog mikro_bridging_lis (database/data/katalog-modul.json) → ref_fitur, nonaktif bawaan untuk faskes yang sudah ada.
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));

    // Izin submodul baru (Konfigurasi/Mapping/Pengiriman LIS Mikrobiologi) untuk peran & pengguna yang sudah memiliki modul Mikrobiologi.
    await prosesIzin(queryInterface, true);
  },

  async down(queryInterface) {
    await prosesIzin(queryInterface, false);
    await queryInterface.sequelize.query(`
      ALTER TABLE mikro_antibiotik DROP COLUMN IF EXISTS kode_lis;
      ALTER TABLE mikro_organisme DROP COLUMN IF EXISTS kode_lis;
      DROP TABLE IF EXISTS mikro_pemetaan_ref;
      DROP TABLE IF EXISTS mikro_spesimen_jenis_lis;
      DROP TABLE IF EXISTS mikro_hasil_lis_mentah;
      DROP TABLE IF EXISTS mikro_kiriman_lis;
      DROP TABLE IF EXISTS mikro_koneksi_lis;
    `);
  },
};
