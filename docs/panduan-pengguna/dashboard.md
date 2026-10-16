# Dashboard

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas manajemen/pimpinan faskes sebelum dipakai Helpdesk.

**Dipakai oleh:** semua pengguna, terutama pimpinan faskes dan manajemen
**Menu:** Dashboard
**Hak akses yang dibutuhkan:** tidak perlu izin khusus. Menu **Dashboard** selalu tampil bagi pengguna yang sudah masuk.

## Untuk apa
Dashboard menampilkan ringkasan kegiatan faskes dalam rentang tanggal tertentu, yaitu jumlah kunjungan, pasien baru, penjualan obat, pendapatan, dan grafik pendukungnya. Data yang tampil hanya milik faskes tempat Anda masuk.

## Tugas sehari-hari

### Melihat ringkasan kegiatan
1. Klik menu **Dashboard**. Halaman ini juga tampil otomatis setelah login.
2. Secara bawaan, data yang ditampilkan adalah **30 hari terakhir**.
3. Baca empat kartu di baris atas:
   - **Total Kunjungan**: jumlah kunjungan rawat jalan, rawat inap, dan IGD;
   - **Pasien Baru**: jumlah pasien baru yang tercatat;
   - **Total Penjualan Obat**: jumlah transaksi penjualan obat;
   - **Total Pendapatan Klinik**: total pendapatan dalam Rupiah.

**Hasilnya:** angka ringkas untuk rentang tanggal yang dipilih.

### Mengubah rentang tanggal
1. Di kanan atas, ada dua kolom tanggal di samping judul **Dashboard**.
2. Pilih tanggal awal pada kolom kiri dan tanggal akhir pada kolom kanan.
3. Data dimuat ulang secara otomatis. Selama proses itu muncul tulisan **Memuat…**.

> Tanggal akhir tidak boleh lebih awal dari tanggal awal. Bila terbalik, data tidak diperbarui.

### Membaca grafik kunjungan
- **Kunjungan Pasien**: garis jumlah kunjungan per tanggal.
- **Status Pelayanan Rawat Jalan**: jumlah dan persentase pasien rawat jalan dalam status **Belum Diperiksa**, **Diperiksa**, dan **Selesai**.
- **Kunjungan Berdasarkan Status Rawat**: perbandingan kunjungan **Rawat Jalan**, **Rawat Inap**, dan **IGD** per tanggal.
- **Kunjungan Per-jenis Kelamin**: perbandingan pasien **Perempuan** dan **Laki-laki**.
- **Top 5 Poli** dan **Top 5 DPJP**: lima poli dan lima dokter dengan kunjungan terbanyak.

Arahkan kursor ke titik grafik untuk melihat angka tepatnya.

### Membaca grafik keuangan
- **Pemasukan dan Pengeluaran**: garis **Pemasukan** (dari tagihan pasien) dan **Pengeluaran** (pembelian barang ke pemasok) per tanggal.

### Melihat dashboard faskes lain (khusus superadmin)
1. Klik ikon akun di kanan atas.
2. Pilih faskes di **Pilih Faskes**.
3. Buka lagi **Dashboard** untuk melihat data faskes tersebut.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| (Grafik kosong / angka 0) | Belum ada data pada rentang tanggal itu. | Perlebar rentang tanggal. |
| (Data tidak berubah setelah tanggal diganti) | Tanggal akhir lebih awal dari tanggal awal. | Perbaiki urutan tanggal. |
| Akses ditolak / Modul tidak aktif | Halaman lain yang dibuka tidak diizinkan. | Klik **Kembali ke Dashboard**. Lihat `setting.md`. |

## Pertanyaan yang sering diajukan
**Apakah angka di Dashboard sama dengan laporan resmi?** Dashboard hanya ringkasan cepat. Untuk angka resmi, gunakan menu **Laporan** atau laporan di masing-masing modul.

**Kenapa angka hari ini masih berubah-ubah?** Data mengikuti transaksi yang masuk. Pilih ulang tanggal untuk memuat data terbaru.

**Bisakah grafik diunduh?** Belum ada tombol unduh grafik di Dashboard.

## Bila menu tidak muncul
- Dashboard adalah modul inti dan selalu aktif. Bila halaman tidak tampil, coba keluar (**LOGOUT**) lalu masuk lagi.
- Bila tetap bermasalah, hubungi admin faskes.

## Catatan untuk peninjau
- **Total Kunjungan** dihitung dari tanggal daftar rawat jalan, rawat inap, dan IGD. Di kode, kunjungan yang sudah dibatalkan tampaknya ikut terhitung. Mohon dipastikan.
- Arti **Pasien Baru** (pasien yang dibuat dalam rentang tanggal) dan sumber **Total Pendapatan Klinik** (tabel tagihan) perlu dipastikan pengertiannya oleh tim keuangan.
- Kartu bertuliskan "Total Pendapatan Klinik" juga tampil untuk faskes jenis rumah sakit.
- Ada fitur katalog "Asisten Bantuan (Helpdesk AI)" di modul Dashboard, tetapi tombolnya belum ditemukan di halaman Dashboard. Fitur ini belum ditulis.
