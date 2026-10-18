'use strict';

// Izin submodul "Pembelian Marketplace" (modul Inventory) untuk peran & pengguna yang sudah memiliki modul Inventory —
// pola sama dengan 20261017110010-izin_antrean_bpjs. Fitur sendiri (inv_marketplace) tetap mati bawaan (lihat
// 20261018120100-sinkron_katalog_inv_marketplace); izin ini hanya menyiapkan pilihan submodul di Pengaturan Peran,
// akses nyata tetap bergantung pada fitur yang diaktifkan per faskes.
const MODUL = 'Inventory';
const SUB = 'Pembelian Marketplace';
// Hanya aksi operasional yang diberikan otomatis. Aksi berisiko (KONFIGURASI KONEKSI, KELOLA PEMETAAN, PERSETUJUAN,
// CHECKOUT, LIHAT LAPORAN) sengaja TIDAK diberikan massal: admin menetapkannya per peran di Pengaturan Peran agar
// pemohon tidak otomatis bisa menyetujui & membayar permintaannya sendiri.
const ALLOWS = ['READ', 'CARI PENAWARAN', 'AJUKAN PERMINTAAN', 'SINKRON STATUS'];

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
