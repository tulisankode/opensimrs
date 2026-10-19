# Pustaka Podman untuk install.sh & uninstall.sh (macOS: kontainer berjalan di VM "podman machine").
# Pemanggil menyediakan fungsi tanya (dan ok/warn dari tampilan.sh).
#
# Kasus yang ditangani: VM mati; VM menyala tetapi koneksi default menunjuk mesin lain/yang sudah dihapus
# (mis. podman-machine-default); VM menyala tetapi koneksinya menyimpan port SSH lama ("connection refused").

podman_siap() { podman info >/dev/null 2>&1; }

# Nama VM: yang bawaan, lalu yang sedang berjalan, lalu yang pertama.
podman_mesin() {
  local m
  m="$(podman machine list --format '{{.Name}} {{.Default}}' 2>/dev/null | awk '$2=="true"{print $1}' | tr -d '*' | head -1)"
  [ -n "$m" ] || m="$(podman machine list --format '{{.Name}}|{{.LastUp}}' 2>/dev/null | awk -F'|' '$2 ~ /[Rr]unning/{print $1}' | tr -d '*' | head -1)"
  [ -n "$m" ] || m="$(podman machine list --format '{{.Name}}' 2>/dev/null | tr -d '*' | head -1)"
  printf '%s' "$m"
}

podman_berjalan() { podman machine inspect --format '{{.State}}' "$1" 2>/dev/null | grep -qi running; }

# podman_sambungkan MESIN → 0 bila Podman bisa dihubungi. Menyalakan VM bila mati, menjadikannya koneksi default,
# dan bila VM menyala tetapi tetap tidak terhubung, menawarkan mulai ulang VM (start menulis ulang port koneksi).
podman_sambungkan() {
  local m="$1"
  podman_siap && return 0
  [ -n "$m" ] || return 1
  podman_berjalan "$m" || podman machine start "$m" >/dev/null 2>&1 || true
  podman_siap && return 0
  podman system connection default "$m" >/dev/null 2>&1 || true
  podman_siap && return 0
  if podman_berjalan "$m" && tanya "VM '$m' menyala tetapi tidak bisa dihubungi (koneksi menyimpan port lama?). Mulai ulang VM '$m'"; then
    podman machine stop "$m" >/dev/null 2>&1 || true
    podman machine start "$m" >/dev/null 2>&1 || true
  fi
  podman_siap
}

# Pesan galat asli Podman + saran pemeriksaan (tanpa rahasia).
podman_saran() {
  podman info 2>&1 | grep -i 'error' | head -2 | sed 's/^/      /' || true
  echo "    Periksa: podman machine ls  &&  podman system connection list"
  echo "    VM menyala tetapi tidak terhubung: podman system connection default <nama-mesin>, atau"
  echo "    podman machine stop <nama-mesin> && podman machine start <nama-mesin>"
}

# Provider "podman compose" terpasang? (tanpa menghubungi VM — podman compose version butuh koneksi)
podman_compose_ada() {
  command -v docker-compose >/dev/null 2>&1 || command -v podman-compose >/dev/null 2>&1 \
    || [ -x "$HOME/.docker/cli-plugins/docker-compose" ] || [ -x /usr/local/lib/docker/cli-plugins/docker-compose ] \
    || [ -x /usr/libexec/docker/cli-plugins/docker-compose ]
}
