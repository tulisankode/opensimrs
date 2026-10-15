'use strict';

// Izin aksi baru modul MCU untuk peran & pengguna yang sudah ada (definisi di auth-service permission-list.js):
// - Peserta › IMPOR (pendaftaran rombongan dari Excel) → diberikan kepada yang sudah memiliki Peserta › CREATE.
// - Tagihan Korporasi › PEMBAYARAN (catat / batalkan pembayaran invoice) → kepada yang memiliki Tagihan Korporasi › UPDATE.

const TAMBAHAN = [
  { submodul: 'Peserta', syarat: 'CREATE', aksi: 'IMPOR' },
  { submodul: 'Tagihan Korporasi', syarat: 'UPDATE', aksi: 'PEMBAYARAN' },
];

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%"MCU"%'`);
    for (const r of rows) {
      let data;
      try {
        data = JSON.parse(r.permissions);
      } catch {
        continue;
      }
      if (!Array.isArray(data)) continue;
      const mcu = data.find((x) => x?.module === 'MCU');
      if (!mcu || !Array.isArray(mcu.subModules)) continue;
      let berubah = false;
      for (const t of TAMBAHAN) {
        for (const sub of mcu.subModules.filter((s) => s?.name === t.submodul && Array.isArray(s.allows))) {
          const ada = sub.allows.includes(t.aksi);
          if (tambah && !ada && sub.allows.includes(t.syarat)) {
            sub.allows.splice(sub.allows.indexOf(t.syarat) + 1, 0, t.aksi);
            berubah = true;
          } else if (!tambah && ada) {
            sub.allows = sub.allows.filter((a) => a !== t.aksi);
            berubah = true;
          }
        }
      }
      if (berubah) {
        await sq.query(`UPDATE "${tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
      }
    }
  }
};

module.exports = {
  async up(queryInterface) {
    await proses(queryInterface, true);
  },
  async down(queryInterface) {
    await proses(queryInterface, false);
  },
};
