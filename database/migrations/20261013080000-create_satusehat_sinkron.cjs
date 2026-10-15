'use strict';

// Catatan sinkronisasi ke SATUSEHAT (Kemenkes): satu baris per sumber data (mis. kunjungan rawat jalan)
// dan jenis resource FHIR. Menjamin pengiriman tidak ganda dan pengiriman gagal dapat diulang.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS satusehat_sinkron (
        id            BIGSERIAL PRIMARY KEY,
        faskes_uuid   VARCHAR(255) NOT NULL,
        sumber        VARCHAR(50)  NOT NULL,            -- rawat_jalan, rawat_inap, igd, lokasi, ...
        sumber_uuid   VARCHAR(255) NOT NULL,            -- uuid baris sumber
        no_pelayanan  VARCHAR(255),
        status        VARCHAR(20)  NOT NULL DEFAULT 'menunggu', -- menunggu | terkirim | gagal | dilewati
        encounter_id  VARCHAR(255),                     -- ID Encounter di SATUSEHAT
        resource_ids  JSONB,                            -- ID resource lain (Condition, Observation, ...)
        percobaan     INTEGER      NOT NULL DEFAULT 0,
        pesan         TEXT,                             -- pesan galat / alasan dilewati
        dikirim_at    BIGINT,
        created_at    BIGINT       NOT NULL,
        updated_at    BIGINT       NOT NULL,
        CONSTRAINT satusehat_sinkron_unik UNIQUE (faskes_uuid, sumber, sumber_uuid)
      );
      CREATE INDEX IF NOT EXISTS satusehat_sinkron_status_idx ON satusehat_sinkron (faskes_uuid, status);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS satusehat_sinkron');
  },
};
