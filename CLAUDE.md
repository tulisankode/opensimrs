# Panduan untuk asisten AI (Claude Code) di repo OpenSIMRS

Berkas ini dibaca otomatis oleh Claude Code. Isinya aturan dan konteks proyek yang berlaku untuk semua contributor. Catatan pribadi atau internal ditulis di `CLAUDE.local.md`, yang diabaikan git dan tidak boleh di-commit.

## Aturan kerja
- **Semua balasan, dokumen, dan pesan commit dalam Bahasa Indonesia yang baik dan benar.** Istilah domain memakai Bahasa Indonesia (`pasien`, `kunjungan`, `penjamin`, `tagihan`).
- Nama produk: **OpenSIMRS**. Lisensi **MIT**. Kontak `dev@opensimrs.id`, website https://opensimrs.my.id, kanal komunitas di [COMMUNITY.md](./COMMUNITY.md).
- **Repo ini publik.** Jangan pernah meng-commit:
  - `.env`, kredensial, atau kunci;
  - IP/host server faskes;
  - data atau screenshot pasien asli.
  
  Data contoh harus jelas fiktif: email `@contoh.id`, HP `080000000000`, NIK berawalan `9999`.
- Jangan deploy, push, atau menghapus branch remote tanpa diminta pemilik atau maintainer.
- Ikuti [CONTRIBUTING.md](./CONTRIBUTING.md) dan [Versi, Branch, dan Aturan Merge](./docs/kontributor/ALUR-GIT-RILIS.md):
  - commit memakai Conventional Commits berbahasa Indonesia;
  - branch kerja `<jenis>/<id>-<ringkasan>`, lalu PR ke `main`;
  - repo tidak memakai branch `develop`.
- Tulis kode yang mirip kode di sekitarnya, termasuk penamaan, kepadatan komentar, dan gaya.

## Arsitektur singkat
- **19 layanan Express** (`*-service/`, port 8081–8100, awalan `/api/v3/...`) dan **frontend** Vue 3 + PrimeVue + Tailwind (`frontend-service/`, port 5520). Tabel port ada di [docs/INSTALLATION_GUIDE.md](./docs/INSTALLATION_GUIDE.md#3-gambaran-sistem--port).
- **PostgreSQL**: satu database bersama `opensimrs` (Sequelize lewat `@opensimrs/model-sdk`; bpjs, satusehat, dan penunjang memakai `pg` langsung).
- **MongoDB**: isi rekam medis elektronik (`rekam_medises`, `sessions`, `catatan_perawats`, `instruksi_medises`).
- **Redis**: token sesi dan cache izin.
- **SDK lokal** di `packages/` (`@opensimrs/model-sdk`, `authorization-sdk`, `permission-sdk`):
  - dipakai lewat `file:../packages/<sdk>` dan `.npmrc` `install-links=true` di tiap layanan;
  - setelah mengubah SDK, jalankan `npm run sdk:refresh` dan naikkan versi SDK-nya.
- Autentikasi memakai JWT **HS256** dengan `SECRET_KEY` yang sama di semua layanan. `faskes_uuid` selalu diambil dari JWT.
- Konvensi data:
  - `snake_case` di DB dan API, `camelCase` di Vue (axios mengonversi otomatis);
  - id `uuidv7`;
  - waktu dalam epoch detik;
  - soft delete (`deleted_at`).
- **SIMRS Studio** (`studio-service`, port 8090): mode pengembang berbasis AI yang menjalankan Claude Code CLI di mesin pengembang. Layanan ini aktif bila `STUDIO_PENGEMBANG=aktif` dan superadmin menyalakan Mode Pengembang di Setting › System. Agen tidak boleh mengubah `studio-service/**`. Lihat [docs/SIMRS-STUDIO.md](./docs/SIMRS-STUDIO.md).
- **Manajemen Modul**: `database/data/katalog-modul.json` dimuat lewat migrasi `sinkronKatalog`. Menu yang tampil = modul aktif faskes ∩ izin user. Setelah mengubah katalog, jalankan `npm run docs:katalog`. Lihat [docs/MANAJEMEN-MODUL.md](./docs/MANAJEMEN-MODUL.md).
- **Migrasi**:
  - nama berkas `database/migrations/YYYYMMDDHHMMSS-*.cjs` (UTC), harus berurutan paling akhir saat merge;
  - wajib idempoten (CI menjalankannya dua kali);
  - **jangan mengubah migrasi yang sudah ada**.
- `schema.sql` hanya berisi struktur dan data referensi nasional (wilayah, ICD-10, ICD-9-CM, SNOMED, LOINC, odontogram), tanpa data faskes atau pasien.

## Perintah penting
```bash
./install.sh            # macOS/Ubuntu/Debian tanpa Docker (Windows: install.cmd)
npm run infra:up        # atau: PostgreSQL/MongoDB/Redis via Docker
npm run install:all
npm run db:migrate
npm run db:demo:seed    # data demo fiktif (development/staging saja)
npm run dev             # semua layanan + frontend; ringan: npm run dev:core
npm --prefix lab-service test
node scripts/dokumen-katalog.mjs --cek
```
Login demo: `superadmin` / `Demo@2026`.

## Jebakan yang sudah diketahui
- `vue-tsc` tidak andal karena ada error lama di ikon. Untuk memverifikasi frontend, pakai `npm --prefix frontend-service run build-only` dan uji di browser.
- Di Windows/Git Bash, argumen yang diawali `/` atau `@/` bisa diubah menjadi path Windows. Untuk penggantian massal, pakai skrip Node.
- Variabel port antar-layanan tidak seragam (`APPLICATION_PORT`/`APP_PORT`/`PORT`/`SERVER_PORT`), jadi isi keempatnya.
- `laporan-service` selalu memakai username dan sandi MongoDB.

## Dokumen rujukan
[README](./README.md) · [Instalasi](./docs/INSTALLATION_GUIDE.md) · [Lingkungan](./docs/LINGKUNGAN.md) · [Roadmap & backlog](./docs/ROADMAP.md) · [Konteks pengembangan](./docs/KONTEKS-PENGEMBANGAN.md) · [Catatan sesi pengembangan](./docs/session-claude.md) · [CHANGELOG](./CHANGELOG.md)
