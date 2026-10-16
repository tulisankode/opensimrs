# Patologi Anatomi

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas patologi anatomi sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas administrasi dan analis laboratorium patologi anatomi (PA), dokter spesialis patologi anatomi (Sp.PA), admin data master PA
**Menu:** Penunjang › Patologi Anatomi › Order PA / Penerimaan Jaringan / Pemeriksaan & Diagnosis / Arsip Blok & Slide / Datamaster / Laporan
**Hak akses yang dibutuhkan:** Patologi Anatomi › Order PA (READ, CREATE, VALIDASI, BATAL, CETAK) · Patologi Anatomi › Penerimaan Jaringan (READ, TERIMA, TOLAK) · Patologi Anatomi › Pemeriksaan (READ, MAKROSKOPIS, MIKROSKOPIS, DIAGNOSIS, VERIFIKASI, CETAK HASIL) · Patologi Anatomi › Arsip Blok & Slide (READ, UPDATE, PINJAM) · Patologi Anatomi › Datamaster › Pemeriksaan PA / Template Laporan PA (READ, CREATE, UPDATE, DELETE) · Patologi Anatomi › Laporan PA › Kunjungan (READ, CETAK LAPORAN)

## Untuk apa
Modul Patologi Anatomi mencatat pemeriksaan histopatologi, sitologi, potong beku (frozen section), dan imunohistokimia (IHK). Alurnya dimulai dari order, lalu penerimaan jaringan dan pemberian Nomor PA, pengisian makroskopis, mikroskopis, dan diagnosis, verifikasi dokter Sp.PA, cetak laporan, sampai pengarsipan blok parafin dan slide.

Status order: **Order** → **Valid** → **Diproses** → **Selesai**. Order juga bisa berstatus **Spesimen Ditolak** atau **Batal**. Status kasus: **Menunggu Jaringan** → **Diterima** → **Diproses** → **Menunggu Verifikasi** → **Selesai**, atau **Ditolak**.

## Tugas sehari-hari

### Melihat order PA yang masuk
1. Buka **Penunjang › Patologi Anatomi › Order PA**.
2. Saring dengan **Cari** (nama, No. RM, No. Order, atau No. PA), **Tanggal mulai**/**Tanggal selesai**, serta pilihan **Status**, **Sumber**, dan **Jenis**. Klik **Reset** untuk mengosongkan saringan.
3. Klik baris order untuk melihat detail: data klinis, riwayat, lokasi/organ, cara pengambilan, daftar pemeriksaan beserta **No. PA**, **Tarif**, dan **Kesimpulan**.

**Hasilnya:** order tampil dengan status dan tanda **CITO** bila pemeriksaan segera.

### Membuat order APS atau rujukan luar
1. Di **Order PA**, klik **Order APS / Rujukan**.
2. Cari pasien di kolom **Pasien** (nama, No. RM, atau NIK; contoh NIK fiktif 9999…). Pasien baru harus didaftarkan dahulu di **Admisi**.
3. Isi **Dokter Pengirim (opsional)**. Untuk rujukan luar, isi **Dokter Perujuk** dan **Faskes Perujuk**.
4. Pilih **Pembayaran** (**Tunai**/**Asuransi**), centang **CITO (segera)** bila perlu, lalu pilih **Pemeriksaan**.
5. Isi **Lokasi / Organ Asal Jaringan**, **Cara Pengambilan**, **Data Klinis / Diagnosis Klinis**, **Riwayat Singkat**, dan **Catatan** (mis. nomor surat rujukan).
6. Klik **Buat Order**.

**Hasilnya:** order baru berstatus **Order** muncul di daftar.

### Memvalidasi order dan mengirim tagihan
1. Buka detail order berstatus **Order**.
2. Periksa pemeriksaan dan tarifnya, lalu klik **Validasi & Kirim Tagihan**. Order juga bisa divalidasi dengan tombol **Validasi** di **Penerimaan Jaringan** bila saringan **Termasuk order belum divalidasi** dicentang.
3. Klik **Cetak Bukti Order** bila diperlukan.

**Hasilnya:** status order menjadi **Valid** dan tagihan masuk ke menu **Pembayaran**.

### Menerima jaringan dan memberi Nomor PA
1. Buka **Penunjang › Patologi Anatomi › Penerimaan Jaringan**, lalu pilih **Menunggu jaringan**.
2. Pada baris kasus, klik **Terima**.
3. Di jendela **Terima Jaringan / Spesimen**, isi **Label Wadah**, lokasi anatomi/organ, **Lateralitas**, cara pengambilan, **Jumlah Wadah**, **Fiksasi**, **Waktu Pengambilan**, **Waktu Penerimaan**, **Kondisi Spesimen**, dan **Catatan**. Catatan wajib diisi bila jaringan histopatologi tidak difiksasi formalin 10%.
4. Klik **Terima & Beri Nomor PA**.
5. Klik **Cetak Label Wadah** untuk mencetak label, lalu **Tutup**.

**Hasilnya:** kasus mendapat **Nomor PA** dan pindah ke **Sudah diterima**. Kasus ini juga muncul di **Pemeriksaan & Diagnosis**.

### Menolak spesimen yang tidak layak
1. Di **Penerimaan Jaringan**, klik **Tolak** pada kasus yang masih menunggu.
2. Isi **Alasan penolakan** beserta tindak lanjutnya (mis. minta kirim ulang), lalu klik **Tolak Spesimen**.

**Hasilnya:** kasus berstatus **Ditolak**. Spesimen dapat dikirim ulang dan diterima kembali dari daftar yang sama. Tagihan tidak berubah, jadi batalkan order bila pemeriksaan tidak dilanjutkan.

### Mengisi makroskopis, mikroskopis, dan diagnosis
1. Buka **Penunjang › Patologi Anatomi › Pemeriksaan & Diagnosis**. Saring dengan status (**Dalam proses**, **Menunggu verifikasi**, **Selesai**), **Hanya CITO**, atau **Melewati target (TAT)**.
2. Klik **Proses** pada kasus.
3. Pilih **Template laporan (kasus normal/umum)** bila ada, lalu sesuaikan isinya.
4. **1. Makroskopis**: isi **Deskripsi makroskopis**, **Jumlah blok / kaset**, **Jumlah slide**, dan **Petugas makroskopis**. Tambahkan foto makroskopis bila perlu (maksimal 4). Klik **Simpan Makroskopis**.
5. **2. Mikroskopis**: isi **Deskripsi mikroskopis**, lalu klik **Simpan Mikroskopis**.
6. **3. Kesimpulan / Diagnosis**: isi **Kesimpulan / diagnosis (dicetak tebal)**, kode **ICD-O Topografi**, **ICD-O Morfologi**, **ICD-10**, **Komentar / saran**, dan pilih **Dokter Spesialis Patologi Anatomi**. Klik **Simpan Diagnosis (Draft)**.
7. Klik **Label Kaset/Slide** untuk mencetak label, atau **Pratinjau Draft** untuk melihat rancangan laporan.

**Hasilnya:** kasus berstatus **Menunggu Verifikasi**. Blok dan slide otomatis tercatat di **Arsip Blok & Slide** sesuai jumlah yang diisi.

### Memverifikasi dan mencetak laporan
1. Dokter Sp.PA membuka kasus berstatus **Menunggu Verifikasi** dengan tombol **Verifikasi**.
2. Periksa isian, lalu klik **Verifikasi Sp.PA & Selesai**.
3. Klik **Cetak Laporan** di jendela kasus, atau **Cetak** pada baris kasus. Hasil juga bisa dicetak dari **Order PA › Cetak Hasil**.

**Hasilnya:** kasus berstatus **Selesai** dan laporan siap dicetak.

### Merevisi laporan (addendum)
1. Buka kasus yang sudah **Selesai**, lalu klik **Revisi / Addendum**.
2. Isi **Alasan revisi** (mis. ada informasi tambahan dari IHK), lalu klik **Buka Revisi**.
3. Perbaiki isian, simpan, lalu verifikasi ulang dengan **Verifikasi Sp.PA & Selesai**.

**Hasilnya:** laporan kembali ke draft dan wajib diverifikasi ulang. Cetakan berikutnya ditandai sebagai revisi.

### Mengelola arsip blok dan slide
1. Buka **Penunjang › Patologi Anatomi › Arsip Blok & Slide**. Saring dengan **Blok parafin**, **Slide**, **Sedang dipinjam**, **Lewat rencana kembali**, atau **Belum ada lokasi rak**.
2. Untuk mengisi lokasi penyimpanan, centang beberapa baris, klik **Lokasi Rak (n)**, isi lokasinya (mis. Lemari B · Rak 03 · Laci 2), lalu klik **Simpan**.
3. Klik **Label (n)** untuk mencetak label baris yang dicentang.
4. Untuk peminjaman, klik **Pinjam**, isi **Peminjam**, **Instansi tujuan**, **Keperluan**, **Rencana kembali**, dan **Catatan**, lalu klik **Catat Peminjaman**.
5. Saat blok/slide dikembalikan, klik **Kembali**, isi **Kondisi saat kembali**, lalu klik **Terima Kembali**.
6. Untuk menambah blok/slide di luar jumlah otomatis (mis. potong ulang), klik **Blok/Slide** (berikon +), isi **Nomor PA**, **Jenis**, **Kode (opsional)**, dan **Pewarnaan**, lalu klik **Simpan**.

**Hasilnya:** posisi dan riwayat peminjaman setiap blok/slide tercatat. Riwayat bisa dilihat lewat ikon jam pada baris.

### Membatalkan order
1. Buka detail order, lalu klik **Batalkan**.
2. Isi **Alasan pembatalan**, lalu klik **Batalkan Order**.

**Hasilnya:** order berstatus **Batal** dan item tagihannya dihapus dari **Pembayaran**. Order yang jaringannya sudah diterima atau diproses tidak dapat dibatalkan.

### Mengelola data master dan melihat laporan
1. **Datamaster › Pemeriksaan PA**:
   - Tab **Pemeriksaan**: isi **Kode**, **Jenis**, **Nama Pemeriksaan**, **Kategori**, **Kode ICD-9-CM**, **Tarif (Rp)**, **Target selesai / TAT (hari)**, **Keterangan**, dan **Status**.
   - Tab **Petugas**: daftar dokter Sp.PA dan petugas dengan **Peran**, **Nama & gelar**, dan **No. SIP** (dicetak di laporan).
2. **Datamaster › Template Laporan**: teks makroskopis, mikroskopis, kesimpulan, dan kode untuk kasus normal/umum. Template bisa berlaku untuk satu pemeriksaan, satu jenis pemeriksaan, atau semua pemeriksaan (**Umum**).
3. **Laporan › Kunjungan PA**: isi **Tanggal mulai** dan **Tanggal selesai**, lalu klik **Tampilkan**. Laporan menampilkan rekap per jenis, sumber, diagnosis terbanyak, beban kerja dokter, organ, pemeriksaan, dan hari. Klik **Excel** untuk mengunduh.

**Hasilnya:** data master langsung dipakai saat order dan pemeriksaan, dan laporan terunduh dalam format Excel.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Order belum divalidasi | Jaringan diterima sebelum order divalidasi. | Validasi order di **Order PA** atau dengan tombol **Validasi** di **Penerimaan Jaringan**. |
| Order sudah dibatalkan | Order berstatus Batal. | Buat order baru bila pemeriksaan tetap diperlukan. |
| Jaringan histopatologi tidak difiksasi formalin 10%: jelaskan di catatan | Fiksasi tidak standar dan **Catatan** kosong. | Isi alasannya di kolom **Catatan**. |
| Spesimen kasus ini sudah diterima (…) | Kasus sudah diterima sebelumnya. | Muat ulang daftar dan cek di **Sudah diterima**. |
| Spesimen yang sudah diterima tidak dapat ditolak | Penolakan dilakukan setelah jaringan diterima. | Hubungi dokter Sp.PA atau kepala instalasi untuk tindak lanjut. |
| Jaringan belum diterima | Pemeriksaan diisi sebelum jaringan diterima. | Terima jaringan dulu di **Penerimaan Jaringan**. |
| Laporan sudah diverifikasi; buka revisi terlebih dahulu | Kasus sudah selesai saat isiannya diubah. | Klik **Revisi / Addendum**. |
| Mikroskopis dan diagnosis wajib diisi sebelum verifikasi | Isian belum lengkap. | Lengkapi dan simpan bagian mikroskopis dan diagnosis. |
| Kode ICD-O topografi harus berformat Cxx.x (mis. C50.9) / Kode ICD-O morfologi harus berformat 9999/9 (mis. 8500/3) | Format kode salah. | Perbaiki penulisan kode sesuai contoh. |
| Kode ICD-10 … tidak ditemukan | Kode ICD-10 tidak ada di referensi. | Pilih kode dari daftar pencarian. |
| Dokter Sp.PA tidak ditemukan / tidak aktif … | Dokter yang dipilih tidak terdaftar sebagai petugas. | Admin menambahkan dokter di **Datamaster › Pemeriksaan PA › Petugas**. |
| Jaringan sudah diterima/diproses, order tidak dapat dibatalkan | Pemeriksaan sudah berjalan. | Order tidak bisa dibatalkan. Hubungi kepala instalasi. |
| Blok/slide sedang dipinjam / … tidak sedang dipinjam | Status peminjaman tidak sesuai dengan tombol yang dipakai. | Muat ulang daftar dan cek status blok/slide. |
| Kode pemeriksaan … sudah dipakai / Kode … sudah dipakai | Kode sudah ada. | Pakai kode lain. |

## Pertanyaan yang sering diajukan
**Kapan Nomor PA keluar?** Saat jaringan diterima dengan tombol **Terima & Beri Nomor PA**.

**Apakah blok dan slide harus dicatat manual ke arsip?** Tidak. Arsip dibuat otomatis dari **Jumlah blok / kaset** dan **Jumlah slide** di bagian makroskopis. Tambahan manual hanya untuk kasus khusus, mis. potong ulang.

**Spesimen ditolak, apakah tagihannya hilang?** Tidak. Tagihan tetap ada. Batalkan order bila pemeriksaan tidak dilanjutkan.

**Tombol Proses tidak ada, hanya Lihat?** Peran Anda belum memiliki izin MAKROSKOPIS, MIKROSKOPIS, DIAGNOSIS, atau VERIFIKASI. Hubungi admin.

**Kasus mana yang terlambat?** Centang **Melewati target (TAT)** di **Pemeriksaan & Diagnosis**. Target dihitung dari **Target selesai / TAT (hari)** di data master pemeriksaan.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**.
- Peran belum punya izin: admin › **Datamaster › Role**.
- Menu Patologi Anatomi ada di dalam menu **Penunjang**. Pada layar sempit, menu bisa berpindah ke tombol **Lainnya**.
- Tab **Order Patologi Anatomi** di RME hanya muncul bila modul Patologi Anatomi aktif.

## Catatan untuk peninjau
- Nama menu di sidebar adalah **Template Laporan**, sedangkan judul halaman dan nama izinnya **Template Laporan PA**.
- Pesan galat backend menyebut "Datamaster › Pemeriksaan PA › Petugas". Di layar, petugas diatur pada tab **Petugas** di halaman **Pemeriksaan PA**. Mohon dicek apakah penamaan tab sudah sesuai.
- Isi pilihan **Fiksasi**, **Lateralitas**, dan **Keperluan** pinjam tidak dituliskan lengkap. Daftarnya diambil dari kode dan sebaiknya disesuaikan dengan layar.
- Alur order IHK lanjutan dari kasus induk (blok dari kasus sebelumnya) ada di backend, tetapi langkahnya tidak dijelaskan di panduan ini.
- Langkah order PA dari RME (tab **Penunjang › Order Patologi Anatomi**) tidak dirinci di sini.
