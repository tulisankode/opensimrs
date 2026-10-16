'use strict';

// Izin modul baru "Bank Darah RS (BDRS)" untuk peran & pengguna yang sudah ada: diberikan kepada yang sudah
// memiliki modul Laboratorium, hanya pada faskes yang modul bank_darah-nya aktif (preset segmen + override),
// serta super admin (tanpa faskes). Definisi izin diambil dari auth-service permission-list.js (bankDarahPermission).

const path = require('path');
const { pathToFileURL } = require('url');

const MODUL_KODE = 'bank_darah';
const MODUL_KUNCI = 'bank darah rs (bdrs)';

const modulAktif = async (sq) => {
  const [preset] = await sq.query(
    `SELECT fs.faskes_uuid, p.modul_kode FROM faskes_segmen fs JOIN preset_segmen_modul p ON p.segmen_kode = fs.segmen_kode
     WHERE p.modul_kode = '${MODUL_KODE}'`,
  );
  const aktif = new Set(preset.map((r) => r.faskes_uuid));
  const [[ada]] = await sq.query(`SELECT to_regclass('public.faskes_modul_override') AS t`);
  if (ada?.t) {
    const [ov] = await sq.query(`SELECT faskes_uuid, aktif FROM faskes_modul_override WHERE modul_kode = '${MODUL_KODE}'`);
    for (const o of ov) {
      if (o.aktif) aktif.add(o.faskes_uuid);
      else aktif.delete(o.faskes_uuid);
    }
  }
  return aktif;
};

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  const { mapPermission } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
  );
  const aktif = await modulAktif(sq);
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, faskes_uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%"Laboratorium"%'`);
    for (const r of rows) {
      let data;
      try {
        data = JSON.parse(r.permissions);
      } catch {
        continue;
      }
      if (!Array.isArray(data)) continue;
      const idx = data.findIndex((x) => x?.module === 'Bank Darah RS (BDRS)');
      const boleh = !r.faskes_uuid || aktif.has(r.faskes_uuid);
      let berubah = false;
      if (tambah && boleh && idx < 0) {
        data.push(...mapPermission([MODUL_KUNCI]));
        berubah = true;
      } else if (!tambah && idx >= 0) {
        data.splice(idx, 1);
        berubah = true;
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
