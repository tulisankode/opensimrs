### Ditambahkan
- **Data demo: skenario "ramai banget"** (`npm run db:demo:ramai`, `database/demo/seed-ramai.cjs`) untuk Virtual Office & Command Center (development/staging saja):
  - mengisi ratusan transaksi fiktif hari ini (WIB) untuk satu faskes demo (bawaan RSA) di semua unit: antrean admisi, kunjungan rawat jalan per poli, IGD (sebagian > 4 jam), rawat inap (menunggu kamar dari IGD/RJ, dirawat dengan bed terisi), order lab & radiologi (ada cito), resep, serta tagihan berjalan/ditutup/lunas dengan riwayat pembayaran;
  - opsi `--intensitas sedang|ramai|sangat-ramai`, `--benih`, mode `--hidup [--interval 10]` yang terus memajukan status dan menambah kedatangan, serta `--bersihkan` yang hanya menghapus baris skrip (jejak di tabel `demo_jejak_ramai`);
  - idempoten per hari dan ditolak bila `NODE_ENV`/`LINGKUNGAN` = production.

### Diubah
- **Virtual Office: denah mengikuti area tampilan.** Tata letak kini dihitung rapat di frontend dari daftar unit & ruang snapshot (kontrak API tetap):
  - zona dan unit dikemas per rak (unit tunggal boleh ditumpuk), koridor tipis seragam, lalu ruang direntangkan hingga denah terisi penuh — ruang lebih besar bila ruangnya sedikit atau areanya luas;
  - Denah memilih susunan dengan keliling terkecil dan dipaskan di atas legenda; Kantor memilih zoom bulat terbesar yang memuat denah (atau zoom "pas" pecahan bila 1× tidak muat) lalu memusatkannya;
  - pas ulang otomatis saat tampil, saat berganti tampilan, saat ukuran area berubah, dan lewat tombol Pusatkan; label ruang Kantor dipotong agar tidak saling menimpa; rute pasien berjalan mengikuti koridor & celah tumpukan yang baru.
