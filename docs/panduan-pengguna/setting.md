# Akun, peran & pengaturan

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau admin faskes/superadmin sebelum dipakai Helpdesk.

**Dipakai oleh:** semua pengguna (login, profil, ganti password); admin faskes (role, user, konfigurasi integrasi, audit trail); superadmin (manajemen modul, mode pengembang)
**Menu:** ikon akun › Profile / Setting / LOGOUT; Setting › Profil Faskes / Konfigurasi Integrasi / Print Out / Manajemen Modul / System / Audit Trail / Ekstensi; Datamaster › Role; Datamaster › User
**Hak akses yang dibutuhkan:**
- Setting › Profile Saya › READ, UPDATE FOTO PROFILE DAN NAMA LENGKAP, UPDATE USERNAME DAN PASSWORD
- Setting › System › READ (untuk membuka **Manajemen Modul** dan **System**; hanya superadmin yang bisa mengubah modul), UPDATE PPN
- Setting › Konfigurasi Integrasi › READ, UPDATE KONFIGURASI VCLAIM, UPDATE KONFIGURASI SATUSEHAT, UPDATE KONFIGURASI LAINNYA
- Setting › Audit Trail › LIHAT, EKSPOR
- Datamaster › Role › CREATE, READ, UPDATE, DELETE
- Datamaster › User › CREATE, READ, UPDATE, DELETE

## Untuk apa
Bagian ini mengatur cara pengguna masuk dan keluar aplikasi, data profil, dan password. Admin juga memakainya untuk mengatur hak akses lewat role dan user, menghubungkan OpenSIMRS ke sistem luar (BPJS, SATUSEHAT, LIS, dan lain-lain), serta menelusuri jejak perubahan data (audit trail). Superadmin memakainya untuk menentukan modul yang aktif di faskes dan menyalakan Mode Pengembang. Menu yang terlihat oleh pengguna ditentukan oleh **modul yang aktif di faskes** dan **izin yang dimiliki pengguna**. Keduanya harus terpenuhi.

## Tugas sehari-hari

### Masuk ke aplikasi (login)
1. Buka alamat OpenSIMRS faskes Anda di browser.
2. Isi **Username** dan **Password**. Klik ikon mata untuk melihat password yang diketik.
3. Klik **LOGIN**.

**Hasilnya:** halaman **Dashboard** tampil. Menu di atas hanya berisi modul yang boleh Anda buka.

### Keluar dari aplikasi
1. Klik ikon akun di kanan atas.
2. Klik **LOGOUT**.

Selalu keluar bila komputer dipakai bergantian.

### Mengubah nama, foto, dan nomor HP
1. Klik ikon akun, lalu **Profile**. Halaman **Profil Saya** terbuka.
2. Di kartu **Foto Profile dan Nama Lengkap**, klik **Edit**.
3. Unggah foto, lalu isi **Awalan/Gelar**, **Nama Lengkap**, **Akhiran/Gelar**, dan **No. Handphone** (contoh fiktif: `080000000000`).
4. Klik **Simpan**. Klik **Batal Edit** bila tidak jadi mengubah.

**Hasilnya:** data profil diperbarui. **Role** dan **Email** hanya ditampilkan dan tidak bisa diubah di sini.

### Mengganti password
1. Klik ikon akun, lalu **Profile**.
2. Di kartu **Username & Password**, klik **Edit**.
3. Isi **Password Lama**, **Password Baru**, dan **Verifikasi Password Baru**.
   Password baru minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, angka, dan simbol (mis. `!@#$`).
4. Klik **Simpan**.

**Hasilnya:** password berganti. Gunakan password baru saat login berikutnya. Username tidak bisa diubah sendiri. Bila perlu, minta admin mengubahnya.

### Membuat role (peran)
1. Buka **Datamaster › Role**, lalu klik **Data**.
2. Isi **Kode** dan **Nama Role**, misalnya `PDF` dan `Petugas Pendaftaran`.
3. Buka bagian **Modul**, lalu centang modul yang boleh dipakai peran ini, misalnya **Admisi** dan **Antrian**. Mencentang modul memberikan semua izin di modul itu.
4. Atur **Status** menjadi **AKTIF**, lalu klik **Simpan**.

**Hasilnya:** role baru bisa dipilih saat membuat atau mengubah user.

### Membuat akun pengguna dan mengatur izinnya
1. Buka **Datamaster › User**, lalu klik **Data**.
2. Di bagian **Data User**, pilih **Praktisi** (pegawai pemilik akun). Isi **No. Handphone** dan **Email** (contoh fiktif: `petugas@contoh.id`).
3. Di bagian **Akun**, isi **Username**, **Password**, dan **Verify Password**.
4. Di bagian **Modul & Permission**, pilih **Role**. Centangan izin terisi sesuai role.
5. Bila perlu, rapikan izin per pengguna. Buka modul, lalu submodul, lalu centang atau hapus centang aksi tertentu, misalnya hanya **READ** tanpa **DELETE**.
6. Atur **Status**, lalu klik **Simpan**.

**Hasilnya:** pengguna bisa login dengan username tersebut. Berikan password awal secara langsung kepada pengguna, jangan lewat grup obrolan, lalu minta pengguna menggantinya lewat **Profile**.

> Setelah izin pengguna diubah, minta pengguna **LOGOUT** lalu login lagi agar menunya diperbarui.

### Mengaktifkan atau menonaktifkan modul faskes (superadmin)
1. Klik ikon akun, lalu **Setting**. Di menu samping, pilih **Manajemen Modul**. Halaman **Manajemen Modul & Fitur** terbuka.
2. Di **Segmen Faskes**, pilih jenis faskes: **Dokter Praktik Mandiri**, **Klinik Pratama**, **Klinik Utama**, **Puskesmas**, atau **Rumah Sakit Kelas D/C/B/A**. Setiap kartu segmen menunjukkan jumlah modul, fitur, dan bagian bawaannya. Segmen menentukan *preset* (paket bawaan) modul, fitur, dan bagian.
3. Di **Modul & Fitur**, modul dikelompokkan per bidang. Klik sakelar untuk menambah modul di luar segmen atau menonaktifkan modul bawaan. Label status modul:
   - **Inti**: modul selalu aktif;
   - **Bawaan segmen**: aktif karena termasuk segmen; bila dimatikan menjadi **Bawaan segmen — dinonaktifkan**;
   - **Tidak termasuk segmen**: tidak aktif kecuali dinyalakan manual;
   - **Segera**: masih dalam pengembangan dan belum bisa diaktifkan.
4. Di bawah setiap modul aktif, atur **fitur**-nya dengan sakelar. Label **Preset segmen** berarti fitur termasuk paket segmen; **Tidak termasuk preset** berarti fitur mati kecuali dinyalakan manual. Fitur wajib tidak bisa dimatikan, dan fitur baru bisa diubah setelah modulnya aktif.
5. Untuk fitur yang punya bagian formulir (mis. bagian RME), klik **Atur bagian · …** untuk menyalakan atau mematikan bagian tertentu. Bagian wajib (isi minimal rekam medis) tidak bisa dimatikan.
6. Isi **Alasan perubahan (opsional)**, misalnya "Klinik membuka layanan rawat inap 5 bed", lalu klik **Simpan Konfigurasi**. Klik **Batalkan Perubahan** untuk kembali ke kondisi semula.
7. Di **Jenis Poli**, tentukan jenis tiap poli (mis. Gigi & Mulut, Mata). Jenis poli menentukan bagian RME khusus, misalnya **Pemeriksaan Gigi** hanya tampil di poli Gigi & Mulut.

**Hasilnya:** muncul pesan "Konfigurasi modul disimpan" dan menu dimuat ulang. Perubahan di luar preset (modul tambahan atau dinonaktifkan, fitur, dan bagian) disimpan sebagai *override* faskes dan tercatat di **Riwayat Perubahan**. Mengganti segmen membersihkan override fitur agar kembali mengikuti preset segmen baru. Pengguna selain superadmin hanya bisa melihat halaman ini.

### Mengatur koneksi ke sistem luar (Konfigurasi Integrasi)
1. Klik ikon akun, lalu **Setting**. Di menu samping, buka **Konfigurasi Integrasi**.
2. Pilih sistem tujuan. Setiap sistem punya halaman sendiri:
   - **BPJS › BPJS PCare** (FKTP), **BPJS › BPJS VClaim** (rumah sakit), dan **BPJS › Antrean Online (Mobile JKN)** (bila fitur antrean online BPJS aktif);
   - **SATUSEHAT**;
   - **LIS › Lab PK**, **LIS › Lab PA** (bila fitur bridging LIS PA aktif), dan **LIS › Mikrobiologi**;
   - **Radiologi › PACS/RIS**, **Bank Darah › UTD**, dan **Hemodialisa › HDIS** (bila fitur bridging-nya aktif);
   - **Helpdesk AI** (gateway tombol Bantuan, khusus superadmin);
   - **Lainnya**.
3. Isi atau ubah konfigurasi di halaman itu, lalu simpan. Langkah rinci ada di panduan modul terkait: [BPJS FKTP](./bpjs-fktp.md), [BPJS FKRTL](./bpjs-fkrtl.md), [SATUSEHAT](./satusehat.md), [Laboratorium](./laboratorium.md), [Radiologi](./radiologi.md).

**Hasilnya:** judul halaman berubah menjadi **Konfigurasi Integrasi › (sistem tujuan)**. Nilai rahasia disimpan terenkripsi dan tidak ditampilkan utuh.

### Menelusuri perubahan data (Audit Trail)
1. Klik ikon akun, lalu **Setting** › **Audit Trail**. Butuh izin Setting › Audit Trail › LIHAT.
2. Saring dengan **Dari tanggal**, **Sampai tanggal**, **Pengguna**, **Aksi**, **Entitas**, **Layanan**, atau **ID Pasien**, lalu klik **Cari**. Klik **Reset** untuk mengosongkan saringan.
3. Klik baris untuk membuka **Detail Audit**: waktu, pengguna, aksi, entitas, layanan, pasien, alamat IP, user agent, ID permintaan, dan ringkasan perubahan.
4. Bila perlu, klik **Ekspor Excel** (butuh izin EKSPOR).
5. Untuk memastikan catatan audit tidak diubah, klik **Verifikasi Rantai Hash**.

**Hasilnya:** bila catatan utuh, tampil pesan "Rantai hash utuh untuk … catatan yang diperiksa." Bila tidak, tampil pesan merah "Ditemukan … catatan dengan rantai hash tidak cocok …". Laporkan ke admin sistem. Bila rentang tanggal terlalu besar, hanya sebagian catatan yang diperiksa; persempit rentangnya.

### Mengatur biaya administrasi dan PPN (System)
1. Klik ikon akun, lalu **Setting** › **System**.
2. Di kartu **Administrasi**, nyalakan sakelar lalu isi **Input Biaya (Rp)** bila faskes menagih biaya administrasi.
3. Di kartu **PPN**, nyalakan sakelar lalu isi **Input Margin (%)**.
4. Klik **Simpan**, atau **Reset** untuk membatalkan.

**Hasilnya:** biaya administrasi dan PPN dipakai pada tagihan berikutnya di kasir.

### Menyalakan Mode Pengembang (SIMRS Studio, khusus superadmin)
Mode Pengembang membuka menu **SIMRS Studio**, alat pengembangan berbasis AI untuk tim IT/pengembang. Petugas pelayanan tidak memerlukannya.
1. Klik ikon akun, lalu **Setting** › **System**. Kartu **Mode Pengembang** hanya tampil untuk superadmin.
2. Klik **Aktifkan**. Baca penjelasan di jendela **Aktifkan Mode Pengembang?**, centang pernyataan "Saya memahami bahwa data pasien tidak boleh dikirim ke AI dan semua perubahan wajib melalui review.", lalu konfirmasi.
3. Klik **Buka SIMRS Studio**, atau buka menu **SIMRS Studio** di menu atas.
4. Untuk mematikannya, klik **Nonaktifkan**.

**Hasilnya:** menu **SIMRS Studio** tampil untuk superadmin. Bila kartu menyatakan layanan Studio belum berjalan, server belum disiapkan untuk Studio (`STUDIO_PENGEMBANG=aktif`). Hubungi tim IT. Lihat [SIMRS Studio](../SIMRS-STUDIO.md).

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Username harus diisi / Password harus diisi | Kolom login kosong. | Isi kedua kolom. |
| username … belum terdaftar! | Username salah ketik atau belum dibuat. | Periksa ejaan. Bila benar, minta admin membuat akun. |
| password anda tidak sesuai | Password salah. | Ketik ulang, perhatikan huruf besar dan kecil. Bila lupa, minta admin mengatur password baru di **Datamaster › User**. |
| Akses ditolak — Akun Anda tidak memiliki permission untuk membuka halaman ini. | Izin pengguna tidak mencakup halaman itu. | Minta admin menambah izin di **Datamaster › Role/User**. |
| Modul tidak aktif — Modul … tidak aktif untuk faskes ini. | Modul belum diaktifkan untuk faskes. | Minta superadmin mengaktifkannya di **Setting › Manajemen Modul**. |
| password lama salah | Isian **Password Lama** keliru. | Ketik ulang password yang sedang dipakai. |
| password baru tidak boleh sama dengan password lama | Password baru sama dengan password lama. | Buat password yang berbeda. |
| Password tidak sama | Isi verifikasi berbeda dari password baru. | Ketik ulang keduanya dengan sama persis. |
| Password harus mengandung setidaknya satu huruf besar / huruf kecil / angka / simbol khusus | Password baru belum memenuhi syarat. | Tambahkan jenis karakter yang kurang. |
| Kode Role harus diisi / Nama Role harus diisi / * Modul harus dipilih | Isian role belum lengkap. | Lengkapi kode, nama, dan minimal satu modul. |
| Praktisi harus dipilih / Format email tidak sesuai / Format tidak sesuai | Isian user belum lengkap atau formatnya salah. | Pilih praktisi. Isi email lengkap dan nomor HP yang diawali 08. |
| Pilih segmen faskes terlebih dahulu | Konfigurasi modul disimpan tanpa segmen. | Pilih salah satu **Segmen Faskes**. |

## Pertanyaan yang sering diajukan
**Saya lupa password, bagaimana?** Tidak ada fitur lupa password mandiri. Minta admin faskes mengatur password baru di **Datamaster › User**, lalu segera ganti password lewat **Profile**.

**Di mana menu Setting?** Menu ini tidak ada di baris menu atas. Klik ikon akun di kanan atas, lalu **Setting**.

**Kenapa rekan saya bisa melihat menu yang tidak saya lihat?** Setiap pengguna bisa memiliki role dan izin yang berbeda.

**Saya sudah diberi izin, tapi menu belum muncul?** Klik **LOGOUT**, lalu login lagi.

**Apa beda Role dan izin di User?** Role adalah paket izin bawaan untuk satu jabatan. Di **Datamaster › User**, izin itu bisa dikurangi atau ditambah khusus untuk pengguna tersebut.

## Bila menu tidak muncul
Menu tampil hanya bila **dua syarat** terpenuhi. Periksa satu per satu:
1. **Modul aktif untuk faskes.** Superadmin membuka **Setting › Manajemen Modul** dan memastikan sakelar modulnya menyala. Modul berlabel **Segera** belum bisa dipakai. Saat dibuka, halaman modul nonaktif menampilkan **Modul tidak aktif**.
2. **Pengguna punya izin.** Admin membuka **Datamaster › Role** (modul dicentang) atau **Datamaster › User** (submodul dan aksi dicentang, minimal **READ**). Saat dibuka, halaman tanpa izin menampilkan **Akses ditolak**.
3. Setelah kedua hal di atas diperbaiki, pengguna **LOGOUT** lalu login lagi.

Catatan tambahan:
- Modul penunjang (mis. Laboratorium, Patologi Anatomi, Mikrobiologi, Radiologi, Fisioterapi, CSSD, Bank Darah, UTD, Laundry, Sarana & Prasarana, Ambulans) dikelompokkan dalam satu menu **Penunjang**, tersusun per bidang dan instalasi. Farmasi, Gizi, Koding Rekam Medis, dan Inventory tetap menjadi menu sendiri.
- Modul yang termasuk paket faskes tetapi masih dikembangkan dikumpulkan di menu **Segera** (bertanda *Soon*) dan belum bisa dibuka.
- Menu **Setting › Ekstensi** hanya tampil untuk superadmin.
- Menu atas yang tidak muat di layar dipindah ke tombol **Lainnya**. Panel ini tersusun per bidang dan punya kotak cari.
- Halaman **Konfigurasi Integrasi** untuk LIS PA, PACS/RIS, UTD, HDIS, dan Antrean Online BPJS hanya tampil bila fiturnya aktif di **Manajemen Modul**.
- **Audit Trail** tidak diberikan otomatis ke peran faskes. Admin harus menambah izin Setting › Audit Trail › LIHAT secara manual.

## Catatan untuk peninjau
- Saat superadmin menyimpan **Manajemen Modul**, izin modul aktif otomatis ditambahkan ke peran admin faskes. Peran lain tetap harus diatur manual di **Datamaster › Role**. Mohon dipastikan bahwa ini perilaku yang diinginkan dan perlu dijelaskan ke admin.
- Belum dipastikan apakah mengubah izin role ikut memperbarui izin user yang sudah ada. Di kode, memilih role di form User hanya menyalin centangan izin role ke user tersebut.
- Pastikan apakah perubahan izin perlu LOGOUT/login (cache izin sesi ±3 jam) atau langsung berlaku.
- Login di kode tidak tampak memeriksa status user NON-AKTIF. Perlu dipastikan akun nonaktif benar-benar ditolak.
- Backend menerima password user baru tanpa batas panjang minimal, walaupun pesannya menyebut minimal 8 karakter. Aturan kekuatan password hanya diperiksa di halaman **Profile**. Perlu kebijakan yang seragam.
- Label tombol tambah di Datamaster tertulis **Data**. Mohon dipastikan sesuai dengan tampilan.
- Bagian **Profil Faskes** (termasuk Logo & Warna) dan **Print Out** belum dibahas.
- Rute **Setting › Manajemen Modul** memakai izin Setting › System › READ, bukan izin tersendiri.
- Izin Konfigurasi Integrasi hanya punya aksi UPDATE untuk VClaim, SATUSEHAT, dan Lainnya. Belum jelas izin apa yang mengatur penyimpanan PCare, LIS, PACS, UTD, HDIS, dan Antrean Online BPJS.
- Izin **SIMRS Studio** (Permintaan, PRD, Coding, QA, Rilis, Ekstensi, dan lain-lain) tidak pernah diberikan otomatis; superadmin memberikannya per peran. Detailnya ada di dokumen SIMRS Studio, bukan di panduan ini.
