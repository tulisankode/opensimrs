# RME Rawat Jalan

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas poli (dokter dan perawat rawat jalan) sebelum dipakai Helpdesk.

**Dipakai oleh:** dokter poli, perawat poli
**Menu:** Rawat Jalan › Poli › Semua Poli (atau nama poli)
**Hak akses yang dibutuhkan:** Rawat Jalan › Poli › READ (melihat daftar pasien), Rawat Jalan › Antrian › PANGGIL (memanggil pasien), Rawat Jalan › RME › (Rekap Medis, Asesmen, SOAP, Akses Dan Penunjang, Resume Dan DISHCARGE, Cetak Hasil Dan Surat) sesuai tugas, Rawat Jalan › Poli › BATAL KUNJUNGAN (membatalkan kunjungan)

## Untuk apa
Modul ini dipakai untuk melayani pasien poli dari antrean sampai pulang. Di sini petugas memanggil pasien, mengisi rekam medis elektronik (asesmen, SOAP, diagnosis), menulis resep, mengirim order penunjang, mencatat tindakan, lalu menutup kunjungan. Setelah kunjungan ditutup, tagihan diteruskan ke kasir dan resep masuk antrean farmasi.

## Tugas sehari-hari

### Membuka daftar pasien poli
1. Buka menu **Rawat Jalan**. Halaman **Poli** langsung terbuka.
2. Di panel kiri, pilih **Semua Poli** atau nama poli Anda.
3. Bila perlu, saring daftar dengan kolom **Cari Pasien**, pilihan **Dokter**, **Tanggal mulai**/**Tanggal selesai**, dan pembayaran **TUNAI**/**ASURANSI**, lalu tekan **Cari**. Tekan **Reset** untuk mengembalikan saringan.
4. Gunakan tombol status di kanan atas: ikon daftar (**Semua status**), **Pelayanan** (pasien yang sedang dilayani), atau **Discharge** (pasien yang sudah selesai).

**Hasilnya:** Tabel menampilkan nomor antrean, No. RM, nama pasien, dokter, poli, jadwal, dan kolom **Status** (**ANTRI**, **DIPERIKSA**, **DISCHARGE**, atau **DIBATALKAN**) beserta status bayar (**Lunas**, **Belum Lunas**, **Belum Ada Tagihan**).

> Bila Anda login sebagai dokter, daftar otomatis hanya menampilkan pasien Anda. Kosongkan pilihan **Dokter** untuk melihat semua pasien.

### Memanggil pasien ke layar antrean
Tugas ini hanya tersedia bila modul **Antrian** aktif di faskes Anda.
1. Di kolom **Status**, tekan tombol **Panggil** pada baris pasien yang berstatus **ANTRI**.
2. Bila pasien belum datang, tekan **Panggil Ulang**. Keterangan "Dipanggil (jam)" atau "Terlewat" tampil di bawah tombol.
3. Cara lain: tekan ikon megafon di bagian atas layar untuk membuka panel **Panggilan Antrian**. Di panel ini ada tab **Antrian Aktif**, **Terlewat**, dan **Selesai**, kolom pencarian, tombol **Panggil Berikutnya**, serta **Panggil Ulang** dan **Lewati** untuk pasien yang sedang dipanggil.

**Hasilnya:** Nomor antrean pasien tampil dan diumumkan di layar antrean.

### Membuka rekam medis dan mulai memeriksa
1. Klik baris pasien di tabel.
2. Bila pasien masih **ANTRI** dan belum dipanggil, muncul jendela **Pasien belum dipanggil**. Pilih:
   - **Panggil Sekarang**: pasien dipanggil dulu. Rekam medis belum dibuka. Klik baris pasien lagi setelah pasien datang.
   - **Buka Tanpa Memanggil**: rekam medis langsung dibuka.
   - **Batal**: tidak terjadi apa-apa.
3. Jendela rekam medis terbuka penuh dengan judul **Detail Pasien | Rawat Jalan**, No. RM, dan nama pasien.

**Hasilnya:** Status pasien berubah menjadi **DIPERIKSA**. Di bagian atas jendela tampil data pasien, tombol **Cetak Label**, dan tombol **Riwayat**. Di bawahnya ada deretan tab, misalnya **Rekam Medis**, **Asesmen**, **S.O.A.P**, **Penunjang**, **Alkes**, **Inform Consent**, **Unggah Berkas**, **Resume & Discharge**, dan **Cetak Hasil & Surat**. Tab yang tampil bergantung pada pengaturan faskes.

### Mengisi asesmen dan SOAP
1. Buka tab **Asesmen**. Pilih bagian yang ingin diisi dari deretan tombol, misalnya **Alergi**, **Anamnesis**, **Tanda Vital**, **Antropometri**, **Asesmen Nyeri**, **Kesadaran**, **Pemeriksaan Fisik**, **Diagnosis Dokter**, **Asuhan Keperawatan**, **Catatan Perawat**, atau **Instruksi Medis**. Di poli gigi dan poli mata juga tersedia **Pemeriksaan Gigi** dan **Pemeriksaan Mata**.
2. Isi formulir, lalu tekan **Simpan**. Tekan **Reset** untuk mengosongkan isian yang belum disimpan.
3. Cara lain: buka tab **S.O.A.P**, lalu pilih **Subjective**, **Objective**, **Assesment**, atau **Plan**. Formulir dikelompokkan menurut huruf SOAP. Gunakan **Lompat Ke Form** untuk langsung menuju formulir tertentu.
4. Buka tab **Rekam Medis** untuk melihat ringkasan semua yang sudah diisi pada kunjungan ini.

**Hasilnya:** Muncul notifikasi berhasil, dan isian tampil di tab **Rekam Medis**.

### Menulis resep (order obat)
1. Di tab **S.O.A.P**, pilih **Plan**, lalu buka bagian **Order Obat**.
2. Tekan **Tambah Order**.
3. Pilih **Lokasi Tujuan Order** (depo farmasi tujuan). Aktifkan **Obat Pulang** bila perlu.
4. Pada tab **Obat**, pilih obat dan isi **Jumlah Total**, **Satuan Dosis**, **Aturan Pakai**, **Cara Pakai**, **Rute Pemberian**, dan **Catatan** sesuai resep dokter, lalu tekan **Simpan** atau **Tambah Obat**. Untuk obat racikan, gunakan tab **Obat Racikan**. Tab ini hanya ada bila fitur racikan aktif.
5. Periksa daftar obat, lalu tekan **Simpan & Order Resep**.

**Hasilnya:** Order resep tampil di bagian **Order Obat** beserta statusnya. Setelah kunjungan ditutup, resep masuk antrean farmasi.

### Mengirim order penunjang (laboratorium, radiologi, dan lainnya)
1. Buka tab **Penunjang**.
2. Pilih jenis order: **Order Lab**, **Order Radiologi**, **Order Fisio**, **Order Patologi Anatomi**, atau **Order Mikrobiologi**. Pilihan yang tampil hanya untuk modul yang aktif.
3. Untuk **Order Lab**: pilih pemeriksaan, lalu isi **Dokter Pengirim**, **Unit Asal**, dan **Penjamin** (khusus pasien asuransi). Bila perlu, isi **Diagnosis / Indikasi** dan **Catatan untuk Lab**. Tekan **Kirim Order Lab**.

**Hasilnya:** Order tampil di riwayat order beserta statusnya. Bila hasil sudah keluar, tekan **Cetak Hasil** untuk mencetaknya.

### Mencatat tindakan
1. Di tab **S.O.A.P** › **Plan** (atau tab **Asesmen** › **Pemeriksaan dan Tindakan**), buka bagian **Pemeriksaan dan Tindakan**.
2. Tekan **Tambah Tindakan** (satu tindakan) atau **Tambah Tindakan Multiple** (beberapa sekaligus).
3. Pilih tindakan, isi **Jumlah**, dan pilih petugas pelaksana, lalu tekan **Simpan**.
4. Tekan **Riwayat Pemeriksaan** untuk melihat tindakan pada kunjungan sebelumnya.

**Hasilnya:** Tindakan tampil di **List Tindakan** beserta harganya. Tindakan ini ikut ditagihkan setelah kunjungan ditutup.

### Memakai SOAP Ringkas (praktik mandiri)
Tab **SOAP Ringkas** hanya muncul bila fitur ini diaktifkan untuk faskes. Bila tab ini aktif, tab **S.O.A.P** disembunyikan.
1. Buka tab **SOAP Ringkas**. Semua isian ada di satu layar:
   - **S — Subjektif**: **Keluhan Utama** dan alergi.
   - **O — Objektif**: tanda vital, **Keadaan Umum**, dan **Pemeriksaan Fisik**.
   - **A — Asesmen**: **Diagnosis Primer (ICD-10)** dan **Diagnosis Sekunder**.
   - **Tindak Lanjut**: **Status Pulang**.
   - **P — Rencana: Resep & Tindakan**.
2. Tekan **Simpan** untuk menyimpan sementara.
3. Bila pelayanan sudah selesai, tekan **Simpan & Selesai**, lalu **Ya, Selesai**. **Keluhan Utama** dan **Diagnosis Primer** wajib diisi.

**Hasilnya:** Muncul pesan "Pelayanan selesai". Kunjungan ditutup, tagihan diteruskan ke kasir, dan resep (bila ada) masuk antrean farmasi.

### Menutup kunjungan (Resume & Discharge)
1. Buka tab **Resume & Discharge**.
2. Periksa dan lengkapi bagian resume, misalnya **Edukasi**, **Keadaan Waktu Pulang**, dan **Status Pulang**. Di bagian **Status Pulang** juga ada isian **Tanggal Discharge** dan data rujukan bila pasien dirujuk.
3. Tekan **Simpan Resume Medis**.
4. Tekan **Discharge**.
5. Bila perlu, tekan **Cetak Resume Medis**.

**Hasilnya:** Status pasien menjadi **DISCHARGE**. Tagihan diteruskan ke kasir dan resep masuk antrean farmasi.

### Mencetak label, surat, dan melihat riwayat
1. **Cetak Label** (kanan atas jendela rekam medis) mencetak label identitas pasien.
2. Tab **Cetak Hasil & Surat** › **Cetak Hasil Pemeriksaan** menampilkan hasil penunjang yang bisa dicetak.
3. Tab **Cetak Hasil & Surat** › **Surat Keterangan** › **Buat Surat** dipakai untuk membuat surat. Pilih jenis surat di **Cari & Pilih Surat**, misalnya **Surat Kontrol Rawat Jalan**, **Surat Permohonan Rawat Inap (SPRI)**, **Surat Keterangan Sakit**, **Surat Keterangan Sehat**, **Surat Rujukan**, **Surat Keterangan Meninggal**, atau **Surat Resep Kacamata**. Tekan **Buat**, isi formulir, lalu tekan **Simpan**.
4. Tombol **Riwayat** menampilkan daftar **Riwayat Kunjungan** pasien. Klik salah satu kunjungan untuk membuka rekam medisnya dalam mode baca (**Riwayat Pemeriksaan**).

**Hasilnya:** Dokumen PDF terbentuk dan surat tersimpan di rekam medis pasien.

### Membatalkan kunjungan
1. Di halaman **Poli**, tekan **Batal Kunjungan** di kiri bawah.
2. Centang pasien yang akan dibatalkan.
3. Isi **Alasan Batal Kunjungan**, lalu tekan **Iya, Batalkan**. Tekan **Batal** untuk mengurungkan.

**Hasilnya:** Status kunjungan menjadi **DIBATALKAN**. Pembatalan hanya bisa dilakukan untuk pasien yang belum diperiksa.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Pembatalan tidak diizinkan, pasien sudah diperiksa | Pasien yang dipilih sudah berstatus DIPERIKSA atau DISCHARGE. | Jangan batalkan kunjungan pasien yang sudah diperiksa. Hubungi admin bila kunjungan memang salah daftar. |
| Data lokasi poliklinik tidak ditemukan. | Kunjungan tidak memiliki data poli. | Minta petugas pendaftaran memeriksa poli pada kunjungan, atau minta admin memeriksa **Datamaster › Lokasi**. |
| Gagal mendapatkan detail data pelayanan. / Terjadi kesalahan saat memuat rekam medis. | Data kunjungan gagal dimuat. | Muat ulang halaman, lalu coba lagi. Bila tetap gagal, laporkan ke Helpdesk beserta No. RM pasien. |
| Belum lengkap — Keluhan utama dan Diagnosis primer wajib diisi. | Muncul di SOAP Ringkas saat menekan **Simpan & Selesai**. | Isi **Keluhan Utama** dan **Diagnosis Primer (ICD-10)**, lalu ulangi. |
| Cetak resume gagal — Resume medis belum bisa dicetak. Simpan resume lalu coba lagi. | Resume belum tersimpan. | Tekan **Simpan Resume Medis**, lalu **Cetak Resume Medis** lagi. |
| Data pasien tidak lengkap untuk mencetak label. | Data identitas pasien belum termuat. | Tutup jendela rekam medis, buka lagi, lalu cetak ulang. |
| Tidak dapat terhubung ke server | Jaringan atau server sedang terganggu. | Periksa koneksi, lalu coba lagi. Bila berulang, hubungi Helpdesk. |
| token tidak valid! / silakan login terlebih dahulu! | Sesi login sudah habis. | Login ulang. |

## Pertanyaan yang sering diajukan
**Mengapa tombol Panggil tidak muncul?** Tombol **Panggil** hanya muncul bila modul **Antrian** aktif dan pasien masih berstatus **ANTRI**. Tanpa modul Antrian (misalnya praktik mandiri), rekam medis langsung bisa dibuka.

**Mengapa daftar pasien saya kosong padahal ada pasien?** Periksa saringan **Dokter**, tanggal, dan tombol status. Dokter yang login otomatis hanya melihat pasiennya sendiri. Tekan **Reset** untuk mengembalikan saringan.

**Di mana CPPT?** Tidak ada tab bernama CPPT. Catatan terintegrasi diisi di tab **S.O.A.P** (atau **SOAP Ringkas**), sedangkan catatan perawat dan instruksi medis ada di bagian **Catatan Perawat** dan **Instruksi Medis**.

**Mengapa tab Asesmen, Penunjang, atau Alkes tidak ada?** Tab-tab itu bisa dinonaktifkan per faskes lewat **Setting › Manajemen Modul**. Bagian khusus seperti **Pemeriksaan Gigi** atau **Pemeriksaan Mata** hanya muncul di poli yang sesuai.

**Bisakah rekam medis diubah setelah Discharge?** Setelah kunjungan ditutup lewat **SOAP Ringkas**, rekam medis tidak bisa diubah dari layar itu. Untuk perubahan setelah discharge, hubungi admin.

**Bagaimana melihat kunjungan pasien sebelumnya?** Di jendela rekam medis, tekan **Riwayat**, lalu pilih kunjungan.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**. Tab RME (Asesmen, Penunjang, Alkes, Inform Consent, Unggah Berkas, Cetak Hasil & Surat, SOAP Ringkas) juga diatur di sini.
- Peran belum punya izin: admin › **Datamaster › Role** (modul izin **Rawat Jalan**).
- Poli tidak tampil di panel kiri: lokasi belum ditandai sebagai poli atau sedang nonaktif. Admin dapat memeriksanya di **Datamaster › Lokasi**.

## Catatan untuk peninjau
- Istilah "CPPT" tidak ditemukan di layar mana pun. Panduan ini mengarahkan ke tab **S.O.A.P**, **Catatan Perawat**, dan **Instruksi Medis**. Mohon pastikan istilah yang dipakai petugas di lapangan.
- Izin rinci di modul **Rawat Jalan › RME** (mis. CREATE ALERGI, DISHCARGE) didefinisikan di `permission-list.js`. Dari pembacaan kode, izin ini tampaknya hanya menentukan menu yang tampil, sedangkan tombol di dalam RME tidak disembunyikan per izin. Mohon diverifikasi.
- Langkah isian **Order Obat** dan **Pemeriksaan dan Tindakan** ditulis dari label formulir. Urutan klik yang persis (mis. kapan memilih petugas) perlu dicek di layar.
- Bagian **Order Lab** memuat label **CITO** pada riwayat order. Belum dipastikan apakah CITO bisa dipilih saat membuat order.
- Belum dipastikan apakah **Discharge** di tab **Resume & Discharge** menolak bila resume belum disimpan. Panduan menyarankan menekan **Simpan Resume Medis** lebih dulu.
- Setelah **Discharge** lewat tab **Resume & Discharge** (bukan SOAP Ringkas), jendela rekam medis tampaknya tidak menutup otomatis. Mohon dicek.
