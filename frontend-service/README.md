# frontend-service — Aplikasi Web OpenSIMRS

Bagian dari monorepo [OpenSIMRS](../README.md). Antarmuka web untuk semua modul: Vue 3 + TypeScript + Vite + PrimeVue + Pinia + Tailwind.

| | |
|---|---|
| Port lokal | `5520` |
| Konfigurasi | `frontend-service/.env` (lokal) atau `.env.production.local` (build server) |

## Menjalankan

Dari **root repo** setelah mengikuti [Petunjuk Instalasi](../docs/INSTALLATION_GUIDE.md):

```bash
npm run dev:frontend                            # frontend saja
npm run dev                                     # semua layanan + frontend
npm --prefix frontend-service run build-only    # build produksi (hasil di dist/, tidak di-commit)
```

- Isi `.env` (alamat API per layanan, `VITE_*`) ada di [Petunjuk Instalasi bagian 5.3](../docs/INSTALLATION_GUIDE.md#53-env-frontend). Nilai `VITE_*` dibakar saat build.
- Docker: image `opensimrs/frontend`, kontainer `opensimrs-frontend`, dibangun dari folder ini.

## Konvensi UI

- Komponen PrimeVue; warna memakai token Tailwind `opensimrs` (mis. `bg-opensimrs-300`, variabel CSS `--opensimrs-*`) karena tema dapat diatur per faskes.
- Logo OpenSIMRS: `src/assets/images/opensimrs*.png` dan favicon di `public/`. Gambar carousel login (`src/assets/images/Login/`) masih tangkapan layar lama dan akan diganti (backlog B-57 di [Roadmap](../docs/ROADMAP.md)).
- Gating modul/fitur lewat `src/stores/modulFaskes.ts` ([Manajemen Modul](../docs/MANAJEMEN-MODUL.md)); cetak PDF lewat `src/utils/pdf/bukaPdf.ts`.
- `vue-tsc` belum andal karena galat lama di `src/components/icons/*` (B-41); lihat [CONTRIBUTING bagian 6.4](../CONTRIBUTING.md#64-pemeriksaan-frontend).

IDE yang disarankan: VS Code + ekstensi Vue (Volar).
