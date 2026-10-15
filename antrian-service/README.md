# antrian-service — Antrian

Bagian dari monorepo [OpenSIMRS](../README.md) (paket `opensimrs-antrian`).

Jadwal dokter, antrian admisi & poli, layar antrian/kiosk TV, anjungan pasien mandiri (APM), kuota JKN/non-JKN.

| | |
|---|---|
| Port lokal | `8082` |
| Awalan API | `/api/v3/antrian` |

## Menjalankan

Jalankan dari **root repo** setelah mengikuti [Petunjuk Instalasi](../docs/INSTALLATION_GUIDE.md) (infrastruktur, `npm run install:all`, `.env` layanan, migrasi):

```bash
npm run dev:antrian       # layanan ini saja
npm run dev           # semua layanan + frontend
```

- Konfigurasi dibaca dari `antrian-service/.env`; templatnya `antrian-service/.env.example`. Daftar variabel dan port acuan ada di [Petunjuk Instalasi bagian 5](../docs/INSTALLATION_GUIDE.md#5-konfigurasi-env-secara-rinci).
- Memakai SDK `@opensimrs/authorization-sdk`, `@opensimrs/model-sdk` dari `packages/` (dipasang sebagai salinan karena `install-links=true` di `.npmrc`). Setelah mengubah SDK, jalankan `npm run sdk:refresh -- antrian-service` dari root.
- Skema database dikelola migrasi di `database/migrations/` (`npm run db:migrate`), bukan oleh layanan.
- Docker: dibangun dari root repo lewat `docker-compose.yml` (lihat [bagian 8](../docs/INSTALLATION_GUIDE.md#8-menjalankan-dengan-docker)).
- Uji unit: `npm --prefix antrian-service test`.

Konvensi kode, alur PR, dan aturan keamanan: [CONTRIBUTING.md](../CONTRIBUTING.md) · arsitektur & jebakan: [Konteks Pengembangan](../docs/KONTEKS-PENGEMBANGAN.md).
