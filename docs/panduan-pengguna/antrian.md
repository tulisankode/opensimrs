# Antrian & Layar Panggil

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas admin antrian/pendaftaran sebelum dipakai Helpdesk.

**Dipakai oleh:** admin faskes (pengaturan jadwal dan layar), petugas pendaftaran, petugas poli, dan petugas farmasi (memanggil pasien)
**Menu:** Antrian › Konfigurasi (Jadwal Dokter, Layar Antrian) / Data antrian / Layar / APM / Antrean Online BPJS
**Hak akses yang dibutuhkan:**
- Antrian › Konfigurasi › READ, CREATE, UPDATE, DELETE
- Antrian › Data Antrian › READ
- Antrian › Layar › READ
- Antrian › Apm › CREATE PASIEN JKN, CREATE PASIEN NON-JKN, CHECKIN, PRINT
- Antrian › Antrean Online BPJS › READ, KONFIGURASI, KIRIM ULANG
- Untuk memanggil pasien dari loket pendaftaran: Admisi › Antrian › PANGGIL, LEWATI, PROSSES, SELESAI

## Untuk apa
Modul ini mengatur jadwal praktik dokter beserta kuota pasiennya, menampilkan nomor antrian di layar TV dengan suara panggilan, dan mencatat antrian pasien di admisi, poli, dan farmasi. Faskes juga bisa memakai Anjungan Pasien Mandiri (APM), tempat pasien mengambil nomor dan mendaftar sendiri.

## Tugas sehari-hari

### Membuat jadwal praktik dokter
1. Buka **Antrian › Konfigurasi › Jadwal Dokter**.
2. Klik **Jadwal** (tombol dengan tanda +). Jendela **Tambah Jadwal** terbuka.
3. Pilih **Poliklinik**, lalu isi **Kode Antrian Poli**.
4. Pilih **Nama Dokter**, lalu isi **Kode Antrian Dokter**.
5. Klik **Jadwal Hari** untuk menambah satu baris jadwal. Pada setiap baris, isi kolom berikut:
   - **Hari** dan **Jam Praktek** (jam mulai dan jam selesai);
   - **Slot JKN** dan **Slot Non-JKN** (kuota pasien). **Total Kuota** terhitung otomatis;
   - **Durasi Per-pasien** (minimal 1 menit);
   - **Status**.
6. Ulangi langkah 5 untuk hari praktik lainnya, lalu klik **Simpan**.

**Hasilnya:** muncul pesan "Jadwal dokter berhasil disimpan". Jadwal bisa langsung dipilih di **Admisi › Rawat Jalan** pada hari yang sesuai.

### Mengubah atau menghapus jadwal dokter
1. Buka **Antrian › Konfigurasi › Jadwal Dokter**. Bila perlu, saring dengan **Cari Poli**, **Cari Dokter**, atau **Status** (**Aktif**/**NON-AKTIF**), lalu klik **Cari**.
2. Pada baris dokter, klik ikon **Edit** untuk mengubah jam, kuota, atau status. Klik ikon **Hapus** untuk menghapus jadwal.
3. Klik **Simpan**.

> Jadwal yang sudah memiliki pasien terdaftar tidak bisa diubah atau dihapus. Untuk menghentikan jadwal ke depan, ubah statusnya menjadi nonaktif setelah tidak ada lagi pasien terdaftar.

### Membuat layar antrian
1. Buka **Antrian › Konfigurasi › Layar Antrian**.
2. Klik **Layar Antrian** (tombol dengan tanda +).
3. Isi **Nama Layar**, lalu pilih **Tipe Layar**. Pilihannya:
   - **Layar 3 x 3 Panggilan**;
   - **Layar 3 x 2 Panggilan**;
   - **Layar 3 List & 3 Panggilan**;
   - **Layar 2 List & 2 Panggilan**;
   - **Layar 1 List, 1 Panggilan, 1 Gambar**.
4. Isi **Teks Judul**.
5. Pilih isi layar: **Admisi**, **Poli** (lalu **Pilih Poli**), dan/atau **Farmasi**. Untuk tipe tertentu, isi juga **URL Youtube**.
6. Isi **Running text** bila ingin menampilkan teks berjalan, lalu atur **Status**.
7. Klik **Simpan**.

**Hasilnya:** layar baru tampil di daftar **Layar Antrian** dan di **Antrian › Layar**.

### Memasang layar antrian di TV
1. Buka **Antrian › Layar**.
2. Pada baris layar, klik ikon **Link kiosk (TV)**. Jendela **Link Kiosk TV** terbuka.
3. Klik **Salin** di samping **URL layar**, lalu buka alamat itu di browser TV atau mini PC. Untuk mencoba di komputer sendiri, klik **Buka**.
4. Supaya layar tampil dan bersuara setiap kali TV menyala, ikuti petunjuk di bagian **Agar otomatis tampil & bersuara saat TV/mini PC menyala**. Salin perintah Chrome yang tersedia ke shortcut di folder Startup.
5. Bila di TV muncul tulisan **Ketuk layar untuk mengaktifkan suara**, ketuk atau klik layar sekali.

**Hasilnya:** layar TV tampil penuh tanpa login, diperbarui otomatis, dan mengumumkan panggilan dengan suara.

> Link bocor atau TV hilang? Di jendela **Link Kiosk TV**, klik **Buat Ulang Kunci**. Link lama langsung tidak berlaku, jadi perbarui alamat di semua TV yang memakai layar itu.

### Melihat tampilan layar dan menguji suara
1. Buka **Antrian › Layar**.
2. Pada baris layar, klik ikon **Lihat layar**.
3. Klik **Tes Suara** untuk memastikan suara panggilan terdengar dari pengeras suara.

### Memantau data antrian
1. Buka **Antrian › Data antrian**.
2. Pilih tab **Admisi**, **Rawat Jalan**, atau **Farmasi**.
3. Atur rentang tanggal, ketik nama di **Cari Pasien**, dan pilih status (**Semua**, **Antri**, **Proses**, **SELESAI**, atau **PENYERAHAN OBAT** untuk farmasi). Lalu klik **Cari**.

**Hasilnya:** tampil nomor antrian, kode booking, waktu daftar dan check-in, nama pasien, metode bayar, dan status antrian.

### Memanggil pasien
- **Loket pendaftaran:** buka salah satu halaman **Admisi**, lalu klik ikon megafon di kanan atas. Di panel **Panggilan Antrian**, pakai tombol **Panggil**, **Panggil Ulang**, **Lewati**, **Proses**, dan **Selesaikan Proses**. Langkah lengkapnya ada di `pendaftaran.md`.
- **Poli:** dari halaman di luar Admisi, ikon megafon membuka panel antrian poli.

**Hasilnya:** nomor yang dipanggil tampil dan diumumkan di layar TV yang menampilkan bagian tersebut.

### Menjalankan Anjungan Pasien Mandiri (APM)
1. Buka **Antrian › APM**. Daftar APM tampil.
2. Klik ikon aktifkan pada baris APM yang akan dipakai. Layar anjungan terbuka.
3. Pasien memilih salah satu menu berikut:
   - **Pasien JKN** atau **Pasien Non-JKN**: mengambil nomor antrian dan mendaftar ke poli;
   - **Checkin**: check-in booking yang sudah ada;
   - **Print**: mencetak ulang nomor antrian.

**Hasilnya:** pasien APM tampil di **Admisi › Rawat Jalan** dengan label **APM** dan perlu di-check-in oleh petugas.

### Memantau Antrean Online BPJS (Mobile JKN)
Bagian ini hanya tampil bila fitur *Antrean Online BPJS (Mobile JKN)* aktif. Fitur ini memerlukan modul BPJS FKRTL atau BPJS FKTP.
1. Admin mengisi konfigurasi sekali di **Setting › Konfigurasi Integrasi › BPJS › Antrean Online (Mobile JKN)**: **Cons ID**, **Secret Key**, **User Key**, dan **URL WS Antrean**, lalu **Status** dan **Simpan**.
2. Buka **Antrian › Antrean Online BPJS**. Tabel menampilkan booking dari Mobile JKN dan pendaftaran JKN lokal dengan kolom **Kode Booking**, **Tanggal Periksa**, **Sumber**, **Status Lokal**, **Status Sinkron**, **Task Tercatat**, dan **Percobaan**.
3. Saring dengan **Status Sinkron** bila perlu, lalu klik **Muat Ulang**.
4. Klik **Detail** untuk melihat **Detail Booking Antrean BPJS**, termasuk task id yang tercatat dan **Riwayat pengiriman**.
5. Bila sinkronisasi gagal, klik **Kirim Ulang** pada baris atau di riwayat pengiriman.

**Hasilnya:** status sinkron diperbarui. Bila belum ada data, tampil "Belum ada antrean yang tersinkron dengan BPJS."

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Validasi Error — Semua field jadwal harus diisi dengan benar | Ada kolom jadwal yang kosong. | Lengkapi hari, jam, kuota, durasi, dan status di setiap baris. |
| Validasi Durasi — Durasi per pasien minimal 1 menit | Durasi per pasien bernilai 0 atau kosong. | Isi durasi minimal 1 menit. |
| Jam mulai harus lebih awal dari jam selesai. | Jam praktik terbalik. | Perbaiki jam mulai dan jam selesai. |
| Kuota JKN harus lebih dari 0 / Kuota Non-JKN harus lebih dari 0 | Kuota diisi 0. | Isi kuota minimal 1. |
| Gagal — Gagal menyimpan jadwal dokter | Jadwal gagal disimpan. | Periksa isian, lalu coba lagi. Bila tetap gagal, hubungi admin. |
| Jadwal tidak dapat diubah karena sudah ada pasien yang terdaftar. | Jadwal sudah dipakai untuk pendaftaran. | Tunggu sampai tidak ada pasien terdaftar, atau buat jadwal baru. |
| Jadwal tidak dapat dihapus karena sudah ada pasien yang terdaftar. | Sama seperti di atas. | Sama seperti di atas. |
| Kuota antrian JKN/Non-JKN untuk jadwal ini sudah penuh. | Kuota jadwal habis. | Pilih jadwal lain, atau tambah kuota lewat **Edit**. |
| Minimal harus memilih satu jenis layar | Isi layar belum dipilih. | Centang **Admisi**, **Poli**, atau **Farmasi**. |
| Nama layar harus diisi / Tipe layar harus diisi / Judul harus diisi | Kolom wajib layar kosong. | Lengkapi kolom tersebut. |
| Link layar tidak lengkap. Salin ulang link kiosk dari menu Antrian › Layar. | Alamat di TV terpotong. | Salin ulang URL dari **Link Kiosk TV**. |
| Link layar tidak berlaku. Minta link kiosk terbaru dari admin (menu Antrian › Layar). | Kunci layar sudah dibuat ulang. | Ambil URL terbaru dari **Link Kiosk TV**. |
| Kode booking sudah kadaluarsa. | Kode booking pasien sudah lewat waktunya. | Daftarkan pasien ulang. |

## Pertanyaan yang sering diajukan
**Layar TV tampil tetapi tidak bersuara?** Ketuk layar sekali bila muncul tulisan **Ketuk layar untuk mengaktifkan suara**. Pastikan volume TV menyala, lalu uji dengan **Tes Suara**. Agar suara langsung aktif tanpa diketuk, pakai perintah Chrome dari jendela **Link Kiosk TV**.

**Apakah TV perlu login ke OpenSIMRS?** Tidak. Link kiosk sudah memuat kunci khusus untuk layar itu. Jangan menyebarkan link tersebut.

**Kenapa dokter tidak muncul di pilihan Jadwal saat mendaftar?** Dokter itu belum punya jadwal untuk hari ini, atau statusnya NON-AKTIF. Periksa di **Antrian › Konfigurasi › Jadwal Dokter**.

**Apa beda Slot JKN dan Slot Non-JKN?** Slot JKN adalah kuota pasien BPJS, sedangkan Slot Non-JKN adalah kuota pasien umum atau asuransi lain. Jumlah keduanya menjadi **Total Kuota** per hari.

**Satu layar bisa menampilkan beberapa bagian sekaligus?** Bisa. Centang lebih dari satu dari **Admisi**, **Poli**, dan **Farmasi** saat membuat layar.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**, aktifkan modul *Antrian & Layar Panggil*. Menu **APM** juga memerlukan fitur *Anjungan Pasien Mandiri (APM)*, dan menu **Antrean Online BPJS** memerlukan fitur *Antrean Online BPJS (Mobile JKN)*.
- Peran belum punya izin: admin › **Datamaster › Role**. Izin per pengguna diatur di **Datamaster › User**. Lihat `setting.md`.

## Catatan untuk peninjau
- Alur APM, termasuk cara membuat atau mengaktifkan APM (tombol di baris daftar APM) dan isian tiap langkahnya, baru diringkas dari nama rute dan komponen. Perlu dilengkapi oleh petugas yang memakainya.
- Pastikan pilihan status di **Data antrian** dan isi kolom per tab (Admisi, Rawat Jalan, Farmasi) sesuai tampilan.
- Belum dipastikan apakah tab **Data antrian** hanya untuk melihat, atau juga bisa dipakai untuk memanggil pasien.
- Tipe layar mana yang meminta **URL Youtube** (di kode: tipe "1 List, 1 Panggilan, 1 Gambar") perlu dicek di layar.
- Isi panel panggilan poli (di luar Admisi) belum dijabarkan. Sebaiknya dibahas di panduan Rawat Jalan.
- Tombol **Kirim Ulang** di **Antrean Online BPJS** tidak tampak memeriksa izin KIRIM ULANG di layar. Arti tiap nilai **Status Sinkron** (ditampilkan apa adanya dari server) perlu dijelaskan ke petugas.
