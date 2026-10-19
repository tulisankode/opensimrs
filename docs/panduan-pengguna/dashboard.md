# Dashboard

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas manajemen/pimpinan faskes sebelum dipakai Helpdesk.

**Dipakai oleh:** semua pengguna, terutama pimpinan faskes dan manajemen
**Menu:** Dashboard; Dashboard › **Dashboard Eksekutif** (tombol di kanan atas halaman Dashboard)
**Hak akses yang dibutuhkan:**
- Dashboard: tidak perlu izin khusus. Menu **Dashboard** selalu tampil bagi pengguna yang sudah masuk.
- Dashboard Eksekutif: Dashboard › Eksekutif › READ (melihat), RINCIAN (membuka rincian), EKSPOR PDF, ATUR TARGET (mengatur target KPI); fitur **Dashboard Eksekutif** harus aktif untuk faskes.

## Untuk apa
Dashboard menampilkan ringkasan kegiatan faskes dalam rentang tanggal tertentu, yaitu jumlah kunjungan, pasien baru, penjualan obat, pendapatan, dan grafik pendukungnya. Data yang tampil hanya milik faskes tempat Anda masuk. **Dashboard Eksekutif** menampilkan indikator pimpinan (layanan, keuangan, mutu, dan SDM) lengkap dengan target KPI, tanpa identitas pasien.

## Tugas sehari-hari

### Melihat ringkasan kegiatan
1. Klik menu **Dashboard**. Halaman ini juga tampil otomatis setelah login.
2. Secara bawaan, data yang ditampilkan adalah **30 hari terakhir**.
3. Baca empat kartu di baris atas:
   - **Total Kunjungan**: jumlah kunjungan rawat jalan, rawat inap, dan IGD;
   - **Pasien Baru**: jumlah pasien baru yang tercatat;
   - **Total Penjualan Obat**: jumlah transaksi penjualan obat;
   - **Total Pendapatan**: total pendapatan dalam Rupiah.

**Hasilnya:** angka ringkas untuk rentang tanggal yang dipilih.

### Mengubah rentang tanggal
1. Di kanan atas, ada dua kolom tanggal di samping judul **Dashboard**.
2. Pilih tanggal awal pada kolom kiri dan tanggal akhir pada kolom kanan.
3. Data dimuat ulang secara otomatis. Selama proses itu muncul tulisan **Memuat…**.

Semua tanggal dalam rentang tampil di grafik; tanggal tanpa data bernilai 0. Agar batang tetap terbaca, rentang lebih dari 45 hari dikelompokkan per minggu (label diawali "Mg"), dan rentang lebih dari 180 hari dikelompokkan per bulan.

> Tanggal akhir tidak boleh lebih awal dari tanggal awal. Bila terbalik, data tidak diperbarui.

### Membaca grafik kunjungan
- **Kunjungan Pasien**: batang bertumpuk per tanggal (atau per minggu/bulan) dengan warna berbeda untuk **Rawat Jalan**, **Rawat Inap**, dan **IGD**. Jenis rawat yang tidak punya data disembunyikan.
- **Status Pelayanan Rawat Jalan**: jumlah dan persentase pasien rawat jalan dalam status **Belum Diperiksa**, **Diperiksa**, dan **Selesai**.
- **Kunjungan Per-jenis Kelamin**: perbandingan pasien **Perempuan** dan **Laki-laki**.
- **Top 5 Poli** dan **Top 5 DPJP**: batang mendatar untuk lima poli dan lima dokter dengan kunjungan terbanyak.

Arahkan kursor ke batang grafik untuk melihat angka tepatnya.

### Membaca grafik keuangan
- **Pemasukan dan Pengeluaran**: batang berdampingan **Pemasukan** (dari tagihan pasien) dan **Pengeluaran** (pembelian barang ke pemasok) per tanggal, dengan sumbu Rupiah (rb, jt, M).
- Di atas grafik tampil total **Pemasukan**, **Pengeluaran**, dan **Selisih**. Selisih berwarna hijau bila pemasukan lebih besar, dan merah bila lebih kecil.

### Melihat dashboard faskes lain (khusus superadmin)
1. Klik ikon akun di kanan atas.
2. Pilih faskes di **Pilih Faskes**.
3. Buka lagi **Dashboard** untuk melihat data faskes tersebut.

### Membuka Dashboard Eksekutif (pimpinan)
1. Di halaman **Dashboard**, klik **Dashboard Eksekutif** di kanan atas. Tombol ini hanya tampil bila fitur aktif dan Anda punya izin Dashboard › Eksekutif › READ.
2. Atur periode dengan dua kolom tanggal, lalu klik ikon **Muat ulang** bila perlu. Superadmin dapat memilih satu atau beberapa faskes di kolom **Faskes aktif**.
3. Pilih tab kelompok indikator: **Layanan**, **Keuangan**, **Mutu**, atau **SDM**. Angka kecil di samping nama tab adalah jumlah indikatornya.
4. Baca kartu indikator. Setiap kartu memuat nama indikator, keterangan singkat (arahkan kursor untuk melihat rumus), nilai, target, perubahan dibanding periode sebelumnya, dan grafik.
   - Garis atas kartu berwarna hijau (**Sesuai target**), kuning (**Perlu perhatian**), atau merah (**Di luar target**).
   - Kartu bertanda **Belum tersedia** berarti datanya belum ada di OpenSIMRS. Alasannya tertulis di kartu.
5. Untuk melihat rincian, klik tombol **per …** di bawah grafik (mis. **per Poli**, **per Dokter**, **per Ruang**, atau **per Penjamin**). Tombol ini butuh izin RINCIAN.

**Hasilnya:** jendela **Rincian … per …** menampilkan tabel agregat tanpa identitas pasien.

### Mengekspor ringkasan rapat (PDF)
1. Di **Dashboard Eksekutif**, atur periode yang diinginkan.
2. Klik **Ekspor PDF** (butuh izin EKSPOR PDF).

**Hasilnya:** ringkasan indikator per kelompok terbuka sebagai PDF. Ekspor ini tercatat di audit trail.

### Mengatur target KPI
1. Di **Dashboard Eksekutif**, klik **Target KPI** (butuh izin ATUR TARGET; tombol tidak tampil saat superadmin memilih faskes lain).
2. Di jendela **Target KPI Faskes**, isi **Minimum**, **Maksimum**, dan **Toleransi %** untuk tiap **Indikator** yang ingin dipantau.
3. Klik **Simpan**.

**Hasilnya:** warna kartu indikator mengikuti target baru. Target hanya dibandingkan bila satu faskes yang dilihat (muncul keterangan "Target KPI dibandingkan bila satu faskes dipilih").

### Bertanya ke asisten Bantuan
Bila fitur **Asisten Bantuan (Helpdesk AI)** aktif, klik ikon headset **Bantuan** di kanan atas header, ketik pertanyaan di **Tulis pertanyaan…**, lalu kirim. Klik **Percakapan baru** untuk memulai dari awal. Bila Helpdesk belum aktif, jendela Bantuan menjelaskan alasannya.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| (Grafik kosong / angka 0) | Belum ada data pada rentang tanggal itu. | Perlebar rentang tanggal. |
| (Data tidak berubah setelah tanggal diganti) | Tanggal akhir lebih awal dari tanggal awal. | Perbaiki urutan tanggal. |
| Akses ditolak / Modul tidak aktif | Halaman lain yang dibuka tidak diizinkan. | Klik **Kembali ke Dashboard**. Lihat `setting.md`. |
| Data dashboard eksekutif tidak dapat dimuat. Pastikan Anda memiliki hak Dashboard › Eksekutif dan periode yang dipilih valid. | Izin kurang atau periode tidak valid (maksimal 366 hari). | Perpendek periode, atau minta admin menambah izin. |
| Rincian tidak dapat dimuat (periksa hak RINCIAN). | Pengguna tidak punya izin RINCIAN. | Minta admin menambah izin Dashboard › Eksekutif › RINCIAN. |

## Pertanyaan yang sering diajukan
**Apakah angka di Dashboard sama dengan laporan resmi?** Dashboard hanya ringkasan cepat. Untuk angka resmi, gunakan menu **Laporan** atau laporan di masing-masing modul.

**Kenapa angka hari ini masih berubah-ubah?** Data mengikuti transaksi yang masuk. Pilih ulang tanggal untuk memuat data terbaru.

**Kenapa grafik menampilkan "Mg 1 Jan" atau nama bulan, bukan tanggal?** Rentang yang dipilih panjang, sehingga data dikelompokkan per minggu (lebih dari 45 hari) atau per bulan (lebih dari 180 hari).

**Bisakah grafik diunduh?** Dashboard biasa belum punya tombol unduh. Di **Dashboard Eksekutif** tersedia **Ekspor PDF**.

**Kenapa tombol Dashboard Eksekutif tidak ada?** Fitur **Dashboard Eksekutif** belum aktif untuk faskes, atau Anda belum punya izin Dashboard › Eksekutif › READ.

**Kenapa indikator tertulis "belum dapat dihitung"?** Datanya belum cukup pada periode itu, misalnya belum ada pasien pulang. Alasannya tertulis di kartu.

## Bila menu tidak muncul
- Dashboard adalah modul inti dan selalu aktif. Bila halaman tidak tampil, coba keluar (**LOGOUT**) lalu masuk lagi.
- Dashboard Eksekutif: superadmin mengaktifkan fitur **Dashboard Eksekutif** di **Setting › Manajemen Modul** (modul Dashboard), lalu admin memberi izin **Dashboard › Eksekutif** di **Datamaster › Role**.
- Bila tetap bermasalah, hubungi admin faskes.

## Catatan untuk peninjau
- **Total Kunjungan** dihitung dari tanggal daftar rawat jalan, rawat inap, dan IGD. Di kode, kunjungan yang sudah dibatalkan tampaknya ikut terhitung. Mohon dipastikan.
- Arti **Pasien Baru** (pasien yang dibuat dalam rentang tanggal) dan sumber **Total Pendapatan** (tabel tagihan) perlu dipastikan pengertiannya oleh tim keuangan.
- Rumus indikator Dashboard Eksekutif (BOR, ALOS, TOI, BTO, GDR, NDR, waktu tunggu) mengikuti rumus Barber-Johnson Depkes 2005 menurut changelog. Mohon ditinjau tim rekam medis/mutu sebelum angka dipakai rapat.
- Menurut changelog, izin Dashboard › Eksekutif hanya otomatis diberikan ke super admin global. Admin faskes perlu menambahkannya ke peran pimpinan secara manual.
- Langkah asisten Bantuan ditulis dari label tombol (TombolBantuan.vue) dan perlu dicoba di layar.
