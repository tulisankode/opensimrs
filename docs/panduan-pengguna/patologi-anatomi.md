# Patologi Anatomi

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas patologi anatomi sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas administrasi dan analis laboratorium patologi anatomi (PA), dokter spesialis patologi anatomi (Sp.PA), admin data master PA, admin/IT faskes (bridging LIS PA)
**Menu:** Penunjang › Patologi Anatomi › Order PA / Penerimaan Jaringan / Pemeriksaan & Diagnosis / Arsip Blok & Slide / Mapping LIS PA / Datamaster / Laporan
**Hak akses yang dibutuhkan:** Patologi Anatomi › Order PA (READ, CREATE, VALIDASI, BATAL, CETAK) · Patologi Anatomi › Penerimaan Jaringan (READ, TERIMA, TOLAK) · Patologi Anatomi › Pemeriksaan (READ, MAKROSKOPIS, MIKROSKOPIS, DIAGNOSIS, VERIFIKASI, CETAK HASIL) · Patologi Anatomi › Arsip Blok & Slide (READ, UPDATE, PINJAM) · Patologi Anatomi › Datamaster › Pemeriksaan PA / Template Laporan PA (READ, CREATE, UPDATE, DELETE) · Patologi Anatomi › Laporan PA › Kunjungan (READ, CETAK LAPORAN) · Setting › Konfigurasi Integrasi (UPDATE KONFIGURASI LAINNYA) untuk koneksi & pengiriman LIS PA

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
2. Periksa pemeriksaan dan tarifnya, lalu klik **Validasi & Kirim Tagihan**. Di jendela **Validasi Order PA**, pilih salah satu:
   - **Validasi Saja**: order divalidasi tanpa dikirim ke sistem PA.
   - **Validasi & Kirim ke LIS PA**: hanya muncul bila fitur **Bridging LIS Patologi Anatomi** aktif. Bila koneksi LIS PA lebih dari satu, pilih tujuannya di **Kirim ke LIS PA**.
3. Klik **Cetak Bukti Order** bila diperlukan.

**Hasilnya:** status order menjadi **Valid** dan tagihan masuk ke menu **Pembayaran**. Bila dikirim ke LIS PA, setiap kasus (pemeriksaan) pada order mendapat nomor registrasi penghubung; bila pengiriman salah satu kasus gagal, validasi dibatalkan dan penyebabnya ditampilkan. Order juga bisa divalidasi tanpa pilihan kirim dengan tombol **Validasi** di **Penerimaan Jaringan** bila saringan **Termasuk order belum divalidasi** dicentang.

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

### Mengatur koneksi dan mapping LIS PA (bridging)
Bagian ini hanya muncul bila fitur **Bridging LIS Patologi Anatomi** aktif (Manajemen Modul, modul Patologi Anatomi).
1. Admin membuka **Setting › Konfigurasi Integrasi › Konfigurasi LIS PA**, menambahkan koneksi (**Nama**, **Kode RS di sistem PA**, **URL Registrasi**, **URL Ambil Hasil**, **URL Laporan/Viewer Slide** opsional, **API Key**), menandai satu koneksi sebagai **Koneksi Bawaan**, lalu klik **Uji Koneksi**.
2. Klik **Kunci Masuk Baru** untuk mendapatkan alamat penerima hasil (`.../adam-pa-lis/bridging?key=...`) yang dipasang di sistem PA tujuan sebagai URL pengembalian hasil. Kunci hanya ditampilkan sekali.
3. Buka **Penunjang › Patologi Anatomi › Mapping LIS PA**, pilih **Koneksi**, lalu isi tab **Pemeriksaan** (kode pemeriksaan di sistem PA), **Unit, Dokter & Penjamin**, dan **Field Hasil** (nama field pada payload hasil vendor, bila berbeda dari nama field SIMRS). Klik **Simpan** pada tiap tab.

**Hasilnya:** kasus yang dikirim memakai kode yang dikenal sistem PA tujuan, dan hasil yang diterima terpetakan ke field laporan yang benar.

### Mengirim ke LIS PA dan menerima hasil
1. Kirim kasus lewat **Validasi & Kirim ke LIS PA** (lihat bagian memvalidasi order). Status pengiriman tiap kasus (**Terkirim**, **Gagal**, **Tidak pasti**) dapat dipantau di **Setting › Konfigurasi Integrasi › Pengiriman LIS PA**, beserta **Kirim Ulang**/**Kirim Lagi** dan **Cek Status**.
2. Di **Pemeriksaan & Diagnosis**, buka kasus yang sudah terkirim, lalu klik **Ambil Hasil LIS PA** untuk menarik hasil secara manual. Sistem PA juga dapat mengirim hasil langsung (push) ke alamat penerima koneksi tanpa perlu ditarik.
3. Diagnosis, laporan, dan status kasus dari sistem PA otomatis masuk ke laporan PA dan rekam medis sesuai izin akses. Laporan yang belum diverifikasi Sp.PA tidak ditampilkan sebagai diagnosis final.
4. Bila sistem PA mengirim **addendum** (laporan tambahan/revisi dengan nomor registrasi yang sama), addendum tersimpan sebagai versi baru dan tampil pada **Riwayat Laporan / Addendum** di kasus terkait — laporan versi sebelumnya tetap dapat dibaca.
5. Bila sistem PA menolak spesimen setelah jaringan diterima di SIMRS, kasus menampilkan **Spesimen ditolak oleh sistem PA tujuan** beserta alasannya. Penolakan ini terpisah dari penolakan manual di **Penerimaan Jaringan** dan tidak menghapus riwayat penerimaan jaringan atau Nomor PA internal.

**Hasilnya:** diagnosis dan status dari sistem PA tersinkron ke SIMRS tanpa input ulang, dan pengiriman ulang pada kasus yang sama tidak membuat kasus ganda di sistem PA tujuan.

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
| Pemeriksaan "…" belum dipetakan ke kode LIS PA | Kode pemeriksaan belum diisi di Mapping LIS PA. | Isi kode di **Mapping LIS PA › Pemeriksaan**. |
| Belum ada koneksi LIS PA aktif | Belum ada koneksi diatur/diaktifkan. | Admin mengatur koneksi di **Setting › Konfigurasi Integrasi › Konfigurasi LIS PA**. |
| Pengiriman ke LIS PA gagal: … | Sistem PA menolak registrasi, atau koneksi/waktu tunggu bermasalah. | Baca pesan dari sistem PA, perbaiki data/mapping, lalu **Kirim Ulang** dari **Pengiriman LIS PA**. Validasi order tetap dibatalkan sampai pengiriman berhasil. |
| Kunci akses tidak valid | Push hasil dari sistem PA memakai kunci masuk yang salah/sudah diganti. | Pasang ulang kunci masuk terbaru (**Kunci Masuk Baru**) di sistem PA tujuan. |

## Pertanyaan yang sering diajukan
**Kapan Nomor PA keluar?** Saat jaringan diterima dengan tombol **Terima & Beri Nomor PA**.

**Apakah blok dan slide harus dicatat manual ke arsip?** Tidak. Arsip dibuat otomatis dari **Jumlah blok / kaset** dan **Jumlah slide** di bagian makroskopis. Tambahan manual hanya untuk kasus khusus, mis. potong ulang.

**Spesimen ditolak, apakah tagihannya hilang?** Tidak. Tagihan tetap ada. Batalkan order bila pemeriksaan tidak dilanjutkan.

**Tombol Proses tidak ada, hanya Lihat?** Peran Anda belum memiliki izin MAKROSKOPIS, MIKROSKOPIS, DIAGNOSIS, atau VERIFIKASI. Hubungi admin.

**Kasus mana yang terlambat?** Centang **Melewati target (TAT)** di **Pemeriksaan & Diagnosis**. Target dihitung dari **Target selesai / TAT (hari)** di data master pemeriksaan.

**Kenapa tombol Validasi & Kirim ke LIS PA tidak ada?** Fitur **Bridging LIS Patologi Anatomi** belum aktif untuk faskes. Hubungi superadmin.

**Pengiriman LIS PA diulang, apakah sistem PA membuat kasus baru?** Tidak. Nomor registrasi penghubung bersifat tetap untuk kasus yang sama, sehingga **Kirim Ulang**/**Kirim Lagi** mengacu pada kasus yang sama di sistem PA.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**.
- Peran belum punya izin: admin › **Datamaster › Role**.
- Menu Patologi Anatomi ada di dalam menu **Penunjang**. Pada layar sempit, menu bisa berpindah ke tombol **Lainnya**.
- Tab **Order Patologi Anatomi** di RME hanya muncul bila modul Patologi Anatomi aktif.
- Menu **Mapping LIS PA** dan tombol **Validasi & Kirim ke LIS PA**/**Ambil Hasil LIS PA** hanya muncul bila fitur **Bridging LIS Patologi Anatomi** aktif di Manajemen Modul.

## Catatan untuk peninjau
- Nama menu di sidebar adalah **Template Laporan**, sedangkan judul halaman dan nama izinnya **Template Laporan PA**.
- Pesan galat backend menyebut "Datamaster › Pemeriksaan PA › Petugas". Di layar, petugas diatur pada tab **Petugas** di halaman **Pemeriksaan PA**. Mohon dicek apakah penamaan tab sudah sesuai.
- Isi pilihan **Fiksasi**, **Lateralitas**, dan **Keperluan** pinjam tidak dituliskan lengkap. Daftarnya diambil dari kode dan sebaiknya disesuaikan dengan layar.
- Alur order IHK lanjutan dari kasus induk (blok dari kasus sebelumnya) ada di backend, tetapi langkahnya tidak dijelaskan di panduan ini. Saat dikirim ke LIS PA, kasus IHK lanjutan mendapat nomor registrasi sendiri dan menyertakan referensi Nomor PA kasus induk bila koneksi mendukungnya.
- Langkah order PA dari RME (tab **Penunjang › Order Patologi Anatomi**) tidak dirinci di sini.
- Bridging LIS Patologi Anatomi (fitur `pa_bridging_lis`) mengikuti pola Bridging LIS Laboratorium: koneksi dan mapping bersifat per koneksi (satu faskes boleh punya beberapa sistem PA tujuan). Server tiruan untuk pengujian ada di `scripts/lis-pa-tiruan.mjs`.
