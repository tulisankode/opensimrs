'use strict';

// Riwayat substitusi obat Resep Dokter (Farmasi). Endpoint substitusi sudah ada sejak lama, tetapi tabelnya
// belum pernah dibuat sehingga selalu gagal 500. Satu baris = satu penggantian obat pada item resep non-racikan
// sebelum verifikasi (status 1–2): obat asal (snapshot), obat pengganti, alasan, petugas, dan persetujuan dokter.
const KOLOM = `
  id serial,
  uuid varchar(255) PRIMARY KEY,
  faskes_uuid varchar(255) NOT NULL,
  prescription_uuid varchar(255) NOT NULL,
  prescription_item_uuid varchar(255) NOT NULL,
  item_medis_asal_uuid varchar(255) NOT NULL,
  jenis_stok_asal_uuid varchar(255),
  medication_qty_asal double precision,
  data_asal jsonb,
  item_medis_uuid varchar(255) NOT NULL,
  jenis_stok_uuid varchar(255) NOT NULL,
  medication_qty double precision NOT NULL,
  harga_satuan double precision,
  kategori_alasan varchar(50) NOT NULL,
  alasan text NOT NULL,
  persetujuan_dokter boolean NOT NULL DEFAULT false,
  dokter_penyetuju varchar(255),
  catatan text,
  petugas varchar(255) NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint,
  deleted_at bigint`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const sql = (s) => queryInterface.sequelize.query(s, { transaction });
      await sql(`CREATE TABLE IF NOT EXISTS prescription_item_substitutions (${KOLOM})`);

      // Tabel yang sudah ada dengan bentuk lain (mis. dibuat manual dari model lama) harus gagal jelas.
      const struktur = await queryInterface.describeTable('prescription_item_substitutions', { transaction });
      for (const kolom of ['uuid', 'faskes_uuid', 'prescription_item_uuid', 'item_medis_asal_uuid', 'item_medis_uuid', 'kategori_alasan', 'alasan', 'petugas']) {
        if (!struktur[kolom]) throw new Error(`Skema prescription_item_substitutions tidak sesuai: kolom ${kolom} tidak ada`);
      }

      await sql(`CREATE INDEX IF NOT EXISTS prescription_item_substitutions_resep
        ON prescription_item_substitutions (faskes_uuid, prescription_uuid) WHERE deleted_at IS NULL`);
      await sql(`CREATE INDEX IF NOT EXISTS prescription_item_substitutions_item
        ON prescription_item_substitutions (prescription_item_uuid) WHERE deleted_at IS NULL`);
    });
  },
  async down() {
    // Riwayat substitusi adalah jejak audit pelayanan; tidak dihapus oleh pemulihan otomatis.
  },
};
