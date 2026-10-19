# Mutu & Akreditasi

> Draf disusun AI dari kode aplikasi pada 2026-10-19 — wajib ditinjau Komite/Tim Mutu dan Tim Keselamatan Pasien sebelum dipakai Helpdesk.

**Dipakai oleh:** semua petugas (melapor insiden), kepala unit, Tim Keselamatan Pasien (KP), Komite Mutu, pengumpul data dan validator indikator mutu, tim akreditasi
**Menu:** Mutu & Akreditasi › Insiden Keselamatan Pasien (Lapor Insiden, Daftar Laporan IKP, Dasbor IKP, Register Risiko, Pengaturan IKP) · Indikator Mutu (Capaian Indikator, Pengumpulan Data, Tindak Lanjut, Master Indikator) · Dasbor Kesiapan · Dokumen Akreditasi · Kredensial Staf · Instrumen Akreditasi · Dokumen Surveior
**Hak akses yang dibutuhkan:**
- Mutu & Akreditasi › Insiden Keselamatan Pasien › LAPOR (semua pelapor), READ, LIHAT PASIEN, TERIMA, GRADING, INVESTIGASI, TINDAK LANJUT, VERIFIKASI, TUTUP, DASBOR, EKSPOR, PENGATURAN
- Mutu & Akreditasi › Register Risiko › READ, CREATE, UPDATE, DELETE
- Mutu & Akreditasi › Indikator Mutu › READ, CREATE, UPDATE, DELETE, INPUT DATA, VALIDASI, TINDAK LANJUT, EKSPOR
- Mutu & Akreditasi › Dasbor Kesiapan, Instrumen Akreditasi, Dokumen Akreditasi, Kredensial Staf, Akses Surveior (sesuai tugas)

## Untuk apa
Modul ini membantu faskes menjalankan program mutu dan keselamatan pasien: melaporkan dan menindaklanjuti insiden keselamatan pasien (IKP), mengelola register risiko unit, mengumpulkan dan memvalidasi data indikator mutu (INM, IMP-RS, IMPU), serta menyiapkan dokumen akreditasi dan kredensial staf.

Modul ini terdiri atas tiga fitur yang diaktifkan terpisah di **Setting › Manajemen Modul**: **Insiden Keselamatan Pasien & Manajemen Risiko**, **Indikator Mutu (INM, IMP-RS, IMPU)**, dan **Dokumen Akreditasi & Kredensial Staf**. Menu di panel kiri hanya tampil untuk fitur yang aktif.

## Tugas sehari-hari

### Membuka modul
1. Klik menu **Mutu & Akreditasi** di menu atas. Bila tidak terlihat, klik **Lainnya** lalu cari "Mutu".
2. Pilih halaman di panel kiri.

### Melaporkan insiden keselamatan pasien (semua petugas)
1. Buka **Mutu & Akreditasi › Insiden Keselamatan Pasien › Lapor Insiden**. Daftar **Laporan Insiden Saya** tampil.
2. Klik **Laporkan Insiden**.
3. Isi **Jenis Insiden** (KTD, KNC, KTC, KPC, atau Sentinel) dan **Kelompok Insiden**.
4. Isi **Waktu Kejadian (WIB)** dan, bila berbeda, **Waktu Insiden Diketahui (WIB, kosong = sama)**.
5. Pilih **Unit Terkait**, isi **Tempat Kejadian** (mis. "Bed 3, kamar mandi"), lalu pilih **Layanan** dan **Akibat bagi Pasien**.
6. Tulis **Kronologi Insiden** (urutan kejadian, tanpa menyalahkan individu) dan **Tindakan Segera yang Dilakukan**, lalu pilih **Tindakan Dilakukan oleh**.
7. Bila insiden serupa pernah terjadi, centang **Insiden serupa pernah terjadi di unit lain** dan isi keterangannya.
8. Bila ingin, centang **Rahasiakan identitas saya (anonim)**. Pilihan ini tidak bisa diubah setelah laporan dikirim.
9. Bila perlu, isi **No. Registrasi Kunjungan Pasien (opsional)** dan lampirkan berkas (PDF/JPG/PNG, maksimal 10 MB, paling banyak 5 berkas).
10. Klik **Kirim Laporan**.

**Hasilnya:** laporan mendapat nomor dan berstatus **Dilaporkan**. Kolom **Ketepatan** menunjukkan apakah laporan dikirim dalam batas waktu (bawaan 48 jam sejak insiden diketahui). Identitas pelapor anonim tidak ditampilkan kepada peninjau mana pun.

> Bila jaringan terputus saat mengirim, tombol berubah menjadi **Kirim Ulang**. Mengirim ulang tidak membuat laporan ganda.

### Melengkapi laporan yang dikembalikan
1. Di **Laporan Insiden Saya**, cari laporan berstatus **Perlu Dilengkapi**. Alasan dari peninjau tertulis di bawahnya.
2. Klik baris itu. Jendela **Lengkapi Laporan …** terbuka.
3. Perbaiki isian, lalu klik **Simpan**.

**Hasilnya:** laporan kembali ke peninjau. Laporan berstatus **Dilaporkan** juga masih bisa diubah dengan cara yang sama.

### Menerima dan menggrading laporan (kepala unit / Tim KP)
1. Buka **Insiden Keselamatan Pasien › Daftar Laporan IKP**. Saring dengan **Cari** (nomor/unit), **Status**, **Jenis**, **Grade**, atau **Unit**.
2. Klik baris laporan. Detail laporan terbuka dengan tab **Laporan**, **Grading**, **Investigasi** (atau **RCA**), **Tindak Lanjut**, **Lampiran**, dan **Riwayat**.
3. Di tab **Laporan**, klik **Terima Laporan** (boleh mengisi **Catatan Penerimaan (opsional)**). Bila laporan kurang lengkap, isi **Alasan Minta Dilengkapi** lalu klik **Kembalikan ke Pelapor**.
4. Petugas dengan izin LIHAT PASIEN dapat menautkan pasien: isi **No. Registrasi Kunjungan (rujukan pasien)** lalu klik **Tautkan**, atau **Lepas** untuk melepasnya.
5. Di tab **Grading**, pilih sel pada matriks **Probabilitas \ Dampak**, lalu klik **Simpan Grading**. Untuk grading ulang, isi **Alasan Grading Ulang**.

**Hasilnya:** status menjadi **Diterima Unit**, lalu **Sudah Digrading** dengan grade **Biru**, **Hijau**, **Kuning**, atau **Merah**. Batas waktu investigasi tampil di bagian atas detail.

### Mencatat investigasi atau RCA
1. Buka detail laporan yang sudah digrading, lalu tab **Investigasi** (tab bernama **RCA** bila grade atau jenis insidennya mewajibkan RCA, misalnya insiden sentinel).
2. Isi **Tim Investigasi**, **Penyebab Langsung**, **Akar Masalah**, **Analisis (mis. 5 why, fishbone)**, dan **Rekomendasi / Tindakan**.
3. Klik **Simpan** untuk menyimpan sementara, atau **Simpan & Selesaikan** bila investigasi selesai.
4. Bila perlu mengubah investigasi yang sudah selesai, isi alasan lalu klik **Buka Kembali**.

**Hasilnya:** status laporan menjadi **Investigasi / RCA**.

### Mencatat dan memverifikasi tindak lanjut
1. Buka tab **Tindak Lanjut**.
2. Isi **Uraian**, pilih **PIC** (pegawai), dan isi **Tenggat**, lalu klik **Tambah**.
3. Untuk memperbarui, klik ikon pensil, isi **Progres** dan **Status**. Bila status **Selesai**, **Hasil (wajib bila selesai)** harus diisi. Klik **Simpan**.
4. Petugas dengan izin VERIFIKASI menekan **Verifikasi** pada tindak lanjut berstatus **Selesai**.

**Hasilnya:** status tindak lanjut berurutan **Rencana**, **Berjalan**, **Selesai**, lalu **Terverifikasi**. Tindak lanjut yang sudah terverifikasi tidak bisa diubah atau dihapus. Tenggat yang lewat ditandai "terlambat".

### Menutup laporan
1. Di bagian bawah detail laporan, isi **Alasan Penutupan (wajib bila tanpa tindak lanjut)** bila perlu.
2. Klik **Tutup Laporan**.

**Hasilnya:** status menjadi **Ditutup** dan laporan tidak bisa diubah. Untuk membukanya lagi, isi **Alasan Buka Kembali** lalu klik **Buka Kembali**.

### Mencatat register risiko unit
1. Buka **Insiden Keselamatan Pasien › Register Risiko**, lalu klik **Catat Risiko**.
2. Pilih **Unit**, isi **Uraian Risiko**, **Penyebab**, dan **Pengendalian yang Sudah Ada**.
3. Pilih **Dampak** dan **Probabilitas**. Grade dihitung dari matriks grading faskes.
4. Isi **Rencana Mitigasi**, **PIC**, dan **Tenggat Mitigasi**, pilih **Status**, lalu klik **Simpan**.

**Hasilnya:** risiko tampil di **Register Risiko Unit** dengan status **Terbuka**, **Dalam Mitigasi**, **Terkendali**, atau **Ditutup**.

### Mengisi data indikator mutu (pengumpul data)
1. Buka **Mutu & Akreditasi › Indikator Mutu › Pengumpulan Data**, lalu klik **Input Data**.
2. Pilih **Indikator** dan **Unit**, lalu isi **Tanggal** (atau **Bulan** untuk indikator bulanan).
3. Isi **Numerator** dan **Denominator**, serta **Catatan** bila perlu. Untuk indikator yang dapat dihitung dari data SIMRS, klik **Pratinjau Hitung** lalu **Hitung & Simpan Draf**.
4. Centang **Langsung ajukan untuk validasi** bila data sudah final, lalu klik **Simpan**.
5. Data berstatus **Draf** dapat dibuka lagi (klik barisnya) untuk **Ubah**, **Ajukan Validasi**, atau **Hapus**.

**Hasilnya:** data berstatus **Draf** atau **Diajukan**.

### Memvalidasi data indikator (validator)
1. Di **Pengumpulan Data**, klik baris berstatus **Diajukan**.
2. Klik **Setujui** (boleh dengan **Catatan (opsional)**) atau **Kembalikan** (isi **Catatan perbaikan (wajib)**), lalu klik **Simpan**.
3. Untuk membuka data yang sudah tervalidasi, klik **Buka Kembali** dan isi **Alasan (wajib)**.

**Hasilnya:** status menjadi **Tervalidasi** atau **Dikembalikan**. Validator tidak boleh orang yang mengisi atau mengajukan data yang sama.

### Melihat capaian dan mencatat tindak lanjut indikator
1. Buka **Indikator Mutu › Capaian Indikator**. Pilih **Jenis**, **Unit**, dan **Periode** (bulan atau triwulan).
2. Baca kolom **Capaian**, **Target**, **Kelengkapan**, dan **Status**: **Tercapai**, **Tidak Tercapai**, **Data Belum Lengkap**, **Target Belum Ditetapkan**, atau **Belum Ada Data**.
3. Klik **Lihat Data** untuk melihat data harian/bulanan, atau **Catat Tindak Lanjut** untuk indikator yang belum tercapai.
4. Di jendela tindak lanjut, isi **Analisis (penyebab capaian)**, **Rencana Tindak Lanjut**, **Penanggung Jawab**, dan **Tenggat / Waktu Evaluasi**, lalu klik **Simpan**. Hasilnya dipantau di **Indikator Mutu › Tindak Lanjut**.
5. Klik **Ekspor Excel** untuk mengunduh laporan capaian (butuh izin EKSPOR).

### Mencatat kredensial staf
1. Buka **Mutu & Akreditasi › Kredensial Staf**, lalu klik **Catat Kredensial**.
2. Pilih **Pegawai (Datamaster, aktif)** dan **Jenis Kredensial** (mis. STR, SIP, Sertifikat Pelatihan, Sertifikat Kompetensi, RKK).
3. Isi **Nomor**, **Penerbit** (mis. KKI, Dinas Kesehatan), **Berlaku Mulai / Tanggal Terbit**, **Berlaku Sampai (kosong = tanpa batas)**, dan **Uraian / Rincian Kewenangan**, lalu klik **Simpan**.
4. Petugas berizin VERIFIKASI membuka kredensial, mengisi **Catatan verifikasi (wajib bila ditolak)**, lalu klik **Terverifikasi** atau **Tolak**.

**Hasilnya:** kredensial tampil dengan status verifikasi **Belum Diverifikasi**, **Terverifikasi**, atau **Ditolak**. Data ini sama dengan **HR / SDM › Kredensial** (lihat [HR / SDM](./sdm.md)).

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Lampiran harus PDF/JPG/PNG / Ukuran lampiran maksimal 10 MB | Berkas lampiran tidak sesuai. | Ubah format atau perkecil berkas. |
| Pilihan anonim tidak dapat diubah setelah laporan dikirim | Status anonim dikunci setelah laporan terkirim. | Hubungi Tim KP bila ada masalah. |
| Lampiran hanya dapat ditambahkan pelapor sebelum laporan diterima unit | Laporan sudah diterima unit. | Minta peninjau menambahkan lampiran. |
| Hanya laporan berstatus Dilaporkan yang dapat dikembalikan ke pelapor | Laporan sudah diterima atau diproses. | Lanjutkan proses dari status sekarang. |
| Laporan harus digrading sebelum investigasi dicatat / sebelum tindak lanjut dicatat | Grading belum dilakukan. | Isi tab **Grading** dulu. |
| Investigasi sederhana sudah selesai; grade baru mewajibkan RCA — buka kembali investigasi sebelum grading ulang | Grade baru memerlukan RCA. | Klik **Buka Kembali** di tab investigasi, lalu grading ulang. |
| Hanya tindak lanjut berstatus Selesai yang dapat diverifikasi | Tindak lanjut belum selesai. | Minta PIC memperbarui status dan hasilnya. |
| Laporan yang sudah ditutup tidak dapat diubah; buka kembali terlebih dahulu | Laporan sudah ditutup. | Klik **Buka Kembali** dengan alasan. |
| No. Registrasi kunjungan tidak ditemukan di faskes ini | Nomor registrasi salah. | Periksa nomor registrasi kunjungan pasien. |
| Risiko yang sedang dimitigasi tidak dapat dihapus; tutup risiko terlebih dahulu | Risiko masih dalam mitigasi. | Ubah status menjadi **Ditutup** dulu. |
| Validator tidak boleh orang yang mengisi atau mengajukan data ini. | Pengisi dan validator sama. | Minta validator lain. |
| Kredensial yang sudah dicabut tidak dapat diubah / diverifikasi | Kredensial berstatus **Dicabut**. | Catat kredensial baru. |

## Pertanyaan yang sering diajukan
**Siapa yang boleh melapor insiden?** Semua petugas yang punya izin LAPOR. Pelapor hanya melihat laporannya sendiri di **Laporan Insiden Saya**.

**Apakah peninjau bisa melihat nama pelapor anonim?** Tidak. Identitas pelapor anonim tidak ditampilkan kepada peninjau mana pun.

**Berapa batas waktu melapor dan investigasi?** Diatur di **Insiden Keselamatan Pasien › Pengaturan IKP** (**Laporan (jam sejak diketahui)** dan batas investigasi per grade dalam hari). Bawaan batas lapor adalah 48 jam.

**Apakah ada format pelaporan nasional (SP2KP/KNKP)?** Belum. Aplikasi menyatakan spesifikasi resminya belum ditetapkan; gunakan rekap internal di **Dasbor IKP**.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **Mutu & Akreditasi** dan fiturnya).
- Peran belum punya izin: admin › **Datamaster › Role** (modul izin **Mutu & Akreditasi**). Izin modul ini tidak diberikan otomatis ke peran faskes.
- Menu atas penuh: buka tombol **Lainnya** di menu atas.

## Catatan untuk peninjau
- Langkah **Dasbor Kesiapan**, **Dokumen Akreditasi**, **Instrumen Akreditasi**, **Dokumen Surveior**, **Dasbor IKP**, dan **Master Indikator** belum ditulis rinci. Panduan ini fokus pada tugas harian.
- Isi pilihan **Kelompok Insiden**, **Layanan**, **Akibat bagi Pasien**, dan matriks grading berasal dari data referensi di server dan perlu dicocokkan dengan pedoman KP faskes.
- Kapan tab bernama **RCA** (bukan **Investigasi**) ditentukan server (`perluRca`). Mohon dipastikan aturan grade yang mewajibkan RCA.
- Langkah memilih sel matriks grading dan membuka detail kredensial ditulis dari kode dan perlu dicoba di layar.
