'use strict';

// Izin modul baru "Laundry" (STD-0023) untuk peran & pengguna yang sudah ada:
//   - super admin (tanpa faskes) yang sudah memiliki daftar izin → seluruh izin Laundry (definisi dari auth-service
//     permission-list.js, laundryPermission);
//   - pemilik modul "Rawat Inap" pada faskes yang modul laundry-nya aktif (preset segmen + override) → hanya izin
//     petugas ruangan: lihat stok, serah terima linen kotor, permintaan, dan konfirmasi penerimaan linen bersih.
// Peran petugas laundry (batch, distribusi, koreksi, datamaster, laporan) diatur admin lewat Setting › Hak Akses.

const path = require('path');
const { pathToFileURL } = require('url');

const MODUL_KODE = 'laundry';
const MODUL_IZIN = 'Laundry';

// Subset izin petugas ruangan.
const IZIN_RUANGAN = {
  'Stok & Par Level': ['READ'],
  Penerimaan: ['READ', 'CREATE'],
  'Permintaan Linen': ['READ', 'CREATE', 'BATAL'],
  Distribusi: ['READ', 'KONFIRMASI'],
};

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
  const { laundryPermission } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
  );
  const izinRuangan = {
    module: MODUL_IZIN,
    subModules: laundryPermission.subModules
      .filter((s) => IZIN_RUANGAN[s.name])
      .map((s) => ({ name: s.name, allows: s.allows.filter((a) => IZIN_RUANGAN[s.name].includes(a)) })),
  };
  const aktif = await modulAktif(sq);
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, faskes_uuid, permissions FROM "${tabel}" WHERE permissions IS NOT NULL AND permissions <> ''`);
    for (const r of rows) {
      let data;
      try {
        data = JSON.parse(r.permissions);
      } catch {
        continue;
      }
      if (!Array.isArray(data) || !data.length) continue;
      const idx = data.findIndex((x) => x?.module === MODUL_IZIN);
      const punyaRanap = data.some((x) => x?.module === 'Rawat Inap');
      let berubah = false;
      if (tambah && idx < 0) {
        if (!r.faskes_uuid) {
          data.push(JSON.parse(JSON.stringify(laundryPermission)));
          berubah = true;
        } else if (punyaRanap && aktif.has(r.faskes_uuid)) {
          data.push(JSON.parse(JSON.stringify(izinRuangan)));
          berubah = true;
        }
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
