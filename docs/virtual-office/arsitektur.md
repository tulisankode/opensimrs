# Arsitektur Virtual Office (STD-0042)

Virtual Office adalah kantor virtual **baca-saja** yang menggambarkan aktivitas operasional faskes **hari ini** (tanggal lokal faskes, bawaan WIB) per unit: jumlah menunggu, dilayani, selesai, beban, dan alur transaksi antarunit. Semua angka adalah agregat dari transaksi nyata OpenSIMRS; tidak ada nama pasien, No. RM, NIK, diagnosis, atau hasil pemeriksaan pada respons maupun tampilan. Avatar mewakili beban kerja (menunggu/dilayani), **bukan** kehadiran atau aktivitas pegawai tertentu.

## Alur

1. Halaman `/dashboard/virtual-office` (fitur katalog `dashboard_virtual_office`, izin Dashboard › Virtual Office › READ) memanggil `GET /api/v3/laporan/virtual-office/snapshot` setiap 30 detik (`interval_polling`, dibatasi 30–60 detik). Polling berhenti saat tab tersembunyi atau peramban luring, lalu langsung memuat ulang saat kembali.
2. `laporan-service/src/virtual-office/routes.js` memeriksa READ (`helpers/izin.js`), lalu `snapshot.js`:
   - menolak token tanpa `faskesUuid` (401) dan parameter kueri apa pun (400), karena faskes **hanya** diambil dari JWT;
   - `akses.js` membaca modul aktif faskes (katalog, preset segmen, override); fitur nonaktif menghasilkan 403;
   - unit tampil bila modulnya aktif. Angka dan ruang unit hanya untuk aksi unit yang dimiliki pengguna (PENDAFTARAN, RAWAT JALAN, IGD, RAWAT INAP, LABORATORIUM, RADIOLOGI, FARMASI, KASIR). Unit lain tampil **terkunci** tanpa angka. Jalur hanya tampil bila kedua ujungnya terbuka;
   - `sumber.js` menjalankan kueri agregat per unit (lihat [pemetaan-status.md](./pemetaan-status.md)). Kegagalan satu sumber menandai unit `galat` dan tidak pernah ditampilkan sebagai nol;
   - hasil agregat ditembolok 15 detik per faskes dan daftar unit; izin tetap diperiksa pada setiap permintaan;
   - `tata-letak.js` menyusun denah (koordinat petak) dari `konfigurasi.json` › `denah`. Unit `per_ruang` (poli, ruangan rawat inap) menjadi zona berisi ruang anak (maksimal `batas_ruang`, sisanya digabung menjadi "Lainnya").
   - Frontend menyusun ulang tata letak secara rapat (`VirtualOffice/tataLetak.ts`) dari daftar unit & ruang snapshot; posisi server hanya dipakai untuk urutan unit tunggal (kontrak API tidak berubah). Zona dan unit dikemas per rak (unit tunggal boleh ditumpuk dalam satu kolom), dengan koridor 1 petak dan tepi gedung 1 petak, lalu rak, kolom, dan ruang direntangkan hingga denah terisi penuh. Denah memilih susunan dengan keliling terkecil (kotak isometrik selalu ±2:1). Kantor memilih zoom bulat terbesar yang memuat denah di area (dikurangi legenda), lalu rasio terdekat; bila 1× tidak muat, dipakai zoom "pas" pecahan yang diperhalus. Tata letak dipaskan ulang saat tampil, saat ukuran area berubah (ResizeObserver), dan lewat Pusatkan.
3. Frontend (`frontend-service/src/views/Dashboard/VirtualOffice/`) punya dua tampilan dari snapshot & tata letak yang sama; pilihannya diingat per peramban (`localStorage` `virtual-office:tampilan`). Tampilan **Kantor** (bawaan) dijelaskan di bagian berikut. Tampilan **Denah** memproyeksikan denah ke isometrik 2:1 dalam SVG: lantai berpetak, zona, ruang berdinding rendah dengan dinding depan berwarna beban, meja, avatar beban kerja, label, dan lengkung jalur beranimasi. Peta dapat digeser (seret atau tombol panah) dan di-zoom (roda mouse, cubit, atau tombol). Klik ruang, zona, atau jalur membuka panel rincian. Tersedia tombol Pusatkan dan Layar penuh, serta status Live/Tertunda/Offline dengan waktu snapshot.

## Tampilan Kantor (piksel 2D tampak atas)

`KantorPiksel.vue` menggambar denah di Canvas 2D dengan `imageSmoothingEnabled = false`. Satu petak denah = 32 piksel dasar (2×2 ubin 16 px), lalu diskalakan dengan faktor bulat (zoom 1×/2×/3×, dikalikan pixel ratio ≤ 2 dan dibulatkan) agar piksel tetap tajam. Hanya bila denah tidak muat pada 1× (layar kecil) dipakai zoom "pas" pecahan yang digambar diperhalus; pada skala itu label ruang hanya berisi nama. Semua sprite dan perabot **digambar prosedural** di `kantor/sprite.ts` dengan palet terbatas, tanpa aset gambar luar.

- **Ruang & perabot** (`kantor/denah.ts`) mengikuti `jenis_ruang` di `konfigurasi.json`: `loket_daftar` (loket, papan antrean, kursi tunggu), `poli` (meja dokter, bed periksa), `igd` (bed, troli, meja jaga), `bangsal` (deretan bed), `lab` (meja lab, mikroskop, tabung), `radiologi` (mesin), `farmasi` (rak obat, loket), `kasir` (loket, mesin kasir). Koridor, ruang tunggu zona, bangku, tanaman, dan jam dinding (waktu nyata) adalah dekorasi. Pintu ruang ada di ujung kanan dinding selatan.
- **Petugas** = label peran bidang kerja dari `petugas` / `petugas_ruang` (mis. "Dokter {ruang}" → "Dokter Poli Anak"), **bukan** nama atau kehadiran pegawai. Status petugas diturunkan dari angka ruang: *santai* (tidak ada yang menunggu/dilayani), *melayani*, atau *sibuk* (beban Ramai/Padat), tampil sebagai gelembung ikon. Label peran tampil pada zoom ≥ 2×.
- **Pasien** generik tanpa identitas (warna baju deterministik dari nomor urut). Jumlahnya = angka nyata: menunggu duduk di kursi tunggu, dilayani berdiri di depan meja atau berbaring di bed. Pasien di luar slot ditandai "+n". Total sprite dibatasi 320 per bingkai.
- Unit terkunci tampil gelap dengan gembok, tanpa petugas/pasien; sumber gagal tampil abu dengan tanda seru.
- Interaksi: seret untuk menggeser, roda/cubit/tombol untuk zoom bertingkat, klik ruang/karakter → panel rincian (`PanelUnit`), klik pasien berjalan → rincian jalur, panah/plus/minus/0 di kanvas. Panel samping (`PanelKantor.vue`) berisi ringkasan, daftar unit berstatus (klik = fokus kamera ke ruang), dan Log Aktivitas.
- Animasi memakai `requestAnimationFrame`: 30 fps saat ada pasien berjalan/kilatan, 8 fps untuk gerak santai (bobbing, gelembung), dan berhenti saat tab tersembunyi.

## Gerakan, animasi, dan log (kedua tampilan)

- **Perpindahan nyata** (`gerakan.ts`): setiap snapshot baru dibandingkan dengan snapshot sebelumnya. Kenaikan `jumlah` per jalur menjadi pasien yang berjalan dari unit asal ke unit tujuan. Kenaikan `total` unit yang tidak punya jalur masuk terlihat (mis. Kasir, karena tagihan tidak menyimpan unit asal) menjadi kedatangan dari pintu masuk. Untuk unit berzona, tujuan dibagi ke ruang yang totalnya naik. Jumlah avatar sebanding selisih, dibatasi 60. Rute menyusuri koridor di bawah tiap rak denah, celah kolom untuk unit yang ditumpuk, dan lajur tepi kiri/kanan, sehingga tidak menembus ruang. Snapshot pertama, pergantian hari, dan jalur yang baru terlihat (izin berubah) tidak menghasilkan gerakan.
- Tidak ada aktivitas karangan: tanpa selisih positif tidak ada pasien berjalan. Saat semua angka 0 tampil keterangan "Belum ada aktivitas hari ini di faskes ini", dan petugas tetap tampil *santai*.
- Denah: antrean bergoyang pelan, pasien dilayani beranimasi ringan, ruang Padat berdenyut, dan garis jalur hanya beranimasi bila ada arus pada pembaruan terakhir. Kedua tampilan: angka berubah dengan count-up dan ruang yang berubah berkilat singkat.
- Header menampilkan jam waktu nyata dan hitung mundur "pembaruan berikutnya".
- **Log Aktivitas** (`logAktivitas.ts`) diturunkan dari selisih yang sama, mis. "10.32 — 2 pasien baru menunggu di Poli Anak", "1 resep selesai di Farmasi", "6 resep dari Poli Rawat Jalan ke Farmasi", atau "Farmasi menjadi Padat". Kata satuan diambil dari `satuan` unit. Log hanya disimpan di memori halaman (maksimal 50 entri) dan dikosongkan saat berganti faskes.
- `prefers-reduced-motion`: pasien berjalan, goyangan, denyut, dan kilatan dimatikan; angka langsung berganti; kanvas Kantor hanya digambar ulang saat data atau kamera berubah.

## Konsistensi angka

Snapshot dihitung dari **status terkini** setiap baris transaksi, bukan dari aliran event. Setiap transaksi dihitung tepat satu kali sesuai status terakhirnya. Perubahan status berulang tidak menggandakan antrean, dan status tidak dapat mundur karena urutan pembaruan (KT-9 sampai KT-11 terpenuhi dari cara penghitungannya). Tidak ada endpoint tulis dan tidak ada tabel proyeksi; Virtual Office tidak mengubah transaksi sumber.

## Konfigurasi

`laporan-service/src/virtual-office/konfigurasi.json` berversi (versi 4) dan diubah lewat peninjauan kode. Isinya: daftar unit (modul katalog, aksi izin, rute modul sumber, ambang beban, `jenis_ruang`, label peran `petugas`/`petugas_ruang`, `satuan` untuk log), denah (baris unit, ukuran ruang, koridor), dan jalur lintas unit. Ambang beban memakai jumlah menunggu (kuning/merah), atau BOR untuk rawat inap.

## Mode simulasi

Bawaannya data nyata. Untuk demo atau QA, set `VIRTUAL_OFFICE_SIMULASI=aktif` di laporan-service. Struktur unit dan ruang tetap dibaca dari database, tetapi angka diganti bilangan sintetis deterministik per blok 5 menit. Respons bertanda `mode_data: "simulasi"` dan UI menampilkan spanduk **Simulasi**.

## Penelusuran detail

Panel menampilkan tautan "Buka modul …" ke halaman modul sumber (mis. `/laboratorium/order-lab`) hanya bila pengguna berizin pada rute itu. Detail transaksi, izin, dan audit tetap diatur oleh modul sumber.
