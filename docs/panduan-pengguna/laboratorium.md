# Laboratorium

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas laboratorium sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas laboratorium (analis), dokter penanggung jawab laboratorium, admin data master laboratorium
**Menu:** Penunjang › Laboratorium › Order Lab / Hasil Pemeriksaan / Expertise / Datamaster / Mapping LIS / Laporan
**Hak akses yang dibutuhkan:** Laboratorium › Order Lab (READ, CREATE, VALIDASI ORDER, BATAL ORDER, …) · Laboratorium › Hasil Pemeriksaan (READ, SIMPAN HASIL, SELESAI, CETAK HASIL, …) · Laboratorium › Expertise (READ, SIMPAN EXPERTISE, CETAK HASIL) · Laboratorium › Datamaster › <nama data> (READ, CREATE, UPDATE, DELETE, IMPORT, EXPORT) · Laboratorium › Laporan › <nama laporan> (READ, CETAK LAPORAN)

## Untuk apa
Modul Laboratorium mencatat alur pemeriksaan lab dari order masuk, validasi order, input hasil, sampai cetak hasil. Order bisa datang dari dokter lewat rekam medis (RME) atau langsung dari pasien yang datang sendiri (APS). Bila faskes memakai LIS (adamLIS), order dapat dikirim ke LIS dan hasilnya diambil otomatis.

Status order lab: **Order** (belum divalidasi) → **Diperiksa** (sudah divalidasi, menunggu hasil) → **Selesai**. Order yang dibatalkan berstatus **Batal**.

## Tugas sehari-hari

### Melihat order lab yang masuk
1. Buka **Penunjang › Laboratorium › Order Lab**.
2. Order dari dokter (tab **Penunjang › Order Lab** di RME) dan order APS tampil di daftar ini.
3. Saring bila perlu: **Pencarian** (nama, alamat, atau No. RM), **Status** (**Semua**, **Belum Lunas**, **Batal Order**), **Tanggal mulai**/**Tanggal selesai**, **Pembayaran** (**TUNAI**/**ASURANSI**), lalu klik **Cari**. Klik **Reset** untuk mengosongkan saringan.
4. Tombol **Order** / **Batal** di bilah atas memilih antara daftar order aktif dan order yang sudah dibatalkan.

**Hasilnya:** daftar pasien beserta jenis pelayanan, unit asal, cara bayar, tanggal **Daftar** dan **Jadwal** pemeriksaan. Order pasien MCU diberi tanda **MCU**.

### Membuat order lab untuk pasien APS (datang sendiri)
1. Buka **Penunjang › Laboratorium › Order Lab**, klik tombol **Order** (berikon +).
2. Di **Identitas Pasien**, cari pasien di kolom **Cari Nama / No. RM** (mis. ketik nama pasien fiktif "Budi Contoh").
3. Di **Detail Kunjungan & Dokter**, pilih **Pembayaran** (**TUNAI** atau **ASURANSI**), **Unit Asal**, dan **Dokter Pengirim**. Isi **Keluhan Utama** dan **Catatan** bila ada. Untuk **ASURANSI**, isi **Nama Penjamin**, **No. Penjamin**, dan **Kelas**.
4. Di bagian **Order Lab**, isi **Tanggal** pemeriksaan, centang **CITO** atau **Status Puasa** bila perlu, lalu pilih pemeriksaan di **Tarif Pemeriksaan** atau **Tarif Pemeriksaan - Paket**.
5. Klik **Simpan**.

**Hasilnya:** order baru muncul di daftar **Order Lab** dengan jenis pelayanan APS.

### Memvalidasi order (sampel siap diperiksa)
1. Di **Order Lab**, klik baris pasien. Jendela **Detail Order Lab** terbuka.
2. Periksa data pasien, **Asesmen Medis**, dan **List Pemeriksaan Lab**. Klik **Rekam Medis** bila perlu melihat rekam medis pasien.
3. Pastikan **Dokter Pengirim** terisi, lalu pilih **Spesimen** yang diambil (boleh lebih dari satu).
4. Bila pemeriksaan perlu diubah, klik **Edit Order**, ubah pilihan pemeriksaan, lalu klik **Simpan**. Pemeriksaan hanya bisa diubah sebelum order divalidasi.
5. Klik **Validasi Order**. Di jendela **Validasi Order Lab**, pilih salah satu:
   - **Validasi Saja**: order divalidasi tanpa dikirim ke LIS.
   - **Validasi & Kirim ke LIS**: hanya muncul bila fitur Bridging LIS aktif. Bila koneksi LIS lebih dari satu, pilih tujuannya di **Kirim ke LIS**.

**Hasilnya:** order pindah ke menu **Hasil Pemeriksaan** dengan status periksa. Bila dikirim ke LIS, muncul pesan "Divalidasi & terkirim ke …" beserta No. Lab dari LIS.

### Membatalkan order
1. Di **Order Lab**, klik **Batal Order** di bagian bawah daftar.
2. Centang order yang akan dibatalkan (boleh beberapa sekaligus).
3. Tulis alasan di kolom **Alasan Batal Order**, lalu klik **Iya, Batalkan**. Tombol ini aktif setelah alasan diisi.

**Hasilnya:** order hilang dari daftar aktif dan dapat dilihat lewat tombol **Batal** atau saringan **Status › Batal Order**.

### Mengisi dan menyimpan hasil pemeriksaan
1. Buka **Penunjang › Laboratorium › Hasil Pemeriksaan**. Pastikan tombol **Periksa** terpilih.
2. Klik baris pasien untuk membuka detail.
3. Bila faskes memakai LIS dan order sudah terkirim, **No. Lab LIS** tampil di atas. Klik **Ambil Hasil LIS** untuk menarik hasil dari LIS.
4. Di **List Order Lab**, isi kolom **Hasil Pemeriksaan** untuk setiap item. Kolom **Flags**, **Metode**, **Satuan**, dan **Nilai Rujukan** diambil dari data master. Isi **Catatan** bila perlu.
5. Klik **Simpan Hasil**. Item yang hasilnya terisi berubah menjadi **Selesai** di kolom **Status Pemeriksaan**.
6. Klik **Riwayat** bila perlu melihat riwayat pemeriksaan lab pasien.

**Hasilnya:** hasil tersimpan dan masih bisa diubah sampai order ditandai selesai.

### Menyelesaikan pemeriksaan dan mencetak hasil
1. Pastikan semua item sudah **Selesai**. Tombol **Selesai** baru aktif setelah semua item terisi dan disimpan.
2. Klik **Selesai**, baca peringatan **Selesai Pemeriksaan**, lalu klik **Iya, Selesai**. Setelah selesai, hasil **tidak dapat** diubah lagi.
3. Untuk mencetak, klik **Cetak Hasil** di detail. Cara lain: di **Hasil Pemeriksaan**, pilih tombol **Selesai**, lalu klik **Cetak** pada baris pasien.

**Hasilnya:** lembar hasil laboratorium terbuka dalam bentuk PDF dan siap dicetak.

### Membatalkan validasi (order perlu dikoreksi)
1. Di **Hasil Pemeriksaan**, klik **Batal Validasi** di bagian bawah daftar.
2. Centang order, isi **Alasan Batal Validasi**, lalu klik **Iya, Batalkan**.

**Hasilnya:** order kembali ke status Order dan muncul lagi di **Order Lab** untuk diperbaiki dan divalidasi ulang.

### Mengisi expertise dokter lab
Menu ini hanya ada bila fitur **Expertise Dokter Lab** aktif.
1. Buka **Penunjang › Laboratorium › Expertise**, lalu klik baris pasien.
2. Tulis catatan di **Catatan Expertise**.
3. Klik **Simpan Expertise**. Tombol ini aktif bila semua item pemeriksaan sudah selesai.
4. Klik **Print Hasil** untuk mencetak. Untuk menarik expertise, klik **Batal Expertise**, lalu **Iya, Batalkan**.

**Hasilnya:** catatan expertise tersimpan dan tampil di bagian **Catatan Expertise** pada detail hasil.

### Mengelola data master laboratorium
Buka **Penunjang › Laboratorium › Datamaster**. Data master disusun berurutan seperti ini:
1. **Kategori Pemeriksaan**: kelompok besar pemeriksaan (mis. Hematologi). Klik **Data** (berikon +), isi **Kode Kategori Pemeriksaan**, **Nama Kategori Pemeriksaan**, **No. Urut**, dan **Status**, lalu klik **Simpan**.
2. **Item Pemeriksaan**: parameter yang hasilnya diisi. Klik **Data** (berikon +), isi **Kode Item Pemeriksaan**, **Nama Item Pemeriksaan**, **Kategori Pemeriksaan**, **Satuan**, **Metode**, dan **Jenis Input** (**Angka**, **Text**, **Long Text**, **Pilihan**). Bila nilai rujukan dipakai, nyalakan **Nilai Rujukan**. Setelah item disimpan, klik ikon daftar angka pada baris item untuk mengisi nilai rujukan per **Jenis Kelamin** dan umur (**Batas Bawah**, **Batas Atas**, **Kritis Bawah**, **Kritis Atas**, **Tampilan**).
3. **Kelompok Pemeriksaan**: gabungan beberapa item (mis. darah lengkap). Pilih **Kategori Pemeriksaan** dan **Item Pemeriksaan**-nya.
4. **Spesimen**: jenis sampel (**Kode Spesimen**, **Nama Spesimen**).
5. **Tarif Lab**: tarif yang dipilih saat order. Isi **Kode Tarif**, **Nama Tarif Tindakan**, **Pelayanan** (Rawat Jalan/Rawat Inap/IGD), **Metode Pembayaran**, isi kelompok/item pemeriksaan, dan **Komponen Tarif**.

Semua halaman data master memiliki **Import** dan **Eksport** untuk Excel. Templat Excel tersedia lewat **Download**.

**Hasilnya:** tarif dan item baru langsung bisa dipilih saat membuat order.

### Mengatur pemetaan kode LIS (bridging LIS)
Bagian ini hanya muncul bila fitur **Bridging LIS (adamLIS)** aktif. Koneksi LIS diatur admin di **Setting › Konfigurasi Integrasi › LIS › Lab PK** (kartu **Konfigurasi LIS (Laboratorium)**).
1. **Mapping LIS › Tindakan (Registrasi)**: isi **Kode Tindakan LIS** untuk tiap tarif lab. Centang **Belum dipetakan** untuk menampilkan tarif yang belum diisi, lalu klik **Simpan**.
2. **Mapping LIS › Unit, Dokter & Penjamin**: pilih tab **Unit Asal**, **Dokter Pengirim**, atau **Penjamin**, lalu isi **Kode di LIS** dan **Simpan**.
3. **Mapping LIS › Hasil Pemeriksaan**: isi **Kode Pemeriksaan LIS** untuk tiap item pemeriksaan (mis. HGB), lalu klik **Simpan**.

**Hasilnya:** order yang dikirim memakai kode yang dikenal LIS, dan hasil dari LIS masuk ke item yang benar. Status pengiriman dapat dipantau di **Setting › Konfigurasi Integrasi › LIS › Lab PK** (kartu **Pengiriman LIS**).

### Melihat laporan laboratorium
1. Buka **Penunjang › Laboratorium › Laporan**, lalu pilih **Kunjungan**, **Waktu Tunggu (TAT)**, atau **Rekap Jumlah Pemeriksaan**.
2. Isi **Jenis Pelayanan** (**Semua**, **Rawat Jalan**, **Rawat Inap**, **IGD**, **APS**), **Tanggal mulai**, dan **Tanggal selesai**, lalu klik **Cari**.
3. Klik **Cetak** untuk mengunduh laporan dalam format Excel.

**Hasilnya:** berkas Excel laporan terunduh ke komputer.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Dokter Pengirim tidak boleh kosong | Kolom dokter di detail order belum dipilih. | Pilih **Dokter Pengirim**, lalu ulangi **Validasi Order**. |
| Pilih minimal satu pemeriksaan | Order APS belum berisi pemeriksaan. | Pilih minimal satu tarif pemeriksaan atau paket. |
| Tanggal tidak boleh kurang dari hari ini | Tanggal pemeriksaan diisi tanggal lampau. | Isi tanggal hari ini atau setelahnya. |
| Unit Asal harus dipilih | Kolom **Unit Asal** pada order APS kosong. | Pilih unit asal. |
| Pemeriksaan hanya dapat diubah sebelum order divalidasi | Order sudah divalidasi saat diedit. | Batalkan validasi dulu di **Hasil Pemeriksaan › Batal Validasi**, lalu edit order. |
| Validasi dibatalkan, pengiriman ke LIS gagal: … | LIS menolak order atau tidak dapat dihubungi, sehingga validasi tidak disimpan. | Baca penyebab di belakang pesan. Periksa **Mapping LIS** atau koneksi LIS, lalu ulangi. Bila mendesak, pakai **Validasi Saja**. |
| LIS tidak dapat dihubungi: … | Server LIS tidak merespons. | Hubungi admin/IT untuk memeriksa koneksi di **Konfigurasi LIS**. |
| Belum ada koneksi LIS aktif… | Belum ada koneksi LIS yang aktif. | Admin mengatur di **Setting › Konfigurasi Integrasi › LIS › Lab PK** (kartu **Konfigurasi LIS (Laboratorium)**), atau pakai **Validasi Saja**. |
| Ambil hasil LIS gagal | Hasil belum tersedia di LIS atau koneksi bermasalah. | Coba lagi beberapa saat kemudian. Bila berulang, hubungi admin. |
| Tidak cocok dengan item: … | Ada hasil dari LIS yang kodenya belum dipetakan. | Admin mengisi kode di **Laboratorium › Mapping LIS › Hasil Pemeriksaan**. Hasil yang belum masuk diisi manual. |
| Item pemeriksaan belum selesai | Masih ada item tanpa hasil saat menandai selesai. | Isi semua hasil, klik **Simpan Hasil**, lalu **Selesai**. |
| Order Lab belum diperiksa | Hasil diisi untuk order yang belum divalidasi atau sudah selesai/batal. | Pastikan order sudah divalidasi di **Order Lab**. |
| Tarif "…" mengacu item pemeriksaan yang sudah tidak aktif | Tarif berisi item atau kelompok yang sudah dihapus atau dinonaktifkan. | Admin memperbaiki isi tarif di **Datamaster › Tarif Lab**. |
| Kode sudah ada / Nomor urut sudah digunakan | Kode atau nomor urut data master sudah dipakai data lain. | Pakai kode atau nomor urut lain. |

## Pertanyaan yang sering diajukan
**Order dari dokter tidak muncul di Order Lab?** Periksa saringan tanggal dan status, lalu klik **Reset** dan **Cari**. Pastikan dokter sudah mengirim order dari tab **Penunjang › Order Lab** di RME.

**Bisakah hasil diubah setelah klik Selesai?** Tidak. Pastikan hasil sudah diperiksa sebelum menekan **Iya, Selesai**.

**Kenapa tombol Selesai tidak bisa diklik?** Masih ada item berstatus **Belum Selesai**. Isi semua hasil, lalu klik **Simpan Hasil** terlebih dahulu.

**Bagaimana membatalkan order yang sudah divalidasi?** Batalkan validasinya dulu di **Hasil Pemeriksaan › Batal Validasi**. Setelah itu, order kembali ke **Order Lab** dan bisa dibatalkan.

**Kenapa tombol Validasi & Kirim ke LIS tidak ada?** Fitur Bridging LIS belum aktif untuk faskes. Hubungi superadmin.

**Flag (tinggi/rendah) tidak muncul?** Flag hanya dihitung bila item memakai nilai rujukan (sakelar **Nilai Rujukan** aktif) dan nilai rujukannya sesuai jenis kelamin dan umur pasien. Hubungi admin data master.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**. Halaman yang modulnya tidak aktif menampilkan kode 403.
- Peran belum punya izin: admin › **Datamaster › Role**.
- Menu **Expertise** dan **Mapping LIS** hanya muncul bila fitur **Expertise Dokter Lab** dan **Bridging LIS (adamLIS)** aktif di Manajemen Modul.
- Menu Laboratorium ada di dalam menu **Penunjang**. Bila Patologi Anatomi atau Mikrobiologi juga aktif, ketiganya dikelompokkan dalam submenu **Penunjang › Laboratorium**, dan menu laboratorium klinik tampil dengan nama **Patologi Klinik**. Pada layar sempit, menu bisa berpindah ke tombol **Lainnya**.

## Catatan untuk peninjau
- Tombol **Cetak Label** di detail **Hasil Pemeriksaan** belum menjalankan apa pun di kode (`@click="() => {}"`). Panduan sengaja tidak menjelaskan cara mencetak label sampel. Mohon dipastikan apakah label dicetak dari tempat lain.
- Izin **CETAK LABEL** dan **CETAK PENGANTAR** ada di daftar izin **Order Lab**, tetapi tombolnya tidak ditemukan di halaman Order Lab.
- Order APS: pasien dicari lewat **Cari Nama / No. RM**. Belum jelas apakah pasien baru bisa langsung didaftarkan dari form ini atau harus lewat Admisi. Mohon dikonfirmasi.
- Komentar di kode frontend menyebut "validasi tetap sah walau pengiriman LIS gagal", tetapi backend membatalkan validasi bila pengiriman gagal. Panduan mengikuti perilaku backend.
- Belum dipastikan apakah validasi order lab otomatis membuat tagihan di menu Pembayaran. Saringan **Belum Lunas** mengisyaratkan ada kaitan dengan pembayaran.
- Langkah membuat order dari RME (tab **Penunjang › Order Lab**) hanya disebut singkat. Rinciannya sebaiknya ada di panduan `rawat-jalan.md`.
