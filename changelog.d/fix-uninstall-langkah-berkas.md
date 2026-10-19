### Diperbaiki
- **`uninstall.sh` berhenti di butir pertama langkah "Berkas buatan instalasi" saat dijalankan di terminal.** `ui_butir` (`scripts/lib/tampilan.sh`) mengakhiri fungsi dengan `[ … ] && printf`, yang bernilai salah untuk setiap butir kecuali butir terakhir. Di bawah `set -e`, skrip berhenti sebelum berkas dihapus.
- `uninstall.sh` mode Podman kini menjalankan `compose down -v --remove-orphans`, sehingga sisa kontainer proyek dari compose lain (mis. `opensimrs-gateway` dari `deploy/server`) ikut terhapus.
