#!/usr/bin/env bash
# =====================================================================================
#  OpenSIMRS — instalasi lokal TANPA Docker (macOS dengan Homebrew, Ubuntu/Debian dengan apt)
#
#  Yang dilakukan (aman dijalankan berulang):
#    1. Cek dependensi & versi: git, openssl, Node.js ≥ 20 (disarankan 22), PostgreSQL ≥ 15,
#       Redis ≥ 6, MongoDB ≥ 6 + mongosh. Yang kurang ditawarkan untuk dipasang.
#    2. Menyalakan PostgreSQL, Redis, MongoDB.
#    3. Membuat role & database PostgreSQL "opensimrs" + memuat schema.sql (sekali saja).
#    4. Membuat akun MongoDB "opensimrs".
#    5. Membuat .env root, .env tiap layanan, dan frontend-service/.env (TIDAK menimpa yang sudah ada).
#    6. npm run install:all → npm run db:migrate → data demo (opsional).
#    7. Alat AI: Claude Code CLI, Codex CLI, OpenCode CLI (npm global), Ollama (LLM lokal, TANPA mengunduh model),
#       dan OpenClaw (Helpdesk, installer resmi). Semuanya ditanyakan satu per satu.
#
#  Pemakaian:
#    ./install.sh                 instalasi lengkap (interaktif)
#    ./install.sh --cek           hanya cek dependensi, tidak mengubah apa pun
#    ./install.sh --ya            jawab "ya" untuk semua pertanyaan
#    ./install.sh --tanpa-demo    lewati data demo (db:demo:seed)
#    ./install.sh --jalankan      langsung "npm run dev" setelah selesai
#    ./install.sh --podman        PostgreSQL, MongoDB, Redis dijalankan di kontainer Podman (podman compose);
#                                 layanan & frontend tetap native. Tidak perlu PostgreSQL/MongoDB/Redis dari Homebrew/apt.
#    ./install.sh --tanpa-ai      lewati pemasangan alat AI (Claude Code, Codex, OpenCode, Ollama, OpenClaw)
#    ./install.sh --helpdesk      (tetap diterima, kini bawaan) OpenClaw ikut ditawarkan di langkah alat AI; produksi di
#                                 VM terpisah (deploy/helpdesk/README.md)
#    ./install.sh --domain simrs.contoh.id --api api-simrs.contoh.id
#                                 akses dari luar lewat domain (Cloudflare Tunnel / reverse proxy HTTPS):
#                                 frontend-service/.env.local mengarahkan API ke https://<api> dan mengizinkan host <domain>,
#                                 lalu gateway nginx (kontainer Podman/Docker, atau nginx dari apt) di port 8080 untuk semua API.
#                                 Arahkan tunnel: <domain> → http://localhost:5520, <api> → http://localhost:8080.
#
#  Hanya untuk development lokal. Untuk server/production lihat docs/INSTALLATION_GUIDE.md & docs/LINGKUNGAN.md.
# =====================================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

HANYA_CEK=0; SEMUA_YA=0; TANPA_DEMO=0; JALANKAN=0; PODMAN=0; TANPA_AI=0; HELPDESK=0; DOMAIN=""; DOMAIN_API=""
ARGUMEN=("$@")   # disimpan untuk "exec bash $0" setelah memasang dependensi (shift menghabiskan "$@")
while [ $# -gt 0 ]; do
  case "$1" in
    --cek) HANYA_CEK=1 ;;
    --ya|-y) SEMUA_YA=1 ;;
    --tanpa-demo) TANPA_DEMO=1 ;;
    --jalankan) JALANKAN=1 ;;
    --podman) PODMAN=1 ;;
    --tanpa-ai) TANPA_AI=1 ;;
    --helpdesk) HELPDESK=1 ;;
    --domain=*) DOMAIN="${1#*=}" ;;
    --api=*) DOMAIN_API="${1#*=}" ;;
    --domain|--api)
      [ $# -ge 2 ] || { echo "Opsi $1 butuh nilai (lihat ./install.sh --help)"; exit 1; }
      if [ "$1" = --domain ]; then DOMAIN="$2"; else DOMAIN_API="$2"; fi; shift ;;
    -h|--help) awk 'NR == 1 { next } /^# =====/ { if (++n == 2) exit; next } { print }' "$0"; exit 0 ;;
    *) echo "Opsi tidak dikenal: $1 (lihat ./install.sh --help)"; exit 1 ;;
  esac
  shift
done
# Domain tanpa skema/path (https:// dan / di akhir dibuang); keduanya wajib bersama.
DOMAIN="${DOMAIN#http*://}"; DOMAIN="${DOMAIN%%/*}"; DOMAIN_API="${DOMAIN_API#http*://}"; DOMAIN_API="${DOMAIN_API%%/*}"
if [ -n "$DOMAIN$DOMAIN_API" ]; then
  { [ -n "$DOMAIN" ] && [ -n "$DOMAIN_API" ]; } || { echo "--domain dan --api harus dipakai bersama (mis. --domain simrs.contoh.id --api api-simrs.contoh.id)"; exit 1; }
  for d in "$DOMAIN" "$DOMAIN_API"; do
    [[ "$d" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || { echo "Nama domain tidak sah: $d"; exit 1; }
  done
fi

DB_NAMA="opensimrs"; DB_USER="opensimrs"; MONGO_USER="opensimrs"
LAYANAN="admisi:8081 antrian:8082 auth:8083 farmasi:8084 igd:8085 inventory:8086 lab:8087 laporan:8088 payment:8089 rawat-inap:8091 rawat-jalan:8092 rekamedis:8093 setting:8094 stok-farmasi:8095 datamaster:8096 satusehat:8097 bpjs:8098 penunjang:8099 studio:8090 program-puskesmas:8100"

# ---------- tampilan: bilah kemajuan, spinner, log (scripts/lib/tampilan.sh) ----------
# shellcheck source=scripts/lib/tampilan.sh
. "$ROOT/scripts/lib/tampilan.sh"
mati()  { printf '\n%sGAGAL:%s %s\n' "$M" "$N" "$1" >&2; [ "$UI_LOG" != /dev/null ] && printf '  Log lengkap: %s\n' "$UI_LOG" >&2; exit 1; }
# Langkah: cek, layanan DB, PostgreSQL, MongoDB, .env, npm, migrasi, demo, alat AI (Podman: layanan DB+PG+Mongo = 1 langkah)
# (+ gateway API bila --domain)
JUMLAH_LANGKAH=$(( PODMAN == 1 ? 7 : 9 )); [ -n "$DOMAIN" ] && JUMLAH_LANGKAH=$((JUMLAH_LANGKAH + 1))
ui_mulai "$JUMLAH_LANGKAH" "${TMPDIR:-/tmp}/opensimrs-install-$(date +%Y%m%d-%H%M%S).log"
# shellcheck source=scripts/lib/podman.sh
. "$ROOT/scripts/lib/podman.sh"
tanya() { # tanya "pertanyaan" → 0 bila ya
  [ "$SEMUA_YA" = 1 ] && return 0
  local j; printf '  %s? %s [y/N] ' "$K" "$1$N"; read -r j </dev/tty || j=""
  case "$j" in y|Y|ya|Ya|YA) return 0 ;; *) return 1 ;; esac
}
ada() { command -v "$1" >/dev/null 2>&1; }
# tanpa angka → keluaran kosong, status 0 (grep tanpa hasil + pipefail + set -e dulu menghentikan skrip tanpa pesan)
mayor() { { echo "$1" | grep -Eo '[0-9]+' || true; } | head -1; }

# ---------- deteksi OS ----------
OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM=mac ;;
  Linux)  if ada apt-get; then PLATFORM=apt; else PLATFORM=linux; fi ;;
  *) mati "OS $OS belum didukung skrip ini. Ikuti docs/INSTALLATION_GUIDE.md bagian 9." ;;
esac

# Homebrew: postgresql@16 & node@22 bersifat keg-only → tambahkan ke PATH sesi ini
if [ "$PLATFORM" = mac ] && ada brew; then
  for f in postgresql@16 node@22; do
    p="$(brew --prefix "$f" 2>/dev/null || true)"
    [ -n "$p" ] && [ -d "$p/bin" ] && PATH="$p/bin:$PATH"
  done
  export PATH
fi

# ---------- 1. cek dependensi ----------
ui_langkah "Cek dependensi ($PLATFORM)"
KURANG=""

cek() { # cek <nama> <perintah> <versi-minimal> <perintah-versi...>
  local nama="$1" cmd="$2" min="$3"; shift 3
  if ! ada "$cmd"; then gagal "$nama belum terpasang"; KURANG="$KURANG $nama"; return; fi
  local v; v="$("$@" 2>/dev/null | head -1 || true)"
  # terpasang tetapi tidak bisa dijalankan (mis. mongod di CPU tanpa AVX: "Illegal instruction", pustaka kurang)
  if [ -n "$min" ] && [ -z "$v" ]; then
    local e kode=0; e="$("$cmd" --version 2>&1 | tail -2 | tr '\n' ' ')" || kode=$?
    "$cmd" --version >/dev/null 2>&1 || kode=$?
    gagal "$nama terpasang ($(command -v "$cmd")) tetapi tidak bisa dijalankan (kode $kode)${e:+: $e}"
    if [ "$kode" = 132 ] || { [ "$cmd" = mongod ] && [ "$(uname -m)" = x86_64 ] && [ -r /proc/cpuinfo ] && ! grep -qw avx /proc/cpuinfo; }; then
      warn "CPU tidak mendukung AVX; MongoDB ≥ 5 butuh AVX. Ganti tipe CPU VPS (mis. 'host' di Proxmox/KVM) atau pilih paket VPS lain."
    fi
    KURANG="$KURANG $nama"; return
  fi
  local m; m="$(mayor "$v")"
  if [ -n "$min" ] && [ -n "$m" ] && [ "$m" -lt "$min" ]; then
    gagal "$nama versi $m terlalu lama (minimal $min): $v"; KURANG="$KURANG $nama"
  else
    ok "$nama: $v"
  fi
}
cek git      git      ""  git --version
cek openssl  openssl  ""  openssl version
cek node     node     20  sh -c "node -v | tr -d v"
cek npm      npm      ""  npm -v
if [ "$PODMAN" = 1 ]; then
  # basis data di kontainer: cukup Podman + provider compose (docker-compose v2 atau podman-compose)
  cek podman podman   4   sh -c "podman --version | grep -Eo '[0-9]+(\.[0-9]+)+'"
  # Provider dicek tanpa menghubungi VM: "podman compose version" butuh koneksi Podman, sehingga VM yang mati/koneksi
  # rusak dulu terbaca sebagai "docker-compose belum terpasang" dan instalasi berulang tanpa henti.
  if ada podman && ! podman_compose_ada; then gagal "podman compose belum punya provider (docker-compose)"; KURANG="$KURANG docker-compose"
  elif ada podman; then ok "provider podman compose: $( (docker-compose version --short || podman-compose --version) 2>/dev/null | head -1)"; fi
else
  cek postgresql psql   15  sh -c "psql --version | grep -Eo '[0-9]+(\.[0-9]+)+'"
  cek redis    redis-server 6 sh -c "redis-server --version | grep -Eo 'v=[0-9.]+' | tr -d v="
  cek mongodb  mongod   6   sh -c "mongod --version | grep -Eo 'v[0-9]+(\.[0-9]+)+' | head -1 | tr -d v"
  cek mongosh  mongosh  ""  mongosh --version
fi
if ada node && [ "$(mayor "$(node -v)")" -lt 22 ] 2>/dev/null; then warn "Node.js 22 LTS disarankan (terpasang $(node -v))"; fi

# MongoDB tidak ada di repositori apt bawaan Ubuntu/Debian → pasang dari repositori resmi (repo.mongodb.org).
# 8.0 didukung resmi di Ubuntu 20.04/22.04/24.04 dan Debian 12; rilis yang lebih baru (mis. Ubuntu 25.x, Debian 13)
# memakai repositori rilis terdekat yang didukung.
pasang_mongo_apt() {
  local ver=8.0 id="" kode="" ubuntu_kode="" mirip="" repo
  # shellcheck disable=SC1091
  [ -r /etc/os-release ] && { id="$(. /etc/os-release; echo "${ID:-}")"; kode="$(. /etc/os-release; echo "${VERSION_CODENAME:-}")"
    ubuntu_kode="$(. /etc/os-release; echo "${UBUNTU_CODENAME:-}")"; mirip="$(. /etc/os-release; echo "${ID_LIKE:-}")"; }
  # turunan Ubuntu (Linux Mint, Pop!_OS, dst.) memakai kode rilis Ubuntu induknya
  if [ "$id" != ubuntu ] && [ "$id" != debian ] && [ -n "$ubuntu_kode" ]; then id=ubuntu; kode="$ubuntu_kode"; fi
  if [ "$id" != ubuntu ] && [ "$id" != debian ]; then case " $mirip " in *" debian "*) id=debian ;; esac; fi
  case "$id" in
    ubuntu)
      case "$kode" in focal|jammy|noble) ;; *) warn "Ubuntu '$kode' belum didukung resmi MongoDB $ver; memakai repositori noble (24.04)"; kode=noble ;; esac
      repo="https://repo.mongodb.org/apt/ubuntu $kode/mongodb-org/$ver multiverse" ;;
    debian)
      case "$kode" in bookworm) ;; *) warn "Debian '$kode' belum didukung resmi MongoDB $ver; memakai repositori bookworm (12)"; kode=bookworm ;; esac
      repo="https://repo.mongodb.org/apt/debian $kode/mongodb-org/$ver main" ;;
    *) mati "Distro '$id' tidak dikenali. Pasang MongoDB ≥ 6 + mongosh secara manual (https://www.mongodb.com/docs/manual/administration/install-on-linux/) lalu jalankan ulang." ;;
  esac
  case "$(uname -m)" in x86_64|amd64|aarch64|arm64) ;; *) mati "MongoDB $ver hanya tersedia untuk x86_64/arm64 (mesin ini: $(uname -m))." ;; esac
  # MongoDB ≥ 5 butuh CPU x86_64 dengan AVX; tanpa AVX mongod berhenti dengan "Illegal instruction"
  if [ "$(uname -m)" = x86_64 ] && [ -r /proc/cpuinfo ] && ! grep -qw avx /proc/cpuinfo; then
    mati "CPU VPS ini tidak mendukung AVX, padahal MongoDB ≥ 5 membutuhkannya. Pilih paket/tipe CPU VPS yang mendukung AVX (mis. tipe CPU 'host' di Proxmox/KVM), lalu jalankan ulang."
  fi
  sudo apt-get update -qq && sudo apt-get install -y gnupg curl ca-certificates
  curl -fsSL "https://www.mongodb.org/static/pgp/server-$ver.asc" | sudo gpg --dearmor --yes -o "/usr/share/keyrings/mongodb-server-$ver.gpg" \
    || mati "Gagal mengunduh kunci GPG MongoDB (cek koneksi internet VPS)."
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-$ver.gpg ] $repo" \
    | sudo tee "/etc/apt/sources.list.d/mongodb-org-$ver.list" >/dev/null
  sudo apt-get update -qq && sudo apt-get install -y mongodb-org || mati "Gagal memasang mongodb-org dari $repo"
  sudo systemctl enable --now mongod 2>/dev/null || sudo service mongod start 2>/dev/null || true
  ok "MongoDB $ver + mongosh terpasang"
}

if [ -n "$KURANG" ]; then
  echo
  warn "Kurang/terlalu lama:$KURANG"
  [ "$HANYA_CEK" = 1 ] && exit 1
  # Sudah dipasang di putaran sebelumnya tetapi masih terbaca kurang → berhenti, jangan mengulang tanpa henti.
  [ "${OPENSIMRS_ULANG_DEP:-0}" = 1 ] && mati "Dependensi masih terbaca kurang setelah dipasang:$KURANG. Buka terminal baru (PATH), cek perintahnya secara manual, lalu jalankan ulang."
  case "$PLATFORM" in
    mac)
      ada brew || mati "Homebrew belum terpasang. Pasang dulu dari https://brew.sh lalu jalankan ulang."
      PAKET=""
      for d in $KURANG; do
        case "$d" in
          git) PAKET="$PAKET git" ;; openssl) PAKET="$PAKET openssl@3" ;;
          node|npm) PAKET="$PAKET node@22" ;; postgresql) PAKET="$PAKET postgresql@16" ;;
          redis) PAKET="$PAKET redis" ;; mongodb) PAKET="$PAKET mongodb/brew/mongodb-community@7.0" ;;
          mongosh) PAKET="$PAKET mongosh" ;;
          podman) PAKET="$PAKET podman" ;; docker-compose) PAKET="$PAKET docker-compose" ;;
        esac
      done
      PAKET="$(echo "$PAKET" | tr ' ' '\n' | sort -u | tr '\n' ' ')"
      tanya "Pasang dengan Homebrew:$PAKET?" || mati "Pasang dependensi di atas lalu jalankan ulang."
      case "$PAKET" in *mongodb-community*) brew tap mongodb/brew ;; esac
      # shellcheck disable=SC2086
      brew install $PAKET
      for f in postgresql@16 node@22; do p="$(brew --prefix "$f" 2>/dev/null || true)"; [ -d "$p/bin" ] && PATH="$p/bin:$PATH"; done
      export PATH
      if [ "$PODMAN" = 1 ]; then
        warn "Agar node@22 tersedia di terminal baru, tambahkan ke ~/.zshrc:"
        echo "      export PATH=\"\$(brew --prefix node@22)/bin:\$PATH\""
      else
        warn "Agar psql/node@22 tersedia di terminal baru, tambahkan ke ~/.zshrc:"
        echo "      export PATH=\"\$(brew --prefix postgresql@16)/bin:\$(brew --prefix node@22)/bin:\$PATH\""
      fi
      ;;
    apt)
      PAKET=""; PERLU_MONGO=0; PERLU_NODE=0
      for d in $KURANG; do
        case "$d" in
          git) PAKET="$PAKET git" ;; openssl) PAKET="$PAKET openssl" ;;
          postgresql) PAKET="$PAKET postgresql postgresql-client" ;; redis) PAKET="$PAKET redis-server" ;;
          node|npm) PERLU_NODE=1 ;; mongodb|mongosh) PERLU_MONGO=1 ;;
          podman) PAKET="$PAKET podman" ;; docker-compose) PAKET="$PAKET podman-compose" ;;
        esac
      done
      if [ -n "$PAKET" ]; then
        tanya "Pasang dengan apt:$PAKET?" || mati "Pasang dependensi di atas lalu jalankan ulang."
        # shellcheck disable=SC2086
        sudo apt-get update -qq && sudo apt-get install -y $PAKET
      fi
      if [ "$PERLU_NODE" = 1 ]; then
        tanya "Pasang Node.js 22 dari NodeSource?" || mati "Pasang Node.js 22 lalu jalankan ulang."
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
      fi
      if [ "$PERLU_MONGO" = 1 ]; then
        tanya "Pasang MongoDB 8.0 + mongosh dari repositori resmi MongoDB?" || mati "Pasang MongoDB ≥ 6 + mongosh (https://www.mongodb.com/docs/manual/administration/install-on-linux/) lalu jalankan ulang."
        pasang_mongo_apt
      fi
      ;;
    *) mati "Pasang dependensi di atas secara manual (docs/INSTALLATION_GUIDE.md bagian 9) lalu jalankan ulang." ;;
  esac
  # ${A[@]+…}: larik kosong + set -u galat di bash 3.2 (bawaan macOS)
  OPENSIMRS_ULANG_DEP=1 exec bash "$0" ${ARGUMEN[@]+"${ARGUMEN[@]}"}   # ulangi dari awal (sekali) agar versi dicek ulang
fi
ok "Semua dependensi tersedia"

# Alat AI (tidak menghalangi instalasi; dipasang di langkah 7).
versi_alat() { ada "$1" && "$1" --version 2>/dev/null | grep -Eo '[0-9]+(\.[0-9]+)+' | head -1; }
for a in "claude|Claude Code CLI (agen SIMRS Studio)" "codex|Codex CLI (agen SIMRS Studio, opsional)" "opencode|OpenCode CLI (agen lokal SIMRS Studio, opsional)" "ollama|Ollama (LLM lokal, opsional)" "openclaw|OpenClaw (Helpdesk; produksi di VM terpisah)"; do
  b="${a%%|*}"; nama="${a#*|}"
  if v="$(versi_alat "$b")" && [ -n "$v" ]; then ok "$nama: $v"; else warn "$nama belum terpasang"; fi
done
[ "$HANYA_CEK" = 1 ] && exit 0

# ---------- nilai rahasia: pakai ulang dari .env bila ada ----------
ambil() { [ -f .env ] && grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }
# .env root yang belum lengkap (mis. salinan .env.example) atau mengarah ke database lain (mis. database kerja
# di kontainer Docker) dicadangkan lalu dibuat ulang: migrasi membaca .env root
if [ -f .env ]; then
  ALASAN=""
  if [ -z "$(ambil DB_PASSWORD)" ] || [ -z "$(ambil MONGO_DB_PASSWORD)" ] || [ -z "$(ambil SECRET_KEY)" ]; then
    ALASAN="belum lengkap"
  elif [ "$(ambil DB_NAME)" != "$DB_NAMA" ] || [ "$(ambil DB_USERNAME)" != "$DB_USER" ] || [ "$(ambil DB_PORT)" != "5432" ]; then
    ALASAN="mengarah ke database lain ($(ambil DB_USERNAME)@$(ambil DB_HOST):$(ambil DB_PORT)/$(ambil DB_NAME))"
  fi
  if [ -n "$ALASAN" ]; then
    CADANGAN=".env.bak.$(date +%Y%m%d%H%M%S)"
    mv .env "$CADANGAN"
    warn ".env root $ALASAN → dicadangkan ke $CADANGAN dan dibuat ulang"
  fi
fi
acak()  { openssl rand -hex "${1:-32}"; }
DB_PASS="$(ambil DB_PASSWORD)";        [ -n "$DB_PASS" ]    || DB_PASS="$(acak 16)"
MONGO_PASS="$(ambil MONGO_DB_PASSWORD)"; [ -n "$MONGO_PASS" ] || MONGO_PASS="$(acak 16)"
SECRET="$(ambil SECRET_KEY)";          [ -n "$SECRET" ]     || SECRET="$(acak 32)"
K1="$(ambil API_KEY_SECRET)";     [ -n "$K1" ] || K1="$(acak 32)"
K2="$(ambil API_KEY_CHECK_NORM)"; [ -n "$K2" ] || K2="$(acak 32)"
K3="$(ambil ADMISI_SECRET_KEY)";  [ -n "$K3" ] || K3="$(acak 32)"
K4="$(ambil ANTRIAN_KEY_SECRET)"; [ -n "$K4" ] || K4="$(acak 32)"

# ---------- .env root (dibutuhkan juga oleh podman compose: env_file .env) ----------
TMP_ENV="$(mktemp)"; trap 'rm -f "$TMP_ENV"' EXIT
cat > "$TMP_ENV" <<EOF
DB_DIALECT=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=$DB_NAMA
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASS
DB_POOL={"acquire": 30000, "max": 10, "min": 0, "idle": 10000}
MONGO_INITDB_DATABASE=$DB_NAMA
MONGO_DB_HOST=127.0.0.1
MONGO_DB_PORT=27017
MONGO_DB_NAME=$DB_NAMA
MONGO_DB_AUTH_SOURCE=admin
MONGO_DB_USERNAME=$MONGO_USER
MONGO_DB_PASSWORD=$MONGO_PASS
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DATABASE=0
REDIS_USERNAME=
REDIS_PASSWORD=
SECRET_KEY=$SECRET
API_BASE=api
API_VERSION=v3
APPLICATION_HOST=0.0.0.0
APP_HOST=0.0.0.0
SYNC_DB=false
NODE_ENV=development
APPLICATION_TIMEZONE=Asia/Jakarta
API_KEY_SECRET=$K1
API_KEY_CHECK_NORM=$K2
ADMISI_SECRET_KEY=$K3
ANTRIAN_KEY_SECRET=$K4
API_KEY_ANTRIAN=$K4
DATAMASTER_SERVICE_URL=http://localhost:8096
ADMISI_API_URL=http://localhost:8081/api/v3/admisi
INVENTORY_URL=http://localhost:8086/api/v3
REKAM_MEDIS_URL=http://localhost:8093/api/v3
FARMASI_API_URL=http://localhost:8084/api/v3/farmasi
PATIENT_SERVICE_URL=http://localhost:8081
SETTING_SERVICE_URL=http://localhost:8094
BASE_URL_API_ADMISI=http://localhost:8081/api/v3/admisi
BASE_URL_API_ANTRIAN=http://localhost:8082/api/v3/antrian
BASE_URL_API_FARMASI=http://localhost:8084/api/v3/farmasi
BASE_URL_API_PEMBAYARAN=http://localhost:8089/api/v3/payment/internal
BASE_URL_API_LAB=http://localhost:8087/api/v3/lab
VITE_BASE_ANTRIAN=http://localhost:8082/api/v3/antrian
SATUSEHAT_MODE=mock
SATUSEHAT_LINGKUNGAN=sandbox
BPJS_MODE=mock
BPJS_LINGKUNGAN=development
LIS_MODE=nyata
EOF

tulis_env() { # tulis_env <berkas> [port] [modul]
  local f="$1"
  if [ -f "$f" ]; then warn "$f sudah ada (tidak ditimpa)"; return; fi
  { cat "$TMP_ENV"
    if [ -n "${2:-}" ]; then echo "APPLICATION_PORT=$2"; echo "APP_PORT=$2"; echo "PORT=$2"; echo "SERVER_PORT=$2"; echo "APPLICATION_MODULE=$3"; fi
  } > "$f"
  chmod 600 "$f"
  ok "$f dibuat"
}
tulis_env .env

# ---------- 2–4. PostgreSQL, Redis, MongoDB ----------
tunggu() { # tunggu "label" <percobaan> perintah...   (jeda 2 detik)
  local label="$1" n="$2"; shift 2; local i
  for i in $(seq 1 "$n"); do "$@" >/dev/null 2>&1 && { ok "$label siap"; return 0; }; sleep 2; done
  mati "$label belum merespons. Periksa log layanannya lalu jalankan ulang."
}
# psql ke database aplikasi (Podman: lewat kontainer, tanpa psql di host)
psqlq() {
  if [ "$PODMAN" = 1 ]; then podman exec -e PGPASSWORD="$DB_PASS" opensimrs-db psql -X -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAMA" "$@"
  else PGPASSWORD="$DB_PASS" psql -X -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAMA" "$@"; fi
}

if [ "$PODMAN" = 1 ]; then
  ui_langkah "PostgreSQL, Redis, MongoDB di Podman"
  # macOS: kontainer berjalan di VM (podman machine)
  if [ "$PLATFORM" = mac ] && ! podman_siap; then
    MESIN="$(podman_mesin)"
    if [ -z "$MESIN" ]; then
      tanya "Buat VM Podman 'opensimrs' (2 CPU, 4 GB RAM, disk 40 GB)?" || mati "Buat VM dulu: podman machine init --cpus 2 --memory 4096 --disk-size 40 opensimrs"
      podman machine init --cpus 2 --memory 4096 --disk-size 40 opensimrs
      MESIN=opensimrs
    fi
    podman_sambungkan "$MESIN" || { podman_saran; mati "Podman belum tersambung ke VM '$MESIN'"; }
    ok "VM Podman '$MESIN' berjalan"
  fi
  # Nama image pendek (postgres:16-alpine, mongo, redis) → Docker Hub, agar tidak gagal "short-name resolution"
  REG='mkdir -p ~/.config/containers && { test -f ~/.config/containers/registries.conf || printf "unqualified-search-registries = [\"docker.io\"]\nshort-name-mode = \"permissive\"\n" > ~/.config/containers/registries.conf; }'
  if [ "$PLATFORM" = mac ]; then
    MESIN="$(podman machine list --format '{{.Name}} {{.Default}}' 2>/dev/null | awk '$2=="true"{print $1}' | tr -d '*' | head -1)"
    [ -n "$MESIN" ] && podman machine ssh "$MESIN" "$REG" >/dev/null 2>&1 || true
  else
    bash -c "$REG"
  fi
  # Port host dipakai layanan lain (mis. PostgreSQL/MongoDB/Redis Homebrew) → kontainer gagal start
  for p in 5432 27017 6379; do
    if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null && ! podman ps --format '{{.Ports}}' | grep -q ":$p->"; then
      mati "Port $p sudah dipakai layanan lain. Hentikan dulu, mis. macOS: brew services stop postgresql@16 mongodb-community@7.0 redis"
    fi
  done
  # .env root dibaca compose untuk nama/sandi DB & Mongo; schema.sql & akun root Mongo dibuat kontainer saat volume baru
  podman compose -f docker-compose.yml up -d db mongodb redis || mati "podman compose gagal menyalakan PostgreSQL/MongoDB/Redis (lihat pesan di atas)"
  echo "  … menunggu PostgreSQL (start pertama memuat schema.sql, 1–3 menit)"
  tunggu "PostgreSQL" 150 podman exec opensimrs-db pg_isready -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAMA"
  tunggu "Redis"      30  podman exec opensimrs-redis redis-cli ping
  tunggu "MongoDB"    60  podman exec opensimrs-mongodb mongosh --quiet --eval "db.runCommand({ping:1}).ok"
  # Volume lama dari instalasi sebelumnya memakai sandi lama → migrasi/login gagal: hentikan dengan petunjuk
  psqlq -tAc "SELECT 1" >/dev/null 2>&1 || mati "Sandi PostgreSQL di .env tidak cocok dengan volume Podman lama. Pakai .env lama, atau hapus volume (DATA HILANG): podman compose -f docker-compose.yml down -v"
  podman exec opensimrs-mongodb mongosh --quiet -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin --eval "db.runCommand({ping:1}).ok" >/dev/null 2>&1 \
    || mati "Sandi MongoDB di .env tidak cocok dengan volume Podman lama. Pakai .env lama, atau hapus volume (DATA HILANG): podman compose -f docker-compose.yml down -v"
  ok "Akun PostgreSQL $DB_USER & MongoDB $MONGO_USER (root) siap"
  [ "$(psqlq -tAc "SELECT to_regclass('public.kelurahan') IS NOT NULL" 2>/dev/null)" = t ] \
    && ok "schema.sql termuat" || mati "schema.sql belum termuat. Lihat log: podman logs opensimrs-db"
else
# ---------- 2. nyalakan layanan ----------
ui_langkah "Menyalakan PostgreSQL, Redis, MongoDB"
case "$PLATFORM" in
  mac)
    for s in postgresql@16 redis mongodb-community@7.0; do
      if brew list "$s" >/dev/null 2>&1; then brew services start "$s" >/dev/null 2>&1 || true; fi
    done ;;
  apt|linux)
    for s in postgresql redis-server mongod; do sudo systemctl start "$s" 2>/dev/null || sudo service "$s" start 2>/dev/null || true; done ;;
esac

tunggu "PostgreSQL" 30 pg_isready -h 127.0.0.1 -p 5432
tunggu "Redis"      30 redis-cli -h 127.0.0.1 ping
tunggu "MongoDB"    30 mongosh --quiet --host 127.0.0.1 --eval "db.runCommand({ping:1}).ok"

# ---------- 3. PostgreSQL ----------
ui_langkah "PostgreSQL: role, database, skema"
if [ "$PLATFORM" = mac ]; then pgadmin() { psql -X -q -d postgres "$@"; }; else pgadmin() { sudo -u postgres psql -X -q -d postgres "$@"; }; fi

if [ "$(pgadmin -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" = 1 ]; then
  # role sudah ada: samakan sandinya dengan .env (lingkungan lokal)
  pgadmin -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"
  ok "Role $DB_USER sudah ada (sandi disamakan dengan .env)"
else
  pgadmin -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
  ok "Role $DB_USER dibuat"
fi
if [ "$(pgadmin -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAMA'")" = 1 ]; then
  ok "Database $DB_NAMA sudah ada"
else
  pgadmin -c "CREATE DATABASE $DB_NAMA OWNER $DB_USER;"
  ok "Database $DB_NAMA dibuat"
fi
export PGPASSWORD="$DB_PASS"
if [ "$(psql -X -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAMA" -tAc "SELECT to_regclass('public.kelurahan') IS NOT NULL")" = t ]; then
  ok "schema.sql sudah dimuat sebelumnya (dilewati)"
else
  ui_jalankan "Memuat schema.sql (struktur + referensi nasional, 1–3 menit)" \
    psql -X -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAMA" -v ON_ERROR_STOP=1 -q -f schema.sql || mati "schema.sql gagal dimuat"
fi
unset PGPASSWORD

# ---------- 4. MongoDB ----------
ui_langkah "MongoDB: akun aplikasi"
HASIL="$(mongosh --quiet --host 127.0.0.1 --eval "
  const a = db.getSiblingDB('admin');
  if (a.getUser('$MONGO_USER')) { a.updateUser('$MONGO_USER', { pwd: '$MONGO_PASS' }); print('diperbarui'); }
  else { a.createUser({ user: '$MONGO_USER', pwd: '$MONGO_PASS', roles: [{ role: 'readWrite', db: '$DB_NAMA' }] }); print('dibuat'); }
" 2>&1 || true)"
case "$HASIL" in
  *dibuat*|*diperbarui*) ok "Akun MongoDB $MONGO_USER $(echo "$HASIL" | tail -1)" ;;
  *) gagal "Tidak bisa membuat akun MongoDB: $HASIL"
     mati "MongoDB Anda tampaknya sudah memakai autentikasi. Buat akun '$MONGO_USER' (readWrite pada '$DB_NAMA', authSource admin) secara manual, isi MONGO_DB_PASSWORD di .env, lalu jalankan ulang." ;;
esac
fi

# ---------- 5. berkas .env ----------
ui_langkah "Berkas .env"
for p in $LAYANAN; do n="${p%%:*}"; port="${p##*:}"; [ -d "$n-service" ] && tulis_env "$n-service/.env" "$port" "$n"; done

# .env layanan lama yang tidak cocok dengan root → login/koneksi DB akan gagal
for p in $LAYANAN; do
  f="${p%%:*}-service/.env"; [ -f "$f" ] || continue
  for v in DB_NAME DB_USERNAME DB_PORT DB_PASSWORD SECRET_KEY MONGO_DB_PASSWORD; do
    if [ "$(grep -E "^$v=" "$f" | head -1 | cut -d= -f2-)" != "$(ambil "$v")" ]; then
      warn "$f: $v berbeda dengan .env root. Samakan, atau hapus berkas itu lalu jalankan ulang skrip."
      break
    fi
  done
done

if [ -f frontend-service/.env ]; then
  warn "frontend-service/.env sudah ada (tidak ditimpa)"
else
  cat > frontend-service/.env <<'EOF'
VITE_BASE_URL=http://localhost:8083
VITE_BASE_AUTH=http://localhost:8083/api/v3/auth
VITE_URL_SETTING=http://localhost:8094/api/v3/setting
VITE_BASE_DATAMASTER=http://localhost:8096/api/v3/datamaster
VITE_BASE_PEMBAYARAN=http://localhost:8089/api/v3/payment
VITE_BASE_LABORATORIUM=http://localhost:8087/api/v3/lab
VITE_BASE_ADMISI=http://localhost:8081/api/v3/admisi
VITE_BASE_IGD=http://localhost:8085/api/v3/pelayanan/igd
VITE_BASE_FARMASI=http://localhost:8084/api/v3/farmasi
VITE_BASE_RAWAT_JALAN=http://localhost:8092/api/v3/rawat-jalan
VITE_BASE_REKAM_MEDIS=http://localhost:8093/api/v3
VITE_BASE_RAWAT_INAP=http://localhost:8091/api/v3/ranap
VITE_BASE_INVENTORY=http://localhost:8086/api/v3/inventory
VITE_BASE_DASHBOARD=http://localhost:8088/api/v3/laporan
VITE_BASE_ANTRIAN=http://localhost:8082/api/v3/antrian
VITE_BASE_STOK=http://localhost:8095/api/v3
VITE_BASE_SATUSEHAT=http://localhost:8097/api/v3/satusehat
VITE_BASE_BPJS=http://localhost:8098/api/v3/bpjs
VITE_BASE_PENUNJANG=http://localhost:8099/api/v3/penunjang
VITE_BASE_STUDIO=http://localhost:8090/api/v3/studio
VITE_BASE_PROGRAM_PUSKESMAS=http://localhost:8100/api/v3/program-puskesmas
EOF
  ok "frontend-service/.env dibuat"
fi

# Akses lewat domain (--domain/--api): .env.local menimpa .env saat Vite berjalan. Semua URL API http://localhost:<port>
# menjadi https://<api>/… (gateway), VITE_KEEP_API_HOST mencegah frontend menempelkan port layanan ke domain.
PENANDA_ENV_LOKAL="# Dibuat install.sh --domain"
if [ -n "$DOMAIN" ]; then
  f=frontend-service/.env.local
  if [ -f "$f" ] && ! head -1 "$f" | grep -q "^$PENANDA_ENV_LOKAL"; then
    cp "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"; warn "$f lama dicadangkan ke $f.bak.*"
  fi
  {
    echo "$PENANDA_ENV_LOKAL $DOMAIN --api $DOMAIN_API. Hapus berkas ini untuk kembali ke http://localhost:<port>."
    echo "ALLOWED_HOSTS=$DOMAIN,$DOMAIN_API"
    echo "VITE_KEEP_API_HOST=true"
    { grep -E '^VITE_[A-Z_]+=https?://(localhost|127\.0\.0\.1):[0-9]+' frontend-service/.env || true; } \
      | sed -E "s#https?://(localhost|127\.0\.0\.1):[0-9]+#https://$DOMAIN_API#"
  } > "$f"
  ok "$f: API lewat https://$DOMAIN_API, host $DOMAIN diizinkan"
fi

# ---------- 6. dependensi npm, migrasi, data demo ----------
ui_langkah "Dependensi npm (10–20 menit pada instalasi pertama)"
# npm audit menghubungi registry untuk tiap layanan dan bisa menggantung di jaringan lambat; jalankan terpisah bila perlu
export npm_config_audit=false npm_config_fund=false
# Folder sama & urutan sama dengan "npm run install:all", satu per satu agar kemajuannya terlihat.
# (tanpa mapfile: bash 3.2 bawaan macOS)
FOLDER_NPM=()
while IFS= read -r d; do FOLDER_NPM+=("$d"); done < <(node -e "const s=require('./package.json').scripts['install:all'];console.log('.');for(const m of s.matchAll(/--prefix (\S+) install/g))console.log(m[1])")
for i in "${!FOLDER_NPM[@]}"; do
  d="${FOLDER_NPM[$i]}"; ke=$((i + 1)); p=$((ke * 100 / ${#FOLDER_NPM[@]}))
  ui_jalankan "$(_bilah $p 12) $ke/${#FOLDER_NPM[@]} npm install $([ "$d" = . ] && echo root || echo "$d")" npm --prefix "$d" install \
    || mati "npm install di $d gagal"
done
ok "Dependensi terpasang (${#FOLDER_NPM[@]} folder)"

ui_langkah "Migrasi database"
ui_jalankan "npm run db:migrate" npm run db:migrate || mati "Migrasi gagal"

ui_langkah "Data demo"
if [ "$TANPA_DEMO" = 1 ]; then
  warn "Data demo dilewati (--tanpa-demo)"
else
  ADA_FASKES="$(psqlq -tAc "SELECT count(*) FROM faskes" 2>/dev/null || echo 0)"
  if [ "${ADA_FASKES:-0}" != 0 ]; then
    ok "Database sudah berisi $ADA_FASKES faskes (data demo dilewati; reset: npm run db:demo:reset -- --ya)"
  elif tanya "Isi data demo (8 faskes fiktif + akun demo)?"; then
    ui_jalankan "Data demo: faskes & akun fiktif" npm run db:demo:seed || mati "Data demo gagal"
    ui_jalankan "Data demo: master penunjang" npm run db:demo:master-penunjang || mati "Data demo penunjang gagal"
  fi
fi

# ---------- gateway API untuk akses domain (--domain/--api) ----------
# Layanan berjalan native; nginx di kontainer meneruskan /api/v3/<layanan>/ ke port layanan di mesin ini
# (konfigurasi dari deploy/server/gateway.nginx.conf lewat scripts/gateway-lokal.mjs).
if [ -n "$DOMAIN" ]; then
  ui_langkah "Gateway API (port 8080) untuk $DOMAIN_API"
  KONF_GW="$HOME/.opensimrs/gateway-lokal.conf"; CLI_GW=""; HOST_GW=127.0.0.1
  if ada podman && { podman_siap || { [ "$PLATFORM" = mac ] && podman_sambungkan "$(podman_mesin)"; }; }; then CLI_GW=podman; HOST_GW=host.containers.internal
  elif ada docker && docker info >/dev/null 2>&1; then CLI_GW=docker; HOST_GW=host.docker.internal; fi
  ui_jalankan "Konfigurasi gateway → $KONF_GW (upstream $HOST_GW)" node scripts/gateway-lokal.mjs --host "$HOST_GW" --keluar "$KONF_GW" \
    || mati "Konfigurasi gateway gagal dibuat"
  # Tanpa Podman/Docker di Linux: nginx dari apt, konfigurasi gateway di /etc/nginx/conf.d (listen 8080, upstream 127.0.0.1)
  KONF_NGINX=/etc/nginx/conf.d/opensimrs-gateway.conf
  if [ -z "$CLI_GW" ] && [ "$PLATFORM" = apt ]; then
    if ! ada nginx && tanya "Podman/Docker tidak ada. Pasang nginx dari apt untuk gateway API (port 8080)?"; then
      sudo apt-get update -qq && sudo apt-get install -y nginx || warn "nginx gagal dipasang"
    fi
    if ! ada nginx && [ ! -x /usr/sbin/nginx ]; then
      warn "nginx tidak tersedia: gateway tidak dijalankan. Pasang nginx/Podman/Docker lalu jalankan ulang installer dengan --domain."
    elif [ ! -f "$KONF_NGINX" ] && (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; then
      warn "Port 8080 sudah dipakai program lain: gateway tidak dijalankan (hentikan program itu lalu jalankan ulang)"
    else
      sed 's/^\(\s*\)listen 80;/\1listen 8080;/' "$KONF_GW" | sudo tee "$KONF_NGINX" >/dev/null
      if sudo nginx -t >>"$UI_LOG" 2>&1; then
        sudo systemctl enable nginx >/dev/null 2>&1 || true
        sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || sudo service nginx restart 2>/dev/null || true
        GW_OK=0; for _ in 1 2 3 4 5; do curl -fsS -m 3 http://127.0.0.1:8080/health >/dev/null 2>&1 && { GW_OK=1; break; }; sleep 1; done
        if [ "$GW_OK" = 1 ]; then ok "Gateway nginx ($KONF_NGINX) menjawab di http://localhost:8080/health"
        else warn "Gateway nginx belum menjawab di port 8080 (cek: sudo systemctl status nginx)"; fi
      else
        sudo rm -f "$KONF_NGINX"
        warn "Konfigurasi nginx tidak lolos 'nginx -t' (lihat log); gateway tidak dijalankan"
      fi
    fi
  elif [ -z "$CLI_GW" ]; then
    warn "Podman/Docker tidak tersedia: gateway tidak dijalankan. Pakai $KONF_GW di nginx mesin ini (ubah listen ke 8080)."
  elif ! "$CLI_GW" container inspect opensimrs-gateway >/dev/null 2>&1 && (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; then
    warn "Port 8080 sudah dipakai program lain: gateway tidak dijalankan (hentikan program itu lalu jalankan ulang)"
  else
    GW_EXTRA=(); if [ "$CLI_GW" = docker ] && [ "$PLATFORM" != mac ]; then GW_EXTRA=(--add-host host.docker.internal:host-gateway); fi
    "$CLI_GW" rm -f opensimrs-gateway >/dev/null 2>&1 || true
    ui_jalankan "$CLI_GW run opensimrs-gateway (nginx, port 8080)" "$CLI_GW" run -d --name opensimrs-gateway --restart=always -p 8080:80 \
      ${GW_EXTRA[@]+"${GW_EXTRA[@]}"} -v "$KONF_GW:/etc/nginx/conf.d/default.conf:ro" docker.io/library/nginx:1.27-alpine \
      || mati "Gateway gagal dijalankan"
    GW_OK=0; for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fsS -m 3 http://127.0.0.1:8080/health >/dev/null 2>&1 && { GW_OK=1; break; }; sleep 1; done
    if [ "$GW_OK" = 1 ]; then ok "Gateway menjawab di http://localhost:8080/health"; else warn "Gateway belum menjawab di port 8080 (cek: $CLI_GW logs opensimrs-gateway)"; fi
  fi
fi

# ---------- 7. alat AI: agen SIMRS Studio (Claude Code, Codex, OpenCode + Ollama) & Helpdesk (OpenClaw) ----------
npm_global() { # npm install -g; pakai sudo bila prefix global tidak bisa ditulis (mis. Node dari apt/NodeSource)
  local p; p="$(npm prefix -g)"
  if [ -w "$p/lib" ] || { [ ! -d "$p/lib" ] && [ -w "$p" ]; }; then ui_jalankan "npm install -g $*" npm install -g --no-audit --no-fund "$@"
  else sudo npm install -g --no-audit --no-fund "$@"; fi   # sudo bisa meminta sandi: tanpa spinner
}
ui_langkah "Alat AI (SIMRS Studio & Helpdesk)"
if [ "$TANPA_AI" = 1 ]; then
  warn "Alat AI dilewati (--tanpa-ai)"
else
  for a in "claude|@anthropic-ai/claude-code|Claude Code CLI" "codex|@openai/codex|Codex CLI" "opencode|@opencode/cli|OpenCode CLI (agen dengan model lokal Ollama)"; do
    IFS='|' read -r b paket nama <<<"$a"
    if ada "$b"; then
      ok "$nama sudah terpasang ($("$b" --version 2>/dev/null | head -1))"
    elif tanya "Pasang $nama ($paket) untuk agen SIMRS Studio?"; then
      if npm_global "$paket"; then ok "$nama terpasang"; else warn "$nama gagal dipasang; pasang manual: npm install -g $paket"; fi
    fi
  done
  echo "    Login akun: SIMRS Studio › Pengaturan & Agen › Hubungkan akun Claude / Hubungkan akun ChatGPT"

  # Ollama: hanya aplikasinya. Model lokal TIDAK diunduh (berukuran GB) — pilih sendiri sesuai RAM/VRAM.
  if ada ollama; then
    ok "Ollama sudah terpasang ($(ollama --version 2>/dev/null | grep -Eo '[0-9]+(\.[0-9]+)+' | head -1))"
  elif tanya "Pasang Ollama (LLM lokal untuk agen OpenCode; model tidak ikut diunduh)?"; then
    if [ "$PLATFORM" = mac ] && ada brew; then
      ui_jalankan "brew install ollama" brew install ollama && brew services start ollama >/dev/null 2>&1 || true
    else
      curl -fsSL https://ollama.com/install.sh | sh || warn "Pemasangan Ollama gagal; lihat https://ollama.com/download"
    fi
    ada ollama && ok "Ollama terpasang"
  fi
  if ada ollama; then
    echo "    Model lokal belum diunduh. Contoh: ollama pull qwen3:8b (RAM ≥ 16 GB) atau ollama pull gpt-oss:20b (VRAM/RAM ≥ 24 GB),"
    echo "    lalu daftarkan di SIMRS Studio › Pengaturan & Agen › Konektor (Ollama, http://localhost:11434)."
  fi

  # OpenClaw (Helpdesk): installer resmi menyiapkan Node 24.16+ sendiri.
  if ada openclaw; then
    ok "OpenClaw sudah terpasang ($(openclaw --version 2>/dev/null | head -1))"
  else
    warn "OpenClaw (Helpdesk) untuk produksi dipasang di VM terpisah dari server SIMRS (deploy/helpdesk/README.md). Di mesin ini untuk uji coba."
    if tanya "Pasang OpenClaw dengan installer resmi (openclaw.ai/install.sh; menyiapkan Node 24.16+ sendiri)?"; then
      curl -fsSL https://openclaw.ai/install.sh | bash || warn "Pemasangan OpenClaw gagal; lihat https://docs.openclaw.ai/install"
    fi
  fi
  ada openclaw && echo "    Lanjutkan Helpdesk: deploy/helpdesk/README.md langkah 3–5 (agen terbatas, sinkron panduan, sambungkan setting-service)"
fi

# ---------- selesai ----------
ui_selesai "Instalasi OpenSIMRS selesai — log: $UI_LOG"
cat <<EOF
  Jalankan aplikasi:
    npm run dev          # semua layanan + frontend
    npm run dev:core     # ringan: auth, datamaster, admisi, frontend

  Buka http://localhost:5520 — login demo: superadmin / Demo@2026
  Kata sandi DB, Mongo, dan kunci aplikasi tersimpan di .env (jangan di-commit / dibagikan).
EOF
if [ -n "$DOMAIN" ]; then cat <<EOF

  Akses lewat domain — arahkan Cloudflare Tunnel / reverse proxy HTTPS:
    https://$DOMAIN      → http://localhost:5520   (frontend)
    https://$DOMAIN_API  → http://localhost:8080   (gateway API)
  Cek: https://$DOMAIN_API/health harus {"status":"ok"}. Gateway mati setelah restart: ${CLI_GW:-podman} start opensimrs-gateway
EOF
fi
if [ "$PODMAN" = 1 ]; then cat <<EOF

  PostgreSQL, MongoDB, Redis berjalan di Podman:
    podman compose -f docker-compose.yml up -d db mongodb redis     # nyalakan (mis. setelah restart)
    podman compose -f docker-compose.yml stop db mongodb redis      # hentikan
EOF
  [ "$PLATFORM" = mac ] && echo "    podman machine start                                            # macOS: VM Podman harus menyala dulu"
fi

if [ "$JALANKAN" = 1 ]; then exec npm run dev; fi
