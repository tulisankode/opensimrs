'use strict';

// Izin fitur baru "Mapping PACS" dalam modul Radiologi yang sudah ada, untuk peran & pengguna yang sudah ada:
// Datamaster tambah fitur baru "Mapping PACS" (hak sama seperti fitur "Petugas Radiologi").
// Kolom permissions = teks JSON (lihat auth-service/src/helpers/permission-list.js, radiologiPermission).

const ubahIzin = (teks, tambah) => {
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  let berubah = false;
  for (const m of data.filter((x) => x?.module === 'Radiologi' && Array.isArray(x.subModules))) {
    for (const sm of m.subModules.filter((s) => s?.name === 'Datamaster' && Array.isArray(s.features))) {
      const acuan = sm.features.find((f) => f?.name === 'Petugas Radiologi');
      const ada = sm.features.findIndex((f) => f?.name === 'Mapping PACS');
      if (tambah && acuan && ada < 0) {
        sm.features.splice(sm.features.indexOf(acuan) + 1, 0, { name: 'Mapping PACS', allows: [...(acuan.allows ?? ['READ', 'CREATE', 'UPDATE', 'DELETE'])] });
        berubah = true;
      } else if (!tambah && ada >= 0) {
        sm.features.splice(ada, 1);
        berubah = true;
      }
    }
  }
  return berubah ? JSON.stringify(data) : null;
};

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%"Radiologi"%'`);
    for (const r of rows) {
      const baru = ubahIzin(r.permissions, tambah);
      if (baru) await sq.query(`UPDATE "${tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: baru, u: r.uuid } });
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
