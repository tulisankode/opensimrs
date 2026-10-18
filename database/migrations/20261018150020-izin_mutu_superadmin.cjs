'use strict';

// Izin modul baru "Mutu & Akreditasi" (STD-0028). Hanya role/pengguna super admin global (faskes_uuid NULL) yang SUDAH
// memiliki daftar izin yang mendapat izin submodul fitur Dokumen Akreditasi & Kredensial Staf (definisi dari
// auth-service permission-list.js, mutuPermission). Daftar izin kosong = super admin tanpa batas, tidak diubah (bila
// diisi satu modul justru membatasi akses). Peran faskes TIDAK diberi otomatis: admin faskes mendapat izin lewat
// sinkron modul saat modul diaktifkan, peran lain (Pokja, Komite, SDM, surveior) diatur di Setting › Hak Akses.
// Submodul/aksi digabung (bukan ditimpa) agar item mutu berikutnya cukup menambah submodul pada modul yang sama.
// Idempoten: submodul & aksi yang sudah ada tidak digandakan.

const path = require('path');
const { pathToFileURL } = require('url');

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  const { mutuPermission } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href
  );
  const nama = mutuPermission.module;
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, permissions FROM "${tabel}" WHERE faskes_uuid IS NULL AND permissions IS NOT NULL AND permissions <> ''`);
    for (const r of rows) {
      let data;
      try {
        data = JSON.parse(r.permissions);
      } catch {
        continue;
      }
      if (!Array.isArray(data) || !data.length) continue;
      let modul = data.find((x) => x?.module === nama);
      let berubah = false;
      if (tambah) {
        if (!modul) {
          data.push((modul = { module: nama, subModules: [] }));
          berubah = true;
        }
        if (!Array.isArray(modul.subModules)) modul.subModules = [];
        for (const sub of mutuPermission.subModules) {
          const ada = modul.subModules.find((s) => s?.name === sub.name);
          if (!ada) {
            modul.subModules.push(JSON.parse(JSON.stringify(sub)));
            berubah = true;
            continue;
          }
          if (!Array.isArray(ada.allows)) ada.allows = [];
          for (const aksi of sub.allows) {
            if (!ada.allows.includes(aksi)) {
              ada.allows.push(aksi);
              berubah = true;
            }
          }
        }
      } else if (modul) {
        const namaSub = mutuPermission.subModules.map((s) => s.name);
        const sisa = (modul.subModules ?? []).filter((s) => !namaSub.includes(s?.name));
        if (sisa.length) modul.subModules = sisa;
        else data.splice(data.indexOf(modul), 1);
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
