### Diperbaiki
- **Installer & uninstaller mode Podman di macOS: koneksi VM.**
  - Logika VM dipindah ke `scripts/lib/podman.sh` dan dipakai bersama `install.sh` dan `uninstall.sh`.
  - Skrip kini menyalakan VM yang mati dan menjadikan VM yang benar sebagai koneksi default. Bila VM menyala tetapi koneksinya menyimpan port lama ("connection refused"), skrip menawarkan mulai ulang VM.
  - `uninstall.sh` tidak lagi menjalankan `podman machine start` tanpa nama mesin, yang mencari `podman-machine-default`.
  - Galat asli Podman ditampilkan beserta saran pemeriksaannya.
  - `install.sh` mengecek provider `podman compose` (docker-compose/podman-compose) tanpa menghubungi VM, sehingga koneksi yang rusak tidak lagi terbaca "docker-compose belum terpasang".
  - Pemasangan dependensi hanya diulang sekali; bila masih terbaca kurang, skrip berhenti alih-alih berulang tanpa henti.
