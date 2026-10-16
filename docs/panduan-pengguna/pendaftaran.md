# Pendaftaran Pasien

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas pendaftaran sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas pendaftaran (admisi), petugas IGD, petugas rawat inap
**Menu:** Admisi › Rawat Jalan / Rawat Inap / IGD / SEP / Data Pasien / Monitoring Kamar / Laporan
**Hak akses yang dibutuhkan:**
- Admisi › Admisi RJ › READ, CREATE PASIEN RJ, UPDATE ADMISI RJ, CETAK KUNJUNGAN, CETAK LABEL, BATAL RJ
- Admisi › Admisi RI › READ, CREATE PASIEN RI, CREATE BAYI BARU LAHIR, UPDATE ADMISI RI
- Admisi › Admisi IGD › CREATE PASIEN IGD, UPDATE ADMISI IGD, BATAL IGD
- Admisi › Data Pasien › READ, CREATE PASIEN, UPDATE DATA PASIEN (serta IMPORT DATA PASIEN, DELETE PASIEN, CETAK KARTU PASIEN, UPLOAD BERKAS RM bila diperlukan)
- Admisi › Antrian › PANGGIL, LEWATI, PROSSES, SELESAI (untuk memanggil antrian pendaftaran)
- Admisi › Laporan Admisi › (nama laporan) › READ, CETAK LAPORAN

## Untuk apa
Modul ini mencatat data pasien (identitas dan No. RM) dan mendaftarkan kunjungan pasien ke rawat jalan (poli), IGD, atau rawat inap. Dari sini petugas juga mencetak bukti kunjungan, gelang, dan label, mengisi General Consent, serta membatalkan kunjungan yang salah daftar.

## Tugas sehari-hari

### Mendaftarkan pasien lama ke Rawat Jalan
1. Buka **Admisi › Rawat Jalan**. Daftar kunjungan hari ini tampil.
2. Klik **Daftar** di kanan atas.
3. Pada kolom **Cari Nama / No. RM**, ketik nama atau No. RM pasien, lalu pilih pasien dari daftar. Data identitas terisi otomatis.
4. Periksa data **Identitas Pasien**. Perbarui bila ada yang berubah, misalnya No. Handphone atau alamat.
5. Di bagian **Detail Kunjungan Dokter**, pilih cara bayar **TUNAI** atau **ASURANSI**.
6. Pilih **Poli**, lalu **DPJP**, lalu **Jadwal**. Hanya jadwal dokter hari ini yang bisa dipilih.
7. Bila perlu, isi **Keluhan Utama** dan **Catatan**, atau nyalakan **Pasien Maternitas**.
8. Bila memilih **ASURANSI**, isi **Nama Penjamin**, **No. Penjamin**, dan **Kelas**.
9. Klik **Simpan**.
10. Bila muncul jendela **General Consent**, klik **Buat** untuk mengisi persetujuan umum sekarang, atau **Lewati** untuk mengisinya nanti.

**Hasilnya:** halaman berpindah ke detail kunjungan. Pasien tampil di daftar **Admisi › Rawat Jalan** dan masuk antrian poli.

### Mendaftarkan pasien baru
1. Buka **Admisi › Rawat Jalan**, lalu klik **Daftar**.
2. Kosongkan kolom **Cari Nama / No. RM**. **No. RM** dibuat otomatis oleh sistem setelah data disimpan.
3. Isi **Awalan / Gelar**, **Nama Lengkap**, **Identitas** (mis. KTP) beserta nomornya, **Tanggal Lahir**, **Jenis Kelamin**, **No. Handphone**, dan **Alamat**.
   Contoh data fiktif: NIK `9999010101010001`, HP `080000000000`.
4. Lengkapi juga **Tempat Lahir**, **Agama**, **Negara**, **Status Pernikahan**, **Nama Ibu Kandung**, serta **Provinsi**, **Kabupaten / Kota**, **Kecamatan**, dan **Kelurahan / Desa**.
   - Bila faskes memakai fitur *Pendaftaran Ringkas*, kolom-kolom ini boleh dikosongkan. Klik **Isi data lengkap (tempat lahir, agama, wilayah, nama ibu, …)** bila ingin mengisinya.
5. Isi **Detail Kunjungan Dokter** seperti pada tugas sebelumnya, lalu klik **Simpan**.

**Hasilnya:** pasien mendapat No. RM baru dan kunjungannya tercatat.

> Pasien juga bisa dicatat tanpa didaftarkan ke poli: buka **Admisi › Data Pasien**, lalu klik **Pasien**.

### Check-in pasien yang sudah booking (APM atau Mobile)
Pasien yang mendaftar sendiri lewat anjungan (APM) atau aplikasi (MOBILE) tampil di **Admisi › Rawat Jalan** dengan label sumber pendaftarannya.
1. Buka **Admisi › Rawat Jalan**. Bila perlu, saring dengan **Cara Daftar** lalu pilih **APM** atau **MOBILE**.
2. Klik baris pasien yang belum check-in. Formulir **Checkin** terbuka.
3. Periksa dan lengkapi data pasien serta kunjungan.
4. Klik **Simpan & Checkin**.

**Hasilnya:** waktu check-in tercatat di kolom **Data Kunjungan** (baris **Checkin**).

### Memanggil antrian pendaftaran
1. Buka salah satu halaman **Admisi**.
2. Klik ikon pengeras suara (megafon) di kanan atas. Panel **Panggilan Antrian** terbuka.
3. Pada tab **Antrian Aktif**, klik **Panggil** pada kartu pasien. Bila pasien belum datang, klik **Panggil Ulang** atau **Lewati**.
4. Klik **Proses** saat pasien dilayani, lalu klik tombol centang hijau (**Selesaikan Proses**) setelah selesai.
5. Pasien yang dilewati ada di tab **Terlewat** dan bisa dipanggil lagi. Pasien yang sudah selesai ada di tab **Selesai**.

**Hasilnya:** nomor pasien diumumkan di layar antrian yang menampilkan Admisi.

### Mendaftarkan pasien IGD
1. Buka **Admisi › IGD**, lalu klik **Daftar**.
2. Cari pasien lama di **Cari Nama / No. RM**, atau isi data pasien baru.
   - Pasien yang belum bisa diidentifikasi: nyalakan **Tanpa Identitas**. Data bisa dilengkapi kemudian. Di daftar, pasien ini bertanda **DATA TIDAK TIDAK LENGKAP**.
   - Bayi baru lahir: nyalakan **Bayi Baru Lahir**, lalu isi **No. KTP Ibu** dan **Jam Lahir**. Ibu harus sudah terdaftar sebagai pasien.
3. Pilih **TUNAI** atau **ASURANSI**, pilih **DPJP**, lalu isi **Keluhan Utama** bila ada.
4. Klik **Simpan**.

**Hasilnya:** pasien tampil di **Admisi › IGD** dan di menu **IGD**.

### Menempatkan pasien rawat inap di kamar dan bed
Pasien yang mendapat surat perintah rawat inap (SPRI) dari poli atau IGD otomatis tampil di **Admisi › Rawat Inap**. Nomor SPRI-nya terlihat di kolom **Data Kunjungan**.
1. Buka **Admisi › Rawat Inap**, lalu klik baris pasien.
2. Periksa identitas pasien dan cara bayar (**TUNAI**/**ASURANSI**).
3. Di **Detail Kunjungan & Ruangan**, pilih **Kategori Ruangan**, **Kelas**, dan **Ruangan**.
4. Pada **Pilih Bed**, klik bed yang berstatus **Kosong**. Bed **Terisi** tidak bisa dipilih.
5. Atur pilihan tambahan bila perlu, misalnya **Pasien Titipan**, **Naik Kelas**, atau **Gabung Tagihan Sebelumnya**.
6. Klik **Simpan**.

**Hasilnya:** bed tercatat untuk pasien. Status kamar terlihat di **Admisi › Monitoring Kamar**.

> Bayi yang lahir saat ibunya dirawat didaftarkan lewat tombol **Bayi Baru Lahir** di **Admisi › Rawat Inap**.

### Mencetak dokumen kunjungan dan mengisi General Consent
1. Buka daftar **Rawat Jalan**, **Rawat Inap**, atau **IGD** di menu **Admisi**, lalu klik baris pasien. Halaman **Detail** terbuka.
2. Klik tombol cetak yang dibutuhkan:
   - **Cetak Kunjungan** untuk rawat jalan;
   - **Cetak Gelang** untuk rawat inap dan IGD;
   - **Cetak Label**.
3. Untuk persetujuan umum, klik **General Consent**, lalu **General Consent Baru**.
4. Pilih **Pasien** atau **Keluarga**. Bila memilih **Keluarga**, isi **Nama Lengkap Keluarga**, **Alamat**, **Jenis Kelamin**, dan **Hubungan Dengan Pasien**.
5. Pilih **Format General Consent**, lalu klik **Setuju & Simpan**. Dokumen yang tersimpan bisa dibuka lagi untuk **Cetak**.

**Hasilnya:** dokumen tercetak dan General Consent tersimpan di data pasien.

### Mengubah data kunjungan
1. Klik baris pasien di daftar, lalu klik **Edit**.
2. Ubah data yang perlu diperbaiki, lalu klik **Simpan**. Klik **Batal Edit** untuk membatalkan perubahan.

Poli dan dokter tidak bisa diubah setelah pendaftaran tersimpan. Bila poli atau dokter salah, batalkan kunjungan lalu daftarkan ulang.

### Membatalkan kunjungan
1. Buka daftar **Rawat Jalan**, **Rawat Inap**, atau **IGD** di menu **Admisi**.
2. Klik tombol merah di kiri bawah: **Batal Rawat Jalan**, **Batal Rawat Inap**, atau **Batal IGD**.
3. Centang pasien yang akan dibatalkan di kolom paling kanan.
4. Isi **Alasan Batal Kunjungan**, lalu klik **Iya, Batalkan**.

**Hasilnya:** kunjungan dibatalkan dan tercatat di laporan **Batal Kunjungan**.

### Mencari dan mengelola data pasien
1. Buka **Admisi › Data Pasien**.
2. Ketik nama, alamat, atau No. RM di **Pencarian**. Bila perlu, pilih **Status** (**Semua Status**, **Aktif**, **Non-Aktif**), lalu klik **Cari**.
3. Klik baris pasien untuk melihat **Data Lengkap Pasien**, **Riwayat Pemeriksaan**, dan **Riwayat Unggah Berkas Rekam Medis**.
4. Dari halaman itu, Anda bisa memakai **Cetak Kartu Pasien**, **General Consent**, atau **Edit Data Pasien**.
5. Berkas rekam medis lama (PDF) bisa diunggah dengan **Pilih File** lalu **Upload**.
6. Di bagian bawah daftar tersedia tombol berikut:
   - **Import**: memasukkan banyak pasien sekaligus dari Excel (.xls/.xlsx);
   - **Download**: mengunduh daftar pasien;
   - **Non-Aktifkan** dan **Aktifkan**: mengubah status pasien yang dicentang;
   - **Hapus**: menghapus pasien yang dicentang.

> **Hapus** hanya berlaku untuk pasien yang belum pernah bertransaksi. Untuk pasien yang sudah pernah berkunjung, gunakan **Non-Aktifkan**. No. RM yang dihapus tidak dipakai ulang.

### Melihat dan mencetak laporan admisi
1. Buka **Admisi › Laporan**, lalu pilih salah satu laporan berikut: **Kunjungan**, **Batal Kunjungan**, **Status Kamar**, **Keperawatan Inap Pasien**, **Bayi Baru Lahir**, atau **Rekap Kunjungan**.
2. Atur **Tanggal mulai** dan **Tanggal selesai**, serta saringan lain bila ada (mis. **DPJP**, **Ruangan**, **Penjamin**). Lalu klik **Cari**.
3. Klik **Cetak** untuk mengunduh atau mencetak laporan.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Data belum lengkap — Periksa kolom yang ditandai merah. | Ada kolom wajib yang kosong atau formatnya salah. | Lengkapi kolom yang bergaris merah, lalu simpan lagi. |
| No identitas KTP minimal 16 karakter | Nomor KTP/NIK kurang dari 16 digit. | Periksa kembali NIK pada KTP pasien. |
| No identitas Passport harus mengandung huruf dan angka | Format nomor paspor tidak sesuai. | Salin nomor paspor persis seperti di dokumen. |
| No Identitas Pasien sudah terdaftar. | Nomor identitas ini sudah dipakai pasien lain. | Cari pasien itu di **Cari Nama / No. RM**. Jangan membuat pasien baru. |
| Jadwal harus dipilih / Tidak ada jadwal hari ini | Dokter yang dipilih tidak punya jadwal praktik hari ini. | Pilih dokter lain, atau minta admin mengatur jadwal di **Antrian › Konfigurasi › Jadwal Dokter**. |
| Hanya bisa memilih jadwal pada hari ini. | Pendaftaran di loket hanya untuk jadwal hari ini. | Pilih jadwal hari ini. |
| Jadwal periksa sudah terdaftar | Pasien sudah terdaftar pada tanggal pemeriksaan yang sama. | Cari kunjungan pasien di daftar **Rawat Jalan**. |
| Kuota antrian Non-JKN untuk jadwal ini sudah penuh. | Kuota jadwal dokter sudah habis. | Pilih jadwal atau dokter lain, atau minta admin menambah kuota. |
| Penjamin Tunai tidak ditemukan, buat terlebih dahulu data penjamin tunai | Data penjamin "Tunai" belum dibuat. | Minta admin membuatnya di **Datamaster › Penjamin**. |
| Nama Penjamin harus dipilih / No. Penjamin harus diisi / Kelas harus dipilih | Cara bayar ASURANSI belum lengkap. | Isi data penjamin, atau ubah ke **TUNAI**. |
| Identitas Ibu tidak ditemukan! Pastikan Ibu sudah terdaftar sebagai pasien | Untuk bayi baru lahir, data ibu belum ada. | Daftarkan ibu sebagai pasien dulu, lalu ulangi. |
| Bed terpakai oleh pasien | Bed yang dipilih sudah ditempati. | Pilih bed lain yang berstatus **Kosong**. |
| Tidak bisa mengubah poli atau dokter | Poli atau dokter tidak boleh diubah setelah pendaftaran. | Batalkan kunjungan, lalu daftarkan ulang. |
| Pembatalan tidak diizinkan, pasien sudah diperiksa | Pasien sudah ditangani dokter. | Kunjungan tidak bisa dibatalkan dari Admisi. Hubungi supervisor. |
| IGD Tidak bisa di cancel karena sudah di pulangkan | Pasien IGD sudah dipulangkan. | Kunjungan tidak bisa dibatalkan. |
| Tidak dapat membatalkan Rawat Inap yang sedang diproses | Pasien rawat inap sudah dalam perawatan. | Hubungi supervisor rawat inap. |
| Format file tidak didukung. Silakan unggah file dengan format .pdf. | Berkas rekam medis bukan PDF. | Ubah berkas ke PDF, lalu unggah lagi. |
| Data no identitas … sudah terdaftar / sudah ada di Excel | Saat **Import**, ada NIK yang sudah terdaftar atau tertulis dua kali di berkas. | Hapus baris ganda dari berkas Excel, lalu impor lagi. |

## Pertanyaan yang sering diajukan
**Bagaimana memastikan pasien tidak terdaftar dua kali?** Sebelum mengisi data baru, selalu cari dulu di **Cari Nama / No. RM**. Sistem menolak nomor identitas yang sudah terdaftar.

**Kenapa pilihan Jadwal kosong?** Dokter itu tidak punya jadwal hari ini, atau jadwalnya nonaktif. Jadwal diatur di **Antrian › Konfigurasi › Jadwal Dokter**.

**Kenapa kolom DPJP tidak bisa diklik?** Untuk rawat jalan, pilih **Poli** terlebih dahulu.

**Apa arti label APM atau MOBILE pada baris pasien?** Pasien mendaftar sendiri lewat anjungan (APM) atau aplikasi. Pasien seperti ini perlu di-check-in di loket.

**Bagaimana cara mendaftarkan pasien rawat inap?** Pasien rawat inap berasal dari SPRI yang dibuat dokter di poli atau IGD. Petugas admisi melengkapi kamar dan bed di **Admisi › Rawat Inap**.

**Pasien sudah dihapus atau dinonaktifkan, bisakah dikembalikan?** Pasien nonaktif bisa diaktifkan lagi dengan **Aktifkan**. Pasien yang dihapus tidak tampil lagi di aplikasi.

**Di mana membuat SEP BPJS?** Di **Admisi › SEP**. Penjelasannya ada di panduan BPJS FKRTL (`bpjs-fkrtl.md`).

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**. Bagian Admisi bergantung pada modul berikut:
  - **Admisi › Rawat Inap** dan **Monitoring Kamar**: modul *Rawat Inap*;
  - **Admisi › IGD**: modul *IGD*;
  - **Admisi › SEP**: modul *BPJS FKRTL (VClaim/SEP)*;
  - tombol **General Consent**: fitur *General Consent*.
- Peran belum punya izin: admin › **Datamaster › Role**. Izin per pengguna diatur di **Datamaster › User**. Lihat juga `setting.md`.

## Catatan untuk peninjau
- Pastikan alur rawat inap sudah benar: pasien masuk ke **Admisi › Rawat Inap** dari SPRI poli/IGD, lalu petugas melengkapi kamar dan bed. Di toolbar Rawat Inap hanya ada tombol **Bayi Baru Lahir**, tidak ada tombol **Daftar**.
- Tombol cetak di detail: kode menampilkan **Cetak Kunjungan** hanya untuk rawat jalan, dan **Cetak Gelang** untuk rawat inap/IGD. Pastikan ini sesuai dengan yang terlihat di layar.
- Label chip IGD tertulis "DATA TIDAK TIDAK LENGKAP" (kata "TIDAK" dobel) di kode. Kemungkinan salah ketik di aplikasi, perlu dipastikan.
- Arti pesan "Jadwal periksa sudah terdaftar" (dari pengecekan booking pada tanggal yang sama) perlu dipastikan dengan petugas.
- Hak akses laporan **Rekap Kunjungan** memakai izin fitur "Rekap Kunjungan", sedangkan daftar izin di auth-service menamainya "Rekap Jumlah Pasien BPJS". Mungkin menu ini tidak tampil untuk peran selain superadmin. Perlu dicek.
- Format berkas Excel untuk **Import** (kolom yang diharapkan, apakah ada templat) belum ditemukan di kode frontend. Mohon dilengkapi.
- Pastikan apakah **Download** di Data Pasien menghasilkan Excel.
