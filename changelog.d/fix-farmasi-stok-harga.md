### Diperbaiki
- **Stok Farmasi › Verifikasi & Pengiriman, Pengeluaran Unit:** verifikasi, kirim, batal, dan pengeluaran unit dari modul Stok kembali berjalan.
  - Sebelumnya stok-farmasi-service memanggil inventory-service di path yang salah (tanpa `/pengeluaran`), sehingga semua aksi itu selalu gagal dengan galat 500. Pesan galat dari inventory (mis. stok tidak cukup) kini diteruskan ke petugas.
- **Alokasi batch saat verifikasi permintaan unit:** kebutuhan yang melebihi satu batch kini dibagi ke batch berikutnya sesuai FEFO/FIFO/LIFO dan hanya dari jenis stok permintaan. Sebelumnya batch pertama dialokasikan berulang, lalu pengiriman gagal karena stok batch itu habis.
- **Kartu Stok & Mutasi:** arah masuk/keluar mengikuti jenis mutasi (surplus/defisit). Sebelumnya retur unit, pemakaian resep, dan retur supplier yang tercatat bernilai positif tampil sebagai stok **masuk**. Stok adjustment kini mencatat selisih, bukan nilai stok baru.
- **Retur unit:** retur beralasan *kadaluarsa* dapat memindahkan batch yang sudah lewat ED. Batch tujuan dengan ED yang sama digabung dan tidak lagi dipecah. Keterangan mutasi memakai nama lokasi, bukan UUID.
- **Permintaan, pengeluaran, dan retur unit:**
  - Jumlah wajib bilangan bulat. Sebelumnya angka desimal menyebabkan galat 500.
  - Lokasi asal dan tujuan wajib milik faskes pengguna dan tidak boleh sama.
  - Batch pengeluaran wajib berasal dari lokasi asal.
  - Tanggal pengeluaran disimpan dalam epoch detik.
  - Item dengan jumlah kirim 0 diperlakukan sebagai sisa permintaan.
- **Stok › Verifikasi & Pengiriman Unit:** daftar menampilkan permintaan yang **ditujukan ke** depo terpilih (lokasi asal), bukan permintaan yang dibuat depo itu sendiri. Penyaringan memakai UUID lokasi. Tab status yang kosong tidak lagi memunculkan galat 404.
- **Form Pengeluaran/Retur Unit:** satuan baris mengikuti satuan penggunaan batch. Sebelumnya retur mengirim UUID jenis stok sebagai konversi, dan pengeluaran mengizinkan memilih "Box" padahal stok dipotong per satuan terkecil.
- **HPP rata-rata (penerimaan barang):** stok lama kini ikut dihitung. Sebelumnya relasi dibaca dengan nama yang salah sehingga HPP rata-rata selalu sama dengan harga beli terakhir, dan stok awal penerimaan di kartu stok selalu 0.
- **Konversi satuan pada PO/penerimaan dan riwayat tarif** dicocokkan per item. Sebelumnya konversi "Box" milik item lain dengan isi berbeda bisa terpakai.
- **Datamaster item medis:** metode HPP `average` dikenali, sehingga harga di daftar item memakai harga rata-rata. Mengubah jenis stok item tidak lagi menimbulkan galat 500. Penghapusan item kini berjalan dalam satu transaksi.
- **Konfigurasi Harga:** metode pemotongan stok dibatasi ke FIFO/FEFO/LIFO dan metode HPP ke average/last. PPN dan margin tidak boleh negatif.

### Keamanan
- **Isolasi faskes pada stok & datamaster farmasi:** detail, ubah, hapus, dan batal tidak lagi bisa menyentuh data faskes lain lewat UUID. Cakupannya:
  - permintaan/pengiriman unit, pengeluaran unit, penerimaan retur unit, stok adjustment, dan daftar stok per lokasi (`/inventory/stok`);
  - harga item;
  - lokasi stok, jenis stok, item medis, jenis stok item, dan konversi.
- **Lokasi stok yang masih memiliki sisa stok** tidak dapat dihapus.
- **Pembatalan permintaan unit** di inventory ditolak bila permintaan sudah dikirim atau sudah dibatalkan.
