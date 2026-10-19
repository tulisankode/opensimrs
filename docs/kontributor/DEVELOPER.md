# Panduan Developer

Untuk pengembang backend/frontend dan mahasiswa informatika. Panduan lengkapnya ada di [CONTRIBUTING.md](../../CONTRIBUTING.md); halaman ini merangkum hal yang wajib diketahui dan menautkan ke rinciannya agar tidak dobel.

Dokumen terkait: [Konteks Pengembangan](../KONTEKS-PENGEMBANGAN.md) · [Manajemen Modul](../MANAJEMEN-MODUL.md) · [Roadmap](../ROADMAP.md) · [Peran kontributor](./README.md)

---

## 1. Setup

```bash
git clone https://github.com/<akun-anda>/opensimrs.git && cd opensimrs
cp .env.example .env          # isi kredensial & SECRET_KEY
npm run infra:up              # PostgreSQL, MongoDB, Redis (Docker) — atau instal native
npm run install:all
#   buat .env tiap layanan & frontend-service/.env
npm run db:migrate
npm run db:demo:seed
npm run dev                   # atau dev:core / dev:<layanan>
```

Atau cukup `./install.sh` (macOS/Ubuntu/Debian) / `install.cmd` (Windows) yang menyiapkan dependensi, database, `.env`, migrasi, dan data demo sekaligus.

Rincian, termasuk jalur tanpa Docker: [Petunjuk Instalasi](../INSTALLATION_GUIDE.md#4-jalur-a--coba-cepat-dengan-data-demo-lokal). Arsitektur dan jebakan yang sudah diketahui: [Konteks Pengembangan](../KONTEKS-PENGEMBANGAN.md).

---

## 2. Alur kerja

- **Fork → branch → PR** ke `main` dengan nama branch `<jenis>/<id-backlog>-<ringkasan>`: [CONTRIBUTING bagian 2](../../CONTRIBUTING.md#2-alur-kontribusi-fork--branch--pr).
- Versioning, branch `release/*`/hotfix, syarat persetujuan, cara merge, dan proses rilis: [Versi, Branch, dan Aturan Merge](./ALUR-GIT-RILIS.md).
- Klaim pekerjaan dulu di issue: [cara mengklaim](../ROADMAP.md#5-cara-memilih--mengklaim-pekerjaan).
- Perubahan besar (struktur data, kontrak API, alur klinis) lewat **RFC** ([GOVERNANCE.md](../../GOVERNANCE.md#rfc-request-for-comments)).

## 3. Konvensi kode & commit

- Commit Bahasa Indonesia, Conventional Commits (`feat(farmasi): ...`), sebut ID backlog: [CONTRIBUTING bagian 3](../../CONTRIBUTING.md#3-konvensi-commit).
- Data: uuidv7, epoch detik, soft delete, `faskes_uuid` dari token; API `/api/v3/<layanan>`, respons `{ message, payload }`: [CONTRIBUTING bagian 4](../../CONTRIBUTING.md#4-konvensi-kode).
- UI memakai PrimeVue dan token warna Tailwind `opensimrs` (`bg-opensimrs-300`, variabel CSS `--opensimrs-*`).

## 4. Review

- PR harus lulus CI (`.github/workflows/ci.yml`): cek sintaks semua layanan & `packages/`; uji unit lab, studio, laporan, setting, penunjang, dan program-puskesmas; `schema.sql` + migrasi dua kali; cek dokumen katalog; `node scripts/cek-integritas.mjs` (rute katalog, menu, migrasi, fragmen CHANGELOG); build frontend.
- Minimal satu maintainer menyetujui. Perubahan alur klinis juga ditinjau tenaga klinis (label `butuh tenaga medis/klinis`).
- Tanggapi review dengan commit baru; jangan *force-push* setelah review dimulai kecuali diminta.

## 5. Larangan commit rahasia dan data

Jangan pernah meng-commit `.env` (dan salinannya), kata sandi, token, API key, data pasien nyata, alamat IP server faskes, atau email/nomor pribadi. Rincian dan langkah bila terlanjur: [CONTRIBUTING bagian 5](../../CONTRIBUTING.md#5-aturan-keamanan--data).

## 6. Migrasi database

- Perubahan skema **hanya** lewat migrasi baru di `database/migrations/` (SQL mentah, idempoten `IF NOT EXISTS`, dalam transaksi). Jangan mengedit migrasi yang sudah dijalankan.
- `schema.sql` hanya struktur + data referensi nasional; jangan menambahkan data faskes/pasien/pengguna ke dalamnya.
- Uji dengan `npm run db:migrate` dua kali (kali kedua tidak boleh mengubah apa pun).
- Katalog modul: ubah `database/data/katalog-modul.json`, buat migrasi `sinkronKatalog`, lalu `npm run docs:katalog` ([Manajemen Modul bagian 4](../MANAJEMEN-MODUL.md#4-panduan-pengembang-menambah-modul-atau-fitur-baru)).

## 7. SDK di `packages/`

- `@opensimrs/model-sdk`, `@opensimrs/authorization-sdk`, `@opensimrs/permission-sdk` dipakai layanan lewat `file:../packages/<sdk>` dan dipasang sebagai salinan (`install-links=true`).
- Setelah mengubah SDK: `npm run sdk:refresh` (atau `npm run sdk:refresh -- <layanan>`), lalu uji layanan yang memakainya.
- Pertahankan lisensi dan atribusi penulis asli di setiap paket. Rincian: [CONTRIBUTING bagian 4](../../CONTRIBUTING.md#4-konvensi-kode) dan [Konteks Pengembangan](../KONTEKS-PENGEMBANGAN.md#4-menjalankan-secara-lokal).
