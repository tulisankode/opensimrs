'use strict';

// Izin submodul "Antrean Online BPJS" (modul Antrian) untuk peran & pengguna yang sudah memiliki modul Antrian —
// pola sama dengan 20261017013010-izin_utd. Fitur sendiri (antrian_online_bpjs) tetap mati bawaan (lihat
// 20261017110000-sinkron_katalog_antrean_bpjs); izin ini hanya menyiapkan pilihan submodul di Pengaturan Peran,
// akses nyata tetap bergantung pada fitur yang diaktifkan per faskes.
const MODUL = 'Antrian';
const SUB = 'Antrean Online BPJS';
const ALLOWS = ['READ', 'KONFIGURASI', 'KIRIM ULANG'];

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, permissions FROM "${tabel}" WHERE permissions LIKE '%"${MODUL}"%'`);
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
      const idx = modul.subModules.findIndex((s) => s?.name === SUB);
      let berubah = false;
      if (tambah && idx < 0) {
        modul.subModules.push({ name: SUB, allows: ALLOWS });
        berubah = true;
      } else if (!tambah && idx >= 0) {
        modul.subModules.splice(idx, 1);
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
