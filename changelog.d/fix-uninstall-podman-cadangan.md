### Diperbaiki
- **`uninstall.sh` mode Podman dan pencadangan.**
  - Podman yang tidak bisa dihubungi (VM `podman machine` mati di macOS, atau koneksi default menunjuk mesin lain) kini dicek sebelum apa pun dihapus. Skrip menawarkan `podman machine start`, menyarankan `podman system connection default <mesin>`, atau berhenti; tidak lagi diam-diam jatuh ke mode native.
  - Sandi PostgreSQL/MongoDB tidak lagi tercetak di layar maupun di berkas log.
  - Cadangan yang gagal atau kosong tidak lagi dilaporkan berhasil, dan penghapusan dihentikan kecuali pengguna menyetujui secara eksplisit. `--ya` saja tidak cukup; pakai `--tanpa-cadangan`.
  - Bila `podman compose down` gagal, skrip berhenti sebelum `.env` dihapus.
  - Langkah "Berkas buatan instalasi" tidak lagi berhenti diam-diam bila `studio-service/data` tidak ada (`set -e` + `pipefail`).
