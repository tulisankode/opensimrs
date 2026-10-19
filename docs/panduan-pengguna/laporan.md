# Laporan

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas rekam medis/pelaporan sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas rekam medis dan pelaporan, manajemen, kepala unit
**Menu:** Laporan › Jumlah Kunjungan Berdasarkan Status Rawat · Rekapitulasi Tindakan · Rekapitulasi Pemeriksaan Lab · Rekapitulasi Diagnosis berdasarkan Umur Pasien; menu **Ekstensi** (bila ada ekstensi terpasang)
**Hak akses yang dibutuhkan:** Laporan › (nama laporan) › READ, CETAK LAPORAN. Untuk Ekstensi, dibutuhkan hak modul yang ditetapkan pada masing-masing ekstensi.

## Untuk apa
Menu Laporan berisi rekapitulasi lintas layanan: jumlah kunjungan, tindakan, pemeriksaan lab, dan diagnosis per kelompok umur. Laporan dapat disaring per periode dan diekspor ke Excel. Laporan yang khusus untuk satu modul ada di menu modul masing-masing, misalnya **Farmasi › Laporan**, **Pembayaran › Laporan**, dan **Inventory › Laporan**.

## Tugas sehari-hari

### Melihat jumlah kunjungan berdasarkan status rawat
1. Buka **Laporan › Jumlah Kunjungan Berdasarkan Status Rawat**.
2. Isi **Cari Dokter** bila perlu.
3. Pilih **Jenis Kunjungan** (**Rawat Jalan**, **Rawat Inap**, atau **IGD**) dan **Metode Bayar** (**Tunai** atau **Asuransi**).
4. Atur **Tanggal mulai** dan **Tanggal selesai**, lalu klik **Cari**.

**Hasilnya:** tabel menampilkan **Jenis Kunjungan**, **Metode Pembayaran**, **Nama Dokter**, dan **Total**.

### Melihat rekapitulasi tindakan
1. Buka **Laporan › Rekapitulasi Tindakan**.
2. Isi **Cari Tindakan** bila perlu, lalu pilih **Jenis Kunjungan** dan **Metode Bayar**.
3. Atur tanggal, lalu klik **Cari**.

**Hasilnya:** tabel menampilkan **Tindakan**, **Jenis Kunjungan**, **Metode Pembayaran**, dan **Total**.

### Melihat rekapitulasi pemeriksaan lab
1. Buka **Laporan › Rekapitulasi Pemeriksaan Lab**.
2. Isi **Cari Tindakan** dengan nama pemeriksaan bila perlu, lalu pilih **Jenis Kunjungan** dan **Metode Bayar**.
3. Atur tanggal, lalu klik **Cari**.

**Hasilnya:** tabel menampilkan **Pemeriksaan**, **Jenis Kunjungan**, **Metode Pembayaran**, dan **Total**.

### Melihat rekapitulasi diagnosis berdasarkan umur pasien
1. Buka **Laporan › Rekapitulasi Diagnosis berdasarkan Umur Pasien**.
2. Pilih **Jenis Kunjungan** dan **Jenis Kelamin**.
3. Atur tanggal, lalu klik **Cari**.

**Hasilnya:** tabel menampilkan **Kode**, **Diagnosis**, jumlah per kelompok umur di kolom **Kunjungan**, dan **Total**.

### Mengekspor laporan ke Excel
1. Tampilkan laporan dengan filter yang diinginkan.
2. Klik **Eksport** di kiri bawah tabel.

**Hasilnya:** berkas Excel terunduh sesuai filter yang dipakai.

Klik **Reset** untuk mengembalikan filter. Periode bawaan adalah 30 hari terakhir.

### Menjalankan laporan, cetakan, atau formulir tambahan (menu Ekstensi)
Ekstensi adalah laporan, template cetak, atau formulir tambahan yang dirakit di SIMRS Studio lalu dipasang superadmin untuk faskes. Ekstensi tidak berada di menu **Laporan**, tetapi di menu atas tersendiri bernama **Ekstensi**.
1. Klik menu **Ekstensi**. Sidebar mengelompokkan ekstensi menjadi **Laporan**, **Cetak**, dan **Formulir**.
2. Pilih ekstensi yang dibutuhkan.
3. Untuk ekstensi laporan:
   1. Isi parameternya. Tanda bintang merah berarti parameter wajib diisi.
   2. Klik **Tampilkan**.
   3. Untuk mengunduh, klik **Ekspor Excel** atau **Cetak PDF**.
4. Untuk ekstensi cetak, isi parameter lalu klik **Cetak**.
5. Untuk ekstensi formulir:
   1. Isi kolom kaitan (misalnya nomor pasien atau kunjungan sesuai label di layar), lalu klik **Buka**.
   2. Isi formulir, lalu klik **Simpan**.
   3. Isian lama dapat diubah (ikon pensil) atau dihapus (ikon tempat sampah).

**Hasilnya:** data ekstensi tampil, terunduh, atau tersimpan.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| endDate must be greater than startDate | **Tanggal selesai** lebih awal daripada **Tanggal mulai**. | Perbaiki rentang tanggal, lalu klik **Cari** lagi. |
| Tidak ada data. / tabel kosong | Tidak ada data yang cocok dengan filter. | Perlebar rentang tanggal atau kosongkan filter dengan **Reset**. |
| Ekstensi tidak ditemukan atau belum dipasang | Ekstensi sudah dicopot atau belum dipasang untuk faskes ini. | Hubungi superadmin. |
| Akses ditolak: perlu hak modul … | Peran Anda tidak punya hak atas modul yang disyaratkan ekstensi. | Minta admin menambahkan hak modul tersebut di **Datamaster › Role**. |
| … wajib diisi | Kolom kaitan atau parameter wajib pada ekstensi masih kosong. | Isi kolom yang ditandai bintang merah. |

## Pertanyaan yang sering diajukan
**Mengapa angka laporan berbeda dengan laporan di menu modul?** Laporan di menu **Laporan** adalah rekap lintas layanan, sedangkan laporan modul hanya mencakup modul itu. Pastikan filter tanggal, jenis kunjungan, dan metode bayar sama.

**Laporan pendapatan ada di mana?** Gunakan **Pembayaran › Laporan › Pendapatan** atau **Farmasi › Laporan › Pendapatan**. Rekapitulasi Pendapatan di menu Laporan belum tersedia. Pimpinan yang berizin juga dapat melihat pendapatan, kas, dan piutang di tab **Keuangan** pada **Dashboard Eksekutif** (lihat `dashboard.md`).

**Mengapa menu Ekstensi tidak ada?** Menu ini hanya muncul bila ada ekstensi yang terpasang untuk faskes dan peran Anda punya hak modulnya.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **Laporan**). Ekstensi dipasang dan dicopot oleh superadmin di **Setting › Ekstensi**.
- Peran belum punya izin: admin › **Datamaster › Role** (modul Laporan).

## Catatan untuk peninjau
- **Rekapitulasi Pendapatan** masih berupa halaman contoh dengan data contoh tetap di kode. Menu ini disembunyikan kecuali di lingkungan pengembangan (`VITE_SHOW_STUB_MENU`), sehingga tidak dibahas sebagai tugas.
- Daftar izin Laporan memuat "Rekapitulasi Pendapatan Fisioterapi", tetapi tidak ada menunya di **Laporan**.
- Pilihan **Jenis Kunjungan** di filter hanya **Rawat Jalan**, **Rawat Inap**, dan **IGD**, sedangkan kode juga mengenal "APS". Mohon dicek apakah APS perlu bisa disaring.
- Pengelompokan umur pada **Rekapitulasi Diagnosis** (isi kolom **Kunjungan**) belum terbaca rinci dari kode. Mohon dilengkapi peninjau.
