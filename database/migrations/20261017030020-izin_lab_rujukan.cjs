'use strict';

// Izin fitur baru "Lab Rujukan" dalam modul Laboratorium yang sudah ada, untuk peran & pengguna yang sudah ada:
// - Sub-modul "Order Lab" tambah allow TANDAI RUJUKAN, KIRIM RUJUKAN, BATAL RUJUKAN.
// - Sub-modul "Hasil Pemeriksaan" tambah allow UNGGAH BERKAS RUJUKAN.
// - Datamaster tambah fitur baru "Laboratorium Rujukan" (hak sama seperti fitur "Spesimen").
// Kolom permissions = teks JSON (lihat auth-service/src/helpers/permission-list.js, laboraturiumPermission).

const ALLOW_BARU = {
  'Order Lab': ['TANDAI RUJUKAN', 'KIRIM RUJUKAN', 'BATAL RUJUKAN'],
  'Hasil Pemeriksaan': ['UNGGAH BERKAS RUJUKAN'],
};

const ubahIzin = (teks, tambah) => {
  let data;
  try {
    data = JSON.parse(teks);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  let berubah = false;
  for (const m of data.filter((x) => x?.module === 'Laboratorium' && Array.isArray(x.subModules))) {
    const subs = m.subModules;
    // Allow baru pada sub-modul yang sudah ada
    for (const [nama, allows] of Object.entries(ALLOW_BARU)) {
      const sub = subs.find((s) => s?.name === nama);
      if (!sub || !Array.isArray(sub.allows)) continue;
      for (const allow of allows) {
        const ada = sub.allows.includes(allow);
        if (tambah && !ada) {
          sub.allows.push(allow);
          berubah = true;
        } else if (!tambah && ada) {
          sub.allows = sub.allows.filter((a) => a !== allow);
          berubah = true;
        }
      }
    }
    // Fitur Datamaster baru "Laboratorium Rujukan"
    for (const sm of subs.filter((s) => s?.name === 'Datamaster' && Array.isArray(s.features))) {
      const acuan = sm.features.find((f) => f?.name === 'Spesimen');
      const ada = sm.features.findIndex((f) => f?.name === 'Laboratorium Rujukan');
      if (tambah && acuan && ada < 0) {
        sm.features.splice(sm.features.indexOf(acuan) + 1, 0, { name: 'Laboratorium Rujukan', allows: [...(acuan.allows ?? ['READ'])] });
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
    const [rows] = await sq.query(`SELECT uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%"Laboratorium"%'`);
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
