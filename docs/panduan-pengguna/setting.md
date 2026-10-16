# Akun, peran & pengaturan

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau admin faskes/superadmin sebelum dipakai Helpdesk.

**Dipakai oleh:** semua pengguna (login, profil, ganti password); admin faskes (role dan user); superadmin (manajemen modul)
**Menu:** ikon akun › Profile / Setting / LOGOUT; Setting › Manajemen Modul; Datamaster › Role; Datamaster › User
**Hak akses yang dibutuhkan:**
- Setting › Profile Saya › READ, UPDATE FOTO PROFILE DAN NAMA LENGKAP, UPDATE USERNAME DAN PASSWORD
- Setting › System › READ (untuk membuka **Manajemen Modul**; hanya superadmin yang bisa mengubahnya)
- Datamaster › Role › CREATE, READ, UPDATE, DELETE
- Datamaster › User › CREATE, READ, UPDATE, DELETE

## Untuk apa
Bagian ini mengatur cara pengguna masuk dan keluar aplikasi, data profil, dan password. Admin juga memakainya untuk mengatur hak akses lewat role dan user. Superadmin memakainya untuk menentukan modul yang aktif di faskes. Menu yang terlihat oleh pengguna ditentukan oleh **modul yang aktif di faskes** dan **izin yang dimiliki pengguna**. Keduanya harus terpenuhi.

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
2. Di **Segmen Faskes**, pilih jenis faskes, misalnya **Klinik Pratama** atau **Rumah Sakit Kelas D**. Segmen menentukan modul dan fitur bawaan.
3. Di **Modul & Fitur**, klik sakelar untuk menambah modul di luar segmen atau menonaktifkan modul bawaan. Fitur di bawah modul juga bisa diatur. Klik **Atur bagian** untuk mengatur bagian formulir RME.
   - Label **Inti** berarti modul selalu aktif.
   - Label **Segera** berarti modul masih dalam pengembangan dan belum bisa diaktifkan.
4. Isi **Alasan perubahan (opsional)**, lalu klik **Simpan Konfigurasi**. Klik **Batalkan Perubahan** untuk kembali ke kondisi semula.
5. Di **Jenis Poli**, tentukan jenis tiap poli (mis. Gigi & Mulut, Mata). Jenis poli menentukan bagian RME khusus yang tampil di poli tersebut.

**Hasilnya:** muncul pesan "Konfigurasi modul disimpan", lalu menu dimuat ulang. Semua perubahan tercatat di **Riwayat Perubahan**. Pengguna selain superadmin hanya bisa melihat halaman ini.

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
- Modul penunjang (Laboratorium, Radiologi, Fisioterapi, Patologi Anatomi, Mikrobiologi) dikelompokkan dalam satu menu **Penunjang**.
- Modul yang termasuk paket faskes tetapi masih dikembangkan muncul di menu terpisah dengan tanda *Soon*.
- Menu **Setting › Ekstensi** hanya tampil untuk superadmin.

## Catatan untuk peninjau
- Saat superadmin menyimpan **Manajemen Modul**, izin modul aktif otomatis ditambahkan ke peran admin faskes. Peran lain tetap harus diatur manual di **Datamaster › Role**. Mohon dipastikan bahwa ini perilaku yang diinginkan dan perlu dijelaskan ke admin.
- Belum dipastikan apakah mengubah izin role ikut memperbarui izin user yang sudah ada. Di kode, memilih role di form User hanya menyalin centangan izin role ke user tersebut.
- Pastikan apakah perubahan izin perlu LOGOUT/login (cache izin sesi ±3 jam) atau langsung berlaku.
- Login di kode tidak tampak memeriksa status user NON-AKTIF. Perlu dipastikan akun nonaktif benar-benar ditolak.
- Backend menerima password user baru tanpa batas panjang minimal, walaupun pesannya menyebut minimal 8 karakter. Aturan kekuatan password hanya diperiksa di halaman **Profile**. Perlu kebijakan yang seragam.
- Label tombol tambah di Datamaster tertulis **Data**. Mohon dipastikan sesuai dengan tampilan.
- Bagian Setting lain (**Profil Faskes**, **Konfigurasi Integrasi**, **Print Out**, **System**/Mode Pengembang) belum dibahas. Untuk SATUSEHAT, lihat `satusehat.md`.
