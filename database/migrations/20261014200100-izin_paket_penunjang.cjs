'use strict';

// Izin fitur baru Datamaster "Paket Radiologi" (modul Radiologi) & "Paket Terapi" (modul Fisioterapi) untuk
// peran & pengguna yang sudah ada. Diberikan kepada yang sudah memiliki fitur saudaranya ("Pemeriksaan Radiologi" /
// "Tindakan Terapi") dengan hak yang sama. Kolom permissions = teks JSON (lihat auth-service permission-list.js).

const TAMBAHAN = [
  { modul: 'Radiologi', acuan: 'Pemeriksaan Radiologi', baru: 'Paket Radiologi' },
  { modul: 'Fisioterapi', acuan: 'Tindakan Terapi', baru: 'Paket Terapi' },
];

const ubahIzin = (teks, tambah) => {
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  let berubah = false;
  for (const t of TAMBAHAN) {
    for (const m of data.filter((x) => x?.module === t.modul)) {
      for (const sm of (m.subModules ?? []).filter((s) => s?.name === 'Datamaster' && Array.isArray(s.features))) {
        const acuan = sm.features.find((f) => f?.name === t.acuan);
        const ada = sm.features.findIndex((f) => f?.name === t.baru);
        if (tambah && acuan && ada < 0) {
          sm.features.splice(sm.features.indexOf(acuan) + 1, 0, { name: t.baru, allows: [...(acuan.allows ?? ['READ'])] });
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
    const [rows] = await sq.query(
      `SELECT uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%Pemeriksaan Radiologi%' OR permissions LIKE '%Tindakan Terapi%'`,
    );
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
