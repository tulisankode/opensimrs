# Manajemen Modul, Fitur & Segmentasi

> Panduan konsep dan praktik **Manajemen Modul** OpenSIMRS: bagaimana satu aplikasi bisa dipakai dokter praktik mandiri sampai rumah sakit kelas A tanpa membebani faskes kecil dengan menu rumah sakit.
>
> - **IT rumah sakit/faskes (implementator):** baca [bagian 1](#1-konsep-singkat), [bagian 2](#2-mengaktifkan-atau-mematikan-modul-untuk-sebuah-faskes), dan [bagian 3](#3-hubungan-dengan-hak-akses-izin).
> - **Mahasiswa & pengembang:** baca semuanya, terutama [bagian 4](#4-panduan-pengembang-menambah-modul-atau-fitur-baru).
> - **Katalog lengkap** (tabel segmen, modul, fitur, bagian) ada di [bagian 5](#5-katalog-lengkap) dan dihasilkan otomatis dari `database/data/katalog-modul.json`.
>
> Dokumen terkait: [Petunjuk Instalasi](./INSTALLATION_GUIDE.md) · [Konteks Pengembangan](./KONTEKS-PENGEMBANGAN.md) · [Roadmap](./ROADMAP.md) · [Panduan Kontribusi](../CONTRIBUTING.md)

---

## Daftar isi

1. [Konsep singkat](#1-konsep-singkat)
2. [Mengaktifkan atau mematikan modul untuk sebuah faskes](#2-mengaktifkan-atau-mematikan-modul-untuk-sebuah-faskes)
3. [Hubungan dengan hak akses (izin)](#3-hubungan-dengan-hak-akses-izin)
4. [Panduan pengembang: menambah modul atau fitur baru](#4-panduan-pengembang-menambah-modul-atau-fitur-baru)
5. [Katalog lengkap](#5-katalog-lengkap)

---

## 1. Konsep singkat

### 1.1 Empat tingkat

```
Segmen faskes ──preset──▶ Modul ──▶ Fitur ──▶ Bagian
                    ▲
          override per faskes (hanya superadmin)
```

| Tingkat | Artinya | Contoh |
|---|---|---|
| **Segmen** | Jenis faskes. Menentukan modul, fitur, dan bagian yang **aktif bawaan** (preset). | Dokter praktik mandiri, klinik pratama, puskesmas, RS kelas C |
| **Modul** | Menu besar di header aplikasi. | Farmasi, Laboratorium, Rawat Inap |
| **Fitur** | Kemampuan di dalam modul: tombol, tab, atau langkah alur. | Racikan obat, Shift kasir, Bridging LIS |
| **Bagian** | Unit terkecil: satu form asesmen atau satu jenis surat. Bisa dibatasi ke jenis poli tertentu. | Form Alergi, Odontogram (khusus poli gigi), Resep kacamata (khusus poli mata) |

**Istilah yang perlu diketahui:**
- **Faskes** = fasilitas kesehatan (praktik dokter, klinik, puskesmas, rumah sakit). Satu instalasi OpenSIMRS bisa melayani banyak faskes; data setiap faskes terpisah.
- **Preset** = daftar bawaan per segmen. Faskes yang tidak diubah apa-apa otomatis mengikuti preset segmennya.
- **Override** = pengecualian per faskes yang dibuat superadmin, mis. "klinik pratama ini juga memakai Radiologi". Yang disimpan hanya **selisih** dari preset, jadi bila preset diperbarui, faskes ikut berubah kecuali pada item yang di-override.
- **Superadmin** = akun dengan peran bernama persis `super admin`; bisa berpindah faskes dan satu-satunya yang boleh mengubah Manajemen Modul.

### 1.2 Aturan penting

| Aturan | Penjelasan |
|---|---|
| **Modul inti selalu aktif** | Dashboard, Pendaftaran, Rawat Jalan, Pembayaran, Datamaster, Laporan, dan SATUSEHAT tidak bisa dimatikan. |
| **Status "Segera"** | Modul/fitur yang sudah terdaftar di katalog tetapi belum dibangun (`tersedia: false`). Tampil di menu sebagai **Segera** dan tidak bisa dibuka. Ini sekaligus penanda pekerjaan untuk kontributor (lihat [ROADMAP](./ROADMAP.md)). |
| **Fitur/bagian wajib** | Tidak bisa dimatikan, mis. Resume Medis dan Telaah Resep, karena menyangkut keselamatan pasien atau kewajiban regulasi. |
| **Syarat modul** | Sebagian fitur hanya berfungsi bila modul lain aktif, mis. Obat Kronis BPJS butuh modul BPJS FKRTL. |
| **Fitur ikut modulnya** | Fitur yang tidak disebut di `preset.fitur_mati` aktif di semua segmen **selama modulnya aktif**. |
| **Faskes tanpa segmen** | Semua modul yang tersedia aktif. Segera atur segmen setelah membuat faskes baru. |
| **Satu alur data** | Layar ringkas (mis. SOAP Ringkas untuk praktik mandiri) dan layar lengkap menyimpan ke struktur data yang sama, sehingga resume, SATUSEHAT, tagihan, dan laporan tetap konsisten. |

### 1.3 Di mana konfigurasi berlaku

Modul, fitur, dan bagian yang aktif dipakai untuk menyaring:
- menu header (termasuk grup **Penunjang ▾** dan tombol **Lainnya**), sidebar, dan rute halaman (rute milik modul nonaktif ditolak router);
- tombol, tab, dan langkah alur di dalam halaman;
- bagian form RME, termasuk yang khusus jenis poli.

Konfigurasi dibaca frontend saat login dari `GET /api/v3/setting/modul`. **Catatan keamanan:** penegakan di sisi server baru sebagian (contoh: `payment-service` mengecek fitur Shift Kasir, `penunjang-service` menegakkan izin per aksi). Penegakan menyeluruh di backend masih menjadi backlog **B-11** di [ROADMAP](./ROADMAP.md).

---

## 2. Mengaktifkan atau mematikan modul untuk sebuah faskes

> Hanya akun **superadmin** yang bisa melakukan langkah ini. Admin faskes biasa bisa melihat halamannya tetapi tidak bisa menyimpan.

1. Login sebagai superadmin. Bila mengelola beberapa faskes, pilih faskes yang akan diatur (superadmin bisa berpindah faskes).
2. Buka **Setting › Manajemen Modul** (rute `/setting/manajemen-modul`).
3. **Pilih segmen** faskes. Modul, fitur, dan bagian bawaan segmen itu langsung tampil dengan label *Bawaan segmen*.
4. Nyalakan atau matikan modul sesuai kebutuhan faskes. Perubahan di luar preset ditandai sebagai override, mis. *Bawaan segmen — dinonaktifkan*.
5. Di dalam setiap modul, atur **fitur** dan **bagian** dengan sakelar yang sama. Item wajib tidak bisa dimatikan; item dengan syarat modul hanya bisa dinyalakan bila modul syaratnya aktif.
6. **Simpan.** Saat disimpan, sistem:
   - mencatat perubahan di **riwayat** (siapa, kapan, apa yang berubah);
   - **menyinkronkan izin** modul yang baru aktif ke peran admin faskes (lihat bagian 3), sehingga menu admin langsung muncul.
7. Pengguna lain perlu **login ulang** agar menunya mengikuti konfigurasi baru.

**Contoh kasus:**

| Kebutuhan | Langkah |
|---|---|
| Klinik pratama ingin memakai Radiologi | Segmen tetap *Klinik Pratama*, nyalakan modul **Radiologi** (override). Lalu beri izin Radiologi ke peran radiografer/dokter di Datamaster › Role. |
| Klinik pratama ingin bridging ke LIS | Fitur **Bridging LIS** dimatikan bawaan di klinik pratama. Nyalakan fitur itu di modul Laboratorium, lalu isi koneksi di Setting › Konfigurasi Integrasi › LIS. |
| Praktik mandiri tidak menjual obat sendiri | Matikan modul **Farmasi**. Resep tetap bisa ditulis di RME, tetapi menu dan alur apotek hilang. |
| Puskesmas ingin memakai diskon/voucher di kasir | Fitur *Diskon & voucher* dimatikan bawaan di puskesmas; nyalakan di modul Pembayaran. |

---

## 3. Hubungan dengan hak akses (izin)

Modul aktif **tidak otomatis** berarti semua pengguna melihat menunya. Rumusnya:

```
Menu yang tampil  =  modul AKTIF di faskes  ∩  modul yang ada di IZIN pengguna
```

- **Modul aktif** diatur di Setting › Manajemen Modul (bagian 2).
- **Izin** (permission) diatur per peran di **Datamaster › Role**: modul, sub-modul, dan aksi (READ, CREATE, VALIDASI, CETAK, dst.). Nama modul izin untuk setiap modul katalog tercantum di kolom *Nama izin (menu)* pada [tabel B](#b-daftar-modul-per-kelompok).
- **Sinkron otomatis untuk admin:** menyimpan Manajemen Modul memanggil `POST /api/v3/auth/permission/sinkron-modul`, yang menambahkan izin modul aktif ke **peran admin faskes** (peran yang memiliki izin Setting › "Profile Faskes"). Peran lain (dokter, perawat, kasir, dst.) **diatur manual** di Datamaster › Role.
- **Editor Role** mengambil daftar izin dari server (`GET /api/v3/auth/permission/katalog`), jadi modul baru langsung muncul sebagai pilihan.
- Izin disimpan ke sesi saat login. **Setelah mengubah izin, pengguna harus login ulang.**

**Bila menu modul tidak muncul**, periksa berurutan:
1. Apakah modulnya aktif untuk faskes ini? (Setting › Manajemen Modul)
2. Apakah peran pengguna punya izin modul itu? (Datamaster › Role)
3. Apakah pengguna sudah login ulang?
4. Apakah modulnya berstatus *Segera*? Modul Segera memang belum bisa dibuka.

> Catatan teknis untuk pengembang: saat login, izin dibaca dari kolom `users.permissions`, bukan `role.permissions`. Editor Role menyalin izin ke pengguna; bila mengubah data langsung di database, salin juga ke pengguna.

---

## 4. Panduan pengembang: menambah modul atau fitur baru

Contoh nyata di bawah memakai modul **Patologi Anatomi** dan **Mikrobiologi** yang ditambahkan pada Oktober 2026. Telusuri berkasnya untuk melihat pola lengkap.

### Langkah 1 — Daftarkan di katalog JSON

Ubah `database/data/katalog-modul.json`:

```jsonc
// di array "modul"
{
  "kode": "patologi_anatomi",          // snake_case, unik, tidak boleh diganti setelah dipakai
  "nama": "Patologi Anatomi",
  "kelompok": "Penunjang",             // Inti / Layanan / Penunjang / Penjaminan / Puskesmas / Rumah Sakit
  "inti": false,
  "tersedia": true,                    // false = tampil sebagai "Segera"
  "deskripsi": "Histopatologi, sitologi & potong beku: ...",
  "menu": ["Patologi Anatomi"],        // nama modul izin (harus sama dengan permission-list.js)
  "rute": ["/patologi-anatomi"],       // awalan rute frontend milik modul ini
  "urutan": 29
}
```

- Tambahkan kode modul ke `preset.segmen_modul.<segmen>` untuk setiap segmen yang mengaktifkannya secara bawaan (PA: `rs_c`, `rs_b`, `rs_a`; Mikrobiologi: `rs_b`, `rs_a`).
- Untuk **fitur** baru, tambahkan objek di array `fitur` (`kode`, `modul`, `nama`, `deskripsi`, `tersedia`, `wajib`, `rute`, `urutan`, opsional `modul_syarat`). Bila fitur tidak boleh menyala di segmen tertentu, tambahkan kodenya ke `preset.fitur_mati.<segmen>`. **Item yang tidak disebut akan aktif di semua segmen.**
- Untuk **bagian** baru, tambahkan di array `bagian` (`fitur`, `poli` bila khusus jenis poli, `modul_syarat` bila perlu) dan bila perlu `preset.bagian_mati`.

### Langkah 2 — Migrasi sinkron katalog

Buat migrasi baru di `database/migrations/` yang hanya memanggil `sinkronKatalog`. Contoh: `20261014230000-katalog_pa_mikrobiologi.cjs`:

```js
'use strict';
const { sinkronKatalog } = require('../lib/sinkron-katalog.cjs');

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction((transaction) => sinkronKatalog(queryInterface, transaction));
  },
  async down() {
    // Katalog mengikuti JSON; kembalikan JSON lalu jalankan migrasi sinkron baru.
  },
};
```

Jalankan `npm run db:migrate`. **Jangan mengedit migrasi yang sudah pernah dijalankan**; selalu buat migrasi baru.

### Langkah 3 — Definisi izin di auth-service

1. `auth-service/src/helpers/permission-list.js`: buat objek izin (mis. `patologiAnatomiPermission` dengan `module`, `subModules`, `allows`) dan daftarkan kuncinya di `mapPermission`.
2. `auth-service/src/controllers/permission-controller.js`: tambahkan nama modul ke `SEMUA_MODUL` agar muncul di editor Role dan ikut sinkron modul.

### Langkah 4 — Rute & menu frontend

1. `frontend-service/src/router/index.ts`: daftarkan halaman. **Wajib** ada rute induk dengan redirect, mis. `/patologi-anatomi` → `/patologi-anatomi/order`; tanpa itu klik menu jatuh ke dashboard.
2. `frontend-service/src/components/section/Header.vue`: tambahkan menu (dan ke `MODUL_PENUNJANG` bila termasuk grup Penunjang), serta nama/ikon di `NAMA_SEGERA`/`IKON_SEGERA` untuk tampilan status Segera.
3. Di komponen, pakai helper dari `frontend-service/src/stores/modulFaskes.ts`:

| Helper | Pakai untuk |
|---|---|
| `modulAktif('patologi_anatomi')` | Menampilkan/menyembunyikan elemen milik modul |
| `fiturAktif('lab_bridging_lis')` | Tombol, tab, atau langkah alur milik fitur |
| `bagianTampil('rme_asesmen', 'Pemeriksaan Gigi', lokasiUuid)` | Bagian form yang bisa bergantung jenis poli |
| `ruteDiizinkanModul(path)` | Sudah dipakai router guard & sidebar; cukup daftarkan rute di katalog |

Saat menyembunyikan langkah, pastikan alurnya tetap valid (contoh: bila General Consent mati, pendaftaran langsung tersimpan tanpa dialog persetujuan).

### Langkah 5 — Izin untuk peran yang sudah ada

Peran yang sudah ada di database tidak otomatis mendapat izin modul baru. Pilih salah satu:
- **Migrasi izin**, contoh `database/migrations/20261014230100-izin_pa_mikrobiologi.cjs`: memberi izin PA/Mikro ke peran & pengguna yang sudah punya izin Laboratorium, hanya pada faskes yang modulnya aktif (preset + override), serta ke superadmin.
- Atau biarkan sinkron otomatis menangani peran admin, dan atur peran lain lewat Datamaster › Role.

### Langkah 6 — Backend, data demo, dan dokumen

- **Penegakan izin di backend** untuk aksi penting (contoh: `penunjang-service/src/umum/izin.js`).
- **Data demo** (opsional): tambahkan seeder modul di `database/demo/` (contoh `seed-patologi.cjs`, `seed-mikrobiologi.cjs`) dan daftarkan ke `seed-demo.cjs` serta runner `isi-master-penunjang.cjs`. Seeder harus idempoten dan memakai data fiktif.
- **Perbarui dokumen ini:** jalankan `node scripts/dokumen-katalog.mjs` lalu commit JSON, migrasi, dan dokumen bersamaan.
- **Uji di dua segmen:** satu yang mengaktifkan modul/fitur dan satu yang mematikannya (akun demo per segmen ada di [Petunjuk Instalasi](./INSTALLATION_GUIDE.md#akun-demo)).

### Ringkasan checklist PR modul/fitur baru

- [ ] `katalog-modul.json` (modul/fitur/bagian + preset segmen)
- [ ] Migrasi `sinkronKatalog` baru
- [ ] Izin di `permission-list.js` + `mapPermission` + `SEMUA_MODUL`
- [ ] Rute (dengan rute induk redirect) + menu header
- [ ] Gating UI dengan `modulAktif`/`fiturAktif`/`bagianTampil`
- [ ] Migrasi izin untuk peran yang sudah ada (bila perlu)
- [ ] Penegakan izin di backend untuk aksi penting
- [ ] `node scripts/dokumen-katalog.mjs` dijalankan
- [ ] Diuji di segmen yang mengaktifkan dan yang mematikan

---

## 5. Katalog lengkap

Singkatan segmen di tabel: **PM** praktik mandiri · **KP** klinik pratama · **KU** klinik utama · **PKM** puskesmas · **RS D/C/B/A** rumah sakit kelas D/C/B/A.

<!-- KATALOG:MULAI -->
<!-- Bagian ini DIHASILKAN OTOMATIS oleh scripts/dokumen-katalog.mjs dari database/data/katalog-modul.json. -->
<!-- Jangan diedit manual: ubah JSON-nya, lalu jalankan `node scripts/dokumen-katalog.mjs`. -->

Ringkasan katalog saat ini: **8 segmen**, **30 modul** (7 inti, 1 berstatus Segera), **68 fitur** (2 berstatus Segera), dan **27 bagian**.

### A. Segmen faskes

| Urutan | Singkatan | Kode | Nama | Gambaran | Modul bawaan |
|---|---|---|---|---|---|
| 1 | PM | `praktik_mandiri` | Dokter Praktik Mandiri | 1 dokter, rawat jalan; daftar–periksa–resep–bayar sederhana. | 9 |
| 2 | KP | `klinik_pratama` | Klinik Pratama | Pelayanan dasar, apotek & lab sederhana; FKTP BPJS. | 13 |
| 3 | KU | `klinik_utama` | Klinik Utama | Pelayanan spesialistik, penunjang, rawat inap terbatas; FKRTL BPJS. | 16 |
| 4 | PKM | `puskesmas` | Puskesmas | FKTP pemerintah: banyak poli, program, laporan dinkes. | 13 |
| 5 | RS D | `rs_d` | Rumah Sakit Kelas D | Pelayanan dasar RS: rawat jalan, IGD, rawat inap, penunjang. | 16 |
| 6 | RS C | `rs_c` | Rumah Sakit Kelas C | Kelas D + kamar operasi, gizi, koding rekam medis. | 21 |
| 7 | RS B | `rs_b` | Rumah Sakit Kelas B | Kelas C + ICU, CSSD, bank darah, akuntansi. | 26 |
| 8 | RS A | `rs_a` | Rumah Sakit Kelas A | Pelayanan paripurna & rujukan nasional/provinsi, termasuk UTD. | 27 |

### B. Daftar modul per kelompok

Status: **Inti** = selalu aktif di semua faskes · **Tersedia** = bisa dipakai · **Segera** = sudah terdaftar di katalog tetapi belum dibangun (tampil di menu sebagai "Segera").

#### Inti

| Kode | Nama | Deskripsi | Status | Nama izin (menu) |
|---|---|---|---|---|
| `dashboard` | Dashboard | Ringkasan kunjungan & pendapatan. | Inti (selalu aktif) | Dashboard |
| `pendaftaran` | Pendaftaran Pasien | Data pasien, No. RM, pendaftaran kunjungan rawat jalan. | Inti (selalu aktif) | Admisi |
| `rawat_jalan` | RME Rawat Jalan | Pemeriksaan, SOAP, diagnosis ICD-10, tindakan, resep, resume. | Inti (selalu aktif) | Rawat Jalan |
| `pembayaran` | Kasir & Pembayaran | Tagihan otomatis dari tindakan, obat, penunjang & kamar; pembayaran. | Inti (selalu aktif) | Pembayaran |
| `datamaster` | Data Master | Pegawai, praktisi, lokasi/poli, tarif, penjamin. | Inti (selalu aktif) | Datamaster |
| `laporan` | Laporan | Laporan kunjungan, diagnosis, keuangan. | Inti (selalu aktif) | Laporan |
| `satusehat` | SATUSEHAT | Integrasi wajib Kemenkes (RME). | Inti (selalu aktif) | – |

#### Layanan

| Kode | Nama | Deskripsi | Status | Nama izin (menu) |
|---|---|---|---|---|
| `antrian` | Antrian & Layar Panggil | Nomor antrian, panggilan pasien, layar TV kiosk bersuara. | Tersedia | Antrian |
| `farmasi` | Farmasi | Telaah, verifikasi, penyiapan & penyerahan resep; stok depo. | Tersedia | Farmasi |
| `inventory` | Gudang & Pengadaan | Gudang, pembelian, distribusi ke depo, stok opname. | Tersedia | Inventory |
| `rawat_inap` | Rawat Inap | Bed & kamar, perpindahan bangsal, discharge, biaya kamar otomatis. | Tersedia | Rawat Inap |
| `igd` | IGD | Pendaftaran & pelayanan gawat darurat, SPRI ke rawat inap. | Tersedia | IGD |
| `training` | Kelas Training | Kelas olahraga/edukasi berbayar (yoga, pilates, senam hamil): jadwal kelas, kuota slot, booking peserta. | Tersedia | Training |
| `mcu` | Medical Check Up (MCU) | Paket MCU perorangan & korporasi: pendaftaran rombongan, alur stasiun pemeriksaan, kesimpulan fit/unfit, laporan & tagihan perusahaan. | Tersedia | MCU |

#### Penunjang

| Kode | Nama | Deskripsi | Status | Nama izin (menu) |
|---|---|---|---|---|
| `laboratorium` | Laboratorium | Order, validasi, hasil, expertise, bridging LIS. | Tersedia | Laboratorium |
| `fisioterapi` | Fisioterapi / Rehabilitasi Medik | Order terapi dari RME, penjadwalan & booking sesi, evaluasi terapi, bed/ruang terapi. | Tersedia | Fisioterapi |
| `radiologi` | Radiologi | Order & hasil radiologi, bridging PACS. | Tersedia | Radiologi |
| `cssd` | CSSD | Sterilisasi alat & pelacakan set instrumen: master set, penerimaan, dekontaminasi, load sterilisasi, penyimpanan & distribusi, pemakaian pasien, recall. | Tersedia | CSSD |
| `patologi_anatomi` | Patologi Anatomi | Histopatologi, sitologi & potong beku: order, penerimaan jaringan, makroskopis, mikroskopis, diagnosis (ICD-O), arsip blok & slide. | Tersedia | Patologi Anatomi |
| `mikrobiologi` | Mikrobiologi | Pewarnaan, kultur, identifikasi kuman & uji kepekaan antibiotik (S/I/R), laporan sementara & antibiogram. | Tersedia | Mikrobiologi |

#### Penjaminan

| Kode | Nama | Deskripsi | Status | Nama izin (menu) |
|---|---|---|---|---|
| `bpjs_fktp` | BPJS FKTP (PCare) | Pendaftaran & kunjungan PCare, rujukan keluar, kapitasi. | Tersedia | – |
| `bpjs_fkrtl` | BPJS FKRTL (VClaim/SEP) | SEP, rujukan masuk, klaim INA-CBG. | Tersedia | – |

#### Puskesmas

| Kode | Nama | Deskripsi | Status | Nama izin (menu) |
|---|---|---|---|---|
| `program_puskesmas` | Program Puskesmas | KIA/KB, imunisasi, MTBS, UKM, laporan LB1 & dinkes. | Tersedia | Program Puskesmas |

#### Rumah Sakit

| Kode | Nama | Deskripsi | Status | Nama izin (menu) |
|---|---|---|---|---|
| `kamar_operasi` | Kamar Operasi | Order & jadwal operasi, checklist keselamatan bedah WHO, laporan operasi & anestesi. | Tersedia | Kamar Operasi |
| `icu` | ICU / Intensif | Pemantauan intensif & flowsheet. | Tersedia | ICU |
| `gizi` | Gizi | Skrining & asesmen gizi, order diet, serta distribusi makan pasien rawat inap. | Tersedia | Gizi |
| `koding_rm` | Koding & Rekam Medis | Koding ICD untuk klaim, peminjaman & retensi berkas. | Tersedia | Koding Rekam Medis |
| `bank_darah` | Bank Darah RS (BDRS) | Permintaan darah dari ruangan, uji silang serasi (crossmatch), stok & serah terima darah untuk transfusi. | Tersedia | Bank Darah RS (BDRS) |
| `utd` | UTD / UPTD Produksi Darah | Unit Transfusi Darah (RS provinsi / UPTD Dinkes): donor, aftap, uji saring IMLTD, pengolahan komponen, distribusi. | Tersedia | UTD |
| `akuntansi` | Akuntansi & Remunerasi | Jurnal, laporan keuangan, jasa pelayanan. | Segera | – |

### C. Matriks modul × segmen (preset bawaan)

✓ = aktif bawaan pada segmen itu · – = tidak aktif bawaan (superadmin tetap bisa menyalakannya per faskes). Modul inti selalu aktif.

| Modul | Status | PM | KP | KU | PKM | RS D | RS C | RS B | RS A |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard (`dashboard`) | Inti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pendaftaran Pasien (`pendaftaran`) | Inti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RME Rawat Jalan (`rawat_jalan`) | Inti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kasir & Pembayaran (`pembayaran`) | Inti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data Master (`datamaster`) | Inti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Laporan (`laporan`) | Inti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SATUSEHAT (`satusehat`) | Inti | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Antrian & Layar Panggil (`antrian`) | Tersedia | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Farmasi (`farmasi`) | Tersedia | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gudang & Pengadaan (`inventory`) | Tersedia | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Laboratorium (`laboratorium`) | Tersedia | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fisioterapi / Rehabilitasi Medik (`fisioterapi`) | Tersedia | – | – | ✓ | – | – | ✓ | ✓ | ✓ |
| Radiologi (`radiologi`) | Tersedia | – | – | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Rawat Inap (`rawat_inap`) | Tersedia | – | – | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| IGD (`igd`) | Tersedia | – | – | – | – | ✓ | ✓ | ✓ | ✓ |
| BPJS FKTP (PCare) (`bpjs_fktp`) | Tersedia | ✓ | ✓ | – | ✓ | – | – | – | – |
| BPJS FKRTL (VClaim/SEP) (`bpjs_fkrtl`) | Tersedia | – | – | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Program Puskesmas (`program_puskesmas`) | Tersedia | – | – | – | ✓ | – | – | – | – |
| Kamar Operasi (`kamar_operasi`) | Tersedia | – | – | – | – | – | ✓ | ✓ | ✓ |
| ICU / Intensif (`icu`) | Tersedia | – | – | – | – | – | – | ✓ | ✓ |
| Gizi (`gizi`) | Tersedia | – | – | – | – | – | ✓ | ✓ | ✓ |
| Koding & Rekam Medis (`koding_rm`) | Tersedia | – | – | – | – | – | ✓ | ✓ | ✓ |
| CSSD (`cssd`) | Tersedia | – | – | – | – | – | – | ✓ | ✓ |
| Bank Darah RS (BDRS) (`bank_darah`) | Tersedia | – | – | – | – | – | – | ✓ | ✓ |
| UTD / UPTD Produksi Darah (`utd`) | Tersedia | – | – | – | – | – | – | – | ✓ |
| Akuntansi & Remunerasi (`akuntansi`) | Segera | – | – | – | – | – | – | ✓ | ✓ |
| Kelas Training (`training`) | Tersedia | – | – | – | – | – | – | – | – |
| Medical Check Up (MCU) (`mcu`) | Tersedia | – | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ |
| Patologi Anatomi (`patologi_anatomi`) | Tersedia | – | – | – | – | – | ✓ | ✓ | ✓ |
| Mikrobiologi (`mikrobiologi`) | Tersedia | – | – | – | – | – | – | ✓ | ✓ |

### D. Fitur per modul

Kolom **Wajib**: fitur tidak bisa dimatikan. **Syarat modul**: fitur hanya berfungsi bila modul tersebut aktif. **Dimatikan bawaan di**: segmen yang mematikan fitur ini lewat `preset.fitur_mati`; di segmen lain fitur ikut aktif bila modulnya aktif.

#### Dashboard (`dashboard`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `helpdesk_ai` | Asisten Bantuan (Helpdesk AI) | Tombol Bantuan untuk bertanya cara memakai OpenSIMRS ke asisten AI. Hanya berlaku bila Gateway helpdesk dikonfigurasi di setting-service. | Tersedia | – | – | – |

#### Pendaftaran Pasien (`pendaftaran`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `daftar_general_consent` | General Consent | Persetujuan umum saat pendaftaran + datamaster format consent. | Tersedia | – | – | PM |
| `daftar_ringkas` | Pendaftaran Ringkas | Pasien baru cukup nama, identitas, tgl lahir, jenis kelamin, HP & alamat; poli/DPJP/jadwal tunggal terisi otomatis. | Tersedia | – | – | KP, KU, PKM, RS D, RS C, RS B, RS A |

#### RME Rawat Jalan (`rawat_jalan`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `rme_asesmen` | Asesmen | Tab Asesmen: tanda vital, pemeriksaan fisik, skrining & asesmen terstruktur. | Tersedia | – | – | – |
| `rme_inform_consent` | Inform Consent | Tab persetujuan tindakan kedokteran. | Tersedia | – | – | PM |
| `rme_unggah_berkas` | Unggah Berkas | Lampiran foto/dokumen (hasil luar, foto luka) pada rekam medis. | Tersedia | – | – | PM |
| `rme_resume` | Resume & Discharge | Resume medis & penutupan kunjungan (memicu tagihan & antrian farmasi). | Tersedia | Ya | – | – |
| `rme_cetak_surat` | Cetak Hasil & Surat | Cetak hasil pemeriksaan, surat sakit, rujukan, SPRI, dll. | Tersedia | – | – | – |
| `rme_soap_ringkas` | SOAP Ringkas (1 layar) | Satu layar S-O-A-P + tanda vital + resep + selesai, untuk praktik mandiri. | Tersedia | – | – | KP, KU, PKM, RS D, RS C, RS B, RS A |

#### Kasir & Pembayaran (`pembayaran`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `bayar_diskon_voucher` | Diskon & Voucher | Pemberian diskon persen & penggunaan voucher di kasir. | Tersedia | – | – | PKM |
| `bayar_shift_kasir` | Shift Kasir | Buka/tutup shift dengan saldo awal & closing harian. Tanpa fitur ini kasir langsung menerima pembayaran. | Tersedia | – | – | PM |
| `bayar_aps_otc` | Transaksi APS & OTC | Tagihan pasien atas permintaan sendiri (lab tanpa kunjungan) & penjualan obat bebas. | Tersedia | – | – | PM |

#### Data Master (`datamaster`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `dm_referensi_kode` | Referensi Kode Klinis | Kelola master ICD-10, ICD-9 CM & SNOMED CT (pencarian diagnosis/tindakan tetap berfungsi tanpa menu ini). | Tersedia | – | – | PM |

#### Antrian & Layar Panggil (`antrian`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `antrian_layar_kiosk` | Layar TV Kiosk | Link layar antrian TV tanpa login, dengan suara panggilan. | Tersedia | – | – | – |
| `antrian_apm` | Anjungan Pasien Mandiri (APM) | Pasien mengambil nomor, check-in & mendaftar sendiri di anjungan. | Tersedia | – | – | – |
| `antrian_online_bpjs` | Antrean Online BPJS (Mobile JKN) | Sinkron antrean & task id ke BPJS, ambil antrean dari Mobile JKN. Perlu BPJS FKRTL atau BPJS FKTP aktif. | Tersedia | – | BPJS FKRTL (VClaim/SEP) (`bpjs_fkrtl`) atau BPJS FKTP (PCare) (`bpjs_fktp`) | PM, KP, KU, PKM, RS D, RS C, RS B, RS A |

#### Farmasi (`farmasi`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `rme_alkes` | Order Alkes/BMHP | Tab Alkes di RME: permintaan alat kesehatan & BMHP ke farmasi. | Tersedia | – | – | PM |
| `farmasi_ruangan` | Farmasi Ruangan | Permintaan & pemakaian obat/alkes oleh ruangan rawat inap/IGD. | Tersedia | – | – | PM, KP |
| `farmasi_penjualan_bebas` | Penjualan Obat Bebas (OTC) | Penjualan obat tanpa resep kepada pembeli umum. | Tersedia | – | – | PM |
| `farmasi_laporan_lanjutan` | Laporan Farmasi Lanjutan | Waktu tunggu pelayanan resep (indikator mutu) & rekap pendapatan per apotik. | Tersedia | – | – | PM |
| `farmasi_telaah` | Telaah & Validasi Resep | Telaah administratif, farmasetik & klinis sebelum obat diserahkan (standar pelayanan kefarmasian). | Tersedia | Ya | – | – |
| `farmasi_racikan` | Obat Racikan | Order obat racikan (puyer, kapsul, salep) dari RME. | Tersedia | – | – | – |
| `farmasi_obat_kronis` | Obat Kronis BPJS (23/7) | Penandaan obat kronis: 7 hari masuk paket INA-CBG, 23 hari ditagihkan terpisah ke BPJS. | Tersedia | – | BPJS FKRTL (VClaim/SEP) (`bpjs_fkrtl`) | – |
| `farmasi_substitusi` | Substitusi Obat | Apoteker mengganti obat dengan padanannya (generik/merek lain) saat telaah resep. | Tersedia | – | – | – |
| `farmasi_retur` | Retur Obat & Material | Pengembalian obat/BMHP dari pasien atau ruangan ke farmasi. | Tersedia | – | – | PM |

#### Gudang & Pengadaan (`inventory`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `inv_pengadaan_po` | Pembelian ke Supplier (PO) | Surat pesanan ke supplier beserta verifikasinya. | Tersedia | – | – | PM, PKM |
| `inv_retur_supplier` | Retur & Penggantian Supplier | Mengembalikan barang rusak/ED ke supplier dan mencatat penggantiannya. | Tersedia | – | – | PM, PKM |
| `inv_stok_opname` | Stok Opname | Penghitungan fisik stok berkala. | Tersedia | – | – | – |
| `inv_stok_adjustment` | Penyesuaian Stok | Koreksi stok di luar opname (rusak, hilang, selisih). | Tersedia | – | – | – |
| `inv_marketplace` | Pembelian via Marketplace | Pengadaan barang lewat marketplace mitra (afiliasi). | Segera | – | – | – |

#### Laboratorium (`laboratorium`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `rme_penunjang` | Order Penunjang dari RME | Tab Penunjang di RME: order laboratorium (dan fisioterapi). | Tersedia | – | – | – |
| `lab_bridging_lis` | Bridging LIS (adamLIS) | Kirim order ke alat/LIS & terima hasil otomatis. | Tersedia | – | – | PM, KP |
| `lab_expertise` | Expertise Dokter Lab | Interpretasi hasil oleh dokter spesialis patologi klinik. | Tersedia | – | – | PM, KP, PKM |
| `lab_rujukan` | Lab Rujukan | Pemeriksaan yang dirujuk ke laboratorium luar beserta input hasilnya. | Tersedia | – | – | – |

#### Radiologi (`radiologi`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `rad_bridging_pacs` | Bridging PACS/RIS | Kirim order ke PACS/RIS dan terima hasil, expertise, serta tautan citra. | Tersedia | – | – | KU, RS D, RS C, RS B, RS A |

#### Rawat Inap (`rawat_inap`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `rme_fpo` | Form Pemberian Obat (FPO) | Pencatatan pemberian obat harian pasien rawat inap/IGD. | Tersedia | – | – | – |
| `ri_perpindahan` | Perpindahan Bed & Bangsal | Permintaan & persetujuan pindah bed/ruangan. | Tersedia | – | – | – |
| `ri_bayi_baru_lahir` | Registrasi Bayi Baru Lahir | Pendaftaran bayi baru lahir dari ibu yang dirawat, beserta laporannya. | Tersedia | – | – | – |

#### BPJS FKRTL (VClaim/SEP) (`bpjs_fkrtl`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `vclaim_rencana_kontrol` | Rencana Kontrol & SPRI | Pembuatan surat kontrol dan SPRI lewat VClaim. | Segera | – | – | – |

#### Program Puskesmas (`program_puskesmas`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `program_puskesmas_satusehat` | Kirim Imunisasi ke SATUSEHAT | Mengirim resource Immunization ke SATUSEHAT setiap pelayanan imunisasi tersimpan. Butuh konfigurasi integrasi SATUSEHAT faskes. | Tersedia | – | SATUSEHAT (`satusehat`) | – |

#### Kamar Operasi (`kamar_operasi`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `rme_order_operasi` | Order Operasi dari RME | Tab Order Operasi pada Plan asesmen Rajal/Ranap/IGD: diagnosis, rencana tindakan ICD-9-CM, jenis elektif/cito, perkiraan durasi. | Tersedia | – | – | – |
| `ok_jadwal` | Jadwal & Daftar Tunggu OK | Daftar tunggu order operasi (cito diprioritaskan) dan penjadwalan ke ruang, waktu, serta tim operasi. | Tersedia | – | – | – |
| `ok_checklist_keselamatan` | Checklist Keselamatan Bedah (WHO) | Sign in, time out, dan sign out; wajib lengkap sebelum laporan operasi dapat difinalkan. | Tersedia | Ya | – | – |

#### ICU / Intensif (`icu`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `icu_dashboard` | Dasbor ICU | Ringkasan bed terisi di ruang intensif: diagnosis, hari rawat, status ventilator & peringatan nilai kritis. | Tersedia | Ya | – | – |
| `icu_serah_terima` | Serah Terima ICU | Kriteria masuk/keluar & serah terima terstruktur, tertaut ke perpindahan bangsal (ri_perpindahan). | Tersedia | Ya | – | – |
| `icu_flowsheet` | Flowsheet Observasi | Observasi per jam/interval: tanda vital, SpO2, GCS, nyeri, parameter ventilator & tren. | Tersedia | Ya | – | – |
| `icu_balance_cairan` | Balance Cairan | Intake-output & balance otomatis per shift dan 24 jam. | Tersedia | – | – | – |
| `icu_skor_sofa` | Skor SOFA | Skor keparahan SOFA saat masuk & harian, beserta riwayat penilaian. | Tersedia | – | – | – |
| `icu_laporan` | Laporan ICU | BOR, ALOS, angka kematian & hari ventilator ruang intensif. | Tersedia | – | – | – |

#### Bank Darah RS (BDRS) (`bank_darah`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `bdrs_permintaan` | Permintaan Darah | Permintaan darah dari ruangan/IGD/OK beserta golongan & jumlah kantong. | Tersedia | – | – | – |
| `bdrs_crossmatch` | Uji Silang Serasi | Pemeriksaan golongan darah & crossmatch sebelum transfusi. | Tersedia | – | – | – |
| `bdrs_stok` | Stok & Serah Terima Darah | Penerimaan dari UTD, penyimpanan, kedaluwarsa, serah terima & pemantauan reaksi transfusi. | Tersedia | – | – | – |
| `bdrs_bridging` | Bridging Bank Darah (UTD) | Kirim permintaan darah ke UTD mitra & terima status, data kantong, serta hasil IMLTD secara otomatis. | Tersedia | – | – | RS B, RS A |

#### UTD / UPTD Produksi Darah (`utd`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `utd_donor` | Rekrutmen & Seleksi Donor | Pendaftaran donor, kuesioner, pemeriksaan Hb/tekanan darah, riwayat & kartu donor. | Tersedia | – | – | – |
| `utd_aftap` | Pengambilan Darah (Aftap) | Pencatatan pengambilan darah, nomor kantong & reaksi donor; donor mobile/kegiatan. | Tersedia | – | – | – |
| `utd_imltd` | Uji Saring IMLTD | Uji saring infeksi menular lewat transfusi darah (HIV, HBsAg, HCV, sifilis) & konfirmasi. | Tersedia | – | – | – |
| `utd_komponen` | Pengolahan Komponen | Pemisahan whole blood menjadi PRC, TC, FFP, cryo; pelabelan & karantina. | Tersedia | – | – | – |
| `utd_distribusi` | Penyimpanan & Distribusi | Stok per golongan/komponen, distribusi ke BDRS/RS lain, pemusnahan kantong reaktif/kedaluwarsa. | Tersedia | – | – | – |
| `utd_pelaporan` | Pelaporan UTD | Laporan produksi, donor & distribusi untuk Dinkes/Kemenkes. | Tersedia | – | – | – |

#### Medical Check Up (MCU) (`mcu`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `mcu_paket` | Paket MCU | Gabungan tindakan, laboratorium, radiologi & EKG dengan satu harga paket. | Tersedia | – | – | – |
| `mcu_pendaftaran` | Pendaftaran MCU Perorangan & Korporasi | Daftar peserta perorangan atau rombongan perusahaan sekaligus, termasuk impor daftar peserta. | Tersedia | – | – | – |
| `mcu_stasiun` | Alur Stasiun Pemeriksaan | Anamnesis, fisik, visus, gigi, lab, radiologi & EKG per stasiun dengan progres tiap peserta. | Tersedia | – | – | – |
| `mcu_order_penunjang` | Order Penunjang Otomatis | Pemeriksaan lab/radiologi dalam paket langsung menjadi order penunjang. | Tersedia | – | – | – |
| `mcu_kesimpulan` | Kesimpulan & Sertifikat MCU | Kesimpulan dokter (fit / fit dengan catatan / unfit), saran, cetak laporan & sertifikat MCU. | Tersedia | – | – | – |
| `mcu_korporasi` | Rekap & Tagihan Korporasi | Invoice per perusahaan dan rekap hasil seluruh peserta. | Tersedia | – | – | – |
| `mcu_pcare` | MCU PCare (BPJS) | Pelaporan hasil MCU peserta JKN ke layanan MCU PCare (tambah/ubah/hapus, status & kirim ulang). | Tersedia | – | BPJS FKTP (PCare) (`bpjs_fktp`) | KP |

#### Patologi Anatomi (`patologi_anatomi`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `pa_bridging_lis` | Bridging LIS Patologi Anatomi | Kirim order PA ke sistem patologi & terima diagnosis otomatis. | Tersedia | – | – | – |

#### Mikrobiologi (`mikrobiologi`)

| Kode | Fitur | Deskripsi | Status | Wajib | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|---|
| `mikro_bridging_lis` | Bridging LIS Mikrobiologi | Kirim order ke LIS mikrobiologi & terima hasil identifikasi/AST otomatis. | Tersedia | – | – | – |

### E. Bagian (unit terkecil)

Bagian adalah potongan form/daftar di dalam sebuah fitur, mis. satu form asesmen atau satu jenis surat. **Khusus poli**: bagian hanya tampil di lokasi berjenis poli tersebut. **Dimatikan bawaan di**: dari `preset.bagian_mati`.

#### Asesmen (`rme_asesmen`)

| Kode | Bagian | Wajib | Khusus poli | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|
| `asm_alergi` | Alergi | Ya | – | – | – |
| `asm_anamnesis` | Anamnesis | Ya | – | – | – |
| `asm_triase` | Triase (IGD) | – | – | IGD (`igd`) | – |
| `asm_tanda_vital` | Tanda Vital | Ya | – | – | – |
| `asm_antropometri` | Antropometri (BB/TB) | – | – | – | – |
| `asm_nyeri` | Asesmen Nyeri | – | – | – | PM |
| `asm_kesadaran` | Kesadaran (GCS) | – | – | – | PM |
| `asm_fisik` | Pemeriksaan Fisik | Ya | – | – | – |
| `asm_gigi` | Pemeriksaan Gigi (odontogram) | – | Gigi & Mulut | – | – |
| `asm_mata` | Pemeriksaan Mata | – | Mata | – | – |
| `asm_luka_bakar` | Derajat Luka Bakar (RON) | – | – | – | PM, KP, PKM |
| `asm_hasil_penunjang` | Catatan Hasil Penunjang | – | – | – | PM |
| `asm_diagnosis` | Diagnosis Dokter (ICD-10) | Ya | – | – | – |
| `asm_askep` | Asuhan Keperawatan | – | – | – | PM |
| `asm_catatan_perawat` | Catatan Perawat | – | – | – | PM |
| `asm_instruksi_medis` | Instruksi Medis | – | – | – | PM, KP, PKM |
| `asm_tindakan` | Pemeriksaan dan Tindakan | Ya | – | – | – |

#### Resume & Discharge (`rme_resume`)

| Kode | Bagian | Wajib | Khusus poli | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|
| `rsm_tanda_vital` | Tanda Vital Saat Masuk | Ya | – | – | – |
| `rsm_ringkasan` | Ringkasan Riwayat Penyakit | Ya | – | – | – |
| `rsm_edukasi` | Edukasi | – | – | – | – |
| `rsm_keadaan_pulang` | Keadaan Waktu Pulang | – | – | – | PM |
| `rsm_status_pulang` | Status Pulang | Ya | – | – | – |
| `rsm_fisik` | Pemeriksaan Fisik | Ya | – | – | – |
| `rsm_diagnosis` | Diagnosis | Ya | – | – | – |
| `rsm_tindakan` | Tindakan | Ya | – | – | – |
| `rsm_obat` | Obat | Ya | – | – | – |

#### Cetak Hasil & Surat (`rme_cetak_surat`)

| Kode | Bagian | Wajib | Khusus poli | Syarat modul | Dimatikan bawaan di |
|---|---|---|---|---|---|
| `srt_resep_kacamata` | Surat Resep Kacamata | – | Mata | – | – |

### F. Jenis poli

Dipakai untuk membatasi bagian khusus poli (mis. odontogram hanya di poli gigi). Jenis poli diatur pada data lokasi poli.

| Kode | Nama |
|---|---|
| `umum` | Umum |
| `gigi` | Gigi & Mulut |
| `mata` | Mata |
| `anak` | Anak |
| `kandungan` | Kebidanan & Kandungan |
| `penyakit_dalam` | Penyakit Dalam |
| `bedah` | Bedah |
| `tht` | THT |
| `saraf` | Saraf |
| `kulit` | Kulit & Kelamin |
| `jiwa` | Jiwa |
| `kia_kb` | KIA/KB |
| `lainnya` | Lainnya |
<!-- KATALOG:SELESAI -->
