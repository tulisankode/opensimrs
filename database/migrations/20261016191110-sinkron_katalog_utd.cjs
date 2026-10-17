'use strict';

// STD-0011: API modul UTD / UPTD Produksi Darah (penunjang-service) sudah diimplementasikan, tetapi frontend
// (store, halaman, menu, rute Vue) belum ada. Modul `utd` dan keenam fiturnya tetap `tersedia: false` ("Segera")
// di database/data/katalog-modul.json sampai frontend siap, sehingga migrasi ini tidak mengubah ketersediaan apa
// pun. Jalankan sinkronKatalog di migrasi baru saat frontend UTD selesai dan katalog diubah menjadi tersedia.
module.exports = {
  async up() {},
  async down() {},
};
