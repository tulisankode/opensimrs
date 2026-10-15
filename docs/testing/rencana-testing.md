# Rencana & Skenario Testing OpenSIMRS — Kesiapan Rilis Rumah Sakit

| Atribut | Nilai |
|---|---|
| Aplikasi | OpenSIMRS (SIMRS, 15 service backend + frontend) |
| Versi dokumen | 1.0 — 12 Oktober 2026 |
| Lingkungan uji | Staging, mis. `https://simrs.contoh.id` (API `https://api.simrs.contoh.id`) |
| Jumlah skenario | 100 (tersebar di 15 modul & 9 jenis test) |
| Tujuan | Membuktikan OpenSIMRS aman, benar, dan stabil untuk operasional harian rumah sakit |

---

## 1. Tujuan & Kriteria Rilis

OpenSIMRS **boleh dirilis ke rumah sakit** hanya bila semua kriteria berikut terpenuhi:

| # | Kriteria | Target |
|---|---|---|
| R1 | Skenario prioritas **P1** lulus | 100% |
| R2 | Seluruh skenario lulus | ≥ 95%, sisanya tanpa dampak klinis/finansial |
| R3 | Defect terbuka | 0 *Critical*, 0 *High* |
| R4 | Alur end-to-end pasien (§6, E2E-01 s.d. E2E-05) | Lulus tanpa workaround |
| R5 | Keamanan (§6, SEC) | Tidak ada akses lintas faskes/role, tidak ada data pasien bocor |
| R6 | Performa (§6, PERF) | Memenuhi target pada beban jam sibuk |
| R7 | Backup & restore | Diuji berhasil, RPO ≤ 24 jam, RTO ≤ 4 jam |
| R8 | UAT | Ditandatangani perwakilan admisi, perawat, dokter, farmasi, laboratorium, kasir, dan manajemen RS |
| R9 | Pelatihan & SOP | Pengguna kunci tiap unit sudah dilatih; SOP gangguan sistem (downtime) tersedia |

## 2. Ruang Lingkup

**Dalam lingkup:** Login & hak akses, Datamaster, Setting, Antrian (APM, layar, jadwal dokter), Admisi, Rawat Jalan, Rekam Medis, IGD, Rawat Inap, Farmasi, Laboratorium, Fisioterapi, Pembayaran, Inventory/Stok, Laporan & Dashboard.

**Di luar lingkup (catat sebagai risiko rilis):**

- Bridging **BPJS (PCare/VClaim/SEP)** dan **SATUSEHAT** — tersedia di `bpjs-service` dan `satusehat-service`, tetapi diuji terpisah di sandbox BPJS/SATUSEHAT dengan kredensial faskes (lihat [Lingkungan](../LINGKUNGAN.md)).
- Integrasi alat laboratorium (LIS/bridging) dan PACS.

## 3. Jenis Test

| Kode | Jenis | Tujuan | Pelaksana | Kapan |
|---|---|---|---|---|
| SMK | *Smoke* | Semua service hidup, login, menu utama terbuka | QA / CI | Setiap deploy |
| FUN | Fungsional | Fitur bekerja sesuai aturan bisnis | QA | Per modul |
| NEG | Negatif & validasi | Input salah ditolak dengan pesan jelas, data tidak rusak | QA | Per modul |
| INT | Integrasi antar-service | Data mengalir benar antar-service (admisi → antrian → rekam medis → farmasi → kasir) | QA + Dev | Setelah FUN |
| E2E | End-to-end | Perjalanan pasien lengkap lintas unit | QA + Key user | Sebelum UAT |
| REG | Regresi | Bug yang sudah diperbaiki tidak muncul lagi | QA / CI | Setiap rilis |
| PERF | Performa & beban | Responsif pada jam sibuk | Dev/DevOps | Sebelum go-live |
| SEC | Keamanan | Autentikasi, otorisasi, isolasi faskes, input berbahaya | Dev + Security | Sebelum go-live |
| REL | Keandalan & pemulihan | Backup/restore, service mati sebagian, restart | DevOps | Sebelum go-live |
| UAT | *User Acceptance* | Pengguna RS menyetujui alur kerja | Key user RS | Terakhir |

## 4. Lingkungan & Data Uji

### 4.1 Lingkungan

| Komponen | Nilai |
|---|---|
| Frontend | `https://simrs.contoh.id` (contoh) |
| API (gateway) | `https://api.simrs.contoh.id/api/v3/<modul>` (contoh) |
| Database | PostgreSQL 16 (`opensimrs`) + MongoDB 7.0 (asesmen) + Redis 7 |
| Browser | Chrome & Edge versi terbaru (utama), Firefox (sekunder) |
| Perangkat | PC loket/poli 1366×768, layar antrian TV 1920×1080, printer label & thermal |

### 4.2 Akun uji (dibuat sebelum eksekusi, satu per peran)

| Peran | Username | Dipakai untuk |
|---|---|---|
| Super admin | `root` | Setting, datamaster, user & role |
| Petugas admisi | `qa.admisi` | Pendaftaran, antrian, SEP |
| Perawat poli | `qa.perawat` | Asesmen, triase, TTV |
| Dokter | `qa.dokter` (terhubung ke praktisi) | SOAP, diagnosis, resep, order |
| Apoteker | `qa.farmasi` | Resep, penjualan obat, retur |
| Analis lab | `qa.lab` | Order & hasil lab |
| Kasir | `qa.kasir` | Pembayaran, closing |
| Gudang | `qa.gudang` | Inventory |
| Manajemen | `qa.manajemen` | Laporan & dashboard (baca saja) |

### 4.3 Data uji

Seluruh data uji **fiktif** — jangan memakai data pasien nyata. NIK uji memakai awalan `9999` agar mudah dibersihkan (`9999010101900001` dst.). Data master minimal: 2 poli (Umum, Anak), 3 dokter dengan jadwal, 2 ruang rawat inap (kelas 1 & 3, masing-masing 2 bed), 10 item obat (2 di antaranya stok 0), 3 tarif lab, 2 penjamin (Umum/Tunai & Asuransi swasta), 2 lokasi stok (Gudang Farmasi, Depo Rawat Jalan).

## 5. Alur End-to-End Utama

```
Pendaftaran (Admisi/APM) → Antrian admisi → Antrian poli → Pemeriksaan (Rekam Medis: asesmen, SOAP, diagnosis)
   → Order lab → Hasil lab → Resep → Farmasi (verifikasi → siap → diserahkan) → Kasir (tagihan, PPN, biaya admin)
   → Discharge → Laporan & dashboard
IGD → Triase → (rujuk) Rawat Inap/SPRI → Perpindahan bangsal → Resume & discharge → Pembayaran
```

---

## 6. Skenario Testing (100)

Kolom: **ID** · **Jenis** · **Skenario & langkah** · **Data uji** · **Hasil yang diharapkan** · **Prio** (P1 = wajib lulus untuk rilis, P2 = penting, P3 = minor).

### 6.1 Login & Hak Akses (6)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| AUTH-01 | SMK | Login dengan akun valid lalu buka Dashboard | `qa.admisi` / password benar | Masuk Dashboard; nama & faskes tampil; token tersimpan | P1 |
| AUTH-02 | NEG | Login dengan password salah 3 kali | `qa.admisi` / `salah123` | Ditolak "gagal login" tiap percobaan; tidak ada token | P1 |
| AUTH-03 | NEG | Login dengan akun nonaktif | User status = nonaktif | Ditolak; pesan akun tidak aktif | P2 |
| AUTH-04 | FUN | Menu mengikuti permission role | Login `qa.kasir` | Hanya menu Pembayaran & Laporan kasir tampil; URL menu lain diarahkan ke 403 | P1 |
| AUTH-05 | FUN | Sesi kedaluwarsa | Biarkan idle > 1 jam lalu klik menu | Diminta login ulang; tidak ada data tersimpan setengah | P2 |
| AUTH-06 | FUN | Logout | Klik Keluar lalu tombol Back browser | Kembali ke login; halaman sebelumnya tidak bisa diakses | P2 |

### 6.2 Datamaster (6)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| DM-01 | FUN | Tambah praktisi dokter & hubungkan ke pegawai | dr. QA Satu, Sp.A, poli Anak | Tersimpan; muncul di pilihan dokter pendaftaran & jadwal | P1 |
| DM-02 | FUN | Tambah poli/lokasi baru | Poli Gigi, kode `PG` | Muncul di admisi, antrian, dan filter poli | P2 |
| DM-03 | FUN | Tambah tarif tindakan & komponen tarif | "Konsultasi Spesialis" Rp150.000 (jasa medis 100.000 + sarana 50.000) | Total sesuai; dipakai di tindakan RM & tagihan kasir | P1 |
| DM-04 | NEG | Kode duplikat | Tambah poli kode `PG` lagi | Ditolak dengan pesan kode sudah ada | P2 |
| DM-05 | FUN | Cari diagnosis ICD-10 | Kata kunci "J06.9" dan "ispa" | Hasil relevan muncul < 2 detik | P2 |
| DM-06 | FUN | Buat role & atur permission menu | Role "Perawat IGD": IGD baca/tulis, Farmasi tidak | Login user role tsb hanya bisa akses sesuai pengaturan | P1 |

### 6.3 Setting (3)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| SET-01 | FUN | Ubah profil faskes | Nama, alamat, telepon, logo baru | Tersimpan; tampil di header & kop cetakan | P2 |
| SET-02 | FUN | Aktifkan PPN & biaya administrasi | PPN 11%, biaya admin Rp10.000 | Tagihan kasir baru menghitung PPN & biaya admin dengan benar | P1 |
| SET-03 | REG | Semua halaman Setting terbuka tanpa error | Profil Faskes, Integrasi, Print Out, Profil Akun, System | Tidak ada 404/500 (regresi path `/setting/setting/...`) | P1 |

### 6.4 Antrian, APM & Layar (7)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| ANT-01 | FUN | Atur jadwal dokter dengan kuota | dr. QA Satu, Senin–Jumat 08–12, kuota 20 (JKN 10, non-JKN 10) | Jadwal tampil; kuota tercatat terpisah JKN/non-JKN | P1 |
| ANT-02 | FUN | Pasien lama check-in di APM | No. RM pasien uji `PU-01` | Tiket antrian poli tercetak; muncul di Data Antrian tab Rawat Jalan | P1 |
| ANT-03 | FUN | Pasien baru ambil antrian admisi di APM | Pasien baru non-JKN | Tiket antrian admisi; muncul di tab Admisi | P1 |
| ANT-04 | INT | Panggil antrian poli dari layar | Status 0 → 1 (Panggil) | Status tersimpan; nama & nomor tampil di layar antrian TV | P1 |
| ANT-05 | FUN | Lewati lalu panggil ulang | Status 1 → 2 (Lewati) → 1 | Masuk daftar Terlewat lalu bisa dipanggil lagi | P2 |
| ANT-06 | NEG | Kuota habis | Daftar pasien ke-21 pada jadwal kuota 20 | Ditolak/diarahkan ke jadwal lain; kuota tidak minus | P1 |
| ANT-07 | REG | Antrian dari pendaftaran admisi tersimpan lengkap | Daftar RJ pasien lama | Baris antrian memiliki `rawat_jalan_uuid`, `status_panggilan`=0, `jenis_pasien` (regresi bug atribut camelCase) | P1 |

### 6.5 Admisi / Pendaftaran (9)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| ADM-01 | FUN | Daftar pasien baru lengkap | Budi Uji, KTP `9999010101900001`, L, 01-01-1990, alamat lengkap | No. RM format `NN-NN-NN` terbit; data lengkap tersimpan | P1 |
| ADM-02 | NEG | NIK bukan 16 digit | KTP `99990101019` | Ditolak; pesan format NIK | P1 |
| ADM-03 | NEG | NIK sudah terdaftar | KTP `9999010101900001` lagi | Ditolak "No Identitas Pasien sudah terdaftar"; tidak ada pasien ganda | P1 |
| ADM-04 | FUN | Pasien dengan paspor | WNA, Paspor `A12345678` | Tersimpan; validasi format paspor | P2 |
| ADM-05 | FUN | Cari pasien | Kata kunci nama sebagian, No. RM, NIK | Hasil benar; pencarian tidak peka huruf besar | P1 |
| ADM-06 | REG | Buka detail pasien tanpa data alamat | Pasien lama hasil migrasi tanpa alamat | Detail terbuka (bukan 404); kolom alamat kosong | P2 |
| ADM-07 | FUN | Daftar rawat jalan pasien lama, penjamin Tunai | PU-01 → poli Umum, dr. QA Dua | Kunjungan RJ + nomor antrian poli terbit | P1 |
| ADM-08 | FUN | Daftar dengan penjamin asuransi | Penjamin "Asuransi QA", no. polis `POL-0001`, kelas 1 | Penjamin tercatat; muncul di tagihan | P2 |
| ADM-09 | FUN | Pendaftaran bayi baru lahir | Ibu = Siti Uji (pasien), bayi lahir hari ini | Bayi mendapat No. RM sendiri dan tercatat di laporan bayi baru lahir | P2 |

### 6.6 Rawat Jalan / Poli (6)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| RJ-01 | FUN | Daftar antrian poli per tab | Tab Antrian Aktif / Terlewat / Selesai, filter poli Anak | Data sesuai status & poli | P1 |
| RJ-02 | FUN | Pasien dipanggil dan diproses | Status 1 → 3 (Proses) | Pasien pindah ke "sedang diperiksa"; rekam medis bisa dibuka | P1 |
| RJ-03 | FUN | Batal kunjungan dengan alasan | Alasan "pasien pulang sebelum diperiksa" | Status batal; muncul di laporan pembatalan poli; tidak masuk tagihan | P2 |
| RJ-04 | NEG | Batal tanpa alasan | Alasan kosong | Ditolak; alasan wajib | P3 |
| RJ-05 | INT | Selesai poli membuat antrian farmasi | Status 3 → 4 (Selesai) dengan resep | Antrian farmasi otomatis terbentuk | P1 |
| RJ-06 | REG | Laporan rekap tindakan RJ | Filter bulan berjalan | Data tampil (bukan 404/500); total sesuai tindakan (regresi route & kolom `tanggal_tindakan`) | P2 |

### 6.7 Rekam Medis (9)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| RM-01 | REG | Buka rekam medis pasien dari poli | Pasien PU-01 status Proses | Sesi RM terbuka; semua tab (Riwayat, Asesmen, SOAP, Penunjang, Alkes, Inform Consent, Unggah Berkas, Resume) tanpa error | P1 |
| RM-02 | FUN | Isi asesmen & TTV | TD 120/80, nadi 80, suhu 36,8, BB 65, TB 170 | Tersimpan di MongoDB; tampil di riwayat kunjungan | P1 |
| RM-03 | NEG | TTV di luar batas wajar | Suhu 60 °C, TD 500/300 | Ditolak/diberi peringatan; tidak tersimpan tanpa konfirmasi | P2 |
| RM-04 | FUN | SOAP & diagnosis ICD-10 | S: demam 3 hari; A: J06.9 (primer) | Tersimpan; diagnosis masuk laporan rekap diagnosis | P1 |
| RM-05 | FUN | Input tindakan dengan petugas | Tindakan "Nebulizer" × 1, petugas perawat & dokter | Tindakan & petugas tersimpan; tarif masuk tagihan | P1 |
| RM-06 | FUN | Inform consent | Persetujuan tindakan, tanda tangan wali | Dokumen tersimpan & bisa dicetak | P2 |
| RM-07 | FUN | Unggah berkas penunjang | PDF hasil rontgen 2 MB | Berkas tersimpan & bisa dibuka; tipe/ukuran tidak valid ditolak | P2 |
| RM-08 | FUN | Riwayat kunjungan lintas waktu | Pasien dengan 3 kunjungan sebelumnya | Riwayat urut terbaru; isi kunjungan lama tidak bisa diubah | P1 |
| RM-09 | INT | Resume & discharge | Kondisi pulang "Sembuh", edukasi diisi | Status pulang tersimpan; history tindakan & billing layanan terbentuk | P1 |

### 6.8 IGD (5)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| IGD-01 | FUN | Daftar pasien IGD lama | PU-02, keluhan "nyeri dada", dokter jaga | No. registrasi `REG…` & pelayanan `IGD…` terbit | P1 |
| IGD-02 | FUN | Pasien IGD tanpa identitas | Laki-laki tak dikenal ± 40 th | Bisa didaftarkan & diberi identitas sementara; dapat dilengkapi kemudian | P1 |
| IGD-03 | FUN | Triase | Kategori merah, TTV kritis, kendaraan "Ambulans" | Triase tersimpan & tampil di daftar pasien IGD | P1 |
| IGD-04 | INT | Rujuk IGD ke rawat inap (SPRI) | Ruang kelas 3, bed tersedia | Pasien masuk rawat inap; bed terisi | P1 |
| IGD-05 | REG | Laporan kunjungan & pembatalan IGD | Rentang tanggal hari ini | Data tampil tanpa 404/500 (regresi base path IGD) | P2 |

### 6.9 Rawat Inap (6)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| RI-01 | FUN | Monitoring kamar | Ruang kelas 1 (2 bed), kelas 3 (2 bed) | Status bed kosong/terisi akurat | P1 |
| RI-02 | NEG | Masukkan pasien ke bed yang terisi | Bed 1 kelas 3 sudah terisi | Ditolak; tidak ada dua pasien di satu bed | P1 |
| RI-03 | FUN | Ajukan & setujui perpindahan bangsal | Kelas 3 → kelas 1 | Request "pending" → disetujui; bed lama kosong, bed baru terisi | P1 |
| RI-04 | FUN | Tolak perpindahan bangsal | Alasan "kelas 1 penuh" | Pasien tetap di bed lama; riwayat perpindahan tercatat | P2 |
| RI-05 | FUN | Tindakan & obat harian selama rawat inap | 3 hari, visite dokter harian | Tindakan per hari tercatat; tagihan akumulatif | P1 |
| RI-06 | INT | Discharge rawat inap | Pulang hari ke-3 | Bed kosong; tagihan rawat inap lengkap (kamar × hari + tindakan + obat) | P1 |

### 6.10 Farmasi (7)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| FAR-01 | INT | Resep dari dokter masuk farmasi | Paracetamol 500 mg 3×1 (10 tab), Amoxicillin 500 mg 3×1 (15 kps) | Resep muncul di Resep Dokter dengan antrian farmasi | P1 |
| FAR-02 | FUN | Verifikasi → siap → diserahkan | Resep FAR-01 | Status berurutan; stok Depo RJ berkurang sesuai jumlah | P1 |
| FAR-03 | NEG | Resep obat stok 0 | Item uji stok 0 | Diberi peringatan stok tidak cukup; tidak bisa diserahkan | P1 |
| FAR-04 | FUN | Resep racikan | Puyer: 3 obat dibagi 10 bungkus | Harga & aturan pakai benar; jenis resep racikan di antrian | P2 |
| FAR-05 | FUN | Penjualan obat bebas (OTC/APS) | Pembeli umum, 2 item | Transaksi tersimpan; stok berkurang; struk tercetak | P2 |
| FAR-06 | FUN | Retur obat | Retur 5 tab dari FAR-02 | Stok bertambah kembali; tagihan disesuaikan | P2 |
| FAR-07 | REG | Tab Alkes rekam medis tanpa order | Pasien baru tanpa order alkes | Daftar kosong tanpa pesan galat (regresi 400 "data tidak ditemukan") | P3 |

### 6.11 Laboratorium (5)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| LAB-01 | INT | Order lab dari rekam medis | Darah lengkap + gula darah sewaktu | Order muncul di Order Lab dengan status order | P1 |
| LAB-02 | FUN | Input hasil & nilai rujukan | Hb 9,5 g/dL (rujukan 13–17) | Hasil tersimpan; nilai di luar rujukan ditandai | P1 |
| LAB-03 | FUN | Expertise & cetak hasil | Catatan dokter PK | Hasil tercetak dengan kop faskes & nama penanggung jawab | P2 |
| LAB-04 | NEG | Input hasil non-numerik pada parameter numerik | Hb = "abc" | Ditolak; pesan validasi | P2 |
| LAB-05 | REG | Laporan rekap pemeriksaan lab dengan filter tanggal | Rentang 1 bulan | Tanpa 500; filter tanggal awal & akhir benar (regresi kolom varchar & `<=`) | P2 |

### 6.12 Fisioterapi (2)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| FIS-01 | FUN | Order → booking → penjadwalan terapi | 6 sesi, 2×/minggu, bed terapi 1 | Jadwal terbentuk tanpa bentrok bed | P2 |
| FIS-02 | FUN | Evaluasi terapi & laporan | Sesi ke-6 selesai | Evaluasi tersimpan; muncul di rekap terapi & pendapatan | P3 |

### 6.13 Pembayaran / Kasir (6)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| PAY-01 | INT | Tagihan rawat jalan lengkap | Konsultasi 150.000 + nebulizer 75.000 + obat 42.500 + lab 120.000 | Rincian & total 387.500 benar; PPN & biaya admin sesuai Setting | P1 |
| PAY-02 | FUN | Pembayaran tunai dengan kembalian | Total 387.500, dibayar 400.000 | Kembalian 12.500; status lunas; kuitansi tercetak | P1 |
| PAY-03 | FUN | Pembayaran sebagian & pelunasan (closed bill) | Bayar 200.000 lalu pelunasan 187.500 | Sisa tagihan benar; setelah pelunasan status lunas | P1 |
| PAY-04 | NEG | Bayar kurang dari total tanpa opsi cicil | Total 387.500, dibayar 300.000 | Ditolak atau dicatat sebagai piutang sesuai SOP; tidak tercatat lunas | P1 |
| PAY-05 | FUN | Tagihan penjamin asuransi | Penjamin "Asuransi QA" | Porsi penjamin & porsi pasien terpisah | P2 |
| PAY-06 | FUN | Closing kasir harian | 10 transaksi uji | Total closing = jumlah transaksi; laporan pendapatan sama dengan closing | P1 |

### 6.14 Inventory / Stok (5)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| INV-01 | FUN | Pengadaan → verifikasi → penerimaan | 100 tab Paracetamol dari "Supplier QA", batch `B001`, ED 2028-12 | Stok Gudang Farmasi +100; batch & ED tercatat | P1 |
| INV-02 | FUN | Pengeluaran ke unit & verifikasi pengiriman | 40 tab Gudang → Depo RJ | Gudang −40, Depo +40; kartu stok kedua lokasi tercatat | P1 |
| INV-03 | FUN | Stok opname dengan selisih | Fisik 58, sistem 60 | Adjustment −2 tercatat dengan alasan; stok akhir 58 | P1 |
| INV-04 | REG | Buka Kartu Stok & Riwayat Mutasi | Halaman Inventory › Kartu Stok & Mutasi | Lokasi stok terpilih otomatis; data tampil tanpa 400 | P2 |
| INV-05 | FUN | Laporan obat mendekati kedaluwarsa | Item ED ≤ 3 bulan | Item muncul di laporan obat expired | P2 |

### 6.15 Laporan & Dashboard (3)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| LAP-01 | FUN | Laporan jumlah kunjungan & rekap diagnosis | Bulan uji | Angka = jumlah kunjungan & diagnosis yang dibuat pada skenario sebelumnya | P1 |
| LAP-02 | REG | Rekap tindakan: tanpa filter, filter penjamin, filter tanggal | Tanpa filter; payment_method=1; 01–31 bulan uji; tanggal terbalik | Tanpa filter = semua; filter benar; tanggal terbalik ditolak 400 (regresi validator) | P1 |
| LAP-03 | FUN | Ekspor laporan ke Excel | Rekap pendapatan bulan uji | File terunduh; angka sama dengan layar | P2 |

### 6.16 End-to-End (5)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| E2E-01 | E2E | Pasien baru rawat jalan tunai: daftar → antrian → poli → RM → resep → farmasi → kasir → laporan | Andi Uji, NIK `9999010101900011`, poli Umum | Seluruh tahap tanpa input ulang data; angka di kasir, farmasi, laporan konsisten | P1 |
| E2E-02 | E2E | Pasien lama via APM + order lab + resep racikan | PU-03, poli Anak | Antrian APM → hasil lab tampil di RM → racikan diserahkan → lunas | P1 |
| E2E-03 | E2E | IGD → rawat inap → perpindahan bangsal → discharge → pembayaran | Pasien IGD-01 | Tagihan akhir mencakup IGD + kamar 2 kelas + tindakan + obat | P1 |
| E2E-04 | E2E | Pasien asuransi swasta rawat jalan | Penjamin "Asuransi QA" | Porsi penjamin/pasien benar sampai laporan penjamin | P2 |
| E2E-05 | E2E | Hari operasional penuh di satu poli | 30 pasien fiktif, 2 dokter, 1 apoteker, 1 kasir | Semua pasien selesai; closing kasir & stok akhir sesuai | P1 |

### 6.17 Performa (3)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| PERF-01 | PERF | Beban pendaftaran jam sibuk (k6/JMeter) | 50 pengguna serentak, 15 menit | p95 respons API < 1 dtk; error < 1%; No. RM tidak ganda | P1 |
| PERF-02 | PERF | Pencarian pasien pada data besar | 100.000 pasien uji | Hasil < 2 dtk | P2 |
| PERF-03 | PERF | Layar antrian berjalan 8 jam | TV + polling terus | Tidak ada kebocoran memori; data tetap mutakhir | P2 |

### 6.18 Keamanan (4)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| SEC-01 | SEC | Isolasi data antar-faskes | Token faskes A meminta data pasien faskes B (ubah `faskes_uuid`/header) | Ditolak; tidak ada data faskes lain yang terbaca | P1 |
| SEC-02 | SEC | Token dimanipulasi / kedaluwarsa | JWT diubah isinya, JWT lewat 1 jam | 401 di semua service | P1 |
| SEC-03 | SEC | Injeksi pada kolom pencarian | `' OR 1=1 --`, `<script>alert(1)</script>` | Tidak ada error SQL/data bocor; skrip tidak tereksekusi saat ditampilkan | P1 |
| SEC-04 | SEC | Akses API langsung tanpa izin menu | Login `qa.kasir`, panggil API datamaster user | Ditolak (403) walau URL diketahui | P1 |

### 6.19 Keandalan & Pemulihan (2)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| REL-01 | REL | Backup & restore penuh | Backup PostgreSQL + MongoDB, restore ke server kosong | Data identik (jumlah pasien, kunjungan, transaksi); RTO ≤ 4 jam | P1 |
| REL-02 | REL | Satu service mati saat operasional | Hentikan farmasi-service 5 menit | Modul lain tetap berjalan; pesan jelas di farmasi; setelah pulih tidak ada data hilang | P1 |

### 6.20 Kompatibilitas (1)

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| CMP-01 | FUN | Browser, resolusi & cetak | Chrome/Edge/Firefox; 1366×768 & 1920×1080; printer label & thermal 58/80 mm | Tata letak tidak rusak; label pasien, tiket antrian, dan kuitansi tercetak benar | P2 |

---

## 7. Ringkasan Distribusi

| Modul | Jumlah | Jenis test | Jumlah |
|---|---|---|---|
| Login & hak akses | 6 | Smoke | 1 |
| Datamaster | 6 | Fungsional | 55 |
| Setting | 3 | Negatif & validasi | 12 |
| Antrian | 7 | Integrasi | 8 |
| Admisi | 9 | End-to-end | 5 |
| Rawat Jalan | 6 | Regresi | 10 |
| Rekam Medis | 9 | Performa | 3 |
| IGD | 5 | Keamanan | 4 |
| Rawat Inap | 6 | Keandalan | 2 |
| Farmasi | 7 | | |
| Laboratorium | 5 | | |
| Fisioterapi | 2 | | |
| Pembayaran | 6 | | |
| Inventory | 5 | | |
| Laporan | 3 | | |
| E2E / Performa / Keamanan / Keandalan / Kompatibilitas | 15 | | |
| **Total** | **100** | **Total** | **100** |

Prioritas: P1 = 63, P2 = 34, P3 = 3.

## 8. Pelaksanaan

| Tahap | Isi | Durasi | Keluaran |
|---|---|---|---|
| 1. Persiapan | Akun uji, data master (§4.3), checklist alat (printer, TV, APM) | 2 hari | Lingkungan siap |
| 2. Smoke & regresi | AUTH, SET-03, ANT-07, ADM-06, RJ-06, RM-01, IGD-05, FAR-07, LAB-05, INV-04, LAP-02 | 1 hari | Tidak ada blocker |
| 3. Fungsional & negatif | Semua skenario FUN/NEG per modul | 5 hari | Daftar defect |
| 4. Integrasi & E2E | INT & E2E | 3 hari | Alur pasien lulus |
| 5. Non-fungsional | PERF, SEC, REL, CMP | 3 hari | Laporan performa & keamanan |
| 6. Perbaikan & retest | Retest defect + regresi penuh | 3–5 hari | Semua P1 lulus |
| 7. UAT | Key user tiap unit menjalankan E2E-01 s.d. E2E-05 dengan alur kerja RS | 3 hari | Berita acara UAT |
| 8. Go/No-Go | Tinjau §1 bersama manajemen RS | 1 hari | Keputusan rilis |

### 8.1 Klasifikasi defect

| Tingkat | Definisi | Contoh | Batas rilis |
|---|---|---|---|
| Critical | Keselamatan pasien, data hilang/salah pasien, sistem mati | Hasil lab tertukar pasien; tagihan pasien lain | 0 |
| High | Alur utama terhenti tanpa jalan lain | Resep tidak bisa diserahkan | 0 |
| Medium | Ada jalan lain / dampak terbatas | Filter laporan salah | Boleh dengan rencana perbaikan |
| Low | Kosmetik | Salah ketik label | Boleh |

### 8.2 Format pencatatan hasil

Untuk setiap eksekusi catat: ID skenario · tanggal · penguji · versi/commit · **Lulus/Gagal/Terblokir** · bukti (screenshot/No. RM/No. transaksi) · ID defect bila gagal.

## 9. Risiko yang Sudah Diketahui (wajib ditinjau sebelum Go/No-Go)

| Risiko | Dampak | Status / mitigasi |
|---|---|---|
| Satu API key statis untuk semua faskes pada endpoint `check-patient` | Data pasien faskes lain dapat dibaca | Ganti dengan API key per faskes sebelum multi-faskes produksi (SEC-01) |
| `Context` global di admisi-service dapat tertukar antar request | Data faskes tertukar pada beban tinggi | Uji PERF-01 + SEC-01; perbaiki menjadi per-request |
| Pembuatan No. RM `count + 1` tanpa penguncian | No. RM ganda saat pendaftaran serentak | Uji PERF-01; perbaiki dengan sequence |
| BPJS/SATUSEHAT belum tervalidasi di sandbox resmi untuk setiap faskes | Klaim/sinkron gagal saat go-live | Uji di sandbox dengan kredensial faskes sebelum memakai endpoint produksi |
| MongoDB dipin 7.0 di lingkungan Docker Desktop | Versi 8+/9 gagal start di kernel ≥ 6.19 | Gunakan 7.0 atau server Linux dengan kernel didukung |
| `SECRET_KEY` berbeda antar layanan | Pengguna ter-logout saat membuka modul | Selesai di tingkat kode: HS256 bagian dari `packages/authorization-sdk`; pastikan `SECRET_KEY` sama di semua layanan |

## 10. Regresi Tambahan (di luar 100 skenario inti)

Skenario berikut ditambahkan setiap kali defect diperbaiki, agar defect yang sama tidak muncul lagi. Dijalankan bersama kelompok REG.

| ID | Jenis | Skenario & langkah | Data uji | Hasil yang diharapkan | Prio |
|---|---|---|---|---|---|
| RGX-01 | REG | Buka dialog Stok (tombol "Stok" di sidebar) › Permintaan Unit, Verifikasi & Pengiriman Unit, Pengeluaran Unit, Retur Unit, Penerimaan Unit, Penerimaan Retur Unit | Lokasi stok "Gudang Logistik" | Setiap halaman memuat daftar dari `/api/v3/stok/*` (bukan URL kosong); tidak ada respons 5xx | P1 |
| RGX-02 | REG | Daftar Permintaan Unit & Pengeluaran Unit menampilkan lokasi awal | Data permintaan/pengeluaran yang sudah ada | Respons 200 berisi `lokasi_awal` / `lokasi_stok_awal`; sebelumnya 500 (SequelizeEagerLoadingError) | P1 |
| RGX-03 | REG | Admisi › Data Pasien › centang 1 pasien › Non-Aktifkan › "Iya, Non-aktifkan" | Pasien uji NIK `9999…` | Toast sukses; pasien hilang dari daftar aktif; indikator loading tertutup | P2 |
| RGX-04 | REG | Farmasi › Resep Dokter › detail resep › Cetak › E-Tiket, E-Resep, Salinan E-Resep | Resep non-racikan & racikan | PDF terbuka: E-Tiket satu label per obat (nama pasien, aturan pakai, nama obat/komposisi racikan); E-Resep & salinan berisi R/ lengkap. Tidak ada teks "undefined" atau "Nama Obat Tidak Ditemukan" | P1 |
| RGX-05 | REG | Dashboard: buka setelah login, ubah rentang tanggal | Rentang 30 hari terakhir & rentang berisi data | Kartu, grafik kunjungan, status RJ, pemasukan/pengeluaran, gender, Top 5 Poli & Top 5 DPJP berasal dari `/api/v3/laporan/dashboard/rekap/*` (bukan angka statis); preflight CORS 204; kunjungan pada tanggal akhir ikut terhitung | P1 |
| RGX-06 | REG | Laporan › Jumlah Kunjungan, Rekap Tindakan, Rekap Pemeriksaan Lab, Rekap Diagnosis: filter jenis kunjungan, metode bayar/jenis kelamin, cari nama, rentang tanggal, paginasi, Eksport | Data periode berjalan; diagnosis berisi tanda kutip | Data dari `/api/v3/laporan/rekap/*`; nama tindakan (bukan uuid); export memuat semua baris (bukan 12) & berkas xlsx terunduh; ekspor lab berisi data lab; super admin bisa membuka Rekap Diagnosis | P1 |
| RGX-07 | REG | RME › Penunjang › Order Lab: pilih pemeriksaan, Kirim Order Lab; buka detail RME (Laboratorium) | Pasien RJ, pemeriksaan aktif & satu tarif yang kelompoknya sudah dihapus | Dokter pengirim terisi DPJP & unit asal = poli kunjungan; order tersimpan & tampil di Riwayat Order Lab beserta pemeriksaan & tarif (bukan data dummy "LAB1234"); tarif rusak ditolak dengan pesan jelas (400, bukan 500); order muncul di Laboratorium › Order Lab | P1 |
| RGX-08 | REG | RME › Instruksi Medis: tulis instruksi lewat dialog (tampilan besar) lalu Simpan | Instruksi & dokter | Instruksi tersimpan dan tampil di riwayat instruksi | P2 |
| RGX-09 | REG | Cetak hasil lab: Laboratorium › Expertise › detail › Print Hasil; RME › Order Lab › order Selesai › Cetak Hasil | Order lab status Selesai dengan hasil & catatan expertise | PDF A4 terbuka: identitas pasien, no. order, dokter pengirim, tabel hasil (hasil/flag/satuan/nilai rujukan/metode; flag abnormal merah), catatan expertise tanpa tag HTML, penanggung jawab | P1 |
| RGX-10 | REG | Laboratorium › Order Lab › detail order › Asesmen Medis › Rekam Medis | Order pasien RJ aktif; order pasien APS tanpa rekam medis | RME pasien terbuka dalam mode Riwayat Pemeriksaan (baca saja); pasien tanpa rekam medis → pesan peringatan, bukan backdrop kosong / error `reading id` | P1 |
| RGX-11 | REG | Setting › Konfigurasi Integrasi › Sinkronisasi SATUSEHAT: Uji Koneksi, Kirim per kunjungan, Kirim Sekarang | Kredensial sandbox SATUSEHAT; kunjungan RJ selesai dengan diagnosis ICD-10 + tanda vital, pasien NIK terdaftar | Uji koneksi menampilkan nama organisasi; kunjungan terkirim (Encounter + Condition + Observation) dengan ID Encounter; kirim ulang tidak membuat data ganda; kunjungan tanpa diagnosis/NIK gagal dengan alasan jelas; Client Secret tampil tersamar | P1 |
| RGX-12 | REG | Setting › Konfigurasi Integrasi › BPJS PCare: simpan konfigurasi, Uji Koneksi, Cek Peserta, pemetaan poli & dokter, kirim kunjungan BPJS | Kredensial PCare development; pasien penjamin BPJS (no. kartu 13 digit); kunjungan RJ selesai dengan diagnosis ICD-10 | Rahasia tampil tersamar & tersimpan terenkripsi; uji koneksi membaca daftar poli FKTP; pendaftaran mendapat nomor urut & kunjungan mendapat nomor kunjungan; kirim ulang tidak ganda; poli/dokter belum dipetakan atau diagnosis kosong → alasan jelas | P1 |
| RGX-13 | REG | Setting › Konfigurasi Integrasi › BPJS VClaim (simpan, Uji Koneksi, pemetaan poli) dan Admisi › SEP Rawat Jalan / Rawat Inap / IGD: cari peserta, pilih rujukan, buat SEP, detail, hapus SEP | Kredensial VClaim development + kode PPK RS; peserta aktif dengan rujukan FKTP; untuk rawat inap nomor SPRI | Rahasia tampil tersamar & tersimpan terenkripsi (kolom lama dikosongkan); memilih rujukan mengisi poli & diagnosis awal; DPJP terisi dari referensi poli; SEP terbit dan tercatat di daftar sesuai jenis pelayanan; hapus SEP mengubah status menjadi Dihapus; peserta tidak aktif / tanpa rujukan / tanpa SPRI ditolak dengan alasan jelas | P1 |
| RGX-14 | REG | Admisi › Rawat Jalan › Daftar pasien baru tunai: isi identitas (tanggal lahir diketik dd-mm-yyyy), poli, DPJP, jadwal → Simpan → General Consent → Setuju & Simpan | Pasien baru NIK 16 digit, jadwal dokter hari ini | Jadwal hanya menampilkan jadwal hari ini milik dokter & poli terpilih (dengan sisa kuota); RT/RW/kode pos/bahasa tidak wajib; isian kurang ditandai sebelum dialog consent; format consent terpilih otomatis; pasien + kunjungan + consent tersimpan dan pindah ke Detail; consent gagal tidak menutup dialog diam-diam | P1 |
| RGX-15 | REG | Rawat Jalan › Poli › buka pasien (perawat) → Asesmen › Tanda Vital: isi suhu "38.4", TD, nadi, nafas, SpO2 → Simpan | Pasien dewasa & pasien anak (< 18 th) | Header menampilkan poli kunjungan (bukan "POLI MATA"); tidak ada notifikasi "Akses ditolak" alkes; suhu tersimpan 38,4 (bukan 384); kolom PEWS anak hanya tampil & wajib untuk pasien anak; gula darah opsional; waktu asesmen terisi otomatis | P1 |
| RGX-16 | REG | Laboratorium › Hasil Pemeriksaan & Expertise › detail order → Detail Rekam Medis dan Riwayat | Order pasien RJ dengan RM; order pasien APS; order divalidasi tanpa spesimen; order dengan data pasien terhapus | RME pasien terbuka (mode riwayat, tanpa galat izin alkes untuk petugas lab); pasien APS → pesan jelas; Riwayat menampilkan order lab pasien lain + hasil per item & flag; daftar tetap tampil walau ada order tanpa data pasien; detail order tanpa spesimen tidak error 500 | P1 |
| RGX-17 | REG | Setting › Konfigurasi Integrasi › Konfigurasi LIS: tambah 2 koneksi, jadikan bawaan, kunci masuk baru, pemetaan kode LIS item | Endpoint registrasi adamLIS + API key + kode RS | API key & kunci masuk tersamar dan terenkripsi; kunci masuk utuh tampil sekali beserta alamat penerima hasil; hanya satu koneksi bawaan; pemetaan kode LIS tersimpan per item | P1 |
| RGX-18 | REG | Laboratorium › Order Lab › Validasi Order → dialog: Validasi Saja / Validasi & Kirim ke LIS; LIS mengirim hasil ke /adam-lis/bridging | Order dengan tarif terpetakan & tidak terpetakan di LIS; 2 koneksi LIS aktif | Validasi saja tidak mengirim; kirim sukses menampilkan No. Lab LIS; LIS menolak (belum dimappingkan) → order tetap tervalidasi + pesan LIS + bisa Kirim Ulang di Pengiriman LIS; hasil masuk tanpa/kunci salah ditolak; hasil cocok mengisi nilai & flag order, yang tidak cocok dilaporkan | P1 |
| RGX-19 | REG | Rawat Jalan › pasien › S.O.A.P (dokter): Assesment cari diagnosis "J06.9"; Plan › Order Obat ke Depo Rawat Jalan; Plan › Pemeriksaan dan Tindakan (tindakan + petugas) | Pasien RJ hasil RGX-14/15 | Diagnosis ditemukan lewat kode maupun nama; resep berstatus Request di depo tujuan; tindakan tersimpan dan muncul sebagai item tagihan kasir (bill_item) | P1 |
| RGX-20 | REG | Resume & Discharge: isi edukasi (boleh kosong), kondisi pulang, status pulang → Simpan Resume Medis → Discharge | Pasien RJ yang sudah diperiksa | Tidak ada galat kalender; resume tersimpan; status kunjungan 5 dengan discharge_date epoch detik hari ini (bukan 1970); label kondisi "Perbaikan" | P1 |
| RGX-21 | REG | Farmasi › Resep Dokter › buka resep | Resep dari RGX-19; item tanpa stok di depo | Detail menampilkan nama, umur, tanggal lahir, cara bayar, unit, penulis resep, keluhan, alergi & diagnosis pasien sebenarnya (tanpa teks contoh); stok kosong → pesan "tidak tersedia di lokasi stok ini" (bukan HTTP 500) | P1 |
| RGX-22 | REG | Order lab dari RME rawat jalan → Laboratorium (Order, Hasil, Expertise) & laporan kunjungan | Pasien RJ dengan order lab | No. Reg order lab = No. Reg kunjungan RJ (bukan nomor baru dari lab); pasien APS tetap mendapat No. Reg lab sendiri | P1 |
| RGX-23 | REG | RME IGD › Cetak Hasil & Surat › Buat Surat › SPRI (tanggal rawat terisi otomatis) → Simpan | Pasien IGD dengan diagnosis | Surat tersimpan & PDF terbentuk (tanpa galat lokasi/poli); baris Rawat Inap status 1 muncul di Admisi › Rawat Inap dengan No. SPRI; bila pembuatan RI gagal, berkas surat tidak tersimpan | P1 |
| RGX-24 | REG | Admisi › Rawat Inap › buka pasien SPRI → kategori, kelas, ruangan, bed → consent → Simpan | Ruangan punya bed tipe "Bed" kosong | Detail RI terbuka (bukan "LokasiModel is not associated"); status_ri 3; bed terisi pasien | P1 |
| RGX-25 | REG | RME Rawat Inap › S.O.A.P › Plan › Pemeriksaan dan Tindakan → Simpan | Pasien RI dirawat | Tindakan tersimpan & tagihan RI bertambah (bukan HTTP 500 "LokasiModel is not associated to RawatInap") | P1 |
| RGX-26 | REG | RME Rawat Inap › Resume & Discharge → Discharge | Pasien RI menempati bed | status_ri 4; bed yang ditempati kembali "Tersedia" (patient kosong) dan bisa dipilih pasien berikutnya | P1 |
| RGX-27 | REG | RME › Order Obat / Order Alkes → lokasi tujuan default | Faskes punya gudang & depo | Default tujuan = depo farmasi (bukan gudang); Farmasi Ruangan › detail transaksi alkes menampilkan identitas & klinis pasien sebenarnya | P2 |
| RGX-28 | REG | Dashboard › kartu Total Antrian | Ada kunjungan booked, check-in, antrian | Total menghitung status 1–3 (tidak hanya 1) | P2 |
| RGX-29 | REG | Datamaster › Tarif › Ruangan → Tambah & Edit tarif (pilih kamar rawat inap, harga per jenis pembayaran) | Kamar RI di Monitoring Kamar | Pilihan ruangan = kamar rawat inap (nama - kelas); tersimpan & tampil dengan kategori & kelas; edit tersimpan (bukan HTTP 500) | P1 |
| RGX-30 | REG | Pasien RI dirawat beberapa hari (termasuk pindah kamar) → Resume & Discharge → Kasir | Tarif ruangan tiap kamar sudah diatur | Tagihan berisi "Sewa Kamar <kamar> (<n> hari)" kategori Biaya Kamar: hari per tanggal WIB, tanggal pulang tidak dihitung, minimal 1 hari, hari pindah ke kamar tujuan; harga sesuai cara bayar; discharge ulang tidak menggandakan biaya kamar; kamar tanpa tarif → peringatan | P1 |
| RGX-31 | REG | Header › Panggilan Antrian (Rawat Jalan): Panggil → Panggil Ulang → Proses → Selesai | Pasien RJ hari ini: satu menunggu, satu sudah discharge, satu dibatalkan | Panggil ulang tersedia setelah dipanggil; Proses mengubah status kunjungan menjadi Diperiksa; pasien discharge tampil di tab Selesai, pasien batal tidak tampil; menekan tombol tidak pernah mengembalikan kunjungan yang sudah selesai ke Diperiksa; gender "Laki-laki"/"Male" tampil benar | P1 |$'\r'
| RGX-32 | REG | Antrian › Layar › Lihat layar (layar dengan Poli) → petugas tekan Panggil / Panggil Ulang di Rawat Jalan | Browser layar: Chrome dengan suara bahasa Indonesia; klik "Tes Suara" sekali | Dalam ±3 detik layar memperbarui panggilan & terdengar ting-tong + "Nomor antrian … Silakan menuju <poli>"; panggilan ulang diumumkan lagi; panggilan poli lain tidak diumumkan di layar ini; tidak ada pengumuman berulang tanpa panggilan baru | P1 |$'\r'
| RGX-33 | REG | Antrian › Layar › Link Kiosk → buka URL /layar/:uuid?kunci=… di browser baru tanpa login | Layar dengan Poli; Chrome --kiosk --autoplay-policy=no-user-gesture-required | Layar tampil penuh tanpa login & tanpa footer; panggilan baru/ulang diumumkan; panggilan lama tidak diumumkan saat TV menyala; kunci salah → pesan "Link layar tidak berlaku"; Buat Ulang Kunci mematikan link lama | P1 |$'\r'
| RGX-34 | REG | Tabel Rawat Jalan: tombol Panggil di kolom Status → klik baris pasien ANTRI | Pasien ANTRI belum dipanggil & sudah dipanggil | Tombol Panggil/Panggil Ulang + "Dipanggil hh:mm"; klik baris pasien belum dipanggil → konfirmasi (Panggil Sekarang / Buka Tanpa Memanggil / Batal); RME dibuka → status DIPERIKSA & panggilan diproses; tabel tidak bergeser | P1 |$'\r'
| RGX-35 | REG | RME RJ › Discharge (tanpa menekan Selesai di panel) | Kunjungan dengan resep / tanpa resep | Panggilan poli selesai; antrian farmasi dibuat hanya bila ada resep (racikan/non-racikan) dan tidak dobel; tombol Selesai di panel juga tidak membuat antrian farmasi tanpa resep | P1 |$'\r'
| RGX-36 | REG | Panel megafon (di luar Admisi) sebagai dokter / perawat dengan poli tugas / admin | Akun terhubung praktisi; perawat diberi Poli Tugas di Datamaster › Praktisi | Default filter: dokter = Antrian saya, perawat = poli tugas, lainnya = semua; penghitung tab; cari nama/RM/nomor; Panggil Berikutnya memanggil nomor menunggu terkecil; banner pasien dipanggil (Panggil Ulang/Lewati); tabel RJ dokter otomatis tersaring ke dokter tsb | P2 |$'\r'
| RGX-37 | REG | Tabel Rawat Jalan kolom pembayaran | Kunjungan lunas / belum lunas / belum ada tagihan | Label sesuai status tagihan terbaru kunjungan (Lunas / Belum Lunas / Belum Ada Tagihan) | P2 |$'\r'
| RGX-38 | REG | Order lab dari RME (RJ/RI/IGD) & APS → Laboratorium › Validasi → Kasir; lalu Batal Validasi | Tarif lab berharga | Saat validasi item "Lab: <pemeriksaan>" masuk Biaya Penunjang di tagihan kunjungan asal (APS: layanan Laboratorium); validasi ulang tidak dobel; batal validasi/batal order menghapus item; bila Pembayaran gagal, validasi ditolak dengan pesan jelas | P1 |$'\r'
| RGX-39 | REG | Setting › Manajemen Modul: pilih segmen, tambah/nonaktifkan modul, simpan | Akun superadmin & akun non-superadmin | Faskes belum diatur → semua modul aktif; superadmin dapat mengganti segmen & sakelar modul (modul inti terkunci, modul "Segera" tidak bisa diaktifkan), perubahan tercatat di riwayat; non-superadmin hanya melihat (PUT ditolak 403); menu atas & sidebar menyembunyikan modul nonaktif; membuka URL modul nonaktif → halaman "Modul tidak aktif" | P1 |$'\r'
| RGX-40 | REG | Setting › Manajemen Modul & Fitur: pilih segmen, ubah sakelar fitur di bawah modul, simpan; buka RME, Kasir, Order Lab, Antrian › Layar | Superadmin; segmen Praktik Mandiri / Klinik Pratama / Puskesmas | Fitur mengikuti preset segmen (mis. praktik mandiri tanpa Alkes & Unggah Berkas; pratama tanpa bridging LIS & expertise; puskesmas tanpa diskon/voucher); fitur modul nonaktif ikut nonaktif; override superadmin tersimpan & tercatat di riwayat; tab RME, tombol Link Kiosk, diskon/voucher kasir & opsi Kirim ke LIS mengikuti status fitur; rute fitur nonaktif (APM, expertise, perpindahan bangsal) → "Modul tidak aktif"; ganti segmen mengosongkan override fitur | P1 |
| RGX-41 | REG | Manajemen Modul & Fitur › Atur bagian (Asesmen, Resume & Discharge) & Jenis Poli; buka RME RJ di poli umum/gigi/mata; simpan resume & discharge | Superadmin; segmen Praktik Mandiri & RS | Bagian wajib (alergi, anamnesis, tanda vital, pemeriksaan fisik, diagnosis, tindakan, status pulang, dst.) terkunci; praktik mandiri tanpa asesmen nyeri/kesadaran/luka bakar/askep/catatan perawat/instruksi medis & keadaan waktu pulang; chip Asesmen, lompat-ke-form & form SOAP/Resume mengikuti bagian aktif; Pemeriksaan Gigi hanya di poli Gigi & Mulut, Pemeriksaan Mata hanya di poli Mata; simpan resume berhasil walau Edukasi/Keadaan Pulang disembunyikan | P1 |
| RGX-42 | REG | Segmen Praktik Mandiri: Kasir tanpa buka shift; RME Cetak Hasil & Pemeriksaan Fisik; Datamaster; kartu segmen | Fitur Shift Kasir nonaktif (preset praktik); pasien poli umum & poli gigi | Kasir langsung bisa Bayar (shift otomatis saldo 0, kontrol Saldo Awal/Shift/Closing tersembunyi, laporan Closing Kasir disembunyikan); odontogram & OHI-S hanya di poli Gigi & Mulut; hasil lab di Cetak Hasil hanya bila Order Penunjang aktif; Inform Consent, Referensi Kode Klinis, APS & OTC, Laporan Farmasi Lanjutan tidak tampil; kartu segmen menampilkan jumlah modul · fitur · bagian | P1 |
| RGX-43 | REG | Migrasi 20261014120000 (katalog relasional) lalu Setting › Manajemen Modul & Fitur: GET, simpan segmen + override modul/fitur/bagian, ganti jenis poli | DB dengan/ tanpa konfigurasi faskes_modul lama | Tabel ref_* & preset_segmen_* terisi dari database/data/katalog-modul.json; konfigurasi lama pindah ke faskes_segmen & faskes_*_override lalu faskes_modul dihapus; FK menolak kode fitur/bagian/jenis poli yang tidak dikenal & rute ganda pemilik; hasil modul/fitur/bagian aktif sama seperti sebelum refactor; hapus faskes_segmen ikut menghapus override (cascade) | P1 |
