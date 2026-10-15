'use strict';

// Integrasi BPJS VClaim (FKRTL / rumah sakit):
// - konfigurasi VClaim per faskes di integrations (rahasia disimpan terenkripsi oleh bpjs-service;
//   kolom lama cons_id/secret_key/user_key/p_p_k dibaca sebagai cadangan lalu dikosongkan saat disimpan ulang)
// - kode poli VClaim per lokasi (berbeda dengan kode poli PCare)
// - catatan SEP yang dibuat dari OpenSIMRS
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE integrations
        ADD COLUMN IF NOT EXISTS vclaim_aktif      BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS vclaim_cons_id    VARCHAR(255),
        ADD COLUMN IF NOT EXISTS vclaim_secret_key TEXT,
        ADD COLUMN IF NOT EXISTS vclaim_user_key   TEXT,
        ADD COLUMN IF NOT EXISTS vclaim_kd_ppk     VARCHAR(50);

      ALTER TABLE lokasi ADD COLUMN IF NOT EXISTS kd_poli_vclaim VARCHAR(20);

      CREATE TABLE IF NOT EXISTS bpjs_vclaim_sep (
        id              BIGSERIAL PRIMARY KEY,
        uuid            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
        faskes_uuid     VARCHAR(255) NOT NULL,
        no_sep          VARCHAR(30)  NOT NULL,
        no_kartu        VARCHAR(30)  NOT NULL,
        no_rm           VARCHAR(50),
        patient_uuid    VARCHAR(255),
        sumber          VARCHAR(30),               -- rawat_jalan | rawat_inap | igd
        sumber_uuid     VARCHAR(255),              -- kunjungan OpenSIMRS yang dikaitkan
        no_reg          VARCHAR(255),
        jenis_pelayanan VARCHAR(2) NOT NULL,       -- 1 rawat inap, 2 rawat jalan
        tgl_sep         DATE NOT NULL,
        poli_tujuan     VARCHAR(20),
        diag_awal       VARCHAR(20),
        no_rujukan      VARCHAR(50),
        ppk_rujukan     VARCHAR(30),
        asal_rujukan    VARCHAR(2),                -- 1 faskes tingkat 1, 2 faskes tingkat 2 (RS)
        kelas_rawat     VARCHAR(2),
        dpjp            VARCHAR(30),
        catatan         TEXT,
        status          VARCHAR(20) NOT NULL DEFAULT 'aktif', -- aktif | dihapus
        permintaan      JSONB,
        respons         JSONB,
        dibuat_oleh     VARCHAR(255),
        dihapus_oleh    VARCHAR(255),
        created_at      BIGINT NOT NULL,
        updated_at      BIGINT NOT NULL,
        CONSTRAINT bpjs_vclaim_sep_unik UNIQUE (faskes_uuid, no_sep)
      );
      CREATE INDEX IF NOT EXISTS bpjs_vclaim_sep_kartu_idx ON bpjs_vclaim_sep (faskes_uuid, no_kartu);
      CREATE INDEX IF NOT EXISTS bpjs_vclaim_sep_tgl_idx ON bpjs_vclaim_sep (faskes_uuid, tgl_sep);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS bpjs_vclaim_sep;
      ALTER TABLE lokasi DROP COLUMN IF EXISTS kd_poli_vclaim;
      ALTER TABLE integrations
        DROP COLUMN IF EXISTS vclaim_aktif, DROP COLUMN IF EXISTS vclaim_cons_id,
        DROP COLUMN IF EXISTS vclaim_secret_key, DROP COLUMN IF EXISTS vclaim_user_key,
        DROP COLUMN IF EXISTS vclaim_kd_ppk;
    `);
  },
};
