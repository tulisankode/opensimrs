<p align="center">
  <img src="./Logo%20OpenSIMRS%20Biru%20Teal.png" alt="Logo OpenSIMRS" width="280"/>
</p>

<h1 align="center">OpenSIMRS</h1>

<p align="center">
  <strong>SIMRS open source untuk fasilitas kesehatan Indonesia, dari praktik dokter mandiri sampai rumah sakit kelas A.</strong>
</p>

<p align="center">
  <a href="https://opensimrs.my.id"><img alt="Website OpenSIMRS.my.id" src="https://img.shields.io/badge/website-OpenSIMRS.my.id-0e7c86"/></a>
  <a href="https://t.me/+uW2ZQA1V7Dc3OTVl"><img alt="Telegram" src="https://img.shields.io/badge/Telegram-gabung-26A5E4?logo=telegram&logoColor=white"/></a>
  <a href="https://discord.gg/qAWhdzGJTW"><img alt="Discord" src="https://img.shields.io/badge/Discord-gabung-5865F2?logo=discord&logoColor=white"/></a>
  <a href="https://chat.whatsapp.com/EULeLrLPMcC6vNKV4AxHQj?mode=gi_t"><img alt="WhatsApp" src="https://img.shields.io/badge/WhatsApp-gabung-25D366?logo=whatsapp&logoColor=white"/></a>
  <a href="./LICENSE"><img alt="Lisensi MIT" src="https://img.shields.io/badge/lisensi-MIT-blue"/></a>
</p>

<p align="center">
  <a href="./docs/INSTALLATION_GUIDE.md">Instalasi</a> ·
  <a href="./docs/MANAJEMEN-MODUL.md">Manajemen Modul</a> ·
  <a href="./docs/ROADMAP.md">Roadmap</a> ·
  <a href="./CHANGELOG.md">Changelog</a> ·
  <a href="./CONTRIBUTING.md">Berkontribusi</a> ·
  <a href="./COMMUNITY.md">Komunitas</a>
</p>

> **Status: alfa (`1.0.0-alpha.1`).** Fitur masih bertambah cepat. Silakan dicoba dan dievaluasi; untuk pemakaian di faskes, uji menyeluruh dan jalankan paralel dengan sistem lama terlebih dahulu.

---

## Apa itu OpenSIMRS?

OpenSIMRS adalah **Sistem Informasi Manajemen Rumah Sakit (SIMRS)** sumber terbuka yang dirancang untuk kebutuhan faskes di Indonesia: pendaftaran, rekam medis elektronik (RME), farmasi, laboratorium, kasir, rawat inap, IGD, layanan penunjang, sampai integrasi **SATUSEHAT** dan **BPJS Kesehatan**.

Satu aplikasi bisa dipakai oleh berbagai jenis faskes karena fiturnya **modular per segmen**:

| Segmen faskes | Contoh yang aktif bawaan |
|---|---|
| Dokter praktik mandiri | Pendaftaran & SOAP ringkas satu layar, resep, kasir sederhana |
| Klinik pratama / Puskesmas | Antrian, multi-poli, apotek & gudang, laboratorium, BPJS PCare, MCU |
| Klinik utama / RS kelas D | Rawat inap, IGD, radiologi, fisioterapi, BPJS VClaim (SEP) |
| RS kelas C / B / A | Ditambah patologi anatomi, mikrobiologi, dan modul rumah sakit lain (sebagian masih "Segera") |

Superadmin dapat menyalakan atau mematikan modul, fitur, dan bagian form untuk tiap faskes di luar bawaan segmennya. Penjelasan lengkap ada di [Manajemen Modul](./docs/MANAJEMEN-MODUL.md).

---

## Fitur utama

| Modul | Ringkasan |
|---|---|
| **Pendaftaran & Antrian** | Data pasien, registrasi rawat jalan/inap/IGD, penjamin (umum, BPJS, asuransi), antrian poli dengan layar TV/kiosk bersuara, anjungan pasien mandiri |
| **Rekam Medis Elektronik** | Asesmen per bagian (alergi, tanda vital, nyeri, triase, gigi, mata, ...), SOAP, diagnosis ICD-10, tindakan, resep, order penunjang, resume & surat, SOAP Ringkas untuk praktik mandiri |
| **Rawat Jalan, Rawat Inap, IGD** | Alur periksa → selesai, SPRI, perpindahan bed/bangsal, discharge dengan tagihan kamar otomatis |
| **Farmasi & Inventory** | Telaah resep, racikan, penyerahan obat, penjualan bebas, stok depo, gudang, pembelian ke supplier, retur, stok opname |
| **Laboratorium** | Order dari RME, hasil & validasi, cetak hasil berkop dengan flag nilai abnormal, **bridging LIS** (kirim per order/massal, ambil hasil, mapping kode) |
| **Penunjang** | Radiologi (jadwal per ruang, expertise), Fisioterapi (jadwal terapi, evaluasi), Patologi Anatomi, Mikrobiologi (kultur & uji kepekaan antibiotik), Medical Check Up perorangan & korporasi |
| **Pembayaran** | Tagihan otomatis dari semua layanan tanpa tagihan ganda, kasir dengan/tanpa shift, diskon & voucher, kuitansi |
| **Integrasi** | SATUSEHAT (Kemenkes), BPJS PCare (FKTP) & VClaim (FKRTL), LIS |
| **Datamaster, Laporan & Setting** | Data faskes, lokasi, pegawai, tarif, peran & izin; dashboard dan laporan; profil, logo & warna tema per faskes |

Daftar lengkap modul, fitur, dan statusnya: [katalog Manajemen Modul](./docs/MANAJEMEN-MODUL.md#5-katalog-lengkap).

---

## Untuk siapa?

Semua peran adalah **Contributor** ([panduan per peran](./docs/kontributor/README.md)):

- **Implementator** (IT rumah sakit, klinik, puskesmas, mahasiswa): memasang, mengonfigurasi, dan mendampingi OpenSIMRS di faskes. Mulai dari [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md) dan [Panduan Implementator](./docs/kontributor/IMPLEMENTATOR.md).
- **Developer** (mahasiswa & pengembang): mempelajari sistem informasi kesehatan nyata dan mengerjakan backlog. Mulai dari issue berlabel `good first issue` di [Roadmap](./docs/ROADMAP.md#4-label-untuk-kontributor) dan [Panduan Developer](./docs/kontributor/DEVELOPER.md).
- **Tester/QA:** menguji alur dengan akun demo per segmen ([Panduan Tester/QA](./docs/kontributor/TESTER-QA.md)).
- **Product development** (analis kebutuhan, tenaga medis & klinis, desainer UX): memvalidasi alur dan istilah lewat issue berlabel `butuh tenaga medis/klinis`, tanpa perlu menulis kode ([Panduan Product Development](./docs/kontributor/PRODUCT-DEV.md)).

---

## Mulai cepat

Prasyarat: Git, Node.js 22, dan Docker + Docker Compose (atau PostgreSQL 16, MongoDB 7, Redis 7 yang dipasang langsung, lihat [instal tanpa Docker](./docs/INSTALLATION_GUIDE.md#9-menjalankan-tanpa-docker-instal-native)). Langkah lengkap (termasuk isi `.env` tiap layanan) ada di [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md#4-jalur-a--coba-cepat-dengan-data-demo-lokal).

```bash
git clone https://github.com/tulisankode/opensimrs.git
cd opensimrs
cp .env.example .env                     # isi kredensial database & SECRET_KEY
npm run infra:up                         # PostgreSQL, MongoDB, Redis (Docker)
npm run install:all                      # dependensi semua layanan + frontend
#   buat .env tiap layanan & frontend-service/.env (lihat Petunjuk Instalasi bagian 5)
npm run db:migrate
npm run db:demo:seed                     # 8 faskes demo + akun
npm run dev                              # semua layanan + frontend
```

**Tanpa Docker (macOS/Ubuntu/Debian):** cukup `./install.sh`. Skrip ini mengecek dan memasang dependensi, menyiapkan database dan semua `.env`, lalu menjalankan instalasi, migrasi, dan data demo. Setelah itu jalankan `npm run dev`. Pakai `./install.sh --cek` untuk hanya memeriksa dependensi.

**Tanpa Docker (Windows 10/11):** jalankan `install.cmd` dari folder repo (klik ganda, atau `.install.cmd` di terminal). Skrip ini melakukan hal yang sama: dependensi dipasang lewat winget (Node.js 22, PostgreSQL 16, MongoDB 7, mongosh, dan Memurai sebagai pengganti Redis). Opsi: `-Cek`, `-Ya`, `-TanpaDemo`, `-Jalankan`. Bila PostgreSQL sudah terpasang, skrip menanyakan sandi superuser `postgres`.

Laptop dengan RAM terbatas: `npm run dev:core` (auth, datamaster, admisi, frontend). Semua di Docker: `npm run stack:up`.

Buka **http://localhost:5520** dan login dengan **`superadmin` / `Demo@2026`**. Akun demo per faskes mengikuti pola `<kode>.<peran>`, mis. `kp.pendaftaran`, `rsd.kasir`, `pm.dr.andi` ([daftar pola akun](./docs/INSTALLATION_GUIDE.md#akun-demo)).

> Data demo seluruhnya fiktif dan hanya untuk development/staging ([aturan lingkungan](./docs/LINGKUNGAN.md)). Jangan menjalankan `db:demo:seed` atau `db:demo:reset` di server yang berisi data nyata.

---

## Arsitektur singkat

```
                     frontend-service (Vue 3, port 5520)
                                       │
                                       │ REST /api/v3/<layanan>/...
 ┌───────────┬────────────┬────────────┼────────────┬──────────────┬───────────────┐
 auth     admisi/antrian  rawat-jalan  rekamedis   farmasi/stok   payment   ... (18 layanan Express)
 └───────────┴────────────┴────────────┼────────────┴──────────────┴───────────────┘
                                       │
          PostgreSQL (satu database bersama) · MongoDB (isi RME) · Redis (cache token & izin)
                                       │
   satusehat-service (FHIR Kemenkes) · bpjs-service (PCare/VClaim) · lab-service ⇄ LIS
```

- **Backend:** Node.js + Express, satu layanan per domain (auth, admisi, antrian, rawat jalan, rawat inap, IGD, rekam medis, farmasi, stok, inventory, laboratorium, penunjang, pembayaran, datamaster, setting, laporan, SATUSEHAT, BPJS).
- **Frontend:** Vue 3 + TypeScript + PrimeVue + Pinia + Tailwind.
- **Data:** PostgreSQL untuk data terstruktur, MongoDB untuk isi rekam medis per sesi, Redis untuk cache token/izin. Setiap data diisolasi per faskes.
- **Monorepo:** semua layanan, SDK bersama `@opensimrs/*` (`packages/`), migrasi (`database/migrations`), katalog modul (`database/data/katalog-modul.json`), deploy (`deploy/server/`), dan dokumen berada di satu repo.

Rincian arsitektur, konvensi, dan alur bisnis: [Konteks Pengembangan](./docs/KONTEKS-PENGEMBANGAN.md).

---

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md) | Persyaratan, port, `.env`, data & akun demo, implementasi di faskes, dengan Docker & tanpa Docker, cadangan, pemecahan masalah |
| [Spesifikasi Hardware](./docs/SPESIFIKASI-HARDWARE.md) | Kebutuhan server on-premise per segmen faskes, jaringan, UPS, cadangan 3-2-1, perangkat klien |
| [Lingkungan Dev/Staging/Production](./docs/LINGKUNGAN.md) | Tujuan tiap lingkungan, alur promosi kode, aturan `.env` dan variabel per lingkungan |
| [Manajemen Modul, Fitur & Segmentasi](./docs/MANAJEMEN-MODUL.md) | Konsep segmen → modul → fitur → bagian, cara mengaktifkan modul, hubungan dengan hak akses, katalog lengkap, panduan menambah modul |
| [Roadmap, Timeline & Backlog](./docs/ROADMAP.md) | Status terkini, fase & timeline, label kontributor, cara mengklaim pekerjaan, backlog |
| [Changelog](./CHANGELOG.md) | Riwayat perubahan per rilis dan skema versi |
| [Panduan Kontribusi](./CONTRIBUTING.md) | Alur fork → PR, konvensi commit & kode, aturan keamanan, cara menguji, etika data kesehatan |
| [Versi, Branch, dan Aturan Merge](./docs/kontributor/ALUR-GIT-RILIS.md) | SemVer & tahap alpha/beta/rc, manajemen branch, syarat persetujuan PR, cara merge, proses rilis |
| [Peran Kontributor](./docs/kontributor/README.md) | Jenjang & rekognisi; panduan [Implementator](./docs/kontributor/IMPLEMENTATOR.md), [Developer](./docs/kontributor/DEVELOPER.md), [Tester/QA](./docs/kontributor/TESTER-QA.md), [Product Development](./docs/kontributor/PRODUCT-DEV.md) |
| [Komunitas](./COMMUNITY.md) | Kanal resmi (Telegram, Discord, WhatsApp) dan aturan forum |
| [Kode Etik](./CODE_OF_CONDUCT.md) · [Tata Kelola](./GOVERNANCE.md) · [Manifesto](./COMMUNITY_MANIFESTO.md) · [Keamanan](./SECURITY.md) | Aturan komunitas, peran & pengambilan keputusan, pelaporan kerentanan |
| [Konteks Pengembangan](./docs/KONTEKS-PENGEMBANGAN.md) | Arsitektur, konvensi data & API, alur bisnis, jebakan yang sudah diketahui, glosarium |
| [Dokumentasi API](./docs/API_DOCUMENTATION.md) | Endpoint per layanan |
| [Rencana Pengujian](./docs/testing/rencana-testing.md) · [Audit Menu](./docs/audit/README.md) | Skenario uji dan temuan audit per modul |
| [LIS tiruan](./scripts/README-lis-tiruan.md) | Server LIS tiruan untuk menguji bridging laboratorium |

---

## Berkontribusi

Kontribusi dalam bentuk kode, dokumentasi, pengujian, maupun masukan klinis sangat diterima.

1. Pasang dan jalankan data demo ([jalur A](./docs/INSTALLATION_GUIDE.md#4-jalur-a--coba-cepat-dengan-data-demo-lokal)).
2. Pilih pekerjaan di [Roadmap](./docs/ROADMAP.md#6-backlog) atau issue berlabel `good first issue`, lalu klaim di issue tersebut.
3. Fork → branch → Pull Request, dengan pesan commit Bahasa Indonesia, mis. `feat(farmasi): ...`.

Baca [CONTRIBUTING.md](./CONTRIBUTING.md) dan [panduan peran Anda](./docs/kontributor/README.md) sebelum mengirim PR. **Jangan pernah meng-commit `.env`, kredensial, atau data pasien nyata.** Kerentanan keamanan dilaporkan secara privat sesuai [SECURITY.md](./SECURITY.md). Komunitas mengikuti [Kode Etik](./CODE_OF_CONDUCT.md) dan [Tata Kelola](./GOVERNANCE.md).

---

## Komunitas & kontak

- **Website resmi:** [OpenSIMRS.my.id](https://opensimrs.my.id)
- **Kanal diskusi resmi:** [grup Telegram](https://t.me/+uW2ZQA1V7Dc3OTVl), [server Discord](https://discord.gg/qAWhdzGJTW), dan [grup WhatsApp](https://chat.whatsapp.com/EULeLrLPMcC6vNKV4AxHQj?mode=gi_t). Aturan forum ada di [COMMUNITY.md](./COMMUNITY.md).
- **Pelacakan pekerjaan teknis:** GitHub Issues & Pull Request di repo ini.
- **Email:** `dev@opensimrs.id` (umum, keamanan, kode etik).

<table>
  <tr>
    <td align="center"><a href="https://t.me/+uW2ZQA1V7Dc3OTVl"><img src="./docs/assets/komunitas/qr-telegram.jpeg" alt="QR grup Telegram OpenSIMRS" width="160"/></a><br/>Telegram</td>
    <td align="center"><a href="https://chat.whatsapp.com/EULeLrLPMcC6vNKV4AxHQj?mode=gi_t"><img src="./docs/assets/komunitas/qr-whatsapp.jpeg" alt="QR grup WhatsApp OpenSIMRS" width="160"/></a><br/>WhatsApp</td>
  </tr>
</table>

---

## Lisensi

OpenSIMRS dirilis di bawah **Lisensi MIT**. Lihat berkas [LICENSE](./LICENSE).

SDK bersama di `packages/` (`@opensimrs/model-sdk`, `@opensimrs/authorization-sdk`, `@opensimrs/permission-sdk`) berlisensi ISC dengan atribusi penulis asli tetap dipertahankan (kolom `license` dan `author` di `package.json` masing-masing paket).
