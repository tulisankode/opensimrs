# igd-service — IGD

Bagian dari monorepo [OpenSIMRS](../README.md) (paket `opensimrs-igd`).

Pelayanan Instalasi Gawat Darurat dan SPRI.

| | |
|---|---|
| Port lokal | `8085` |
| Awalan API | `/api/v3/pelayanan` |

## Menjalankan

Jalankan dari **root repo** setelah mengikuti [Petunjuk Instalasi](../docs/INSTALLATION_GUIDE.md) (infrastruktur, `npm run install:all`, `.env` layanan, migrasi):

```bash
npm run dev:igd       # layanan ini saja
npm run dev           # semua layanan + frontend
```

- Konfigurasi dibaca dari `igd-service/.env`; templatnya `igd-service/.env.example`. Daftar variabel dan port acuan ada di [Petunjuk Instalasi bagian 5](../docs/INSTALLATION_GUIDE.md#5-konfigurasi-env-secara-rinci).
- Memakai SDK `@opensimrs/authorization-sdk`, `@opensimrs/model-sdk` dari `packages/` (dipasang sebagai salinan karena `install-links=true` di `.npmrc`). Setelah mengubah SDK, jalankan `npm run sdk:refresh -- igd-service` dari root.
- Skema database dikelola migrasi di `database/migrations/` (`npm run db:migrate`), bukan oleh layanan.
- Docker: dibangun dari root repo lewat `docker-compose.yml` (lihat [bagian 8](../docs/INSTALLATION_GUIDE.md#8-menjalankan-dengan-docker)).
- Uji unit: `npm --prefix igd-service test`.

Konvensi kode, alur PR, dan aturan keamanan: [CONTRIBUTING.md](../CONTRIBUTING.md) · arsitektur & jebakan: [Konteks Pengembangan](../docs/KONTEKS-PENGEMBANGAN.md).
