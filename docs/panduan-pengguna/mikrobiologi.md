# Mikrobiologi

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas laboratorium mikrobiologi sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas administrasi dan analis laboratorium mikrobiologi, dokter spesialis mikrobiologi klinik (Sp.MK), admin data master mikrobiologi
**Menu:** Penunjang › Mikrobiologi › Order Mikrobiologi / Pemeriksaan & Hasil / Datamaster / Laporan
**Hak akses yang dibutuhkan:** Mikrobiologi › Order Mikrobiologi (READ, CREATE, VALIDASI, BATAL, CETAK) · Mikrobiologi › Pemeriksaan (READ, INPUT HASIL, LAPORAN SEMENTARA, VERIFIKASI, CETAK HASIL) · Mikrobiologi › Datamaster › Pemeriksaan Mikrobiologi / Organisme / Antibiotik (READ, CREATE, UPDATE, DELETE) · Mikrobiologi › Laporan Mikrobiologi › Kunjungan / Antibiogram (READ, CETAK LAPORAN) · Mikrobiologi › Konfigurasi LIS Mikrobiologi / Mapping LIS Mikrobiologi (LIHAT, KELOLA) · Mikrobiologi › Pengiriman LIS Mikrobiologi (LIHAT, KIRIM ULANG, CEK STATUS) — khusus faskes yang mengaktifkan fitur **Bridging LIS Mikrobiologi**

## Untuk apa
Modul Mikrobiologi mencatat pemeriksaan mikrobiologi dari order sampai hasil final. Alurnya mencakup penerimaan spesimen, pewarnaan, kultur, identifikasi organisme, uji kepekaan antibiotik (S/I/R), laporan sementara, dan verifikasi dokter. Modul ini juga menyusun laporan kunjungan dan antibiogram.

Status order: **Order** → **Valid** → **Diproses** → **Selesai**, atau **Batal**. Status tiap pemeriksaan: **Menunggu Spesimen** → **Spesimen Diterima** → **Diproses** → **Laporan Sementara** → **Final**, atau **Spesimen Ditolak**.

## Tugas sehari-hari

### Melihat order mikrobiologi yang masuk
1. Buka **Penunjang › Mikrobiologi › Order Mikrobiologi**.
2. Saring dengan **Cari** (nama, No. RM, atau No. Order), **Tanggal mulai**/**Tanggal selesai**, serta pilihan **Status** dan **Sumber**. Klik **Reset** untuk mengosongkan saringan.
3. Klik baris order untuk melihat detail: keterangan klinis, antibiotik yang sedang diberikan, daftar pemeriksaan beserta **Spesimen**, **No. Mikro**, **Tarif**, dan **Organisme**.

**Hasilnya:** order tampil dengan status dan tanda **CITO** bila pemeriksaan segera.

### Membuat order APS atau rujukan luar
1. Di **Order Mikrobiologi**, klik **Order APS**.
2. Cari pasien di kolom **Pasien** (nama, No. RM, atau NIK; contoh NIK fiktif 9999…). Pasien baru harus didaftarkan dahulu di **Admisi**.
3. Centang **CITO (segera)** bila perlu. Di **Pemeriksaan & Spesimen**, pilih pemeriksaan dan jenis spesimennya.
4. Isi **Dokter Pengirim (opsional)**, **Pembayaran** (**Tunai**/**Asuransi**), **Keterangan Klinis / Diagnosis**, **Antibiotik yang Sedang Diberikan**, dan **Catatan** (mis. nomor surat rujukan).
5. Klik **Buat Order**.

**Hasilnya:** order baru berstatus **Order** muncul di daftar.

### Memvalidasi order dan mengirim tagihan
1. Buka detail order berstatus **Order**.
2. Periksa pemeriksaan dan tarifnya, lalu klik **Validasi & Kirim Tagihan**.
3. Klik **Cetak Bukti Order** bila diperlukan.
4. Klik **Ke Pemeriksaan** untuk langsung membuka daftar pemeriksaan.

**Hasilnya:** status order menjadi **Valid** dan tagihan masuk ke menu **Pembayaran**.

### Menerima atau menolak spesimen
1. Buka **Penunjang › Mikrobiologi › Pemeriksaan & Hasil**, lalu klik baris pemeriksaan. Saringan **Status**, **Spesimen**, dan **Hanya CITO** bisa dipakai bila perlu.
2. Di bagian **1. Penerimaan**, isi **Waktu pengambilan**, **Waktu diterima lab**, **Diambil oleh**, **Sumber / lokasi**, **Volume / jumlah**, **Wadah**, dan **Kualitas spesimen**.
3. Klik **Terima Spesimen**.
4. Bila spesimen tidak layak, isi **Alasan penolakan** beserta tindak lanjutnya (mis. minta pengambilan ulang), lalu klik **Tolak Spesimen**.

**Hasilnya:** spesimen diterima dan mendapat **No. Mikro**, atau berstatus **Spesimen Ditolak**. Riwayatnya tampil di **Riwayat Spesimen**.

### Mencatat pewarnaan dan kultur
1. Di jendela pemeriksaan, buka **2. Pewarnaan**. Pilih **Jenis pewarnaan**, **Leukosit (PMN)**, dan **Sel epitel skuamosa**.
2. Untuk pewarnaan Gram, klik **Temuan** lalu isi **Jumlah**, **Bentuk**, **Sifat Gram**, dan **Susunan**. Isi juga **Keterangan / hasil mikroskopis**.
3. Buka **3. Kultur**. Pilih **Hasil kultur** (**Dalam proses inkubasi**, **Tidak tumbuh**, **Tumbuh**, **Kontaminan**, atau **Flora normal**), lalu isi **Mulai inkubasi**, **Media**, dan **Keterangan kultur**.
4. Klik **Simpan**. Tanda **● Ada perubahan belum disimpan** muncul bila ada isian yang belum disimpan.

**Hasilnya:** status pemeriksaan menjadi **Diproses**.

### Mencatat isolat dan uji kepekaan antibiotik
1. Buka **4. Isolat & Uji Kepekaan**, lalu klik **Tambah Isolat**.
2. Pilih organisme dan isi **Jumlah koloni** (mis. ≥10^5 CFU/mL). Pilih **Penanda resistensi** (mis. ESBL, MRSA) bila ada, dan tambahkan catatan isolat bila perlu.
3. Di **Uji Kepekaan Antibiotik**, klik **Isi panel standar** untuk memunculkan antibiotik sesuai kelompok organisme, atau tambahkan antibiotik lain.
4. Isi **MIC (µg/mL)** atau **Zona (mm)**, lalu **Interpretasi** (S, I, atau R). Centang **Lapor** untuk antibiotik yang ditampilkan di cetakan hasil.
5. Klik **Simpan**. Baris tanpa MIC, zona, dan interpretasi tidak ikut disimpan.

**Hasilnya:** isolat dan hasil uji kepekaan tersimpan pada pemeriksaan.

### Menerbitkan laporan sementara
1. Buka **5. Laporan**. Klik **Susun otomatis** untuk menyusun teks laporan sementara dari isian sebelumnya, lalu sesuaikan bila perlu.
2. Klik **Terbitkan Laporan Sementara**.
3. Klik **Cetak** untuk mencetak laporan sementara.

**Hasilnya:** status pemeriksaan menjadi **Laporan Sementara**, sehingga dokter pengirim bisa menerima informasi awal sebelum hasil final.

### Memverifikasi hasil final dan mencetak
1. Di **5. Laporan**, isi **Kesimpulan / interpretasi klinis** dan **Catatan / saran**. Untuk pemeriksaan tanpa kultur, isi **Hasil pemeriksaan**.
2. Pilih **Dokter pemverifikasi (Sp.MK)**, lalu klik **Verifikasi & Final**.
3. Klik **Cetak** di jendela pemeriksaan, atau **Cetak Hasil** di detail order.

**Hasilnya:** hasil berstatus **Final** dan tidak bisa diubah lagi. Bila perlu revisi, klik **Buka Verifikasi**, isi **Alasan revisi**, lalu klik **Buka Verifikasi** sekali lagi. Hasil kembali ke status sebelumnya dan alasannya dicatat.

### Membatalkan order
1. Buka detail order, lalu klik **Batalkan**.
2. Isi **Alasan pembatalan**, lalu klik **Batalkan Order**.

**Hasilnya:** order berstatus **Batal** dan item tagihannya dihapus dari **Pembayaran**. Order yang spesimennya sudah diterima atau diproses tidak dapat dibatalkan.

### Mengelola data master dan melihat laporan
1. **Datamaster › Pemeriksaan**: klik **Pemeriksaan** (berikon +), isi **Kode**, **Jenis**, **Nama Pemeriksaan**, jenis spesimen yang diterima, tahapan hasil (**Pewarnaan / Sediaan Langsung**, **Kultur & Identifikasi**, **Uji Kepekaan Antibiotik (AST)**), **Metode**, **Tarif (Rp)**, **TAT (hari)**, dan **Status**. Tahapan menentukan bagian form hasil yang muncul.
2. **Datamaster › Organisme**: klik **Organisme** (berikon +), isi **Kode**, **Kode WHONET (opsional)**, **Nama Organisme**, **Sifat Gram**, **Bentuk**, dan **Kelompok (Panel Antibiotik)**.
3. **Datamaster › Antibiotik**: klik **Antibiotik** (berikon +), isi **Kode (WHONET)**, **Nama Antibiotik**, **Golongan / Kelas**, **Potensi Disk**, **Standar**, dan breakpoint bila ada. Atur isi panel per kelompok organisme di **Panel per Kelompok Organisme**, lalu klik **Simpan Panel**.
4. **Laporan › Kunjungan**: isi tanggal, klik **Tampilkan**, lalu **Excel** untuk mengunduh.
5. **Laporan › Antibiogram**: isi **Tanggal mulai** dan **Tanggal selesai**, pilih spesimen bila perlu, centang **Semua isolat (bukan hanya isolat pertama)** bila diinginkan, lalu klik **Tampilkan**. Klik **Cetak** atau **Excel** untuk menyimpan hasilnya.

**Hasilnya:** data master langsung dipakai di form pemeriksaan. Antibiogram disusun dari isolat yang hasilnya sudah final.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Jenis spesimen untuk … wajib dipilih | Order dibuat tanpa memilih spesimen. | Pilih jenis spesimen untuk setiap pemeriksaan. |
| Order belum divalidasi | Spesimen diterima sebelum order divalidasi. | Klik **Validasi & Kirim Tagihan** di detail order. |
| Order sudah dibatalkan | Order berstatus Batal. | Buat order baru bila pemeriksaan tetap diperlukan. |
| Spesimen sudah diterima (status …) | Spesimen sudah diterima sebelumnya. | Muat ulang data pemeriksaan. |
| Spesimen berstatus …, tidak dapat ditolak | Spesimen sudah diproses. | Hubungi dokter Sp.MK atau kepala instalasi untuk tindak lanjut. |
| Spesimen belum diterima | Hasil diisi sebelum spesimen diterima. | Terima spesimen di **1. Penerimaan**. |
| Hasil sudah final; buka verifikasi untuk merevisi | Hasil final diubah. | Klik **Buka Verifikasi** dan isi alasannya. |
| Setiap temuan Gram wajib berisi sifat atau bentuk | Ada baris temuan Gram yang kosong. | Lengkapi atau hapus baris tersebut. |
| Interpretasi … harus S, I, atau R | Interpretasi uji kepekaan tidak valid. | Pilih S, I, atau R. |
| Item berstatus …, laporan sementara tidak dapat diterbitkan / belum dapat diverifikasi | Tahapan pemeriksaan belum sesuai. | Simpan isian hasil dulu, lalu ulangi. |
| Dokter pemverifikasi tidak ditemukan | Dokter yang dipilih tidak valid. | Pilih dokter lain atau hubungi admin. |
| Spesimen sudah diterima/diproses, order tidak dapat dibatalkan | Pemeriksaan sudah berjalan. | Order tidak bisa dibatalkan. Hubungi kepala instalasi. |
| Breakpoint zona: nilai R harus lebih kecil dari S / Breakpoint MIC: nilai R harus lebih besar dari S | Batas breakpoint antibiotik terbalik. | Perbaiki nilai breakpoint di data master. |
| Kode … sudah dipakai | Kode data master sudah ada. | Pakai kode lain. |

## Pertanyaan yang sering diajukan
**Kenapa bagian Kultur atau Uji Kepekaan tidak muncul?** Bagian form mengikuti tahapan yang dicentang pada data master pemeriksaan. Minta admin memeriksa **Datamaster › Pemeriksaan**.

**Daftar antibiotik di uji kepekaan kosong saat Isi panel standar diklik?** Organisme belum punya kelompok, atau panel kelompoknya belum diisi. Atur di **Datamaster › Organisme** dan **Datamaster › Antibiotik**.

**Apa beda laporan sementara dan final?** Laporan sementara bisa diterbitkan selama pemeriksaan berjalan, mis. hasil pewarnaan sebelum kultur selesai. Hasil final sudah diverifikasi dokter dan dikunci.

**Kenapa isolat tidak masuk antibiogram?** Antibiogram hanya menghitung isolat dengan hasil final pada periode dan saringan yang dipilih. Secara bawaan, hanya isolat pertama yang dihitung.

**Apakah hasil mikrobiologi bisa diambil dari alat/LIS?** Bisa, bila faskes mengaktifkan fitur **Bridging LIS Mikrobiologi** (lihat bagian [Bridging LIS Mikrobiologi](#bridging-lis-mikrobiologi) di bawah). Tanpa fitur ini, hasil tetap diisi manual seperti biasa.

## Bridging LIS Mikrobiologi
Fitur opsional per faskes (superadmin mengaktifkannya di **Setting › Manajemen Modul** untuk modul Mikrobiologi) yang mengirim order ke LIS mikrobiologi dan menerima kembali hasil identifikasi organisme serta uji kepekaan antibiotik secara otomatis, tanpa input ulang.

### Menyiapkan koneksi & mapping (admin/IT)
1. Buka **Setting › Konfigurasi Integrasi › LIS › Mikrobiologi** (kartu **Konfigurasi LIS Mikrobiologi**). Tambah koneksi: **Nama**, **Kode RS**, **URL Registrasi**, **URL Ambil Hasil** (boleh memuat `{no_registrasi}`), **API Key**, batas paralel, dan jeda. Faskes boleh memiliki lebih dari satu koneksi; satu ditandai **Bawaan**.
2. Klik **Kunci Masuk Baru** untuk membuat kunci yang dipasang di sisi LIS sebagai kredensial pengiriman hasil (`x-api-key`). Kunci hanya ditampilkan utuh sekali.
3. Klik **Uji koneksi** untuk memastikan URL Registrasi dapat dihubungi.
4. Buka **Mikrobiologi › Mapping LIS** dan lengkapi kode LIS untuk **Pemeriksaan**, **Jenis Spesimen**, **Organisme**, **Antibiotik**, serta **Unit, Dokter & Penjamin**. Gunakan saringan **Belum dipetakan** pada tiap tab untuk melengkapi mapping yang kosong. Kode WHONET organisme (bila diisi) terpisah dari kode LIS vendor.

### Mengirim order & memantau kiriman
1. Pada order mikrobiologi yang siap divalidasi, pilih **Validasi & Kirim ke LIS Mikrobiologi** (bukan **Validasi Saja**) bila ingin order langsung terkirim.
2. Bila pengiriman gagal (koneksi nonaktif, pemeriksaan belum dipetakan, atau LIS menolak), validasi ikut dibatalkan dan sistem menampilkan penyebabnya — order tetap berstatus **Order**, siap diperbaiki dan dicoba lagi.
3. Pantau status di **Setting › Konfigurasi Integrasi › LIS › Mikrobiologi** (kartu **Pengiriman LIS Mikrobiologi**): **Terkirim**, **Gagal**, **Sedang dikirim**, atau **Tidak pasti**. Order **Tidak pasti** sebaiknya dicek dulu lewat **Cek Status** sebelum memilih **Kirim Ulang**, agar tidak terdaftar dobel di LIS.

### Menerima hasil
- Hasil normalnya masuk otomatis (LIS mengirim/push ke SIMRS). Bila belum masuk, petugas dapat menekan **Ambil Hasil LIS** di halaman **Pemeriksaan & Hasil** untuk menariknya secara manual.
- Laporan sementara dari LIS langsung tampil berlabel **Laporan Sementara** begitu diterima, termasuk untuk dokter pengirim.
- Isolat jamak (polimikrobial) dari satu spesimen tersimpan sebagai beberapa baris isolat, masing-masing dengan kepekaan antibiotiknya sendiri.
- Organisme atau antibiotik yang belum dipetakan tetap tersimpan dan ditandai **Tidak cocok dengan item** — lengkapi mapping lalu minta LIS mengirim ulang, atau koreksi manual bila diperlukan.
- Hasil final dari LIS tetap menunggu pemeriksaan dan **verifikasi Sp.MK** seperti alur manual; hasil yang sudah diverifikasi tidak tertimpa otomatis oleh kiriman LIS berikutnya — gunakan **Buka Verifikasi** lebih dulu bila LIS mengirim koreksi.
- Hasil S/I/R yang masuk lewat bridging otomatis ikut terhitung di laporan **Antibiogram** tanpa langkah tambahan.

### Menguji tanpa LIS sungguhan
Gunakan server tiruan `scripts/lis-tiruan-mikro.mjs` (lihat `scripts/README-lis-tiruan-mikro.md`) untuk mensimulasikan registrasi, laporan sementara, hasil final, isolat ganda, dan antibiotik tak dikenal pada lingkungan pengembangan.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**.
- Peran belum punya izin: admin › **Datamaster › Role**.
- Menu Mikrobiologi ada di dalam menu **Penunjang**, pada submenu **Laboratorium** bersama **Patologi Klinik** dan **Patologi Anatomi**. Pada layar sempit, menu bisa berpindah ke tombol **Lainnya**.
- Tab **Order Mikrobiologi** di RME hanya muncul bila modul Mikrobiologi aktif.
- Tombol tambah data master hanya muncul bila peran memiliki izin CREATE.
- Menu **Mikrobiologi › Mapping LIS** serta **Konfigurasi LIS Mikrobiologi**/**Pengiriman LIS Mikrobiologi** di Setting hanya tampil bila fitur **Bridging LIS Mikrobiologi** (`mikro_bridging_lis`) aktif untuk faskes.

## Catatan untuk peninjau
- Bagian Bridging LIS Mikrobiologi ditambahkan bersamaan dengan fiturnya (STD-0014); mohon tinjau ulang istilah dan langkah setelah pengujian end-to-end dengan `scripts/lis-tiruan-mikro.mjs`.
- Panduan tidak menyebut nilai breakpoint atau standar tertentu. Isian data master antibiotik menjadi tanggung jawab faskes.
- Tidak dipastikan apakah **No. Mikro** terbit saat spesimen diterima atau saat order divalidasi. Panduan menulis "saat diterima".
- Isi pilihan **Status**/**Sumber** di toolbar dan skala **Leukosit (PMN)** tidak dituliskan. Mohon disesuaikan dengan layar.
- Langkah order mikrobiologi dari RME (tab **Penunjang › Order Mikrobiologi**) tidak dirinci di sini.
