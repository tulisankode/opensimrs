# IGD

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas IGD (dokter dan perawat jaga IGD) sebelum dipakai Helpdesk.

**Dipakai oleh:** dokter jaga IGD, perawat IGD
**Menu:** IGD › Pasien IGD
**Hak akses yang dibutuhkan:** IGD › IGD › READ (melihat daftar pasien), IGD › IGD › BATAL IGD (membatalkan kunjungan), IGD › Detail Pasien › (Rekam Medis, Asesmen, SOAP Dokter, Alkes Dan Penunjang, FPO, Resume Dan Dishcarge, Cetak Hasil Dan Surat) sesuai tugas, IGD › Laporan IGD (laporan)

## Untuk apa
Modul ini dipakai untuk melayani pasien gawat darurat setelah didaftarkan di **Admisi › IGD**. Di sini petugas mengisi triase dan rekam medis elektronik, menulis resep, mencatat tindakan dan pemberian obat, membuat surat permohonan rawat inap (SPRI), lalu memulangkan pasien.

## Tugas sehari-hari

### Melihat daftar pasien IGD
1. Buka menu **IGD**. Halaman **Pasien IGD** langsung terbuka.
2. Bila perlu, saring daftar:
   - **Cari Nama / Alamat / No. RM**;
   - **Dokter**;
   - **Tanggal mulai** dan **Tanggal selesai**;
   - **Data Pasien**: **DATA LENGKAP** atau **DATA TIDAK LENGKAP** (pasien tanpa identitas lengkap);
   - **Pembayaran**: **TUNAI** atau **ASURANSI**.
3. Tekan **Cari**. Tekan **Reset** untuk mengembalikan saringan.
4. Gunakan tombol status: ikon daftar (**Semua status**), **Pelayanan**, atau **Discharge**.

**Hasilnya:** Tabel menampilkan No. RM, No. Registrasi, data pasien, dokter, tanggal daftar, tanggal pulang, dan kolom **Status** (**DIRAWAT**, **DISCHARGE**, atau **DIBATALKAN**) beserta status bayar (**Lunas** atau **Belum Lunas**).

### Membuka rekam medis pasien IGD
1. Klik baris pasien di tabel.
2. Jendela rekam medis terbuka dengan judul **Detail Pasien | IGD**.
3. Di kiri atas ada pilihan tanggal rekam medis. Tekan tombol **+** di sebelahnya untuk menambah catatan tanggal hari ini bila belum ada.
4. Di tab **Rekam Medis**, **Asesmen**, dan **S.O.A.P** tampil deretan sesi (**Sesi 1**, **Sesi 2**, dan seterusnya). Di tab **Rekam Medis** juga ada **Non-Sesi**. Tekan **+** di deretan sesi untuk menambah sesi pemeriksaan baru.

**Hasilnya:** Data pasien, tombol **Cetak Label**, tombol **Riwayat**, dan tab-tab rekam medis tampil, termasuk tab **FPO** bila fitur tersebut aktif.

### Mengisi triase dan asesmen
1. Di jendela rekam medis, buka tab **Asesmen**.
2. Pilih **Triase**. Isi data yang tersedia, misalnya **Cara Datang**, **Kendaraan**, **Asal Rujukan**, **Kasus**, **Keadaan Umum**, tanda vital, skor GCS, dan **Kesimpulan Triase**, sesuai penilaian petugas.
3. Tekan **Simpan**.
4. Lanjutkan ke bagian lain, misalnya **Alergi**, **Anamnesis**, **Tanda Vital**, **Pemeriksaan Fisik**, **Derajat Luka Bakar (RON)**, **Diagnosis Dokter**, **Catatan Perawat**, atau **Instruksi Medis**. Tekan **Simpan** pada setiap formulir.

**Hasilnya:** Data triase dan asesmen tampil di tab **Rekam Medis** untuk sesi yang dipilih.

### Mengisi SOAP, resep, tindakan, dan order penunjang
Caranya sama dengan rawat jalan. Lihat [RME Rawat Jalan](./rawat-jalan.md).
1. **S.O.A.P**: pilih **Subjective**, **Objective**, **Assesment**, atau **Plan**, isi formulir, lalu tekan **Simpan**.
2. **Resep**: **S.O.A.P** › **Plan** › **Order Obat** › **Tambah Order**. Pilih **Lokasi Tujuan Order**, tambahkan obat, lalu tekan **Simpan & Order Resep**.
3. **Tindakan**: bagian **Pemeriksaan dan Tindakan** › **Tambah Tindakan**, lalu tekan **Simpan**.
4. **Order penunjang**: tab **Penunjang** › **Order Lab** (atau order lain yang aktif). Isi **Dokter Pengirim**, **Unit Asal**, dan **Penjamin**, lalu tekan **Kirim Order Lab**.
5. **Alkes/BMHP**: tab **Alkes**.

**Hasilnya:** Order tampil beserta statusnya. Tindakan ikut ditagihkan saat pasien dipulangkan.

### Mencatat pemberian obat (FPO)
1. Buka tab **FPO** (**Form Pemberian Obat (FPO)**).
2. Pilih tanggal dengan tombol panah kiri/kanan atau kalender. Tanggal yang lebih dari hari ini tidak bisa dipilih.
3. Pada obat yang diberikan, tekan **Edit**, isi **Jam Pemberian** dan **Catatan**, lalu tekan **Simpan Edit**.

**Hasilnya:** Pemberian obat tercatat pada tanggal tersebut.

### Membuat SPRI (pasien akan dirawat inap)
1. Buka tab **Cetak Hasil & Surat** › **Surat Keterangan**.
2. Tekan **Buat Surat**. Di **Cari & Pilih Surat**, pilih **Surat Permohonan Rawat Inap (SPRI)**, lalu tekan **Buat**.
3. Isi **Tanggal rencana Rawat Inap**, **Dokter**, **Tujuan Ruangan Rawat Inap**, dan **Keterangan / Catatan**.
4. Tekan **Simpan**.

**Hasilnya:** Muncul pesan "Surat baru berhasil disimpan!". Pasien otomatis terdaftar di rawat inap dengan status **WAITING** (menunggu bed). Petugas admisi kemudian menetapkan bed. Lihat [Rawat Inap](./rawat-inap.md).

### Memulangkan pasien (Resume & Discharge)
1. Buka tab **Resume & Discharge**.
2. Lengkapi **Edukasi**, **Keadaan Waktu Pulang**, dan **Status Pulang** (termasuk **Tanggal Discharge** dan data rujukan bila dirujuk).
3. Tekan **Simpan Resume Medis**, lalu **Discharge**.
4. Bila perlu, tekan **Cetak Resume Medis**.

**Hasilnya:** Status pasien menjadi **DISCHARGE** dan tagihan diteruskan ke kasir.

### Membatalkan kunjungan IGD
1. Di halaman **Pasien IGD**, tekan **Batal Kunjungan** di bawah tabel.
2. Centang pasien yang akan dibatalkan.
3. Isi **Alasan Batal Kunjungan**, lalu tekan **Iya, Batalkan**.

**Hasilnya:** Status kunjungan menjadi **DIBATALKAN**. Pasien yang sudah dipulangkan tidak bisa dibatalkan.

### Melihat laporan IGD
1. Di panel kiri, buka **Laporan**, lalu pilih **Kunjungan IGD**, **Pembatalan Dirawat**, atau **Rekap Tindakan Pasien**.
2. Atur saringan, lalu tekan **Cari**. Tekan **Cetak** untuk mencetak laporan.

**Hasilnya:** Data laporan tampil sesuai saringan.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Lokasi IGD tidak ada di datamaster lokasi | Belum ada lokasi bertipe IGD di data master. | Minta admin menambahkan lokasi IGD di **Datamaster › Lokasi**. |
| IGD Tidak bisa di cancel karena sudah di pulangkan | Pasien yang dipilih sudah DISCHARGE. | Batalkan centang pasien tersebut. |
| Tanggal Sudah Ada | Tombol **+** ditekan padahal catatan tanggal hari ini sudah ada. | Pilih tanggal hari ini dari daftar tanggal. |
| Penambahan sesi hanya dapat dilakukan untuk tanggal hari ini pada rekam medis terbaru. | Sesi baru hanya bisa ditambahkan pada tanggal hari ini. | Pilih atau buat tanggal hari ini, lalu tambah sesi. |
| Sesi sudah memiliki order farmasi. Batalkan order farmasi terlebih dahulu untuk menghapus sesi ini. | Sesi yang akan dihapus sudah memiliki resep. | Batalkan order farmasinya dulu, lalu hapus sesi. |
| Pemberian obat gagal. Stok obat tidak mencukupi | Stok obat di depo tidak cukup untuk dicatat sebagai pemberian. | Hubungi farmasi untuk memeriksa stok. |
| Gagal memuat detail riwayat. | Data kunjungan lama gagal dimuat. | Coba lagi. Bila tetap gagal, laporkan ke Helpdesk beserta No. RM. |
| Tidak dapat terhubung ke server | Jaringan atau server sedang terganggu. | Periksa koneksi, lalu coba lagi. |

## Pertanyaan yang sering diajukan
**Bagaimana mendaftarkan pasien IGD?** Pendaftaran dilakukan di **Admisi › IGD**, bukan di menu IGD. Lihat panduan Pendaftaran Pasien.

**Bagaimana mencari pasien tanpa identitas?** Pada saringan **Data Pasien**, pilih **DATA TIDAK LENGKAP**.

**Apa beda Sesi dan tanggal?** Satu tanggal rekam medis bisa berisi beberapa sesi pemeriksaan. Tambah sesi untuk pemeriksaan ulang di hari yang sama. Tambah tanggal (tombol **+** di samping pilihan tanggal) untuk hari berikutnya.

**Bagaimana menghapus sesi yang salah?** Pilih sesinya, tekan **Hapus Sesi**, isi **Alasan Menghapus Sesi**, lalu tekan **Iya, Hapus**. Seluruh data pemeriksaan pada sesi itu akan terhapus. Tombol ini hanya muncul bila ada lebih dari satu sesi.

**Pasien perlu dirawat inap, apa yang dilakukan?** Buat **Surat Permohonan Rawat Inap (SPRI)** di tab **Cetak Hasil & Surat**. Pasien akan muncul di rawat inap dengan status **WAITING** sampai admisi menetapkan bed.

**Mengapa halaman BPJS di panel kiri IGD belum berfungsi?** Halaman monitoring BPJS di IGD masih dalam pengembangan.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **IGD**). Tab **FPO** dan bagian **Triase** juga mengikuti pengaturan di sini.
- Peran belum punya izin: admin › **Datamaster › Role** (modul izin **IGD**).

## Catatan untuk peninjau
- Belum dipastikan apakah kunjungan IGD otomatis ditutup (discharge) setelah SPRI dibuat, atau tetap harus di-**Discharge** manual. Mohon diverifikasi alurnya.
- Isian formulir **Triase** ditulis dari label komponen. Urutan dan isian wajibnya perlu dicek di layar.
- Alur **FPO** (tombol **Edit**, **Jam Pemberian**, **Simpan Edit**) ditulis dari kode dialog edit. Cara mencatat pemberian pertama kali perlu dikonfirmasi petugas.
- Rute **IGD › BPJS › Monitoring** ditandai "stub" (belum berfungsi penuh) di router.
- Seperti pada rawat jalan, izin rinci di **IGD › Detail Pasien** tampaknya tidak menyembunyikan tombol di dalam RME. Mohon diverifikasi.
- Tombol status di halaman ini bertuliskan **Pelayanan**, padahal label status pasien di tabel adalah **DIRAWAT**. Mohon pastikan pemahaman petugas.
