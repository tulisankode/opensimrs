# Radiologi

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas radiologi sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas administrasi radiologi, radiografer, dokter spesialis radiologi (Sp.Rad), admin data master radiologi
**Menu:** Penunjang › Radiologi › Order Radiologi / Penjadwalan / Pemeriksaan & Hasil / Datamaster / Laporan
**Hak akses yang dibutuhkan:** Radiologi › Order Radiologi (READ, CREATE, VALIDASI, BATAL, CETAK) · Radiologi › Penjadwalan (READ, CREATE, UPDATE, BATAL, CETAK) · Radiologi › Pemeriksaan (READ, PERIKSA, INPUT HASIL, CETAK HASIL) · Radiologi › Datamaster › <nama data> (READ, CREATE, UPDATE, DELETE) · Radiologi › Laporan Radiologi › Kunjungan (READ, CETAK LAPORAN)

## Untuk apa
Modul Radiologi mencatat pemeriksaan radiologi dari order, validasi dan tagihan, penjadwalan ruang/alat, pemeriksaan oleh radiografer, sampai expertise (bacaan) dokter radiologi dan cetak hasil. Order bisa datang dari dokter lewat RME, dari pasien APS (atas permintaan sendiri atau rujukan luar), atau dari MCU.

Status order: **Order** → **Valid** (sudah divalidasi dan tagihan terkirim) → **Diperiksa** → **Selesai**, atau **Batal**. Status tiap pemeriksaan: **Menunggu** → **Menunggu Expertise** → **Selesai**.

## Tugas sehari-hari

### Melihat order radiologi yang masuk
1. Buka **Penunjang › Radiologi › Order Radiologi**.
2. Saring dengan **Cari** (nama, No. RM, atau No. Order), **Tanggal mulai**/**Tanggal selesai**, serta pilihan **Status**, **Sumber** (RME/APS/MCU), dan **Modalitas**. Klik **Reset** untuk mengosongkan saringan.
3. Klik baris order untuk melihat detail: pasien, asal, dokter pengirim, pembayaran, keterangan klinis, serta daftar pemeriksaan beserta **Tarif**, **Jadwal / Ruang**, dan **Kesan**.

**Hasilnya:** order tampil dengan status dan tanda **CITO** bila pemeriksaan segera.

### Membuat order APS (pasien datang sendiri atau rujukan luar)
1. Di **Order Radiologi**, klik **Order APS**.
2. Cari pasien di kolom **Pasien** (nama, No. RM, atau NIK; contoh NIK fiktif 9999…). Pasien baru harus didaftarkan dahulu di **Admisi**.
3. Centang **CITO (segera)** bila perlu, lalu pilih item di **Pemeriksaan / Paket**.
4. Isi **Dokter Pengirim (opsional)**, **Pembayaran** (**Tunai**/**Asuransi**), **Keterangan Klinis / Diagnosis**, dan **Catatan** (mis. nomor surat rujukan).
5. Klik **Buat Order**.

**Hasilnya:** order baru berstatus **Order** muncul di daftar.

### Memvalidasi order dan mengirim tagihan
1. Buka detail order berstatus **Order**.
2. Periksa kembali pemeriksaan dan tarifnya, lalu klik **Validasi & Kirim Tagihan**.
3. Klik **Cetak Bukti Order** bila pasien memerlukan bukti order.

**Hasilnya:** status order menjadi **Valid** dan tagihan pemeriksaan masuk ke menu **Pembayaran**.

### Menjadwalkan pemeriksaan
1. Buka detail order yang sudah **Valid**, lalu klik **Jadwalkan**. Cara lain: buka **Penunjang › Radiologi › Penjadwalan** dan klik **Jadwalkan** pada order di daftar tunggu.
2. Di jendela **Jadwalkan Pemeriksaan Radiologi**, pilih **Ruang / Alat** dan **Tanggal pemeriksaan**, lalu pilih slot jam yang kosong.
3. Isi **Catatan** bila perlu (mis. pasien memakai kursi roda).
4. Klik **Jadwalkan**. Untuk pasien CITO, klik **Segera (slot terdekat hari ini)**.

**Hasilnya:** pemeriksaan tercatat di papan **Penjadwalan Pemeriksaan** beserta nomor antrean ruang.

### Mengelola jadwal dan kedatangan pasien
1. Buka **Penunjang › Radiologi › Penjadwalan**, lalu pilih **Tanggal** atau klik **Hari ini**.
2. Klik jadwal pasien untuk melihat detail, lalu pilih tindakan:
   - **Pasien Hadir**: menandai pasien sudah datang. Tombol ini aktif pada hari pemeriksaan.
   - **Cetak Slip**: mencetak slip jadwal, termasuk persiapan pasien.
   - **Ubah**: memindah ruang, tanggal, atau jam.
   - **Batalkan**: membatalkan jadwal. Isi **Alasan**, lalu klik **Batalkan Jadwal**. Order tidak ikut batal dan pemeriksaan kembali ke daftar tunggu jadwal.
   - **Ke Worklist**: membuka **Pemeriksaan & Hasil** untuk ruang tersebut.
3. Klik **Cetak Jadwal** untuk mencetak daftar jadwal hari itu.

**Hasilnya:** status jadwal diperbarui (terjadwal, hadir, atau batal).

### Mencatat pemeriksaan oleh radiografer
1. Buka **Penunjang › Radiologi › Pemeriksaan & Hasil**. Saring dengan **Hanya CITO**, **Jadwal hari ini**, ruang, atau status bila perlu.
2. Pada pemeriksaan berstatus **Menunggu**, klik **Periksa**.
3. Di jendela **Catat Pemeriksaan**, pilih **Ruang / Alat**, **Radiografer** (kosongkan bila radiografernya pengguna yang sedang login), dan **Waktu pemeriksaan**.
4. Klik **Simpan**.

**Hasilnya:** status pemeriksaan menjadi **Menunggu Expertise**. Bila pasien belum ditandai hadir, sistem mencatat kehadirannya otomatis.

### Mengisi expertise dan mencetak hasil
1. Di **Pemeriksaan & Hasil**, klik **Input Hasil** pada pemeriksaan berstatus **Menunggu Expertise**.
2. Pilih **Template expertise (bacaan normal)** bila ada, lalu sesuaikan isinya.
3. Pilih **Dokter Radiologi (Sp.Rad)**, isi **Hasil / Uraian** dan **Kesan**.
4. Tambahkan lampiran gambar bila perlu lewat **Tambah gambar** (PNG/JPG, maksimal 1 MB per berkas, 5 berkas).
5. Klik **Simpan Expertise**.
6. Klik **Cetak** pada baris pemeriksaan, atau **Cetak Hasil** di detail order.

**Hasilnya:** status pemeriksaan menjadi **Selesai** dan hasil bisa dicetak. Untuk mengoreksi, klik **Ubah Hasil**.

### Membatalkan order
1. Buka detail order berstatus **Order** atau **Valid**, lalu klik **Batalkan**.
2. Isi **Alasan pembatalan**, lalu klik **Batalkan Order**.

**Hasilnya:** order berstatus **Batal** dan item tagihannya dihapus dari **Pembayaran**. Order yang pemeriksaannya sudah dikerjakan tidak dapat dibatalkan.

### Mengelola data master radiologi
Buka **Penunjang › Radiologi › Datamaster**:
- **Pemeriksaan Radiologi**: klik **Pemeriksaan** (berikon +), isi **Kode**, **Modalitas**, **Nama Pemeriksaan**, **Bagian Tubuh**, **Kode ICD-9-CM**, **Tarif (Rp)**, **Persiapan Pasien** (dicetak di slip jadwal), dan **Status**, lalu klik **Simpan**.
- **Paket Radiologi**: gabungan beberapa pemeriksaan dengan **Harga Paket (Rp)**. Saat diorder, harga paket dibagi proporsional ke tiap pemeriksaan.
- **Ruang & Alat**: **Kode Ruang**, **Nama Ruang**, **Alat (merk / tipe)**, modalitas yang dilayani, **Jam Buka**, **Jam Tutup**, **Durasi Slot (menit)**, dan hari operasional.
- **Template Expertise**: teks bacaan normal per pemeriksaan, per modalitas, atau umum.
- **Petugas Radiologi**: daftar **Dokter Radiologi** dan **Radiografer**, diambil dari Datamaster Praktisi.

**Hasilnya:** data baru langsung bisa dipilih saat order, penjadwalan, dan expertise.

### Melihat laporan kunjungan radiologi
1. Buka **Penunjang › Radiologi › Laporan › Kunjungan Radiologi**.
2. Isi **Tanggal mulai** dan **Tanggal selesai**, lalu klik **Tampilkan**.
3. Baca ringkasan (order, pasien, pendapatan, rerata waktu tunggu) dan tabel per modalitas, ruang/alat, pelayanan, pemeriksaan, dan hari.
4. Klik **Excel** untuk mengunduh.

**Hasilnya:** berkas Excel laporan terunduh.

## Bridging PACS/RIS

> Hanya tersedia bila superadmin mengaktifkan fitur **Bridging PACS/RIS** untuk faskes di **Setting › Manajemen Modul** (modul Radiologi tetap harus aktif).

### Menyiapkan koneksi PACS
1. Buka **Setting › Konfigurasi Integrasi › Konfigurasi PACS**, lalu klik **Tambah PACS**.
2. Isi **Nama**, **Kode RS di PACS**, **URL Kirim Order**, **URL Ambil Hasil/Status** (opsional, pakai `{accession_number}` sebagai placeholder), **URL Viewer** (opsional), dan **API Key**.
3. Atur **Maks. request paralel** dan **Jeda antar-request**, tandai **Status: Aktif**, dan tandai **PACS Bawaan** bila ini satu-satunya/koneksi utama.
4. Klik **Simpan**. Salin **alamat penerima hasil** dan **kunci masuk** yang tampil (hanya sekali) untuk dipasang di PACS sebagai URL pengembalian hasil.
5. Klik **Uji Koneksi** untuk memastikan PACS dapat dihubungi.

**Hasilnya:** koneksi PACS siap dipakai mengirim order dan menerima hasil.

### Memetakan tindakan, referensi, dan ruang/alat
1. Buka **Penunjang › Radiologi › Mapping PACS**.
2. **Tindakan**: isi **Kode Prosedur PACS** dan **Modalitas PACS** untuk tiap tindakan radiologi. Centang **Belum dipetakan** untuk menyaring yang belum diisi.
3. **Unit, Dokter & Penjamin**: isi **Kode di PACS** (opsional) bila PACS mensyaratkan kode khusus untuk unit asal, dokter pengirim, atau penjamin.
4. **Ruang/Alat (AE Title)**: isi **AE Title** modalitas untuk ruang/alat yang relevan (data referensi yang dikirim bersama order; SIMRS tidak membentuk worklist DICOM).
5. Klik **Simpan** pada tiap halaman.

**Hasilnya:** mapping tersimpan dan dipakai saat order dikirim ke PACS.

### Memvalidasi dan mengirim order ke PACS
1. Buka detail order radiologi berstatus **Order**.
2. Klik **Validasi & Kirim ke PACS**. Bila ada lebih dari satu koneksi aktif tanpa koneksi bawaan, pilih koneksi tujuan.
3. Bila koneksi PACS sedang bermasalah atau mapping belum lengkap, klik **Validasi Saja** sebagai jalur darurat (tagihan tetap diproses, tanpa mengirim ke PACS).

**Hasilnya:** setiap pemeriksaan mendapat **Accession Number** unik, order tervalidasi, dan status pengiriman tercatat di **Pengiriman PACS**. Accession Number tampil di detail order dan cetak hasil.

### Mengelola pengiriman yang gagal atau tidak pasti
1. Buka **Setting › Konfigurasi Integrasi › Pengiriman PACS**.
2. Saring dengan **Status** bila perlu.
3. Klik **Kirim Ulang** (status Gagal) atau **Kirim Lagi** (status lain) untuk mengirim ulang dengan Accession Number yang sama.
4. Klik **Cek Status** pada baris berstatus **Tidak pasti** untuk memastikan status terbaru di PACS sebelum mengirim ulang.

**Hasilnya:** status pengiriman diperbarui tanpa menggandakan order di PACS.

### Mengambil hasil dan membuka citra
1. Di **Pemeriksaan & Hasil**, klik **Ambil Hasil PACS** pada pemeriksaan yang sudah dikirim untuk menarik status/hasil terbaru secara manual. Biasanya hasil masuk otomatis dari PACS tanpa langkah ini.
2. Klik **Buka Citra** pada hasil radiologi (atau riwayat penunjang di RME) untuk membuka viewer PACS bila tautannya tersedia.

**Hasilnya:** status, expertise, dan tautan citra dari PACS tersimpan pada pemeriksaan yang benar. Expertise yang sudah diisi manual tidak ditimpa otomatis oleh hasil PACS.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Order belum divalidasi; validasi order terlebih dahulu | Order dijadwalkan atau diperiksa sebelum divalidasi. | Klik **Validasi & Kirim Tagihan** di detail order. |
| Order sudah dibatalkan | Order berstatus Batal. | Buat order baru bila pemeriksaan tetap diperlukan. |
| Slot ruang tersebut sudah terisi pada jam itu; pilih jam atau ruang lain | Jam yang dipilih sudah dipakai pasien lain. | Pilih slot lain atau ruang lain. |
| Pasien sudah dijadwalkan di … pukul …; pilih jam lain | Pasien yang sama sudah punya jadwal di jam itu. | Pilih jam lain. |
| … tidak beroperasi hari ini / Tidak ada slot kosong lagi hari ini di … | Ruang tutup pada hari itu atau slotnya penuh. | Ikuti saran di pesan, pilih tanggal atau ruang lain. |
| Jadwal ini untuk tanggal …; ubah jadwal ke hari ini bila pasien datang di luar jadwal | **Pasien Hadir** ditekan di luar tanggal jadwal. | Klik **Ubah**, pindahkan jadwal ke hari ini, lalu tandai hadir. |
| Sebagian pemeriksaan sudah dikerjakan, order tidak dapat dibatalkan | Ada pemeriksaan yang sudah dicatat radiografer. | Order tidak bisa dibatalkan. Hubungi kepala instalasi bila perlu koreksi. |
| Pemeriksaan belum dikerjakan radiografer | Expertise diisi sebelum pemeriksaan dicatat. | Klik **Periksa** dan simpan pemeriksaan dulu. |
| Kode pemeriksaan … sudah dipakai / Kode ruang … sudah dipakai | Kode data master sudah ada. | Pakai kode lain. |
| Ruang masih memiliki … jadwal aktif; pindahkan atau batalkan dahulu | Ruang yang akan dihapus masih punya jadwal. | Pindahkan atau batalkan jadwalnya dulu. |
| Jam tutup harus setelah jam buka | Jam operasional ruang terbalik. | Perbaiki **Jam Buka** dan **Jam Tutup**. |
| Tindakan "…" belum dipetakan ke kode prosedur PACS | Pemeriksaan belum punya mapping di **Mapping PACS › Tindakan**. | Lengkapi mapping, atau klik **Validasi Saja** untuk melanjutkan tanpa kirim ke PACS. |
| Belum ada koneksi PACS aktif | Fitur aktif tapi belum ada koneksi, atau semua koneksi nonaktif. | Tambahkan/koneksi aktifkan di **Setting › Konfigurasi Integrasi › Konfigurasi PACS**. |
| Lebih dari satu koneksi PACS aktif — pilih koneksi tujuan | Ada beberapa koneksi aktif tanpa koneksi bawaan. | Pilih koneksi tujuan pada dialog yang muncul, atau tandai satu koneksi sebagai **PACS Bawaan**. |
| Pengiriman ke PACS gagal/sebagian gagal — validasi dibatalkan | PACS menolak atau tidak dapat dihubungi. | Perbaiki penyebab (lihat pesan), lalu kirim ulang dari **Pengiriman PACS**, atau pakai **Validasi Saja**. |
| Item ini belum terkirim ke PACS | **Ambil Hasil PACS** ditekan sebelum order dikirim. | Kirim order ke PACS terlebih dahulu. |

## Pertanyaan yang sering diajukan
**Apakah pemeriksaan harus dijadwalkan dulu?** Tidak selalu. Pemeriksaan yang belum dijadwalkan tetap tampil di **Pemeriksaan & Hasil** dan bisa langsung dicatat dengan **Periksa**. Penjadwalan membantu mengatur antrean ruang/alat.

**Pasien datang di hari lain dari jadwalnya?** Buka **Penjadwalan**, klik jadwalnya, pilih **Ubah**, pindahkan ke hari ini, lalu klik **Pasien Hadir**.

**Membatalkan jadwal apakah membatalkan order?** Tidak. Slot kembali tersedia dan pemeriksaan kembali menunggu jadwal.

**Pasien belum terdaftar, bisakah dibuatkan order APS?** Belum bisa. Daftarkan pasien dahulu di **Admisi**, lalu buat order APS.

**Daftar dokter radiologi kosong di dialog expertise?** Bila belum ada dokter di **Datamaster › Petugas Radiologi**, dialog menampilkan semua dokter aktif. Tambahkan dokter radiologi agar pilihannya lebih tepat.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**.
- Peran belum punya izin: admin › **Datamaster › Role**.
- Menu Radiologi ada di dalam menu **Penunjang**. Pada layar sempit, menu bisa berpindah ke tombol **Lainnya**.
- Tab **Order Radiologi** di RME hanya muncul bila modul Radiologi aktif.

## Catatan untuk peninjau
- Bridging PACS/RIS (fitur `rad_bridging_pacs`) ditambahkan mengikuti pola Bridging LIS; mohon ditinjau bersama tim radiologi sebelum dipakai di faskes produksi.
- Pembatasan per tombol (mis. VALIDASI, INPUT HASIL) tidak ditemukan pada halaman radiologi di frontend maupun di rute penunjang-service. Pengguna yang bisa membuka menu kemungkinan bisa menjalankan semua tombol. Mohon dipastikan.
- Isi pilihan **Modalitas** (mis. X-Ray, CT, USG) tidak dituliskan karena daftarnya diambil dari kode (`MODALITAS_RAD`). Mohon disesuaikan dengan layar.
- Belum dijelaskan langkah order radiologi dari RME (tab **Penunjang › Order Radiologi**). Rinciannya sebaiknya ada di panduan RME.
