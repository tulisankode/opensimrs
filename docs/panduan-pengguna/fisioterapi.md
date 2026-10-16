# Fisioterapi / Rehabilitasi Medik

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas fisioterapi sebelum dipakai Helpdesk.

**Dipakai oleh:** fisioterapis, petugas administrasi fisioterapi/rehabilitasi medik, admin data master fisioterapi
**Menu:** Penunjang › Fisioterapi › Order Fisioterapi / Penjadwalan Terapi / Evaluasi Terapi / Booking Terapi / Datamaster / Laporan
**Hak akses yang dibutuhkan:** Fisioterapi › Order Fisioterapi (READ, CREATE ORDER, VALIDASI DOKTER, BATAL ORDER, …) · Fisioterapi › Penjadwalan Terapi (READ, SIMPAN DAN MULAI TERAPI) · Fisioterapi › Evaluasi Terapi (READ, EVALUASI) · Fisioterapi › Booking Terapi (READ, CREATE BOOKING TERAPI, UPDATE BOOKING, BATAL BOOKING, DAFTAR) · Fisioterapi › Datamaster › Bed Ruangan / Tindakan Terapi / Paket Terapi · Fisioterapi › Laporan Fisio › <nama laporan> (READ, CETAK LAPORAN)

## Untuk apa
Modul Fisioterapi mengelola program terapi pasien dari order sampai evaluasi tiap sesi. Order datang dari dokter lewat RME (**Order Fisio**), dari pasien APS, atau dari booking. Order lalu divalidasi, sesi dijadwalkan ke bed dan jam terapi, dan setiap sesi dievaluasi dengan format SOAP.

Status order: **Order Baru** → **Tervalidasi** → **Terjadwal** → **Selesai**, atau **Batal**. Status sesi: **Booking**, **Terjadwal**, **Hadir**, **Selesai**, atau **Batal**.

## Tugas sehari-hari

### Melihat dan memvalidasi order terapi
1. Buka **Penunjang › Fisioterapi › Order Fisioterapi**.
2. Saring dengan **Cari** (nama, No. RM, atau No. Order), **Status**, **Jenis Fisioterapi**, **Tanggal mulai**, dan **Tanggal selesai**. Klik **Reset** untuk mengosongkan saringan.
3. Klik **Detail** pada baris order. Jendela **Detail Order Fisioterapi** menampilkan diagnosis, keluhan, catatan, dan **Tindakan Terapi** beserta tarifnya.
4. Bila isi order perlu diubah, klik **Ubah Order**, lakukan perubahan, lalu klik **Simpan Perubahan**.
5. Klik **Validasi Order**.

**Hasilnya:** status order menjadi **Tervalidasi** dan sesi terapi siap dijadwalkan. Bila order diubah setelah divalidasi, tagihan di menu **Pembayaran** ikut diperbarui.

### Membuat order APS (pasien datang sendiri)
1. Di **Order Fisioterapi**, klik **Order APS**.
2. Di jendela **Order Terapi APS (Atas Permintaan Sendiri)**, pilih **Pasien Terdaftar** dan **Cara Bayar** (**Tunai / Umum** atau **Asuransi / Penjamin**).
3. Pilih sumber tindakan:
   - **Tindakan Satuan**: pilih **Jenis Fisioterapi**, isi **Jumlah Sesi**, lalu tambahkan **Tindakan Terapi** dan **Qty per sesi**.
   - **Paket Terapi**: pilih paketnya. Jenis, jumlah sesi, dan tindakan mengikuti paket, dan tagihan memakai harga paket.
4. Isi **Diagnosis**, **Keluhan**, dan **Catatan** (opsional).
5. Klik **Simpan Order**.

**Hasilnya:** order baru berstatus **Order Baru** dan detailnya langsung terbuka untuk divalidasi.

### Menjadwalkan sesi terapi
1. Buka detail order yang sudah **Tervalidasi**, lalu klik **Jadwalkan Sesi**. Cara lain: di **Penjadwalan Terapi**, klik **Jadwalkan** pada daftar **Order menunggu jadwal**.
2. Pilih **Tanggal Terapi**.
3. Pada grid jam dan bed, klik sel **Tersedia** yang diinginkan.
4. Klik **Simpan Jadwal**. Ulangi untuk sesi berikutnya. Jumlah sesi yang sudah terjadwal tampil sebagai **Sesi terjadwal x/y**.

**Hasilnya:** sesi tercatat di tabel jadwal pada detail order dan di papan **Penjadwalan Terapi**.

### Memantau jadwal harian dan menandai kehadiran
1. Buka **Penunjang › Fisioterapi › Penjadwalan Terapi**, lalu pilih **Tanggal** atau klik **Hari ini**.
2. Bagian **Ketersediaan Bed** menampilkan slot yang terisi (**Terjadwal**, **Hadir**, **Selesai**, **Booking**).
3. Di tabel **Sesi pada tanggal ini**, klik **Hadir** saat pasien datang.
4. Klik **Evaluasi** untuk mengisi hasil sesi, atau **Detail** untuk membuka order.

**Hasilnya:** status sesi berubah menjadi **Hadir**.

### Mengisi evaluasi sesi terapi
1. Buka **Penunjang › Fisioterapi › Evaluasi Terapi**. Saring dengan **Cari**, tanggal, atau **Status Sesi**.
2. Pilih sesi di daftar sebelah kiri.
3. Isi **Subjektif (S)**, **Objektif (O)**, **Asesmen (A)**, **Intervensi / Plan (P)**, **Evaluasi**, **Edukasi**, **Fase Rehabilitasi**, dan **Fisioterapis**. Klik **Salin evaluasi terakhir** bila ingin memakai isian sesi sebelumnya sebagai awal.
4. Bila perlu, isi bagian **Inform Consent**: pilih **Persetujuan tindakan** atau **Penolakan tindakan**, lalu isi **Nama yang menyatakan**, **Hubungan dengan pasien**, **Tindakan yang dijelaskan**, dan **Saksi**.
5. Klik **Simpan Evaluasi & Selesaikan Sesi**. Untuk mengoreksi evaluasi yang sudah ada, klik **Perbarui Evaluasi**.
6. Klik **Asuhan Terapi** untuk mencetak lembar asuhan.

**Hasilnya:** sesi berstatus **Selesai** dan evaluasinya tampil di bagian **Evaluasi Rehab Medik** pada detail order.

### Mengubah atau membatalkan sesi dan order
1. Buka detail order. Pada tabel jadwal, klik **Ubah** untuk memindah tanggal, jam, atau bed sebuah sesi, atau klik **Batal** untuk membatalkan sesi itu.
2. Untuk membatalkan seluruh order, klik **Batal Order**, isi **Alasan Pembatalan**, lalu klik **Ya, Batalkan**.

**Hasilnya:** slot sesi yang dibatalkan kembali tersedia. Order yang sudah memiliki sesi terevaluasi tidak dapat dibatalkan.

### Menerima booking terapi
1. Buka **Penunjang › Fisioterapi › Booking Terapi**.
2. Pilih **Tanggal terapi**. Tabel **Cek Ketersediaan Bed (7 hari)** menampilkan jumlah bed kosong per jam.
3. Klik slot jam dan bed yang tersedia pada grid.
4. Di **Data Booking**, pilih **Pasien lama (terdaftar)** lalu cari pasiennya, atau pilih **Pasien baru** lalu isi **Nama Pasien** dan **No. HP** (contoh fiktif 080000000000).
5. Isi **Catatan** bila ada, lalu klik **Buat Booking**.

**Hasilnya:** booking tampil di **Daftar Booking Aktif** dan slot terkunci untuk pasien tersebut.

### Melanjutkan booking menjadi order
1. Di **Daftar Booking Aktif**, klik **Lanjutkan ke Order** pada booking pasien yang datang.
2. Di jendela **Lanjutkan Booking ke Order Terapi**, pilih **Pasien**. Untuk booking pasien baru, daftarkan pasien dahulu di **Admisi**, lalu cari di sini.
3. Pilih **Cara Bayar**, isi tindakan atau paket serta diagnosis, lalu klik **Buat Order**.
4. Untuk membatalkan booking, klik **Batal**, isi **Alasan (opsional)**, lalu klik **Ya, Batalkan**.

**Hasilnya:** booking berubah menjadi order terapi tanpa perlu memilih slot ulang.

### Mengelola data master dan mencetak laporan
1. Buka **Penunjang › Fisioterapi › Datamaster**:
   - **Bed Ruangan**: **Kode Bed**, **Nama Bed**, **Ruangan**, **Keterangan**, **Status**. Bed aktif menentukan jumlah slot per jam.
   - **Tindakan Terapi**: **Kode**, **Nama Tindakan**, **Jenis Fisioterapi**, **Tarif (Rp)**.
   - **Paket Terapi**: **Kode**, **Nama Paket**, **Jumlah Sesi**, **Tindakan per Sesi**, **Harga Paket (Rp, seluruh sesi)**.
2. Laporan ada di **Penunjang › Fisioterapi › Laporan**: **Kunjungan**, **Rekapitulasi Kunjungan Jenis Fisioterapi**, **Rekapitulasi Terapi**, dan **Rekapitulasi Pendapatan Fisioterapi**. Isi **Tanggal mulai** dan **Tanggal selesai**, klik **Tampilkan**, lalu klik **Ekspor** untuk mengunduh dalam format Excel.
3. Dari detail order, klik **Jadwal Terapi** untuk mencetak jadwal sesi pasien.

**Hasilnya:** data master baru bisa langsung dipakai saat order dan penjadwalan.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Pilih pasien terdaftar | Pasien belum dipilih pada order APS atau booking pasien lama. | Cari dan pilih pasien. Pasien baru didaftarkan dahulu di **Admisi**. |
| Jenis fisioterapi wajib dipilih / Pilih minimal satu tindakan terapi / Pilih paket terapi | Isian order belum lengkap. | Lengkapi jenis, tindakan, atau paket. |
| Order belum divalidasi; validasi order terlebih dahulu | Sesi dijadwalkan sebelum order divalidasi. | Klik **Validasi Order** di detail order. |
| Order belum divalidasi; evaluasi dapat diisi setelah order divalidasi… | Evaluasi dibuka untuk order yang belum divalidasi. | Validasi order di **Order Fisioterapi**. |
| Seluruh … sesi order sudah terjadwal | Semua sesi order sudah punya jadwal. | Tambah jumlah sesi lewat **Ubah Order** bila memang perlu sesi tambahan. |
| Bed sudah terisi pada tanggal & jam terapi tersebut; pilih bed atau jam lain | Slot sudah dipakai pasien lain. | Pilih sel lain yang berstatus **Tersedia**. |
| Order ini sudah memiliki sesi pada tanggal & jam tersebut | Pasien sudah dijadwalkan di jam yang sama. | Pilih jam lain. |
| Pilih slot jam & bed yang tersedia pada grid. | Booking dibuat tanpa memilih slot. | Klik sel yang tersedia pada grid. |
| Pasien baru harus didaftarkan di Admisi lalu dipilih di sini | Booking pasien baru dilanjutkan ke order sebelum pasien terdaftar. | Daftarkan pasien di **Admisi**, lalu pilih di kolom **Pasien**. |
| Sesi sudah dievaluasi; jadwal tidak dapat diubah | Sesi yang sudah dievaluasi tidak bisa dipindah. | Tidak perlu diubah. Buat sesi baru bila diperlukan. |
| Order sudah memiliki … sesi yang dievaluasi sehingga tidak dapat dibatalkan | Program terapi sudah berjalan. | Batalkan sesi yang belum berjalan saja. |
| Bed masih memiliki … jadwal/booking aktif; batalkan atau pindahkan dahulu | Bed yang akan dihapus masih dipakai. | Pindahkan atau batalkan jadwalnya dulu. |
| Kode bed/tindakan/paket … sudah dipakai | Kode data master sudah ada. | Pakai kode lain. |

## Pertanyaan yang sering diajukan
**Kenapa tombol Hadir atau Evaluasi tidak muncul?** Kedua tombol hanya muncul bila order sudah divalidasi dan sesi berstatus **Terjadwal**/**Hadir**.

**Booking pasien baru, apakah pasien harus didaftarkan?** Saat booking cukup nama dan No. HP. Saat dilanjutkan ke order, pasien harus sudah terdaftar di **Admisi**.

**Grid jadwal bertuliskan "Belum ada bed aktif"?** Tambahkan bed di **Datamaster › Bed Ruangan** dan pastikan statusnya aktif.

**Apakah order dari dokter perlu dibuat ulang?** Tidak. Order dari RME (**Order Fisio**) otomatis masuk ke **Order Fisioterapi** dengan sumber **Order Dokter (RME)**.

**Bisakah evaluasi diubah setelah disimpan?** Bisa. Pilih sesinya di **Evaluasi Terapi**, ubah isiannya, lalu klik **Perbarui Evaluasi**.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**.
- Peran belum punya izin: admin › **Datamaster › Role**.
- Menu Fisioterapi ada di dalam menu **Penunjang**. Pada layar sempit, menu bisa berpindah ke tombol **Lainnya**.
- Tab **Order Fisio** di RME hanya muncul bila modul Fisioterapi aktif.

## Catatan untuk peninjau
- Nama izin di daftar izin (mis. "VALIDASI DOKTER", "SIMPAN DAN MULAI TERAPI", "UPDATE ASSESMENT MEDIS") tampaknya berasal dari tampilan lama dan tidak sepadan dengan tombol baru (**Validasi Order**, **Jadwalkan Sesi**, **Simpan Evaluasi & Selesaikan Sesi**). Pembatasan per tombol tidak ditemukan di halaman. Mohon dipastikan izin mana yang benar-benar dipakai.
- Di folder Fisioterapi ada komponen lama (mis. `PopUpOrderFisioPage.vue`) berisi data contoh statis yang tidak dipakai halaman sekarang. Panduan mengikuti `DialogDetailOrder.vue`.
- Tidak dipastikan kapan status order berubah menjadi **Selesai**. Dugaan: setelah semua sesi dievaluasi.
- Keempat laporan Fisioterapi memakai kerangka bersama (`KerangkaLaporan.vue`) dengan tombol **Tampilkan** dan **Ekspor**. Saringan tambahan di tiap laporan belum diperiksa.
- Pilihan **Jenis Fisioterapi** di kode: Sport, Saraf (Neuro), Ortopedi, Anak (Pediatri), Geriatri.
