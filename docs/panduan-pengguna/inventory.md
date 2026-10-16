# Gudang & Pengadaan

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas gudang farmasi/logistik sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas gudang farmasi/logistik, petugas pengadaan, kepala instalasi farmasi (verifikator)
**Menu:** Inventory › Pengadaan Barang · Pengeluaran Barang · Penerimaan Barang · Datamaster › Supplier · Riwayat Tarif · Kartu Stok & Mutasi · Stok Opname · Stok Adjustment · Laporan
**Hak akses yang dibutuhkan:** Inventory › (Pengadaan Barang, Verifikasi Pembelian Barang Supplier, Retur dan Penggantian Supplier, Pengeluaran Barang, Penerimaan Barang, Datamaster Supplier, Riwayat Tarif, Kartu Stok dan Mutasi, Stok Opname, Stok Adjustment, Laporan Inventory) › READ beserta aksinya. Permintaan barang dari depo atau unit memakai modul izin STOK.

## Untuk apa
Modul ini mengelola stok di gudang: pembelian ke supplier, verifikasinya, dan penerimaan barang. Modul ini juga mengirim barang ke depo atau unit yang meminta, mencatat pemakaian dan pemusnahan, meretur barang ke supplier, dan menjalankan stok opname serta koreksi stok.

Sebelum mulai, pilih gudang yang dikerjakan pada kotak **Pilih Lokasi Stok** di bagian atas sidebar Inventory.

## Tugas sehari-hari

### Membuat pengajuan pembelian ke supplier
1. Buka **Inventory › Pengadaan Barang › Pembelian Barang Supplier**, lalu klik **Permintaan**.
2. Isi kepala pembelian:
   - **Lokasi Penerima**, **Kategori Item**, **Jenis Item**, dan **Jenis Stok**;
   - **Supplier**, **Tgl. PO**, dan **Cara Bayar**;
   - **Catatan** bila perlu, dan nyalakan **Cito** bila mendesak.
3. Klik **Tambah Item** (satu per satu) atau **Tambah Item Multiple** (beberapa sekaligus). Pada setiap baris, pilih barang, isi jumlah, dan pilih satuan beli.
4. Periksa diskon dan PPN, lalu klik **Simpan Pembelian**.

**Hasilnya:** pembelian tampil dengan status **PENGAJUAN**. Selama belum diverifikasi, pembelian masih dapat diubah lewat **Ubah Pembelian** atau dibatalkan lewat **Batal Pembelian**.

### Memverifikasi pembelian
1. Buka **Inventory › Pengadaan Barang › Verifikasi Pembelian Barang Supplier**.
2. Pilih **Pengajuan Pembelian**, lalu klik baris pembelian yang akan diperiksa.
3. Periksa barang dan jumlahnya, lalu klik **Verifikasi**.

**Hasilnya:** status berubah menjadi **DIVERIFIKASI**, dan pembelian muncul di **Penerimaan Pembelian** sebagai **Belum Diterima**.

### Menerima barang dari supplier
1. Buka **Inventory › Penerimaan Barang › Penerimaan Pembelian**, pilih **Belum Diterima**, lalu klik baris pembelian.
2. Isi data penerimaan:
   - **Tgl. Penerimaan**, **No. Faktur**, **Tgl. Faktur**, dan **No. Surat Jalan**;
   - **Catatan** bila perlu.
3. Pada setiap barang, isi tanggal kedaluwarsa (exp. date) sesuai fisik barang.
4. Periksa **Diskon**, **Materai**, dan PPN, lalu isi **Nama Supplier Pengirim**.
5. Klik **Terima Pembelian**.

**Hasilnya:** stok gudang bertambah dan status menjadi **DITERIMA**. Faktur dapat dicetak dari detail penerimaan lewat **Cetak Faktur**.

### Memverifikasi dan mengirim barang ke depo atau unit
Depo atau unit mengajukan permintaan lewat tombol **Stok › Permintaan Barang** di sidebar modulnya (lihat [farmasi.md](./farmasi.md)).
1. Buka **Inventory › Pengeluaran Barang › Verifikasi & Pengiriman Unit**, lalu pilih **Permintaan**.
2. Klik baris permintaan. Isi jumlah yang akan dikirim pada setiap barang, lalu klik **Verifikasi**.
3. Isi **Catatan Pengiriman** bila perlu, lalu klik **Kirim Barang**. Untuk menolak permintaan, klik **Tolak Permintaan**.

**Hasilnya:** status berubah menjadi **DIKIRIM** (atau **DITOLAK**). Stok gudang berkurang, dan unit dapat melihat barang di **Stok › Penerimaan Unit**.

### Mencatat pengeluaran barang tanpa permintaan, pemakaian, atau pemusnahan
1. Buka **Inventory › Pengeluaran Barang › Pengeluaran Unit**, lalu klik **Pengeluaran**.
2. Pilih **Jenis Pengeluaran**:
   - **Pemakaian Unit**;
   - **Pengeluaran Tanpa Permintaan**: isi juga **Tujuan Pengeluaran**;
   - **Pemusnahan Barang**: pilih juga **Jenis Pemusnahan**, yaitu **Kadaluarsa** atau **Rusak**.
3. Isi **Tanggal Pengeluaran**, **Kategori Item**, **Jenis Stok**, **Jenis Item**, dan **Catatan**.
4. Tambahkan barang lewat **Tambah Item** atau **Tambah Item Multiple**, lalu klik **Simpan**.

**Hasilnya:** stok gudang berkurang dan pengeluaran tercatat dengan nomor pengeluaran.

### Meretur barang ke supplier dan menerima penggantian
1. Buka **Inventory › Pengadaan Barang › Retur & Penggantian Barang Supplier**, lalu klik **Retur**.
2. Isi **Tgl. Retur**, **Alasan Retur**, **Asal Lokasi Gudang**, dan **Catatan**.
3. Cari faktur penerimaan lewat jendela **Faktur Penerimaan**. Cari berdasarkan **Cari No. Faktur** dan **Tgl. Faktur**, lalu pilih barang dan jumlah yang diretur.
4. Klik **Simpan & Proses Retur**. Status retur menjadi **RETUR**.
5. Saat penggantian datang:
   1. Buka retur tersebut, lalu pilih **Jenis Penggantian** dan isi **Tgl. Penggantian**.
   2. Isi barang atau nominal penggantian, lalu klik **Simpan & Terima Penggantian**.

**Hasilnya:** status retur menjadi **DITERIMA**.

### Melakukan stok opname
1. Buka **Inventory › Stok Opname**, lalu klik **Stok Opname**.
2. Isi **Judul Stok Opname**, **Jenis Stok**, **Kategori Item**, **Jenis Item**, dan **Tgl. Cut Off**.
3. Klik **Rekonsil Dari Master Item** atau **Rekonsil Dari Stok Item** untuk memuat daftar barang beserta **Stok Sistem**.
4. Klik **Kartu Stok** untuk mengunduh lembar kerja. Isi hasil hitung fisik di lembar itu, lalu unggah lewat **Import Excel**, pilih berkas, dan klik **Simpan & Preview**. Kolom **Stok Fisik** dan **Selisih** akan terisi.
5. Hapus barang yang tidak dihitung dengan **Hapus Item**.
6. Klik **Simpan (Draft)** untuk melanjutkan nanti, atau **Simpan & Akhiri SO** bila sudah selesai.

**Hasilnya:** stok opname berstatus **DRAFT** atau **SELESAI**. Stok opname yang selesai dapat dicetak dari halaman detailnya lewat **Cetak**.

### Mengoreksi stok di luar opname (Stok Adjustment)
1. Buka **Inventory › Stok Adjustment**, cari barang, lalu klik **Cari**.
2. Klik **Adjustment** pada baris barang. Jendela berisi daftar batch (exp. date dan stok) akan terbuka.
3. Klik **Adjust** pada batch yang dikoreksi, lalu konfirmasi dengan **Iya, Adjust Item**.

**Hasilnya:** stok batch terkoreksi dan tercatat di mutasi.

### Melihat kartu stok, riwayat harga, dan laporan
- **Kartu Stok & Mutasi**: pilih **Kartu Stok** atau **Mutasi**, atur filter (**Kategori**, **Jenis Stok**, **Jenis Item**, **Lokasi Stok**, dan tanggal), lalu klik **Tampilkan**. Klik **Cetak** untuk mengunduh.
- **Riwayat Tarif**: menampilkan riwayat harga per barang. Klik **Tampilkan**.
- **Laporan › Obat Expired** dan **Laporan › Persediaan**: atur tanggal, klik **Cari**, lalu klik **Cetak**.

### Mengelola data supplier
1. Buka **Inventory › Datamaster › Supplier**, lalu klik **Data**.
2. Isi data supplier:
   - **Kode Supplier** dan **Nama Supplier**;
   - alamat lengkap (**Provinsi**, **Kab/Kota**, **Kecamatan**, **Kel/Desa**, dan **Alamat**);
   - **No. Telepon** (contoh: 080000000000) dan **Kategori Item**;
   - **Status**.
3. Klik **Simpan**. Banyak supplier sekaligus dapat dimasukkan lewat tombol **Import** dengan berkas Excel.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Tidak dapat memverifikasi PO dengan status … | Pembelian sudah diverifikasi, dibatalkan, atau diterima. | Muat ulang halaman dan periksa status pembelian. |
| Permintaan dengan status … tidak dapat diverifikasi. / … tidak dapat dikirim. | Permintaan unit sudah diproses atau dibatalkan. | Muat ulang daftar. Barang hanya bisa dikirim setelah permintaan diverifikasi. |
| Hanya permintaan yang sudah diverifikasi yang bisa dikirim. | **Kirim Barang** diklik sebelum **Verifikasi**. | Klik **Verifikasi** terlebih dahulu. |
| Kuantitas pengiriman (…) melebihi kuantitas yang diminta (…). | Jumlah kirim lebih besar dari jumlah yang diminta unit. | Turunkan jumlah kirim. |
| Stok tidak cukup untuk item … / Sisa stok tidak mencukupi … | Stok gudang kurang untuk dikirim atau dikeluarkan. | Kurangi jumlah, pilih batch atau jenis stok lain, atau ajukan pembelian. |
| Satuan pembelian tidak valid atau tidak ditemukan relasi konversinya … | Barang belum punya konversi satuan beli. | Admin farmasi melengkapi **Konversi Satuan** di **Farmasi › Datamaster › Item Medis**. |
| Lokasi stok tujuan wajib diisi untuk jenis … / Jenis pemusnahan wajib diisi … | Kolom wajib untuk jenis pengeluaran itu masih kosong. | Isi **Tujuan Pengeluaran** atau **Jenis Pemusnahan**. |
| Import gagal. Terdapat kode supplier yang sudah terdaftar … | Kode supplier di berkas Excel sudah ada di sistem. | Ganti atau hapus baris dengan kode ganda, lalu impor ulang. |

## Pertanyaan yang sering diajukan
**Mengapa barang yang sudah dibeli belum masuk stok?** Stok baru bertambah setelah **Terima Pembelian** di menu Penerimaan Pembelian, bukan saat verifikasi.

**Mengapa permintaan dari depo tidak muncul di gudang?** Pastikan gudang yang dipilih di **Pilih Lokasi Stok** sama dengan **Tujuan Permintaan** yang dipilih depo.

**Apa beda Stok Opname dan Stok Adjustment?** Stok opname adalah penghitungan fisik berkala untuk banyak barang. Stok adjustment adalah koreksi satu batch barang di luar jadwal opname, misalnya karena barang rusak atau hilang.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **Gudang & Pengadaan**). Pembelian ke Supplier (PO), Retur & Penggantian Supplier, Stok Opname, dan Penyesuaian Stok adalah fitur yang bisa dinyalakan terpisah.
- Peran belum punya izin: admin › **Datamaster › Role** (modul Inventory, dan modul STOK untuk permintaan dari unit).

## Catatan untuk peninjau
- Di daftar izin, submodul **Laporan Inventory** memuat fitur "Obat Expired" dua kali dan tidak memuat "Persediaan". Akibatnya, menu **Laporan › Persediaan** mungkin tidak tampil untuk peran selain superadmin.
- Rute **Pembelian Barang Supplier** memeriksa izin "Pengadaan Barang › Verifikasi Pembelian Barang Supplier". Namanya membingungkan, mohon dicek saat mengatur peran.
- Jendela konfirmasi pembatalan pembelian dan penolakan pengiriman berjudul "Batal Penjualan". Ini tampaknya salah label di kode.
- Pada halaman tambah stok opname, kolom **Stok Fisik** tidak bisa diketik langsung, sehingga langkahnya ditulis lewat **Kartu Stok** → **Import Excel**. Mohon dipastikan alur ini, termasuk bentuk lembar kerjanya.
- Isian pada jendela **Adjust** (stok baru atau selisih) belum terbaca jelas dari kode. Mohon dilengkapi oleh petugas gudang.
