### Diperbaiki
- `install.sh --domain … --api …` di Ubuntu/Debian **tanpa Podman/Docker** kini benar-benar menjalankan gateway API di port 8080.
  - Sebelumnya gateway dilewati dan hanya diberi peringatan, sehingga domain API lewat Cloudflare Tunnel menjawab **502 Bad Gateway**.
  - Installer kini menawarkan nginx dari apt dan memasang konfigurasi `/etc/nginx/conf.d/opensimrs-gateway.conf` (listen 8080, upstream `127.0.0.1`). Konfigurasi itu diperiksa dengan `nginx -t`, nginx dimuat ulang, lalu `/health` dicek.
  - `uninstall.sh` ikut menghapus konfigurasi tersebut, tanpa mencopot nginx.
