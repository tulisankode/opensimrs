'use strict';

// Izin submodul pelacakan unit linen (STD-0030) untuk peran & pengguna yang sudah memiliki modul "Laundry"
// (20261018090010-izin_laundry):
//   - super admin (tanpa faskes) → seluruh aksi submodul baru (definisi laundryPermission di permission-list.js);
//   - peran/pengguna faskes yang sudah punya modul Laundry → hanya "Pemindaian Unit" › READ (membaca hasil pindai).
//     Pemindaian tetap menjalankan aksi alur yang sudah ada (Penerimaan, Batch, Distribusi), jadi tidak ada hak baru
//     yang melonggarkan akses. Registrasi/label, koreksi unit, dan laporan unit diberikan admin lewat Setting › Hak Akses.
const path = require('path');
const { pathToFileURL } = require('url');

const MODUL = 'Laundry';
const SUB_BARU = ['Unit Linen', 'Pemindaian Unit', 'Koreksi Unit', 'Laporan Unit'];
const SUB_FASKES = { 'Pemindaian Unit': ['READ'] };

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  const { laundryPermission } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
  );
  const definisi = laundryPermission.subModules.filter((s) => SUB_BARU.includes(s.name));
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, faskes_uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%"${MODUL}"%'`);
    for (const r of rows) {
      let data;
      try {
        data = JSON.parse(r.permissions);
      } catch {
        continue;
      }
      if (!Array.isArray(data)) continue;
      const modul = data.find((x) => x?.module === MODUL);
      if (!modul || !Array.isArray(modul.subModules)) continue;
      let berubah = false;
      for (const def of definisi) {
        const idx = modul.subModules.findIndex((s) => s?.name === def.name);
        if (tambah && idx < 0) {
          if (!r.faskes_uuid) modul.subModules.push(JSON.parse(JSON.stringify(def)));
          else if (SUB_FASKES[def.name]) modul.subModules.push({ name: def.name, allows: SUB_FASKES[def.name] });
          else continue;
          berubah = true;
        } else if (!tambah && idx >= 0) {
          modul.subModules.splice(idx, 1);
          berubah = true;
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
