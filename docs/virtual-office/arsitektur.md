# Arsitektur Virtual Office (STD-0042)

Virtual Office adalah peta isometrik 2.5D **baca-saja** yang menggambarkan aktivitas operasional faskes **hari ini** (tanggal lokal faskes, bawaan WIB) per unit: jumlah menunggu, dilayani, selesai, beban, dan alur transaksi antarunit. Semua angka adalah agregat dari transaksi nyata OpenSIMRS; tidak ada nama pasien, No. RM, NIK, diagnosis, atau hasil pemeriksaan pada respons maupun tampilan. Avatar mewakili beban kerja (menunggu/dilayani), **bukan** kehadiran atau aktivitas pegawai tertentu.

## Alur

1. Halaman `/dashboard/virtual-office` (fitur katalog `dashboard_virtual_office`, izin Dashboard › Virtual Office › READ) memanggil `GET /api/v3/laporan/virtual-office/snapshot` setiap 30 detik (`interval_polling`, dibatasi 30–60 detik). Polling berhenti saat tab tersembunyi atau peramban luring, lalu langsung memuat ulang saat kembali.
2. `laporan-service/src/virtual-office/routes.js` memeriksa READ (`helpers/izin.js`), lalu `snapshot.js`:
   - menolak token tanpa `faskesUuid` (401) dan parameter kueri apa pun (400), karena faskes **hanya** diambil dari JWT;
   - `akses.js` membaca modul aktif faskes (katalog, preset segmen, override); fitur nonaktif menghasilkan 403;
   - unit tampil bila modulnya aktif. Angka dan ruang unit hanya untuk aksi unit yang dimiliki pengguna (PENDAFTARAN, RAWAT JALAN, IGD, RAWAT INAP, LABORATORIUM, RADIOLOGI, FARMASI, KASIR). Unit lain tampil **terkunci** tanpa angka. Jalur hanya tampil bila kedua ujungnya terbuka;
   - `sumber.js` menjalankan kueri agregat per unit (lihat [pemetaan-status.md](./pemetaan-status.md)). Kegagalan satu sumber menandai unit `galat` dan tidak pernah ditampilkan sebagai nol;
   - hasil agregat ditembolok 15 detik per faskes dan daftar unit; izin tetap diperiksa pada setiap permintaan;
   - `tata-letak.js` menyusun denah (koordinat petak) dari `konfigurasi.json` › `denah`. Unit `per_ruang` (poli, ruangan rawat inap) menjadi zona berisi ruang anak (maksimal `batas_ruang`, sisanya digabung menjadi "Lainnya").
3. Frontend (`frontend-service/src/views/Dashboard/VirtualOffice/`) memproyeksikan denah ke isometrik 2:1 dalam SVG: lantai berpetak, zona, ruang berdinding rendah dengan dinding depan berwarna beban, meja, avatar beban kerja, label, dan lengkung jalur beranimasi. Peta dapat digeser (seret atau tombol panah) dan di-zoom (roda mouse, cubit, atau tombol). Klik ruang, zona, atau jalur membuka panel rincian. Tersedia tombol Pusatkan dan Layar penuh, serta status Live/Tertunda/Offline dengan waktu snapshot.

## Konsistensi angka

Snapshot dihitung dari **status terkini** setiap baris transaksi, bukan dari aliran event. Setiap transaksi dihitung tepat satu kali sesuai status terakhirnya. Perubahan status berulang tidak menggandakan antrean, dan status tidak dapat mundur karena urutan pembaruan (KT-9 sampai KT-11 terpenuhi dari cara penghitungannya). Tidak ada endpoint tulis dan tidak ada tabel proyeksi; Virtual Office tidak mengubah transaksi sumber.

## Konfigurasi

`laporan-service/src/virtual-office/konfigurasi.json` berversi dan diubah lewat peninjauan kode. Isinya: daftar unit (modul katalog, aksi izin, rute modul sumber, ambang beban), denah (baris unit, ukuran ruang, koridor), dan jalur lintas unit. Ambang beban memakai jumlah menunggu (kuning/merah), atau BOR untuk rawat inap.

## Mode simulasi

Bawaannya data nyata. Untuk demo atau QA, set `VIRTUAL_OFFICE_SIMULASI=aktif` di laporan-service. Struktur unit dan ruang tetap dibaca dari database, tetapi angka diganti bilangan sintetis deterministik per blok 5 menit. Respons bertanda `mode_data: "simulasi"` dan UI menampilkan spanduk **Simulasi**.

## Penelusuran detail

Panel menampilkan tautan "Buka modul …" ke halaman modul sumber (mis. `/laboratorium/order-lab`) hanya bila pengguna berizin pada rute itu. Detail transaksi, izin, dan audit tetap diatur oleh modul sumber.
