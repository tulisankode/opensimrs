# Data Master

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau admin sistem faskes sebelum dipakai Helpdesk.

**Dipakai oleh:** admin sistem faskes, admin SDM, admin keuangan/tarif
**Menu:** Datamaster › User · Role · Pegawai · Praktisi · Ruangan · Kategori Ruangan · Diagnosis (ICD 10) · ICD 9 CM · Snomed CT · LOINC · Tarif · Komponen Tarif · Tindakan · Faskes · Organisasi · Lokasi · Penjamin · Voucher · General Consent (dan **Super Admin** khusus superadmin)
**Hak akses yang dibutuhkan:** Datamaster › (nama submenu) › READ, CREATE, UPDATE, DELETE, IMPORT, EXPORT. Submenu Praktisi memakai nama izin **Praktisioner**. Submenu Tarif memakai aksi khusus, misalnya CREATE TARIF dan UPDATE TARIF.

## Untuk apa
Data Master menyimpan data acuan yang dipakai semua modul: akun pengguna dan perannya, pegawai dan praktisi (dokter, perawat, dll.), poli dan ruangan, tarif tindakan, penjamin, dan voucher. Data master yang lengkap dan benar membuat pendaftaran, layanan, dan kasir berjalan lancar.

Data obat dan alkes tidak ada di menu ini, melainkan di **Farmasi › Datamaster** (lihat [farmasi.md](./farmasi.md)). Data supplier ada di **Inventory › Datamaster › Supplier**.

## Pola layar yang sama di semua submenu
- Tombol **Data** (ikon +) di kanan atas untuk menambah data. Di submenu Tarif, tombolnya bernama **Tarif Tindakan** dan **Tarif Ruangan**.
- Kolom **Cari …**, lalu tombol **Cari** dan **Reset** untuk mencari data.
- Ikon biru di kolom **Action** untuk mengubah data, dan ikon merah untuk menghapus. Saat menghapus, jendela **Hapus Data** muncul; klik **Hapus** untuk melanjutkan.
- Di bawah tabel:
  - **Download**: mengunduh format Excel;
  - **Import**: mengunggah berkas `.xls` atau `.xlsx`;
  - **Eksport**: mengunduh data.
- Hampir semua formulir punya sakelar **Status** (**AKTIF** atau **NON-AKTIF**). Data yang non-aktif tidak bisa dipilih di layanan.

## Tugas sehari-hari

### Menambah pegawai
1. Buka **Datamaster › Pegawai**, lalu klik **Data**.
2. Isi data pegawai:
   - **Tipe Pegawai**;
   - **Gelar Awal**, **Nama Lengkap**, dan **Gelar Akhir**;
   - **NIK** (contoh fiktif: 9999010101010001), **Tanggal Lahir**, dan **Jenis Kelamin**.
3. Pastikan **Status** aktif, lalu klik **Simpan**.

**Hasilnya:** pegawai tampil di daftar dan dapat dipilih saat membuat praktisi atau user.

### Menambah praktisi (dokter, perawat, bidan, dll.)
1. Buka **Datamaster › Praktisi**, lalu klik **Data**.
2. Pilih **Tipe Praktisi**, lalu pilih pegawai di **Nama Pegawai**.
3. Isi **Kode HFIS (BPJS)**, **SIP**, dan **STR**.
4. Untuk dokter, isi juga **Kode Antrian Dokter** dan pilih **Poli**.
5. Klik **Simpan**.

**Hasilnya:** praktisi dapat dijadwalkan di poli dan dipilih saat pendaftaran. Detail praktisi juga menampilkan **ID SATUSEHAT** dan **Status SATUSEHAT**.

### Membuat akun user untuk petugas
1. Buka **Datamaster › User**, lalu klik **Data**.
2. Di **Data User**, pilih orangnya lewat **Cari & Pilih Praktisi**. Lalu isi **No. Handphone** (contoh: 080000000000) dan **Email** (contoh: petugas@contoh.id).
3. Di **Akun**, isi **Username**, **Password**, dan **Verify Password**.
4. Di **Modul & Permission**, pilih **Role**. Hak akses modul akan mengikuti peran tersebut.
5. Klik **Simpan**.

**Hasilnya:** petugas dapat masuk ke aplikasi dengan username dan password tersebut.

### Mengatur peran dan hak akses (Role)
1. Buka **Datamaster › Role**, lalu klik **Data**. Untuk mengubah peran yang sudah ada, klik ikon ubah.
2. Isi **Kode** dan **Nama Role**.
3. Di bagian **Modul**, centang modul, submodul, dan aksi yang boleh dipakai peran ini (misalnya READ, CREATE, BAYAR, CETAK).
4. Klik **Simpan**.

**Hasilnya:** semua user dengan peran ini mendapat hak akses baru. Pengguna mungkin perlu keluar lalu masuk lagi agar menu ikut berubah.

### Menambah lokasi atau poli
1. Buka **Datamaster › Lokasi**, lalu klik **Data**.
2. Isi **Kode Lokasi** dan **Nama Lokasi**.
3. Pada pilihan **Poli**, pilih **Iya** bila lokasi ini adalah poli, lalu isi **Kode Antrian Poli**.
4. Lengkapi **Deskripsi**, **No. Telepon**, **Email**, **URL Website**, **Tipe**, **Kelas**, **Part Of** (lokasi induk), dan **Status Operasional**.
5. Klik **Simpan**.

**Hasilnya:** poli muncul di pendaftaran dan di sidebar **Rawat Jalan › Poli**. Lokasi yang sudah terkirim ke SATUSEHAT menampilkan **ID SATUSEHAT**.

### Menambah ruangan rawat inap
1. Pastikan kategori ruangan sudah ada di **Datamaster › Kategori Ruangan**. Bila belum, tambahkan dengan **Kode Kategori Ruangan** dan **Nama Kategori Ruangan**.
2. Buka **Datamaster › Ruangan**, lalu klik **Data**.
3. Isi **Kode Ruangan**, **Nama Ruangan**, **Kategori Ruangan**, **Nomor Kamar**, dan **Kelas Ruangan**.
4. Klik **Simpan**.

### Mengatur tindakan dan tarif
1. Pastikan data tindakan dan komponen tarif sudah ada:
   - **Datamaster › Tindakan**: isi **Kode Tindakan** dan **Nama Tindakan**, dan bila perlu pilih **Snomed CT** dan **ICD-9 CM**.
   - **Datamaster › Komponen Tarif**: isi **Kode Komponen Tarif** dan **Nama Komponen Tarif**, misalnya jasa sarana atau jasa medis.
2. Buka **Datamaster › Tarif**, lalu klik **Tarif Tindakan**.
3. Isi **Kode Tarif**, **Nama Tarif Tindakan**, **Pelayanan**, dan **Metode Pembayaran**.
4. Di **List Tindakan**, pilih tindakan, lalu isi nilai setiap **Komponen Tarif** dalam rupiah.
5. Klik **Simpan**.
6. Untuk tarif kamar (bila modul Rawat Inap aktif):
   1. Klik **Tarif Ruangan**.
   2. Isi **Kode Tarif**, **Nama Tarif**, **Pelayanan**, **Ruangan**, **Jenis Pembayaran Bed**, dan **Harga Bed**.
   3. Klik **Simpan**.

**Hasilnya:** tarif otomatis dipakai saat tindakan atau kamar dicatat, lalu masuk ke tagihan kasir. Tab **TINDAKAN** dan **RUANGAN** di halaman Tarif dipakai untuk berpindah daftar.

### Menambah penjamin atau voucher
- **Penjamin**:
  1. Buka **Datamaster › Penjamin**, lalu klik **Data**.
  2. Isi **Kode Penjamin**, **Nama Penjamin**, **No. Telepon**, dan **Alamat**.
  3. Klik **Simpan**.
- **Voucher** (bila fitur Diskon & Voucher aktif):
  1. Buka **Datamaster › Voucher**, lalu klik **Data**.
  2. Isi **Kode Voucher**, **Nama Voucher**, **Waktu Voucher**, **Jumlah Voucher**, **Tipe Voucher**, dan **Tarif Voucher**.
  3. Klik **Simpan**.

**Hasilnya:** penjamin dapat dipilih saat pendaftaran. Kasir dapat memakai kode voucher lewat **Pakai Voucher**.

### Mengimpor data dalam jumlah banyak
1. Di submenu yang dituju, klik **Download** untuk mengunduh format Excel.
2. Isi berkas sesuai kolomnya. Gunakan data fiktif saat uji coba.
3. Klik **Import** dan pilih berkas `.xls` atau `.xlsx`.

**Hasilnya:** data bertambah. Bila ada baris yang salah, muncul pesan galat yang menyebut kode atau nama yang bermasalah.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| code … sudah ada gunakan code lain | Kode yang diisi sudah dipakai data lain. | Gunakan kode lain atau ubah data yang sudah ada. |
| nama … sudah ada gunakan nama lain | Nama sudah dipakai data lain. | Gunakan nama yang berbeda. |
| nik … sudah terdaftar sebagai pegawai | NIK sudah ada di daftar pegawai. | Cari pegawai tersebut lalu ubah datanya, jangan menambah data baru. |
| role … belum ada / Role … tidak ada dalam daftar role yang tersedia. | Nama role di berkas impor tidak cocok dengan **Datamaster › Role**. | Buat role terlebih dahulu atau samakan penulisan namanya. |
| kategori ruangan tidak ada dalam sistem | Kategori pada data ruangan belum dibuat. | Tambahkan di **Datamaster › Kategori Ruangan**. |
| provinsi … / kabupaten/kota … / kecamatan … tidak ada dalam sistem | Nama wilayah di berkas impor tidak cocok dengan data wilayah. | Samakan penulisan nama wilayah dengan pilihan di aplikasi. |
| file yang di import harus file excel / file harus di sertakan | Berkas tidak dipilih atau formatnya bukan Excel. | Pilih berkas `.xls` atau `.xlsx` hasil **Download** format. |
| username … belum terdaftar! | Username tidak ditemukan. | Periksa ejaan username di **Datamaster › User**. |

## Pertanyaan yang sering diajukan
**Petugas baru tidak bisa login, apa yang perlu dicek?** Pastikan user sudah dibuat di **Datamaster › User** dengan **Status** aktif dan sudah diberi **Role**.

**Menu di layar petugas tidak sesuai tugasnya?** Ubah centang modul pada perannya di **Datamaster › Role**. Menu yang tampil adalah gabungan modul aktif faskes dan izin peran.

**Mengapa dokter tidak muncul di pilihan poli?** Pastikan praktisi bertipe dokter sudah dikaitkan ke **Poli** dan statusnya aktif.

**Mengapa menu Diagnosis (ICD 10), ICD 9 CM, dan Snomed CT tidak ada?** Menu ini adalah fitur **Referensi Kode Klinis** yang bisa dimatikan. Pencarian diagnosis dan tindakan di layanan tetap berfungsi walaupun menunya tidak tampil.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **Data Master**; fitur **Referensi Kode Klinis**, **Diskon & Voucher** untuk menu Voucher, dan **General Consent**).
- Peran belum punya izin: admin › **Datamaster › Role**.
- Grup **Super Admin** (**Gigi FDI**, **Kategori Gigi**, **Item Gigi**, **Oklusi**) hanya tampil untuk akun superadmin.

## Catatan untuk peninjau
- Langkah pembuatan user ditulis dari label **Cari & Pilih Praktisi**. Mohon dipastikan apakah pegawai non-praktisi (misalnya kasir atau admin) juga dipilih lewat kolom ini.
- Kolom **Waktu Voucher**, **Tipe Voucher**, dan **Tarif Voucher** belum dijelaskan rinci (persen atau nominal). Mohon dilengkapi.
- Submenu **Faskes** memuat **Client ID** dan **Client Secret** SATUSEHAT. Panduan sengaja tidak membahas pengisiannya. Rujuk ke panduan SATUSEHAT (`satusehat.md`) bila sudah tersedia.
- Pesan galat dari layanan Datamaster sebagian berbahasa campuran atau ada salah ketik (misalnya "Genral consen"). Pesan dikutip apa adanya.
- **Organisasi**, **General Consent**, **LOINC**, dan grup **Super Admin** tidak dibahas sebagai tugas sehari-hari karena jarang diubah petugas.
