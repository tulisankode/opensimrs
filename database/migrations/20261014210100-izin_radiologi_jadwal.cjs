'use strict';

// Izin fitur baru modul Radiologi untuk peran & pengguna yang sudah ada (kolom permissions = teks JSON):
// - Sub-modul "Penjadwalan" (READ/CREATE/UPDATE/BATAL/CETAK) → diberikan kepada yang punya sub-modul "Order Radiologi";
//   hak mengikuti hak order (CREATE → CREATE+UPDATE, BATAL, CETAK).
// - Datamaster "Ruang & Alat", "Template Expertise", "Petugas Radiologi" → diberikan kepada yang punya fitur
//   "Pemeriksaan Radiologi" dengan hak yang sama.
// Lihat auth-service/src/helpers/permission-list.js (radiologiPermission).

const FITUR_BARU = ['Ruang & Alat', 'Template Expertise', 'Petugas Radiologi'];

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
    const subs = m.subModules;
    // Sub-modul Penjadwalan
    const order = subs.find((s) => s?.name === 'Order Radiologi');
    const iJadwal = subs.findIndex((s) => s?.name === 'Penjadwalan');
    if (tambah && order && iJadwal < 0) {
      const a = order.allows ?? ['READ'];
      const allows = ['READ', ...(a.includes('CREATE') ? ['CREATE', 'UPDATE'] : []), ...(a.includes('BATAL') ? ['BATAL'] : []), ...(a.includes('CETAK') ? ['CETAK'] : [])];
      subs.splice(subs.indexOf(order) + 1, 0, { name: 'Penjadwalan', allows });
      berubah = true;
    } else if (!tambah && iJadwal >= 0) {
      subs.splice(iJadwal, 1);
      berubah = true;
    }
    // Fitur datamaster
    for (const sm of subs.filter((s) => s?.name === 'Datamaster' && Array.isArray(s.features))) {
      const acuan = sm.features.find((f) => f?.name === 'Pemeriksaan Radiologi');
      for (const nama of FITUR_BARU) {
        const ada = sm.features.findIndex((f) => f?.name === nama);
        if (tambah && acuan && ada < 0) {
          sm.features.push({ name: nama, allows: [...(acuan.allows ?? ['READ'])] });
          berubah = true;
        } else if (!tambah && ada >= 0) {
          sm.features.splice(ada, 1);
          berubah = true;
        }
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
