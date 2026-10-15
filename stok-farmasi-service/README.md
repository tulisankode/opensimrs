# stok-farmasi-service — Stok Farmasi

Bagian dari monorepo [OpenSIMRS](../README.md) (paket `opensimrs-stok-farmasi`).

Stok depo farmasi, kartu stok, mutasi.

| | |
|---|---|
| Port lokal | `8095` |
| Awalan API | `/api/v3/stok` |

## Menjalankan

Jalankan dari **root repo** setelah mengikuti [Petunjuk Instalasi](../docs/INSTALLATION_GUIDE.md) (infrastruktur, `npm run install:all`, `.env` layanan, migrasi):

```bash
npm run dev:stok-farmasi       # layanan ini saja
npm run dev           # semua layanan + frontend
```

- Konfigurasi dibaca dari `stok-farmasi-service/.env`; templatnya `stok-farmasi-service/.env.example`. Daftar variabel dan port acuan ada di [Petunjuk Instalasi bagian 5](../docs/INSTALLATION_GUIDE.md#5-konfigurasi-env-secara-rinci).
- Memakai SDK `@opensimrs/authorization-sdk`, `@opensimrs/model-sdk` dari `packages/` (dipasang sebagai salinan karena `install-links=true` di `.npmrc`). Setelah mengubah SDK, jalankan `npm run sdk:refresh -- stok-farmasi-service` dari root.
- Skema database dikelola migrasi di `database/migrations/` (`npm run db:migrate`), bukan oleh layanan.
- Docker: dibangun dari root repo lewat `docker-compose.yml` (lihat [bagian 8](../docs/INSTALLATION_GUIDE.md#8-menjalankan-dengan-docker)).
- Belum ada uji unit (lihat backlog B-56 di [Roadmap](../docs/ROADMAP.md#61-fase-0--pembukaan-komunitas--kebersihan-repo)).

Konvensi kode, alur PR, dan aturan keamanan: [CONTRIBUTING.md](../CONTRIBUTING.md) · arsitektur & jebakan: [Konteks Pengembangan](../docs/KONTEKS-PENGEMBANGAN.md).
