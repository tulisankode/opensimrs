# Medical Check Up (MCU)

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas MCU (admin MCU, dokter pemeriksa, dan bagian penagihan) sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas pendaftaran MCU, petugas stasiun pemeriksaan, dokter pemeriksa MCU, petugas penagihan korporasi
**Menu:** MCU › Peserta MCU · Pemeriksaan Stasiun · Tagihan Korporasi · Datamaster (Paket MCU, Perusahaan) · Laporan MCU · Rekap Hasil (HRD)
**Hak akses yang dibutuhkan:**
- MCU › Peserta › READ, CREATE, IMPOR, UPDATE, BATAL, HAPUS, KESIMPULAN, CETAK, KIRIM LIS (sesuai tugas)
- MCU › Pemeriksaan › READ, INPUT HASIL
- MCU › Datamaster › Paket MCU / Perusahaan › READ, CREATE, UPDATE, DELETE
- MCU › Tagihan Korporasi › READ, CREATE, UPDATE, PEMBAYARAN, CETAK
- MCU › Laporan MCU › READ, CETAK LAPORAN

## Untuk apa
Modul MCU mengelola pemeriksaan kesehatan perorangan maupun rombongan karyawan perusahaan. Alurnya: siapkan paket dan data perusahaan, daftarkan peserta (satu per satu atau impor Excel dari HRD), isi hasil di tiap stasiun pemeriksaan, lalu dokter menyimpan kesimpulan (Fit, Fit dengan Catatan, atau Unfit). Hasilnya bisa dicetak, direkap untuk HRD, dan ditagihkan ke perusahaan lewat invoice.

## Tugas sehari-hari

### Menyiapkan paket MCU
1. Buka **MCU › Datamaster › Paket MCU**, lalu klik **+ Paket**.
2. Isi **Kode** (mis. `MCU-STD`), **Nama Paket**, dan **Harga (Rp)**.
3. Pilih **Berlaku untuk**: Perorangan, Korporasi, atau Perorangan & Korporasi. Biarkan sakelar pada **Aktif**.
4. Di bagian **Stasiun Pemeriksaan**, centang stasiun yang dilalui peserta (mis. Anamnesis & Riwayat, Tanda Vital & Antropometri, Pemeriksaan Fisik, Visus & Buta Warna, Audiometri, EKG, Spirometri, Pemeriksaan Gigi).
5. Di bagian **Isi Paket**, tambahkan pemeriksaan dengan **+ Lab**, **+ Radiologi**, atau **+ Tindakan**, lalu pilih master pemeriksaannya.
6. Klik **Simpan**.

**Hasilnya:** paket tampil di daftar Paket MCU. Stasiun Laboratorium dan Radiologi otomatis ditambahkan bila paket berisi item tersebut, dan stasiun Kesimpulan Dokter selalu ada.

### Menambah perusahaan dan harga kontrak
1. Buka **MCU › Datamaster › Perusahaan**, lalu klik **+ Perusahaan**.
2. Di tab **Data Perusahaan**, isi **Kode**, **Nama Perusahaan**, **Alamat**, **PIC / HRD**, **Telepon**, dan **Email** (contoh: `hrd@contoh.id`). Klik **Simpan**.
3. Setelah tersimpan, buka tab **Harga Kontrak**, klik **Tambah Harga Kontrak**.
4. Pilih **Paket MCU**, isi **Harga kontrak (Rp)**, **No. kontrak / PKS**, serta **Berlaku mulai** dan **Berlaku sampai** bila ada. Klik **Simpan Kontrak**.

**Hasilnya:** saat peserta perusahaan ini didaftarkan pada tanggal dalam masa berlaku kontrak, harga yang dipakai adalah harga kontrak, bukan harga paket biasa.

### Mendaftarkan peserta satu per satu
1. Buka **MCU › Peserta MCU**, klik **Daftar Peserta**.
2. Pilih **Perorangan** atau **Korporasi / Rombongan**. Untuk korporasi, pilih **Perusahaan**.
3. Pilih **Paket MCU**, **Tanggal MCU**, dan **Jenis MCU** (Umum / Perorangan, Pra-Kerja, Berkala, Khusus, Purna Kerja).
4. Di **Cari pasien terdaftar**, ketik nama, No. RM, atau NIK, lalu klik **Cari**. Centang pasien yang dimaksud.
5. Bila pasien belum terdaftar, klik **+ Pasien Baru**, isi **Nama lengkap**, **No. identitas / NIK** (contoh: `9999010101010001`), **Jenis kelamin**, **Tanggal lahir**, dan data lain, lalu klik **Simpan & Pilih**.
6. Untuk peserta korporasi, isi kolom **NIK Kary.**, **Jabatan**, dan **Bagian** di tabel **Peserta dipilih**.
7. Klik **Daftarkan … Peserta**.

**Hasilnya:** peserta muncul di daftar dengan status **Terdaftar** dan nomor MCU. Order laboratorium dan radiologi sesuai isi paket dibuat otomatis.

### Mengimpor peserta dari Excel HRD
1. Buka **MCU › Peserta MCU**, klik **Impor Excel**.
2. Pilih **Perusahaan**. Bila perlu, pilih **Paket bawaan (bila kolom paket kosong)**, **Tanggal MCU**, dan **Jenis MCU**.
3. Bila HRD belum punya berkas, klik **Unduh Templat Excel** dan kirimkan ke HRD. Sheet **Petunjuk** di templat menjelaskan setiap kolom.
4. Klik **Pilih File Excel** dan pilih berkas dari HRD. Format templat OpenSIMRS dan format unggah massal adamLIS (sheet Pasien) sama-sama diterima, maksimal 1.000 baris.
5. Periksa pratinjau. Gunakan tombol penyaring **Semua**, **Pasien lama**, **Pasien baru**, **Galat**, dan **Dengan peringatan**. Kolom **Keterangan** menjelaskan masalah setiap baris.
6. Bila ada baris galat, klik **Unduh Baris Galat**, minta HRD memperbaikinya, lalu impor ulang baris tersebut.
7. Klik **Daftarkan … Baris Valid**.

**Hasilnya:** muncul ringkasan **Berhasil didaftarkan**, **Pasien baru (Admisi)**, **Baris gagal**, dan **Waktu proses**. Pasien baru otomatis dibuatkan No. RM di Admisi. Daftar peserta langsung menampilkan hasil impor. Bila ada baris yang gagal saat disimpan, klik **Unduh Baris Gagal**.

### Mengisi hasil di stasiun pemeriksaan
1. Buka **MCU › Pemeriksaan Stasiun** (atau klik **Periksa** pada baris peserta di Peserta MCU).
2. Pilih **Tanggal**, cari peserta, lalu klik nama peserta di daftar sebelah kiri.
3. Klik tombol stasiun di bagian atas (mis. **Tanda Vital & Antropometri**), lalu isi formnya.
4. Klik **Simpan Draft** bila hasil belum lengkap, atau **Simpan & Selesai** bila stasiun sudah tuntas.
5. Untuk stasiun **Laboratorium**, hasil dari order laboratorium tampil otomatis. Klik **Muat ulang hasil** bila hasil baru masuk.

**Hasilnya:** tombol stasiun yang selesai berubah hijau dengan tanda centang, dan kolom **Progres** di Peserta MCU bertambah.

### Menyimpan kesimpulan dokter dan mencetak hasil
1. Di **MCU › Pemeriksaan Stasiun**, pilih peserta, lalu klik stasiun **Kesimpulan Dokter**.
2. Pilih **Fit**, **Fit dengan Catatan**, atau **Unfit**.
3. Isi **Catatan / temuan bermakna** dan **Saran / rekomendasi**. Keduanya wajib bila memilih Fit dengan Catatan atau Unfit.
4. Pilih **Dokter pemeriksa**, lalu klik **Simpan Kesimpulan**. Bila masih ada stasiun yang belum selesai, aplikasi meminta konfirmasi.
5. Klik **Laporan Hasil** untuk mencetak laporan, atau **Surat Keterangan** (hanya bila status sudah Selesai).

**Hasilnya:** status peserta menjadi **Selesai**. Untuk koreksi, klik **Buka Kembali**. Kesimpulan akan dihapus, dan tombol ini tidak bisa dipakai bila peserta sudah masuk invoice yang terbit atau sudah dibayar.

### Membatalkan atau menghapus peserta secara massal
1. Buka **MCU › Peserta MCU**, saring daftar dengan **Perusahaan**, **Tanggal mulai**/**Tanggal selesai**, atau **Status**, lalu klik **Cari**.
2. Centang peserta yang akan diproses. Untuk memilih melebihi satu halaman, centang semua baris di halaman lalu klik **Pilih semua … peserta sesuai filter**.
3. Klik **Batalkan Terpilih** untuk membatalkan, misalnya karena HRD mengirim revisi daftar. Klik **Hapus Permanen** bila peserta salah impor atau salah daftar.
4. Isi **Alasan**, lalu klik tombol konfirmasi.

**Hasilnya:** muncul ringkasan jumlah yang berhasil dan yang gagal beserta alasannya.
- **Batalkan**: peserta berstatus **Batal** tetapi tetap tercatat untuk audit, dan bisa didaftarkan atau diimpor ulang.
- **Hapus Permanen**: hanya berlaku untuk peserta yang belum diproses sama sekali. Peserta yang sudah diproses dilaporkan gagal, dan untuk mereka gunakan **Batalkan**.

Untuk membatalkan satu peserta saja, klik ikon tiga titik di baris peserta › **Batalkan**, isi **Alasan pembatalan**, lalu klik **Batalkan Peserta**.

### Membuat invoice korporasi dan mencatat pembayaran
1. Buka **MCU › Tagihan Korporasi**, klik **Buat Invoice**.
2. Pilih **Perusahaan**, **Periode mulai**, **Periode selesai**, dan **Jatuh tempo**. Isi **Catatan** bila perlu.
3. Daftar peserta perusahaan berstatus proses/selesai yang belum masuk invoice lain akan muncul. Centang peserta yang ditagihkan, lalu klik **Buat Invoice (Draft)**.
4. Klik **Detail** pada invoice. Periksa isinya, lalu klik **Terbitkan**.
5. Klik **Cetak Invoice**, atau **Invoice + Rekap HRD** untuk menyertakan lampiran rekap hasil.
6. Saat perusahaan membayar, buka **Detail**, klik **Catat Pembayaran**, isi **Tanggal bayar**, **Jumlah (Rp)**, **Metode**, dan **No. referensi / bukti**, lalu klik **Simpan Pembayaran**.

**Hasilnya:** status invoice berubah menjadi **Terbit**, lalu **Dibayar Sebagian** atau **Lunas**. Sisa tagihan tampil di detail invoice.

### Melihat laporan MCU dan rekap untuk HRD
1. Untuk rekap internal, buka **MCU › Laporan MCU**. Pilih **Tanggal mulai**, **Tanggal selesai**, **Perusahaan**, **Paket**, dan **Cara bayar**, lalu klik **Tampilkan**. Pilih tab **Per Perusahaan**, **Per Paket**, atau **Per Tanggal**, lalu klik **Unduh CSV** bila perlu.
2. Untuk laporan ke HRD, buka **MCU › Rekap Hasil (HRD)**. Pilih **Perusahaan** dan rentang tanggal, lalu klik **Tampilkan**.
3. Klik **Cetak PDF** atau **Ekspor Excel**.

**Hasilnya:** Laporan MCU menampilkan jumlah peserta, distribusi kesimpulan, dan pendapatan, termasuk korporasi yang belum ditagih. Rekap HRD menampilkan kesimpulan per karyawan, temuan abnormal utama, dan rekap per bagian.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Sudah terdaftar MCU pada tanggal … | Pasien yang sama sudah punya pendaftaran MCU di tanggal itu. | Periksa daftar Peserta MCU; jangan didaftarkan dua kali. |
| Pasien non-aktif tidak bisa didaftarkan MCU | Data pasien dinonaktifkan di Admisi. | Aktifkan dulu di **Admisi › Data Pasien**. |
| Maksimal 300 peserta per pendaftaran; gunakan impor Excel untuk rombongan besar | Terlalu banyak pasien dipilih di dialog Daftar Peserta. | Gunakan **Impor Excel**. |
| Kolom wajib tidak ditemukan: file harus memuat kolom nama dan no_identitas/NIK (atau no_rm) | Judul kolom di Excel tidak dikenali. | Pakai **Unduh Templat Excel** atau sesuaikan judul kolom. |
| Maksimal 1000 baris per impor | Berkas terlalu besar. | Pecah berkas menjadi beberapa bagian. |
| NIK (KTP) harus 16 digit angka | NIK salah ketik atau terpotong. | Perbaiki di Excel; ketik NIK sebagai teks. |
| NIK tersimpan sebagai angka di Excel — pastikan digit terakhir benar | Excel menyimpan NIK sebagai angka sehingga digit terakhir bisa berubah. | Ubah format kolom menjadi teks dan ketik ulang NIK. |
| Paket kosong dan paket bawaan belum dipilih | Kolom paket kosong dan dialog impor tidak menentukan paket bawaan. | Isi kolom paket atau pilih **Paket bawaan**. |
| Peserta MCU sudah selesai (kesimpulan terbit) dan tidak dapat dibatalkan | Kesimpulan sudah disimpan. | Buka kembali di stasiun Kesimpulan Dokter bila memang perlu koreksi. |
| Peserta sudah masuk invoice korporasi; batalkan invoice terlebih dahulu | Peserta sudah ditagihkan. | Batalkan invoice (bila belum ada pembayaran), lalu batalkan peserta. |
| Pembatalan tidak dapat dilakukan dari modul MCU — proses pengembalian dana (refund) … melalui Kasir | Tagihan perorangan sudah dibayar. | Proses refund/pembatalan transaksi di Kasir dulu. |
| Catatan atau saran wajib diisi untuk kesimpulan fit dengan catatan / unfit | Kolom catatan/saran kosong. | Isi **Catatan / temuan bermakna** atau **Saran / rekomendasi**. |
| Kode paket … sudah dipakai / Kode perusahaan … sudah dipakai | Kode ganda. | Gunakan kode lain. |
| Masa berlaku bertumpang tindih dengan kontrak lain untuk paket yang sama | Dua kontrak untuk paket yang sama berlaku di tanggal yang sama. | Ubah tanggal **Berlaku mulai**/**Berlaku sampai**. |
| Perusahaan masih memiliki … peserta MCU yang sedang berjalan | Perusahaan belum bisa dihapus. | Selesaikan atau batalkan pesertanya dulu. |
| Invoice sudah memiliki pembayaran; batalkan pembayaran terlebih dahulu | Invoice dengan pembayaran tidak bisa dibatalkan. | Batalkan pembayaran di **Riwayat Pembayaran**, lalu batalkan invoice. |
| No. referensi wajib diisi untuk pembayaran transfer/giro/cek | Nomor bukti belum diisi. | Isi **No. referensi / bukti**. |
| Jumlah melebihi sisa tagihan | Nominal lebih besar dari sisa. | Sesuaikan **Jumlah (Rp)**. |

## Pertanyaan yang sering diajukan
**Apa beda Batalkan dan Hapus Permanen?** Batalkan mengubah status menjadi Batal dan datanya tetap tercatat. Hapus Permanen menghilangkan peserta dari daftar dan laporan, dan hanya berlaku untuk peserta yang belum diproses sama sekali.

**HRD mengirim revisi daftar karyawan. Apa yang harus dilakukan?** Saring Peserta MCU per perusahaan dan tanggal, batalkan peserta yang tidak lagi ikut dengan **Batalkan Terpilih**, lalu impor ulang berkas revisinya. Peserta yang sudah terdaftar di tanggal yang sama akan ditandai sebagai ganda.

**Apakah impor Excel mengubah data pasien lama?** Tidak. Bila tanggal lahir atau data lain di berkas berbeda, aplikasi memberi peringatan dan data pasien di Admisi tidak diubah.

**Kenapa tombol Surat Keterangan tidak bisa diklik?** Surat keterangan hanya bisa dicetak setelah kesimpulan dokter disimpan (status Selesai).

**Kenapa harga peserta korporasi berbeda dengan harga paket?** Perusahaan tersebut punya harga kontrak yang berlaku pada tanggal MCU. Lihat tab **Harga Kontrak** di data perusahaan.

**Kolom LIS dan tombol Kirim ke LIS tidak ada. Kenapa?** Fitur bridging LIS belum aktif untuk faskes, atau peran Anda tidak punya izin KIRIM LIS.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul Medical Check Up (MCU)).
- Peran belum punya izin: admin › **Datamaster › Role** (modul MCU).
- Tombol tertentu tidak muncul (mis. **Impor Excel**, **Hapus Permanen**, **Catat Pembayaran**): peran belum memiliki aksi yang sesuai (IMPOR, HAPUS, PEMBAYARAN).

## Catatan untuk peninjau
- Fitur bridging LIS (Kirim ke LIS, Kirim Ulang yang Gagal, Ambil Hasil LIS, Cek Status di LIS, Tandai Belum Terdaftar) sengaja tidak dijabarkan langkah demi langkah karena bergantung pada fitur `lab_bridging_lis` dan integrasi adamLIS yang masih berjalan. Mohon putuskan apakah perlu bagian tersendiri.
- Aturan "Hapus Permanen" diambil dari teks dialog: peserta belum punya isian stasiun, order lab belum berisi hasil dan belum dikirim ke LIS, order radiologi belum diperiksa, belum masuk invoice, dan tagihan perorangan belum dibayar. Mohon dicek apakah perlu disederhanakan untuk petugas.
- Batal/hapus massal dibatasi 500 peserta sekali proses (`MAKS_MASSAL` di backend). Pesan galatnya: "Maksimal 500 peserta sekali proses — persempit filter (tanggal/perusahaan)". Belum dimasukkan ke tabel karena jarang terjadi.
- Alur pembayaran peserta **perorangan** (tagihan masuk Kasir) tidak dijelaskan di sini dan perlu dirujuk ke panduan Pembayaran.
