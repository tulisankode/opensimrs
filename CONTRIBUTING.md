# Panduan Kontribusi OpenSIMRS

Terima kasih ingin ikut membangun **OpenSIMRS**, SIMRS open source untuk fasilitas kesehatan Indonesia. Panduan ini ditulis untuk dua kelompok kontributor:

- **IT rumah sakit/faskes**: melaporkan masalah dari lapangan, mengusulkan kebutuhan, memperbaiki bug yang ditemui saat implementasi.
- **Mahasiswa & pengembang**: memahami kode dan mengerjakan item backlog, mulai dari yang berlabel `good first issue`.

Tenaga medis dan klinis (dokter, perawat, apoteker, analis, perekam medis) juga sangat dibutuhkan untuk memvalidasi alur, meski tanpa menulis kode. Cari issue berlabel `butuh tenaga medis/klinis`.

**Semua peran adalah Contributor.** Aturan main per peran ada di [docs/kontributor/](./docs/kontributor/README.md):

| Peran | Panduan |
|---|---|
| Implementator (IT RS/faskes, mahasiswa yang memasang di faskes) | [IMPLEMENTATOR.md](./docs/kontributor/IMPLEMENTATOR.md) |
| Developer | [DEVELOPER.md](./docs/kontributor/DEVELOPER.md) (merujuk ke panduan ini) |
| Tester/QA | [TESTER-QA.md](./docs/kontributor/TESTER-QA.md) |
| Product development (analis kebutuhan, tenaga medis/klinis, desainer UX) | [PRODUCT-DEV.md](./docs/kontributor/PRODUCT-DEV.md) |

Diskusi dan tanya jawab dilakukan di kanal komunitas: [Telegram](https://t.me/+uW2ZQA1V7Dc3OTVl), [Discord](https://discord.gg/VNpKKgWw), dan [WhatsApp](https://chat.whatsapp.com/EULeLrLPMcC6vNKV4AxHQj?mode=gi_t) (aturan forum di [COMMUNITY.md](./COMMUNITY.md)); pelacakan pekerjaan teknis tetap lewat GitHub Issues dan Pull Request.

Dengan berkontribusi, Anda setuju mengikuti [Kode Etik](./CODE_OF_CONDUCT.md) dan bahwa kontribusi Anda dirilis di bawah [lisensi proyek](./LICENSE).

---

## Daftar isi

1. [Sebelum mulai](#1-sebelum-mulai)
2. [Alur kontribusi: fork → branch → PR](#2-alur-kontribusi-fork--branch--pr)
3. [Konvensi commit](#3-konvensi-commit)
4. [Konvensi kode](#4-konvensi-kode)
5. [Aturan keamanan & data](#5-aturan-keamanan--data)
6. [Cara menguji](#6-cara-menguji)
7. [Changelog](#7-changelog)
8. [Etika data kesehatan](#8-etika-data-kesehatan)
9. [Melaporkan bug & mengusulkan fitur](#9-melaporkan-bug--mengusulkan-fitur)

---

## 1. Sebelum mulai

1. Pasang OpenSIMRS di komputer Anda dengan **jalur A** di [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md) dan pastikan bisa login dengan akun demo.
2. Baca [Konteks Pengembangan](./docs/KONTEKS-PENGEMBANGAN.md): arsitektur, konvensi data & API, alur bisnis, dan **jebakan yang sudah diketahui**.
3. Bila pekerjaan Anda menyentuh menu/fitur, baca [Manajemen Modul](./docs/MANAJEMEN-MODUL.md).
4. Pilih pekerjaan dari [Roadmap & Backlog](./docs/ROADMAP.md) dan **klaim** sesuai [cara mengklaim](./docs/ROADMAP.md#5-cara-memilih--mengklaim-pekerjaan). Untuk perubahan besar (arsitektur, struktur data, kontrak API), buat issue berlabel `RFC` dulu (lihat [GOVERNANCE.md](./GOVERNANCE.md)).

---

## 2. Alur kontribusi: fork → branch → PR

```bash
# 1. Fork repo di GitHub (tombol "Fork"), lalu clone fork Anda
git clone https://github.com/<akun-anda>/opensimrs.git
cd opensimrs
git remote add upstream https://github.com/tulisankode/opensimrs.git

# 2. Selalu mulai dari main terbaru
git checkout main
git pull upstream main

# 3. Buat branch dengan nama yang menjelaskan isi
git checkout -b fix/b-22-kode-status-dirujuk

# 4. Kerjakan, uji, lalu commit (lihat konvensi di bagian 3)
git add <berkas-yang-diubah>
git commit -m "fix(rme): B-22 samakan kode status pulang dirujuk ke other-hcf"

# 5. Kirim ke fork Anda dan buka Pull Request ke tulisankode/opensimrs, branch main
git push origin fix/b-22-kode-status-dirujuk
```

**Nama branch:** `<jenis>/<id-backlog>-<ringkasan>`, mis. `feat/b-17-program-kia`, `fix/b-45-batal-order-lab`, `docs/panduan-satusehat`.

**Isi deskripsi PR:**
- Apa yang diubah dan **mengapa** (sebut ID backlog/issue, mis. `Menutup #123`, `B-22`).
- Cara menguji: akun demo dan segmen yang dipakai, langkah, hasil yang diharapkan.
- Tangkapan layar untuk perubahan tampilan (pakai data demo, bukan data pasien).
- Migrasi baru (bila ada) dan dampaknya ke data lama.
- Entri [CHANGELOG](./CHANGELOG.md) bagian *Belum dirilis*.

**Aturan PR:**
- Satu PR = satu tujuan. Pisahkan perbaikan yang tidak berhubungan.
- Satu fitur yang menyentuh beberapa layanan cukup **satu PR** (repo ini monorepo): kode layanan + migrasi + katalog + dokumen.
- PR kecil lebih cepat ditinjau. Buka **draft PR** lebih awal bila pekerjaan besar.
- PR harus lulus CI (cek sintaks layanan & `packages/`, uji unit lab-service, `schema.sql` + migrasi dua kali, cek dokumen katalog, build frontend) dan ditinjau minimal satu maintainer.
- Tanggapi masukan reviewer dengan commit baru; jangan *force-push* setelah review dimulai kecuali diminta.

---

## 3. Konvensi commit

Pesan commit memakai **Bahasa Indonesia** dengan format [Conventional Commits](https://www.conventionalcommits.org/id/v1.0.0/):

```
<jenis>(<cakupan>): <ringkasan singkat, huruf kecil, tanpa titik>

<penjelasan opsional: apa & mengapa, bukan bagaimana>
```

| Jenis | Kapan dipakai |
|---|---|
| `feat` | Fitur baru |
| `fix` | Perbaikan bug |
| `docs` | Dokumentasi saja |
| `refactor` | Perubahan struktur kode tanpa mengubah perilaku |
| `test` | Menambah/memperbaiki uji |
| `chore` | Pemeliharaan (dependensi, skrip, konfigurasi) |
| `perf` | Peningkatan performa |
| `ci` | Perubahan CI/CD |

**Cakupan** memakai nama modul/area, mis. `rme`, `farmasi`, `lab`, `lis`, `kasir`, `admisi`, `mcu`, `radiologi`, `modul`, `demo`, `deploy`.

Contoh:

```
feat(mcu): impor Excel peserta korporasi
fix(kuitansi): tampilkan tanggal discharge
fix(lab): B-45 pembuatan order lab dalam satu transaksi
docs: panduan integrasi SATUSEHAT
```

Sebut ID backlog (`B-xx`) bila ada.

---

## 4. Konvensi kode

Ringkasan dari [Konteks Pengembangan bagian 6](./docs/KONTEKS-PENGEMBANGAN.md#6-konvensi); baca dokumen itu untuk rincian.

### Umum
- **Tulis kode yang mirip kode di sekitarnya.** Istilah domain memakai **Bahasa Indonesia** (`pasien`, `kunjungan`, `penjamin`, `tagihan`) agar konsisten dengan pengguna klinis.
- Komentar seperlunya, terutama untuk menjelaskan **mengapa** sebuah aturan ada.
- Jangan menambah dependensi baru tanpa alasan kuat; sebutkan di deskripsi PR.

### Data & database
- ID memakai `uuid` (uuidv7, string) yang dibuat aplikasi.
- Waktu `created_at`/`updated_at`/`deleted_at` disimpan sebagai **epoch detik** (BIGINT).
- **Soft delete**: setiap query menyaring `deleted_at IS NULL` **dan** `faskes_uuid`.
- `faskes_uuid` selalu diambil dari token login, **bukan** dari body request.
- Perubahan skema lewat **migrasi baru** di `database/migrations/` (SQL mentah, idempoten `IF NOT EXISTS`, dalam transaksi). **Jangan mengedit migrasi yang sudah pernah dijalankan.**
- Jangan pernah `TRUNCATE ... CASCADE` tabel `ref_*`.

### API
- Prefiks `/api/v3/<layanan>/...`, respons `{ message, payload }`.
- Database & API memakai `snake_case`; kode Vue memakai `camelCase` (axios mengonversi otomatis).

### Frontend
- Vue 3 + TypeScript + PrimeVue + Pinia + Tailwind; validasi form dengan vee-validate + yup.
- Gating modul/fitur dengan helper di `src/stores/modulFaskes.ts` (lihat [Manajemen Modul](./docs/MANAJEMEN-MODUL.md#langkah-4--rute--menu-frontend)).
- Cetak PDF lewat `bukaPdf` (`src/utils/pdf/bukaPdf.ts`), bukan `pdfMake.createPdf().open()`.

### SDK bersama (`packages/`)
- `@opensimrs/model-sdk`, `@opensimrs/authorization-sdk`, dan `@opensimrs/permission-sdk` ada di `packages/` dan dipakai layanan lewat `file:../packages/<sdk>` (dipasang sebagai salinan karena `install-links=true` di `.npmrc` tiap layanan).
- Setelah mengubah kode SDK, jalankan `npm run sdk:refresh` (atau `npm run sdk:refresh -- <layanan>`) lalu uji layanan yang memakainya. Perubahan SDK berdampak ke banyak layanan: sebutkan di deskripsi PR dan naikkan versi di `package.json` SDK bila kontraknya berubah.
- Pertahankan berkas lisensi dan atribusi penulis asli di setiap paket SDK.

### Modul/fitur baru
Ikuti checklist di [Manajemen Modul bagian 4](./docs/MANAJEMEN-MODUL.md#4-panduan-pengembang-menambah-modul-atau-fitur-baru), termasuk menjalankan `node scripts/dokumen-katalog.mjs` setelah mengubah `database/data/katalog-modul.json`.

---

## 5. Aturan keamanan & data

Repo ini **publik**. Apa pun yang di-commit bisa dibaca siapa saja, selamanya (riwayat git sulit dihapus).

**Jangan pernah meng-commit:**
- Berkas `.env` dan salinannya (`.env.layanan`, `.env.production.local`, dst.).
- Kata sandi, token, API key, *client secret*, kunci privat, sertifikat. Satu-satunya kata sandi yang boleh tertulis adalah kata sandi demo publik `Demo@2026`.
- **Data pasien nyata** dalam bentuk apa pun: nama, NIK, No. RM, nomor BPJS, alamat, foto, hasil pemeriksaan, berkas ekspor (Excel/PDF/SQL dump), log, atau tangkapan layar dari sistem produksi.
- Alamat IP/host server internal faskes atau kantor, dan email/nomor telepon pribadi.
- Dokumen internal faskes atau dokumen kebutuhan produk yang bersifat rahasia.

**Data uji harus fiktif.** Gunakan data demo (`npm run db:demo:seed`, `db:demo:transaksi`) atau buat identitas fiktif. Untuk email contoh, pakai domain yang memang dicadangkan untuk contoh, mis. `@contoh.test` atau `@example.com`; untuk host pakai `simrs.contoh.id`/`localhost`.

**Bila terlanjur meng-commit rahasia:** jangan hanya menghapusnya di commit berikutnya. Segera **ganti (rotasi)** rahasia tersebut, lalu kabari maintainer secara privat.

**Kerentanan keamanan** dilaporkan secara privat sesuai [SECURITY.md](./SECURITY.md), **bukan** lewat issue publik.

---

## 6. Cara menguji

### 6.1 Uji alur dengan akun demo per segmen

Setelah `npm run db:demo:seed`, tersedia 8 faskes fiktif dengan akun per peran (kata sandi `Demo@2026`; pola akun di [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md#akun-demo)).

- Uji dengan **akun peran yang sesuai** (mis. `kp.pendaftaran` untuk pendaftaran, `kp.kasir` untuk kasir), bukan hanya `superadmin`, agar masalah izin ikut terlihat.
- Untuk perubahan yang bergantung segmen, uji minimal di **satu segmen yang mengaktifkan** fitur dan **satu yang mematikannya** (mis. praktik mandiri `pm.*` vs klinik pratama `kp.*`).
- Data transaksi realistis: `npm run db:demo:transaksi` (bawaan faskes praktik mandiri).
- Tambahkan skenario regresi untuk bug yang diperbaiki ke [rencana pengujian](./docs/testing/rencana-testing.md).

### 6.2 Uji unit

```bash
npm --prefix lab-service test          # uji bridging LIS (lis-peta, lis-bulk)
npm --prefix rekamedis-service test    # mis. perhitungan biaya kamar
npm --prefix bpjs-service test
npm --prefix satusehat-service test
```

Layanan lain memakai `jest` atau `mocha` (lihat skrip `test` di `package.json` masing-masing). Beberapa layanan belum punya uji sama sekali; menambahkannya adalah kontribusi yang sangat berguna (backlog B-56).

### 6.3 Uji bridging LIS tanpa server LIS asli

```bash
node scripts/lis-tiruan.mjs     # http://localhost:2312, x-api-key: kunci-uji-lis
```

Isi koneksi di **Setting › Konfigurasi Integrasi › LIS** sesuai [scripts/README-lis-tiruan.md](./scripts/README-lis-tiruan.md). LIS tiruan meniru registrasi per order, registrasi massal MCU, baca hasil, galat, dan latensi, serta bisa diatur lewat `POST /_uji/atur`.

### 6.4 Pemeriksaan frontend

- `npx vue-tsc --noEmit -p tsconfig.app.json` di `frontend-service` **belum andal** karena ±47 galat sintaks lama di `components/icons/*` (backlog B-41).
- Untuk sementara, pastikan berkas yang Anda ubah dapat dimuat: `curl -I http://localhost:5520/src/<path-berkas>` harus 200, lalu uji di browser tanpa galat di konsol.
- Build produksi harus lulus: `npm --prefix frontend-service run build-only`.

### 6.5 Migrasi

```bash
npm run db:migrate
npm run db:migrate     # dijalankan dua kali: kali kedua tidak boleh mengubah apa pun
```

CI menguji hal yang sama pada database kosong.

---

## 7. Changelog

Setiap PR yang mengubah perilaku untuk pengguna atau implementator menambahkan satu baris di [CHANGELOG.md](./CHANGELOG.md) bagian **[Belum dirilis]**, pada kategori yang sesuai:

- **Ditambahkan** – fitur baru · **Diubah** – perubahan perilaku · **Usang** · **Dihapus** · **Diperbaiki** – bug · **Keamanan**

Tulis dari sudut pandang pengguna, mis. *"Kasir: rincian tagihan menampilkan biaya penunjang (B-44)."* Sebut migrasi baru bila ada. Maintainer memindahkan entri ke nomor versi saat rilis.

---

## 8. Etika data kesehatan

OpenSIMRS mengelola **data kesehatan**, yang oleh Undang-Undang Nomor 27 Tahun 2022 tentang **Pelindungan Data Pribadi (UU PDP)** digolongkan sebagai **data pribadi yang bersifat spesifik**, dan **rekam medis** wajib dijaga kerahasiaannya sesuai peraturan perundang-undangan di bidang kesehatan (termasuk ketentuan Menteri Kesehatan tentang rekam medis). Sebagai kontributor:

- **Prinsip minimum**: kumpulkan dan tampilkan data pasien hanya sebanyak yang dibutuhkan alur.
- **Rahasia rekam medis**: fitur baru harus menghormati hak akses per peran; jangan membuat jalan pintas yang membuka data pasien tanpa izin (mis. endpoint tanpa autentikasi, log berisi data pasien).
- **Jejak audit**: perubahan data klinis penting sebaiknya tercatat (siapa, kapan, apa).
- **Tidak ada data nyata di luar faskes**: jangan meminta, menyalin, atau membagikan data pasien nyata untuk debugging. Minta implementator mereproduksi masalah dengan data demo.
- **Keselamatan pasien di atas kecepatan**: perubahan pada alur klinis (resep, hasil lab, nilai kritis, identitas pasien) perlu ditinjau tenaga klinis (label `butuh tenaga medis/klinis`).
- **Implementator** bertanggung jawab atas kepatuhan di faskesnya (persetujuan pasien, pengamanan server, cadangan, akses). OpenSIMRS menyediakan alat; kepatuhan tetap tanggung jawab penyelenggara.

Panduan ini bukan nasihat hukum. Konsultasikan kebijakan faskes dan peraturan yang berlaku.

---

## 9. Melaporkan bug & mengusulkan fitur

Format laporan bug yang lebih rinci (severity, regresi, verifikasi) ada di [panduan Tester/QA](./docs/kontributor/TESTER-QA.md); alur usulan fitur ada di [panduan Product Development](./docs/kontributor/PRODUCT-DEV.md).

**Bug:** buka issue di GitHub berisi
- versi/commit OpenSIMRS, cara instalasi (lokal/Docker), OS, versi Node/Docker;
- segmen faskes dan peran akun;
- langkah reproduksi, hasil yang terjadi, hasil yang diharapkan;
- log galat (hapus kata sandi, token, dan data pasien).

**Usulan fitur:** jelaskan kebutuhan di lapangan (siapa penggunanya, di jenis faskes apa, alur saat ini), bukan hanya solusi teknisnya. Usulan dari tenaga klinis dan IT faskes sangat membantu menentukan prioritas.

Terima kasih telah berkontribusi untuk layanan kesehatan Indonesia yang lebih baik.
