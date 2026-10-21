# Farmasi

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas farmasi (apoteker/TTK) sebelum dipakai Helpdesk.

**Dipakai oleh:** apoteker, tenaga teknis kefarmasian (TTK), petugas depo farmasi
**Menu:** Farmasi › Resep Dokter · Penjualan Obat · Retur Obat & Material · Farmasi Ruangan · Riwayat Transaksi · Datamaster · Laporan, ditambah tombol **Stok** di bagian bawah sidebar
**Hak akses yang dibutuhkan:** Farmasi › Resep Dokter / Penjualan Obat / Retur Obat dan Material / Farmasi Ruangan / Riwayat Transaksi › READ (beserta aksi seperti RESEP MASUK VERIFIKASI, PENYERAHAN OBAT SERAHKAN OBAT, CREATE BELI OBAT, RETUR). Untuk tombol **Stok** dibutuhkan modul izin STOK.

## Untuk apa
Modul Farmasi menerima resep elektronik dari dokter, lalu menjalankan telaah, verifikasi, penyiapan, dan penyerahan obat kepada pasien. Modul ini juga dipakai untuk penjualan obat bebas tanpa resep, retur obat atau material, order alkes dari ruangan, dan pengelolaan stok depo farmasi.

## Tugas sehari-hari

### Menelaah dan memverifikasi resep masuk
1. Buka **Farmasi › Resep Dokter**.
2. Atur filter bila perlu: **Lokasi** (depo farmasi), **Jenis Pelayanan**, **Tanggal mulai**, dan **Tanggal selesai**. Lalu klik **Cari**. Kolom pencarian **Pencarian Transaksi** menerima nama pasien atau No. RM.
3. Halaman ini punya tiga kolom: **Resep Masuk**, **Obat Disiapkan**, dan **Penyerahan Obat**. Klik kartu pasien di kolom **Resep Masuk**.
4. Periksa **Asesmen Medis** dan **List Obat**. Bila stok obat perlu dipilih, pilih **Stok Obat** pada tiap baris dan perhatikan **Sisa Stok**.
5. Bila obat perlu diubah, klik ikon pensil (biru) pada baris obat. Isi formulir **Edit Obat**, lalu klik **Simpan Edit**. Ikon hijau di sebelahnya dipakai untuk obat yang digerus.
6. Di bagian **Telaah Resep**, centang semua butir **Aspek Farmasetik**, **Aspek Administratif**, dan **Aspek Klinik**.
7. Pilih **Petugas Telaah**, lalu klik **Simpan Telaah**. Tombol ini baru aktif bila semua butir telaah sudah dicentang.
8. Klik **Verifikasi**.

**Hasilnya:** resep pindah ke kolom **Obat Disiapkan**, stok obat berkurang, dan biaya obat masuk ke tagihan pasien di menu Pembayaran.

### Menyiapkan obat dan menandai siap diserahkan
1. Di **Farmasi › Resep Dokter**, klik kartu pasien di kolom **Obat Disiapkan**.
2. Siapkan obat sesuai daftar. Bila perlu mencetak etiket atau resep, klik **Cetak** lalu pilih **E-Tiket**, **E-Resep**, atau **Salinan E-Resep**.
3. Klik **Obat Siap Diserahkan**.

**Hasilnya:** resep pindah ke kolom **Penyerahan Obat**.

### Menyerahkan obat kepada pasien
1. Klik kartu pasien di kolom **Penyerahan Obat**.
2. Di bagian **Edukasi Pemberian Obat**, centang butir edukasi yang sudah disampaikan.
3. Isi **Diberikan Ke** dan **No. Handphone Penerima** (contoh: 080000000000). Pilih **Petugas Edukasi**.
4. Klik **Serahkan Obat**.

**Hasilnya:** resep hilang dari papan kerja dan tercatat di **Riwayat Transaksi**.

Bila obat ternyata belum siap diserahkan, klik **Batal Penyerahan**. Resep akan kembali ke kolom **Obat Disiapkan**.

### Membatalkan atau memindahkan lokasi order resep
1. Buka resep yang masih berada di kolom **Resep Masuk**.
2. Untuk membatalkan:
   1. Klik **Batal Order** dan isi **Alasan Membatalkan Order**.
   2. Klik **Iya, Batalkan**. Setelah dibatalkan, dokter harus mengorderkan ulang obatnya.
3. Untuk memindahkan resep ke depo lain:
   1. Klik **Pindah Lokasi Order**.
   2. Pilih depo di **Pindah Lokasi Ke**, lalu klik **Pindahkan**.

**Hasilnya:** resep batal, atau resep pindah ke antrean depo tujuan.

### Melayani penjualan obat bebas (tanpa resep)
1. Buka **Farmasi › Penjualan Obat**, lalu klik **Beli**.
2. Isi **Lokasi Farmasi**, **Nama Pembeli**, dan **No. Handphone**. Isi **Dokter Yang Meresepkan** dan **Catatan** bila ada.
3. Klik **Tambah Item**. Pada setiap baris, pilih item di **Cari Item**, pilih **Jenis Stok**, lalu isi **Jumlah** dan **Diskon** bila ada.
4. Klik **Simpan**.

**Hasilnya:** transaksi tampil di daftar dengan status **Belum Bayar**. Gunakan tombol **Belum Bayar**, **Lunas**, dan **Dibatalkan** untuk menyaring daftar.

Untuk membatalkan penjualan yang belum dibayar:
1. Buka transaksinya, lalu klik **Batal Penjualan**.
2. Isi alasan, lalu klik **Iya, Batalkan**.

### Menerima retur obat atau material dari pasien
1. Buka **Farmasi › Retur Obat & Material**.
2. Pilih **Obat** atau **Material**, atur tanggal, lalu klik **Cari**.
3. Klik baris resep yang akan diretur.
4. Centang item di kolom **Terima Retur** dan isi **Alasan Retur**.
5. Klik **Retur**.

**Hasilnya:** nilai retur dihitung di **Total Retur**, dan item yang diterima tercatat sebagai retur.

### Melayani order alkes dari ruangan (Farmasi Ruangan)
1. Buka **Farmasi › Farmasi Ruangan**. Halaman ini punya tiga kolom: **Order Masuk**, **Sedang Disiapkan**, dan **Penyerahan Alkes**.
2. Buka order di kolom **Order Masuk** dan periksa **List Alkes**. Klik **Verifikasi** bila order sudah sesuai. Tombol **Batal Order** dan **Pindah Lokasi Order** juga tersedia di sini.
3. Di kolom **Sedang Disiapkan**, klik **Alkes Siap Diserahkan**.
4. Di kolom **Penyerahan Alkes**, isi **Diberikan Oleh** dan **Diterima Oleh**, lalu klik **Serahkan**.

**Hasilnya:** alkes tercatat diserahkan ke ruangan.

### Mengelola stok depo (tombol Stok)
1. Klik tombol **Stok** di bagian bawah sidebar Farmasi.
2. Di jendela yang terbuka, pilih depo pada **Lokasi Stok**.
3. Gunakan menu di sisi kiri jendela:
   - **Permintaan Barang**: klik **Permintaan** untuk meminta barang ke gudang. Isi **Tgl. Permintaan**, **Kategori Item**, **Jenis Stok**, **Jenis Item**, dan **Tujuan Permintaan**. Nyalakan **Cito** bila mendesak. Tambahkan barang dengan **Tambah Item** atau **Tambah Item Multiple**, lalu klik **Simpan**.
   - **Penerimaan Unit**: melihat barang kiriman gudang.
   - **Retur Unit**: mengembalikan barang ke gudang.
   - **Kartu Stok & Mutasi**, **Stok Opname**, dan **Stok Adjustment**: memeriksa dan mengoreksi stok depo.

**Hasilnya:** permintaan masuk ke gudang di menu **Inventory › Pengeluaran Barang › Verifikasi & Pengiriman Unit** (lihat [inventory.md](./inventory.md)).

### Menambah data obat atau alkes (Item Medis)
1. Buka **Farmasi › Datamaster › Item Medis**, lalu klik **Data**.
2. Isi **Kode Item Medis**, **Nama Item Medis**, **Jenis Item**, **Satuan Penggunaan**, **Jenis Stok**, **Manufaktur**, **Bentuk Sediaan**, **Kategori Item**, dan **Komposisi**.
3. Di bagian **Konversi Satuan**, pilih **Satuan Pembelian**, isi **Konversi**, lalu klik **Tambahkan**.
4. Klik **Simpan**.

**Hasilnya:** item dapat dipilih di resep, penjualan, dan pengadaan.

Data pendukung lain ada di submenu yang sama: **Aturan Pakai**, **Satuan**, **Bentuk Sediaan**, **Kategori Obat**, **Manufaktur**, **Jenis Stok**, **Lokasi Stok**, **Cara Pakai**, **Komposisi**, dan **Konfigurasi Harga** (margin, PPN, metode FIFO/LIFO/FEFO, dan tarif racikan).

### Melihat laporan farmasi
1. Buka **Farmasi › Laporan**, lalu pilih **Pendapatan**, **Waktu Tunggu**, atau **Rekap Pendapatan Resep Per Apotik**.
2. Atur filter dan tanggal, lalu klik **Cari**.
3. Klik **Cetak** untuk mengunduh laporan.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Lokasi stok default belum di set untuk pelayanan … | Belum ada depo yang ditandai sebagai tujuan order untuk jenis pelayanan itu (RJ/RI/IGD). | Admin farmasi membuka **Farmasi › Datamaster › Lokasi Stok** dan mengisi **Default Tujuan Order & Permintaan**. |
| Harga item medis … tidak ditemukan | Obat belum punya harga untuk jenis stok yang dipilih, biasanya karena belum pernah diterima dari pembelian. | Pilih jenis stok lain yang punya stok, atau minta gudang memproses penerimaan pembelian obat tersebut. |
| order status tidak memungkinkan aksi ini | Resep sudah diproses ke tahap berikutnya, misalnya oleh petugas lain. | Klik tombol muat ulang (panah melingkar), lalu buka kembali resepnya. |
| Stok untuk … tidak mencukupi. Sisa: …, diminta: … | Jumlah yang dijual melebihi sisa stok di depo itu. | Kurangi jumlah, pilih jenis stok lain, atau minta barang ke gudang lewat tombol **Stok**. |
| Penjualan obat tidak dapat dibatalkan karena statusnya sudah … | Penjualan sudah lunas atau sudah dibatalkan. | Penjualan yang sudah lunas tidak dapat dibatalkan dari menu ini. Hubungi kepala instalasi farmasi. |
| Hanya resep yang sudah diserahkan yang bisa direturs. | Retur hanya dapat dilakukan untuk resep yang obatnya sudah diserahkan. | Selesaikan penyerahan terlebih dahulu, atau batalkan order bila obat belum diserahkan. |
| Gagal sinkronisasi ke Billing: … | Verifikasi resep gagal mengirim biaya obat ke tagihan pasien. | Coba lagi beberapa saat kemudian. Bila tetap gagal, laporkan ke tim IT beserta No. RM pasien. |

## Pertanyaan yang sering diajukan
**Mengapa tombol Verifikasi tidak bisa diklik?** Telaah resep belum disimpan. Centang semua butir telaah, pilih **Petugas Telaah**, lalu klik **Simpan Telaah**.

**Apakah obat harus dibayar dulu sebelum diserahkan?** Ya, untuk pasien tunai rawat jalan dan IGD. Biaya obat atau alkes masuk ke tagihan pasien saat diverifikasi. Selama tagihan belum dibayar di kasir, kartu di kolom Penyerahan berlencana **MENUNGGU PEMBAYARAN** dan tombol **Serahkan** nonaktif. Pengecualian: pasien rawat inap (dibayar saat pulang), pasien penjamin (BPJS/asuransi), dan BHP Kamar Operasi/Hemodialisa. Tagihan yang ditutup kasir sebagai piutang juga dianggap selesai.

**Bagaimana kalau dokter salah menulis obat?** Bila resep masih di kolom **Resep Masuk**, petugas farmasi bisa mengubah obat lewat ikon pensil. Bila resep harus diganti total, klik **Batal Order**, lalu minta dokter mengorder ulang.

**Mengapa tombol Stok tidak ada?** Tombol **Stok** hanya muncul bila modul Farmasi atau Gudang & Pengadaan aktif untuk faskes.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **Farmasi**). Beberapa submenu adalah fitur terpisah: Penjualan Obat Bebas (OTC), Retur Obat & Material, Farmasi Ruangan, dan Laporan Farmasi Lanjutan.
- Peran belum punya izin: admin › **Datamaster › Role** (modul Farmasi, dan modul STOK untuk tombol **Stok**).

## Catatan untuk peninjau
- Daftar izin Farmasi memuat aksi "MENUNGGU PEMBAYARAN …". Tahap ini tidak menjadi kolom tersendiri, tetapi tampil sebagai lencana di kolom **Penyerahan Obat**/**Penyerahan Alkes** (lihat pertanyaan pembayaran di atas).
- Belum dapat dipastikan dari kode apakah transaksi **Penjualan Obat** dibayar di **Pembayaran › Transaksi › APS & OTC** dan bagaimana status berubah menjadi **Lunas**. Layanan farmasi hanya membuat status "belum_lunas" dan "cancel". Mohon dikonfirmasi alurnya.
- Langkah retur (kolom **Terima Retur**) ditulis dari judul kolom. Mohon dicek apakah petugas juga mengisi jumlah retur.
- Tombol **Stok** juga muncul di sidebar modul lain (Admisi, Rawat Jalan, Rawat Inap, IGD, Laboratorium, Pembayaran, dll.). Menu di dalam jendela Stok tampaknya tidak disaring per izin di layar.
- Arti ikon hijau "digerus" pada baris obat perlu dijelaskan oleh apoteker.
