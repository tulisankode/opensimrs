# rawat-jalan-service — Rawat Jalan

Bagian dari monorepo [OpenSIMRS](../README.md) (paket `opensimrs-rawat-jalan`).

Antrian poli (panggil, mulai periksa), konteks petugas.

| | |
|---|---|
| Port lokal | `8092` |
| Awalan API | `/api/v3/rajal` |

## Menjalankan

Jalankan dari **root repo** setelah mengikuti [Petunjuk Instalasi](../docs/INSTALLATION_GUIDE.md) (infrastruktur, `npm run install:all`, `.env` layanan, migrasi):

```bash
npm run dev:rawat-jalan       # layanan ini saja
npm run dev           # semua layanan + frontend
```

- Konfigurasi dibaca dari `rawat-jalan-service/.env`; templatnya `rawat-jalan-service/.env.example`. Daftar variabel dan port acuan ada di [Petunjuk Instalasi bagian 5](../docs/INSTALLATION_GUIDE.md#5-konfigurasi-env-secara-rinci).
- Memakai SDK `@opensimrs/authorization-sdk`, `@opensimrs/model-sdk` dari `packages/` (dipasang sebagai salinan karena `install-links=true` di `.npmrc`). Setelah mengubah SDK, jalankan `npm run sdk:refresh -- rawat-jalan-service` dari root.
- Skema database dikelola migrasi di `database/migrations/` (`npm run db:migrate`), bukan oleh layanan.
- Docker: dibangun dari root repo lewat `docker-compose.yml` (lihat [bagian 8](../docs/INSTALLATION_GUIDE.md#8-menjalankan-dengan-docker)).
- Uji unit: `npm --prefix rawat-jalan-service test`.

Konvensi kode, alur PR, dan aturan keamanan: [CONTRIBUTING.md](../CONTRIBUTING.md) · arsitektur & jebakan: [Konteks Pengembangan](../docs/KONTEKS-PENGEMBANGAN.md).
