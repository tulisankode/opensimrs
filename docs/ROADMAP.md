# Roadmap, Timeline & Backlog OpenSIMRS

> Acuan bersama untuk pengelola proyek, implementator di faskes, dan kontributor: ke mana OpenSIMRS dikembangkan, urutan pengerjaannya, pekerjaan apa yang menunggu, dan cara ikut mengerjakannya.
>
> Dokumen terkait: [Konteks Pengembangan](./KONTEKS-PENGEMBANGAN.md) (cara kerja kode) · [Manajemen Modul](./MANAJEMEN-MODUL.md) (katalog modul & segmen) · [CHANGELOG](../CHANGELOG.md) (yang sudah dirilis) · [Panduan Kontribusi](../CONTRIBUTING.md)
>
> Terakhir diperbarui: **15 Oktober 2026** (rilis publik `1.0.0-alpha.1`). Perbarui setiap kali item selesai atau prioritas berubah ([bagian 9](#9-cara-memperbarui-dokumen-ini)).

---

## Daftar isi

1. [Arah produk](#1-arah-produk)
2. [Status saat ini](#2-status-saat-ini-oktober-2026)
3. [Fase & timeline](#3-fase--timeline)
4. [Label untuk kontributor](#4-label-untuk-kontributor)
5. [Cara memilih & mengklaim pekerjaan](#5-cara-memilih--mengklaim-pekerjaan)
6. [Backlog](#6-backlog)
7. [Keputusan desain yang sudah diambil](#7-keputusan-desain-yang-sudah-diambil)
8. [Pemetaan dokumen kebutuhan lama ke katalog](#8-pemetaan-dokumen-kebutuhan-lama-ke-katalog)
9. [Cara memperbarui dokumen ini](#9-cara-memperbarui-dokumen-ini)

---

## 1. Arah produk

OpenSIMRS adalah SIMRS (Sistem Informasi Manajemen Rumah Sakit) yang **tumbuh bersama faskes**: satu basis kode untuk dokter praktik mandiri sampai rumah sakit kelas A. Kuncinya adalah **Manajemen Modul** bertingkat (rincian di [MANAJEMEN-MODUL.md](./MANAJEMEN-MODUL.md)):

```
Segmen faskes ──preset──▶ Modul ──▶ Fitur ──▶ Bagian (unit terkecil, mis. satu form asesmen)
                    ▲
          override per faskes (hanya superadmin)
```

- Segmen menentukan modul, fitur, dan bagian yang **aktif bawaan**, sehingga faskes kecil tidak dibebani menu rumah sakit.
- Satu alur data dipakai semua segmen; yang berbeda hanya tampilan dan langkah yang diaktifkan.
- Integrasi nasional (SATUSEHAT, BPJS) dan sistem pendukung (LIS) menjadi bagian inti, bukan tambahan.

### Urutan prioritas segmen

Pengembangan dikerjakan dari segmen paling sederhana. Sebuah segmen harus **benar-benar siap pakai** sebelum fokus utama pindah ke segmen berikutnya; pekerjaan untuk segmen lain tetap boleh berjalan paralel bila ada kontributornya.

| Urutan | Segmen | Kode katalog |
|---|---|---|
| 1 | Dokter praktik mandiri | `praktik_mandiri` |
| 2 | Klinik pratama | `klinik_pratama` |
| 3 | Klinik utama | `klinik_utama` |
| 4 | Puskesmas | `puskesmas` |
| 5 | RS kelas D | `rs_d` |
| 6 | RS kelas C | `rs_c` |
| 7 | RS kelas B | `rs_b` |
| 8 | RS kelas A | `rs_a` |

---

## 2. Status saat ini (Oktober 2026)

### 2.1 Sudah tersedia

| Area | Isi |
|---|---|
| **Manajemen Modul** | Katalog relasional 30 modul, 53 fitur, 27 bagian; preset 8 segmen; override superadmin + riwayat; fitur wajib; syarat modul; bagian khusus jenis poli (gigi/mata). Gating di menu, sidebar, router, dan komponen. Simpan konfigurasi menyinkronkan izin peran admin. |
| **Praktik mandiri** | SOAP Ringkas satu layar, Pendaftaran Ringkas, kasir tanpa shift, General Consent opsional. |
| **Rawat jalan** | Pendaftaran → antrian poli (panggil, mulai periksa, layar TV/kiosk + suara) → RME → resep/lab/penunjang → selesai → antrean farmasi otomatis → kasir. |
| **Rawat inap & IGD** | Registrasi, SPRI, perpindahan bed/bangsal, discharge, tagihan kamar otomatis saat pulang. |
| **Farmasi & inventory** | Resep, telaah, racikan, penyerahan, penjualan bebas (OTC), stok depo, gudang, PO, penerimaan, retur, opname. |
| **Penagihan** | Tindakan, obat, lab, penunjang, dan kamar tertagih otomatis tanpa tagihan ganda; kuitansi & rincian tagihan lengkap dengan diskon/voucher. |
| **Laboratorium (Patologi Klinik)** | Order dari RME, validasi → tagihan, cetak hasil berkop dengan flag, **bridging LIS** (per order & massal, mapping kode, ambil hasil). |
| **Penunjang** | **Fisioterapi**, **Radiologi** (ruang, jadwal, template expertise), **MCU** (paket, peserta korporasi, impor Excel, invoice, rekap HRD, kirim massal ke LIS), **Patologi Anatomi**, **Mikrobiologi** (kultur, AST, antibiogram). |
| **Integrasi** | SATUSEHAT (kunjungan RJ selesai), BPJS PCare (FKTP) & VClaim (peserta, rujukan, SEP). |
| **Data demo & alat bantu** | 8 faskes fiktif satu per segmen, seeder transaksi via API, LIS tiruan, CI (sintaks layanan & SDK, uji unit lab, migrasi, cek katalog, build frontend). |
| **Fondasi repo** | Monorepo dengan SDK `@opensimrs/*` di `packages/`, skema database tanpa data pribadi, satu `docker-compose.yml` + deploy generik `deploy/server/`, identifier teknis seluruhnya `opensimrs`. |

### 2.2 Masih berstatus "Segera" (belum dibangun)

- **Modul:** Program Puskesmas, Kamar Operasi, ICU, Gizi, Koding RM, CSSD, Bank Darah RS, UTD/UPTD, Akuntansi, Training.
- **Fitur:** Lab Rujukan, Rencana Kontrol VClaim, Antrean Online BPJS (Mobile JKN), MCU PCare, Pembelian via Marketplace, seluruh fitur Bank Darah dan UTD.

Daftar lengkap dan statusnya ada di [katalog Manajemen Modul](./MANAJEMEN-MODUL.md#5-katalog-lengkap).

### 2.3 Batasan yang perlu diketahui implementator

- Status rilis **alfa**: uji menyeluruh dan jalankan paralel dengan sistem lama sebelum dipakai penuh.
- Otorisasi per peran dan penegakan Manajemen Modul sebagian besar masih di frontend (B-10, B-11).
- Belum ada wizard instalasi bersih tanpa data demo (B-40).

---

## 3. Fase & timeline

Timeline disusun untuk **model komunitas**: pengelola inti kecil dan kontributor sukarela (mahasiswa, IT faskes). Tanggal adalah perkiraan; yang mengikat adalah **urutan dan kriteria selesai**. Timeline ditinjau ulang setiap akhir kuartal.

| Fase | Periode (perkiraan) | Target rilis | Fokus | Kriteria selesai |
|---|---|---|---|---|
| **0. Pembukaan komunitas** | Okt – Nov 2026 | `1.0.0-alpha.x` | Dokumentasi, instalasi yang mulus, kebersihan repo, label & issue awal | Orang baru bisa memasang dan menjalankan data demo hanya dengan [Petunjuk Instalasi](./INSTALLATION_GUIDE.md). Minimal 20 issue berlabel `good first issue`. B-40, B-41, B-51 selesai (B-50, B-52, B-53, B-54, B-55 sudah selesai). |
| **1. Praktik mandiri siap pakai** | Nov 2026 – Jan 2027 | `1.0.0-beta.1` | Alur satu dokter penuh tanpa menu yang tidak relevan | Daftar → periksa → resep → serahkan obat → bayar → laporan berjalan di satu faskes demo tanpa bantuan developer. B-01 s.d. B-06 selesai. Satu faskes nyata menjadi pilot. |
| **2. Klinik pratama & puskesmas** | Feb – Apr 2027 | `1.0.0` (stabil pertama) | Multi-poli, multi-petugas, lab dasar, gudang → apotek, PCare, keamanan backend | Otorisasi per peran dan Manajemen Modul ditegakkan di backend (B-10, B-11). PCare tervalidasi di sandbox BPJS. Program Puskesmas (B-17) tersedia minimal KIA & imunisasi. |
| **3. Klinik utama & RS kelas D** | Mei – Jul 2027 | `1.1.0` | Rawat inap, IGD, VClaim/SEP, spesialis | Alur IGD → RI → pulang → klaim lengkap. Rencana kontrol (B-24) & lab rujukan (B-25) tersedia. |
| **4. RS kelas C & B** | Agu – Des 2027 | `1.2.0` – `1.3.0` | Kamar operasi, ICU, gizi, koding RM, CSSD, PACS radiologi | Modul terkait berstatus "Tersedia" beserta preset segmennya. |
| **5. RS kelas A & layanan darah** | 2028 | `1.4.0`+ | Bank darah, UTD/UPTD, akuntansi & remunerasi, antrean online BPJS | Semua modul katalog berstatus "Tersedia". |

**Pekerjaan lintas fase** (bisa dikerjakan kapan saja, paralel): keamanan dan otorisasi, pengujian otomatis, kualitas data, dokumentasi, serta aksesibilitas & performa antarmuka.

---

## 4. Label untuk kontributor

Setiap issue di GitHub diberi label agar mudah dipilih sesuai kemampuan.

### 4.1 Label jenis pekerjaan

| Label | Untuk siapa | Ciri pekerjaan |
|---|---|---|
| `good first issue` | **Mahasiswa** dan kontributor baru | Lingkup kecil dan jelas (≤ 1–2 hari), satu layanan/berkas, lokasi kode sudah disebut, cara uji tertulis. Tidak menyentuh alur klinis kritis. |
| `bantuan dibutuhkan` | Kontributor berpengalaman, IT faskes | Pekerjaan penting yang belum ada yang mengerjakan; bisa lintas layanan. |
| `butuh tenaga medis/klinis` | Dokter, perawat, apoteker, analis, perekam medis | Perlu validasi alur klinis, istilah, formulir, atau aturan (mis. nilai kritis lab, format resep). Tidak harus bisa coding: cukup memberi masukan di issue. |
| `integrasi` | Kontributor yang paham API eksternal | SATUSEHAT, BPJS (PCare/VClaim/Antrean), LIS, PACS/DICOM, alat laboratorium. Butuh akses sandbox. |
| `dokumentasi` | Siapa saja | Perbaikan panduan, tangkapan layar, terjemahan istilah. |
| `keamanan` | Kontributor berpengalaman | Otorisasi, kebocoran data, rahasia. **Kerentanan aktif dilaporkan secara privat** sesuai [SECURITY.md](../SECURITY.md), bukan lewat issue publik. |
| `RFC` | Pengelola & komunitas | Usulan perubahan besar; didiskusikan minimal 7 hari (lihat [GOVERNANCE.md](../GOVERNANCE.md)). |

### 4.2 Label pendukung

- **Prioritas:** `P1` (menghalangi pemakaian nyata pada fase berjalan), `P2` (penting untuk fase berjalan/berikutnya), `P3` (peningkatan).
- **Area:** `modul:<kode>` sesuai kode katalog, mis. `modul:farmasi`, `modul:laboratorium`, `modul:radiologi`, ditambah `area:frontend`, `area:database`, `area:devops`.
- **Status:** `menunggu keputusan` (belum boleh dikerjakan), `siap dikerjakan`, `sedang dikerjakan`.

---

## 5. Cara memilih & mengklaim pekerjaan

1. **Pilih** issue berlabel `siap dikerjakan` yang sesuai kemampuan. Mahasiswa sebaiknya mulai dari `good first issue`. Item backlog di bagian 6 yang belum punya issue boleh dibuatkan issue-nya dengan menyebut ID-nya (mis. `B-41`).
2. **Klaim** dengan berkomentar di issue, mis. *"Saya ingin mengerjakan ini, perkiraan selesai 5 hari."* Tunggu pengelola menetapkan (assign) Anda. Satu orang sebaiknya memegang **maksimal dua** issue aktif.
3. **Mulai** dengan membaca [Konteks Pengembangan](./KONTEKS-PENGEMBANGAN.md) dan bagian kode yang disebut di issue. Tanyakan di issue bila ada yang belum jelas.
4. **Buka draft PR lebih awal** (setelah 1–3 hari kerja) agar arah pekerjaan bisa dikoreksi sejak dini. Sebut ID backlog di judul PR, mis. `fix(lab): B-45 status batal order lab`.
5. **Kabari** bila terhambat. Klaim yang **tidak ada kabar selama 14 hari** dianggap dilepas dan issue dibuka kembali untuk orang lain.
6. **Selesai** saat PR digabung: item dipindah ke CHANGELOG dan ditandai selesai di sini.

Untuk tugas kuliah, kerja praktik, atau skripsi: sebutkan di issue agar pengelola bisa membantu memilih lingkup yang pas dan memberi umpan balik tepat waktu.

---

## 6. Backlog

Kolom **Label** menunjukkan label utama yang disarankan. Status: `menunggu keputusan`, `siap dikerjakan`, `sedang dikerjakan`, `selesai`.

### 6.1 Fase 0 — Pembukaan komunitas & kebersihan repo

| ID | Item | Prioritas | Label | Status | Catatan |
|---|---|---|---|---|---|
| B-40 | **Wizard/seeder instalasi awal**: membuat faskes pertama, segmen, peran admin, dan superadmin tanpa data demo. | P1 | `bantuan dibutuhkan` | siap dikerjakan | Sementara memakai `db:demo:seed` lalu menonaktifkan faskes demo (lihat [Petunjuk Instalasi 7.3](./INSTALLATION_GUIDE.md#73-akun-superadmin-pertama)). |
| B-41 | **Bersihkan 47 galat sintaks lama `vue-tsc`** di `frontend-service/src/components/icons/*` agar pemeriksaan tipe bisa diandalkan. | P2 | `good first issue` | siap dikerjakan | Setelah bersih, tambahkan `vue-tsc` ke CI. |
| B-51 | **Port di `.env.example` tiap layanan belum seragam** (mis. admisi 8001, lab 4444) dan berbeda dari `docker-compose.yml`. Samakan dengan [tabel port](./INSTALLATION_GUIDE.md#3-gambaran-sistem--port). | P2 | `good first issue` | siap dikerjakan | Alamat IP internal dan kunci terisi sudah dibersihkan; tinggal port dan kelengkapan variabel. |
| B-57 | **Ganti screenshot carousel login**: gambar di `frontend-service/src/assets/images/Login/` masih tangkapan layar tampilan lama. Ganti dengan tangkapan layar OpenSIMRS terbaru yang memakai data demo (tanpa data asli). | P3 | `good first issue`, `area:frontend` | siap dikerjakan | Logo & favicon OpenSIMRS sudah diganti (`src/assets/images/opensimrs*.png`). |
| B-56 | **Uji unit untuk layanan tanpa tes** (`admisi`, `laporan`, `payment`, `rawat-inap`, `stok-farmasi` masih `echo`). Mulai dari fungsi murni (perhitungan tagihan, penomoran). | P2 | `good first issue` | siap dikerjakan | Contoh pola: `lab-service/test/`, `rekamedis-service/test/` (`node --test`). `penunjang-service` sudah punya skrip `npm test` tetapi belum punya folder `test/`. |

### 6.2 Fase 1 — Praktik mandiri

| ID | Item | Prioritas | Label | Status | Catatan |
|---|---|---|---|---|---|
| B-01 | **Satu lokasi stok** untuk praktik mandiri: fitur "Banyak Depo / Lokasi Stok" dimatikan di preset; pilihan "Lokasi Tujuan Order" di dialog resep disembunyikan dan resep masuk ke depo rawat jalan. | P1 | `butuh tenaga medis/klinis` | menunggu keputusan | Backend sudah memilih depo bawaan bila lokasi tujuan kosong (`prescription-service.js`). |
| B-02 | **Penerimaan barang supplier langsung ke depo**, tanpa PO dan gudang (Inventory tidak aktif di praktik mandiri). | P1 | `bantuan dibutuhkan` | menunggu keputusan | Bergantung pada B-01. |
| B-03 | **Gudang ikut muncul sebagai tujuan order resep** di semua segmen, padahal gudang bukan tempat penyerahan obat. | P2 | `bantuan dibutuhkan` | menunggu keputusan | Pencocokan `default_tujuan_order_permintaan` per karakter membuat kode `10` terbaca sebagai RJ. |
| B-04 | **Tagihan otomatis ditutup setelah lunas** (`close_bill`). Saat ini tagihan baru pada kunjungan berikutnya bisa ikut menempel. | P1 | `butuh tenaga medis/klinis` | menunggu keputusan | Perlu aturan kapan tagihan ditutup. |
| B-05 | **Makna PPN obat** di `konfigurasi_harga.ppn` belum jelas (data lama berisi 110); PPN tagihan diambil dari profil faskes. | P2 | `bantuan dibutuhkan` | menunggu keputusan | Satukan sumber PPN. |
| B-06 | **Komponen tarif bawaan** agar menu Komponen Tarif bisa disembunyikan di praktik mandiri. | P3 | `good first issue` | siap dikerjakan | |
| B-42 | **Angka "Tagihan" di header RME selalu Rp 0** (belum diimplementasikan). | P2 | `good first issue` | siap dikerjakan | Ambil total dari payment-service per kunjungan. |
| B-43 | **Normalisasi titel/bahasa pasien** hasil API vs opsi form (mis. "Tn." vs "Tn. (Tuan)"). | P3 | `good first issue` | siap dikerjakan | Admisi. |
| B-44 | **Kasir: rincian Detail Tagihan** (Biaya Tindakan/Obat/Kamar) Rp 0 untuk item kategori penunjang; "Umur: Thn Bln Hr" kosong. | P2 | `good first issue` | siap dikerjakan | |

### 6.3 Fase 2 — Klinik pratama & puskesmas

| ID | Item | Prioritas | Label | Status | Catatan |
|---|---|---|---|---|---|
| B-10 | **Otorisasi per peran di backend** (saat ini terutama ditegakkan di frontend). | P1 | `bantuan dibutuhkan`, `keamanan` | siap dikerjakan | Pola sudah ada di `penunjang-service/src/umum/izin.js`. |
| B-11 | **Penegakan Manajemen Modul di backend**: endpoint modul/fitur nonaktif ditolak server. | P1 | `bantuan dibutuhkan`, `keamanan` | siap dikerjakan | Sumber kebenaran: `GET /api/v3/setting/modul`. |
| B-12 | **Rollback antrian** bila registrasi gagal. | P1 | `bantuan dibutuhkan` | siap dikerjakan | |
| B-13 | **Race condition No. RM** saat pendaftaran bersamaan. | P1 | `bantuan dibutuhkan` | siap dikerjakan | Perlu sequence atau lock per faskes. |
| B-14 | **Pencarian penjamin TUNAI tidak dibatasi per faskes** (`insurance-admission-repository.js`). | P1 | `good first issue` | siap dikerjakan | |
| B-15 | **Placeholder template General Consent** (`{{ nama }}` dst.) tidak terisi saat dicetak. | P2 | `good first issue` | siap dikerjakan | |
| B-16 | **PCare: rujukan, obat per kunjungan.** | P2 | `integrasi` | siap dikerjakan | |
| B-17 | **Program Puskesmas** (`program_puskesmas`): KIA, imunisasi, PTM, laporan program. | P2 | `butuh tenaga medis/klinis`, `bantuan dibutuhkan` | siap dikerjakan | Butuh rincian kebutuhan dari tenaga puskesmas. |
| B-18 | **Parameter `?filter=` di URL** diabaikan saat halaman dibuka langsung. | P3 | `good first issue` | siap dikerjakan | |
| B-19 | **Datamaster gigi** hanya tampil bila ada poli gigi; mapping SATUSEHAT di datamaster mengikuti modul `satusehat`. | P3 | `good first issue` | siap dikerjakan | |
| B-45 | **Lab**: `updateBatalOrder` memeriksa status secara keliru; pembuatan order lab belum dalam transaksi; batas nilai rujukan hanya integer (perlu desimal). | P1 | `bantuan dibutuhkan` | siap dikerjakan | `lab-service`. |
| B-48 | **MCU lanjutan**: pemeriksaan tambahan berjenis tindakan; pembayaran korporasi masuk laporan kasir; uji dropdown templat impor di Microsoft Excel; **MCU PCare** (fitur `mcu_pcare`, syarat `bpjs_fktp`). | P2 | `integrasi`, `bantuan dibutuhkan` | siap dikerjakan | |

### 6.4 Fase 3 — Klinik utama & RS kelas D

| ID | Item | Prioritas | Label | Status | Catatan |
|---|---|---|---|---|---|
| B-20 | **Diagnosis dan keluhan dari IGD** tidak terbawa saat pasien pindah ke rawat inap. | P1 | `butuh tenaga medis/klinis` | siap dikerjakan | |
| B-21 | **Discharge tidak idempoten**: discharge ulang menduplikasi `history_tindakan`. | P1 | `bantuan dibutuhkan` | siap dikerjakan | `rekamedis-service` `insertHistoryTindakan`. |
| B-22 | **Kode status pulang "Dirujuk"**: frontend mengirim `other-hfc`, backend memeriksa `other-hcf`. | P2 | `good first issue` | siap dikerjakan | Samakan ke kode FHIR `other-hcf` dan migrasikan data lama. |
| B-23 | **Daftar tindakan tidak bisa dikosongkan** (validasi `items.min(1)`), dan tindakan yang dihapus tidak dikirim ke server. | P2 | `good first issue` | siap dikerjakan | |
| B-24 | **Rencana Kontrol & SPRI via VClaim** (`vclaim_rencana_kontrol`). | P2 | `integrasi` | siap dikerjakan | |
| B-25 | **Lab rujukan** ke laboratorium luar (`lab_rujukan`). | P2 | `bantuan dibutuhkan` | siap dikerjakan | |
| B-26 | **Umur tampil "0Th 0Bln 0Hr"** di Perpindahan Bangsal. | P3 | `good first issue` | siap dikerjakan | |
| B-27 | **Ringkasan ekstremitas** tidak masuk summary RME (`ket_ekstremitas_*` vs `ket_ekstermitas_*`). | P3 | `good first issue` | siap dikerjakan | |

### 6.5 Fase 4–5 — Rumah sakit menengah & besar

| ID | Item | Prioritas | Label | Status | Catatan |
|---|---|---|---|---|---|
| B-32 | **Kamar Operasi, ICU, Gizi, Koding RM, CSSD.** | P2 | `butuh tenaga medis/klinis`, `bantuan dibutuhkan` | siap dikerjakan | Modul sudah terdaftar berstatus "Segera". Ikuti [panduan menambah modul](./MANAJEMEN-MODUL.md#4-panduan-pengembang-menambah-modul-atau-fitur-baru). |
| B-33 | **Bank Darah RS & UTD/UPTD produksi darah.** | P3 | `butuh tenaga medis/klinis` | siap dikerjakan | Fitur turunan sudah terdaftar. |
| B-34 | **Akuntansi & remunerasi** (integrasi back office). | P3 | `bantuan dibutuhkan` | siap dikerjakan | |
| B-35 | **Antrean Online BPJS (Mobile JKN)**: task id, check-in, antrean farmasi. | P2 | `integrasi` | siap dikerjakan | Fitur `antrian_online_bpjs`. |
| B-46 | **Patologi Anatomi & Mikrobiologi lanjutan**: izin READ di backend; halaman verifikasi publik QR hasil; ekspor WHONET; integrasi alat mikrobiologi; notifikasi nilai kritis; data demo dokter spesialis mikrobiologi klinik. | P2 | `butuh tenaga medis/klinis`, `integrasi` | siap dikerjakan | |
| B-47 | **Radiologi lanjutan**: jam operasional per hari & libur alat, status "tidak hadir", **PACS/DICOM**, dosis radiasi & BHP, tanda tangan final, layar antrean. | P2 | `integrasi`, `butuh tenaga medis/klinis` | siap dikerjakan | |
| B-49 | **Fisioterapi**: hapus komponen prototipe lama yang tidak terpakai di `frontend-service/src/views/Fisioterapi/Layout/**` & `Section/**`. | P3 | `good first issue` | siap dikerjakan | Pastikan tidak ada impor tersisa sebelum menghapus. |

### 6.6 Pertanyaan terbuka

| ID | Pertanyaan |
|---|---|
| Q-01 | Perlukah segmen khusus **UTD/UPTD Darah** dan **praktik fisioterapis mandiri**? |
| Q-02 | Modul **Training** (kelas olahraga/edukasi berbayar) masuk produk inti, atau diturunkan menjadi add-on? |
| Q-03 | **Marketplace, Subscription, dan Web Admin Mobile** adalah fitur tingkat platform, bukan modul faskes. Di repo mana dan oleh siapa dikembangkan? |
| Q-04 | Kontrak API LIS (cek duplikat, idempotensi, format status/hasil, kode lab per faskes) perlu dibakukan bersama penyedia LIS agar integrasi bisa dipakai LIS lain. Temuan teknis dari uji integrasi disampaikan langsung ke penyedia LIS, tidak dipublikasikan. |

### 6.7 Selesai

Ringkasan per rilis ada di [CHANGELOG](../CHANGELOG.md). Item backlog lama yang sudah selesai pada Oktober 2026:

| ID lama | Item | Selesai di |
|---|---|---|
| B-50 | Skrip `dev:frontend` (serta `dev:penunjang`, `dev:satusehat`, `dev:bpjs`) di `package.json` root; `npm run dev` kini menjalankan semua layanan + frontend; `infra:up` hanya infrastruktur. | 1.0.0-alpha.1 |
| B-52 | `schema.sql` hanya struktur + data referensi nasional, tanpa data faskes/pasien/pengguna dan tanpa kepemilikan objek; instalasi baru tidak perlu `db:demo:reset`. | 1.0.0-alpha.1 |
| B-53 | `mongo-init.js` tanpa kata sandi tertanam; layanan memakai akun root MongoDB dari `.env`. | 1.0.0-alpha.1 |
| B-54 | Rebranding identifier teknis ke `opensimrs` (paket SDK, database, kontainer, image, jaringan, token warna); SDK dipindah ke `packages/` sehingga tidak bergantung pada paket npm pihak luar. | 1.0.0-alpha.1 |
| B-55 | CI menjalankan `node scripts/dokumen-katalog.mjs --cek`, cek sintaks `packages/`, dan uji unit lab-service. | 1.0.0-alpha.1 |
| B-30 | Radiologi (order, worklist, expertise, ruang & jadwal, template, petugas). PACS dipindah ke B-47. | 0.6.0 |
| B-31 | Fisioterapi / Rehabilitasi Medik (order, jadwal, booking, evaluasi, laporan). | 0.6.0 |
| B-36 | Medical Check Up (paket, perorangan & korporasi, stasiun, kesimpulan, sertifikat, invoice, impor Excel, LIS massal). MCU PCare dipindah ke B-48. | 0.6.0 |
| – | Patologi Anatomi & Mikrobiologi sebagai modul terpisah. | 0.6.0 |
| – | Manajemen Modul tiga tingkat relasional, syarat modul, sinkron izin, katalog izin dari server. | 0.5.0 – 0.6.0 |
| – | SOAP Ringkas, Pendaftaran Ringkas, kasir tanpa shift (praktik mandiri). | 0.6.0 |
| – | Gating fitur: General Consent, racikan, obat kronis BPJS, substitusi, retur, PO, opname, bayi baru lahir, resep kacamata, odontogram. | 0.5.0 – 0.6.0 |
| – | Tagihan tidak dobel saat simpan ulang; kuitansi & tagihan lengkap; data demo 8 faskes. | 0.6.0 |

---

## 7. Keputusan desain yang sudah diambil

Keputusan ini sebaiknya tidak diubah tanpa diskusi (RFC), karena kode lain sudah bergantung padanya.

| Keputusan | Alasan |
|---|---|
| Katalog modul disimpan di `database/data/katalog-modul.json` dan disinkronkan ke tabel `ref_*` lewat migrasi | Satu sumber kebenaran yang bisa ditinjau di PR, dengan integritas relasi (FK) di database. |
| Konfigurasi faskes hanya menyimpan **selisih** dari preset segmen | Perubahan preset otomatis berlaku ke faskes yang tidak meng-override. |
| Hanya peran `super admin` yang boleh mengubah Manajemen Modul | Modul berdampak ke kontrak layanan dan alur klinis, jadi bukan pengaturan admin faskes. |
| Layar ringkas memakai endpoint dan struktur data yang sama dengan form lengkap | Resume, SATUSEHAT, tagihan, dan laporan tidak perlu tahu layar mana yang dipakai. |
| Item tagihan yang dihitung ulang sistem diganti, bukan ditambah (`replace_ref` / `replace_category_codes`) | Penyimpanan ulang dan discharge ulang tidak menagih dua kali. |
| Gagal kirim ke LIS = gagal validasi order lab | Mencegah order tertagih tetapi tidak pernah sampai ke laboratorium. |
| Satu monorepo untuk semua layanan | Satu fitur lintas layanan cukup satu PR; migrasi, katalog, dan dokumen ikut ditinjau bersama. |
| Data demo memakai identitas fiktif per segmen | Data uji realistis tanpa memuat data pasien nyata. |

---

## 8. Pemetaan dokumen kebutuhan lama ke katalog

Dokumen kebutuhan produk (PRD) lama disusun per menu, sedangkan katalog disusun per kemampuan yang bisa dinyalakan atau dimatikan per segmen. Dokumen PRD tidak dipublikasikan; ringkasan pemetaannya:

| PRD | Katalog | Status |
|---|---|---|
| Admisi | `pendaftaran` + General Consent, Pendaftaran Ringkas; bayi baru lahir di `rawat_inap` | Tersedia |
| Antrian | `antrian` (layar kiosk, APM) | Antrean Online BPJS → B-35 |
| Rekam Medis, RJ, RI, IGD | `rawat_jalan`, `rawat_inap`, `igd` + bagian asesmen & resume | Tersedia |
| Poli Gigi / Poli Mata | Bagian khusus jenis poli (odontogram, pemeriksaan mata, resep kacamata) | Tersedia |
| Farmasi & Stok | `farmasi` | Satu lokasi stok → B-01 |
| Inventory | `inventory` | Marketplace → Q-03 |
| Laboratorium | `laboratorium` (+ `patologi_anatomi`, `mikrobiologi`) | Lab rujukan → B-25 |
| Pembayaran | `pembayaran` | Tutup tagihan otomatis → B-04 |
| PCare / VClaim | `bpjs_fktp` / `bpjs_fkrtl` | B-16, B-24, B-48 |
| Fisioterapi | `fisioterapi` | Tersedia |
| Integrasi Back Office | `akuntansi` (Segera) | B-34 |
| Training | `training` (Segera) | Q-02 |
| Marketplace, Subscription, Web Admin Mobile | Di luar katalog faskes | Q-03 |

---

## 9. Cara memperbarui dokumen ini

1. Saat mulai mengerjakan item, ubah statusnya menjadi `sedang dikerjakan` dan sebut ID-nya di judul PR, mis. `fix(farmasi): B-03 gudang bukan tujuan order resep`.
2. Saat PR digabung, pindahkan item ke [6.7 Selesai](#67-selesai) dan tulis entrinya di [CHANGELOG](../CHANGELOG.md) bagian *Belum dirilis*.
3. Item baru memakai ID berikutnya yang belum terpakai (B-58, B-59, ...), ditaruh di fase yang sesuai, lengkap dengan prioritas, label, dan lokasi kode bila diketahui.
4. Perubahan urutan fase, timeline, atau keputusan desain dibahas dulu lewat issue berlabel `RFC`, lalu dicatat di sini.
