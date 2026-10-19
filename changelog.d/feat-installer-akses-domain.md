### Ditambahkan
- **Installer: akses instalasi lokal lewat domain** (`./install.sh --domain <domain> --api <domain-api>`, Windows `-Domain`/`-Api`). Untuk Cloudflare Tunnel atau reverse proxy HTTPS.
  - Menulis `frontend-service/.env.local`: host diizinkan, `VITE_KEEP_API_HOST=true`, dan semua URL API ke `https://<domain-api>`.
  - Menjalankan gateway nginx `opensimrs-gateway` (Podman/Docker) di port 8080, dengan konfigurasi dari `scripts/gateway-lokal.mjs` (turunan `deploy/server/gateway.nginx.conf` untuk layanan yang berjalan native).
  - `uninstall.sh`/`uninstall.ps1` ikut menghapus gateway, konfigurasinya, dan `.env.local` buatan installer.

### Diubah
- `frontend-service/vite.config.ts` membaca `ALLOWED_HOSTS` juga dari berkas `.env*` frontend, tidak hanya dari environment proses. Domain tambahan tidak perlu lagi ditulis langsung di `vite.config.ts`.
