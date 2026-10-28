#!/usr/bin/env bash
# =====================================================================================
#  OpenSIMRS — hapus instalasi lokal (pasangan install.sh; macOS/Ubuntu/Debian)
#
#  Yang dihapus — HANYA milik OpenSIMRS:
#    1. Proses OpenSIMRS yang masih berjalan (port 5520, 8081–8100) — dengan konfirmasi.
#    2. (Opsional, ditawarkan) cadangan: pg_dump + mongodump ke ~/opensimrs-cadangan-<waktu>/.
#    3. PostgreSQL: database & role aplikasi (bawaan "opensimrs", dibaca dari .env).
#    4. MongoDB: database & akun aplikasi "opensimrs".
#    5. Redis: kunci sesi OpenSIMRS (token-*) di database Redis aplikasi — BUKAN FLUSHDB.
#       Mode Podman: kontainer opensimrs-db/-mongodb/-redis beserta volumenya (podman compose down -v).
#    6. Berkas buatan instalasi di folder repo: node_modules, .env*, dist, data Studio, log; worktree SIMRS Studio.
#    7. (--hapus-folder) folder repo ini seluruhnya.
#
#  TIDAK dihapus: PostgreSQL/MongoDB/Redis/Node.js itu sendiri, database/akun lain, Claude Code, Codex & OpenCode CLI
#  (kecuali --alat-ai), OpenClaw, Ollama (beserta model lokalnya).
#
#  Pemakaian:
#    ./uninstall.sh                 interaktif (menampilkan rencana, meminta ketik "HAPUS OPENSIMRS")
#    ./uninstall.sh --simulasi      tampilkan apa yang akan dihapus, tanpa menghapus apa pun
#    ./uninstall.sh --ya            tanpa pertanyaan (cadangan tetap dibuat kecuali --tanpa-cadangan)
#    ./uninstall.sh --tanpa-cadangan  lewati pg_dump/mongodump
#    ./uninstall.sh --hapus-folder  hapus juga folder repo ini (setelah semua langkah lain)
#    ./uninstall.sh --alat-ai       hapus juga Claude Code, Codex & OpenCode CLI global (npm uninstall -g)
#    ./uninstall.sh --podman        paksa mode Podman (bawaan: dideteksi dari kontainer opensimrs-db)
# =====================================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SIMULASI=0; SEMUA_YA=0; TANPA_CADANGAN=0; HAPUS_FOLDER=0; ALAT_AI=0; PODMAN=""
for arg in "$@"; do
  case "$arg" in
    --simulasi|--cek) SIMULASI=1 ;;
    --ya|-y) SEMUA_YA=1 ;;
    --tanpa-cadangan) TANPA_CADANGAN=1 ;;
    --hapus-folder) HAPUS_FOLDER=1 ;;
    --alat-ai) ALAT_AI=1 ;;
    --podman) PODMAN=1 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "Opsi tidak dikenal: $arg (lihat ./uninstall.sh --help)"; exit 1 ;;
  esac
done

# shellcheck source=scripts/lib/tampilan.sh
. "$ROOT/scripts/lib/tampilan.sh"
mati() { printf '\n%sGAGAL:%s %s\n' "$M" "$N" "$1" >&2; exit 1; }
# shellcheck source=scripts/lib/podman.sh
. "$ROOT/scripts/lib/podman.sh"
tanya() {
  [ "$SEMUA_YA" = 1 ] && return 0
  local j; printf '  %s? %s [y/N] ' "$K" "$1$N"; read -r j </dev/tty || j=""
  case "$j" in y|Y|ya|Ya|YA) return 0 ;; *) return 1 ;; esac
}
ada() { command -v "$1" >/dev/null 2>&1; }
# aksi "label" perintah... — dijalankan (dengan spinner) atau hanya ditampilkan pada --simulasi
aksi() {
  local label=$1; shift
  if [ "$SIMULASI" = 1 ]; then printf '  %s(simulasi)%s %s\n' "$R" "$N" "$label"; return 0; fi
  ui_jalankan "$label" "$@"
}
# aksi_langsung: sama, tanpa spinner — untuk perintah yang bisa meminta sandi (sudo)
aksi_langsung() {
  local label=$1; shift
  if [ "$SIMULASI" = 1 ]; then printf '  %s(simulasi)%s %s\n' "$R" "$N" "$label"; return 0; fi
  echo "  … $label"; if "$@"; then ok "$label"; else return 1; fi
}

# ---------- konfigurasi dari .env (bawaan sama dengan install.sh) ----------
baca_env() { # baca_env BERKAS KUNCI BAWAAN
  local v=""
  [ -f "$1" ] && v="$(grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//')"
  printf '%s' "${v:-$3}"
}
DB_NAMA="$(baca_env .env DB_NAME opensimrs)"
DB_USER="$(baca_env .env DB_USERNAME opensimrs)"
DB_PORT="$(baca_env .env DB_PORT 5432)"
MONGO_USER="$(baca_env .env MONGO_DB_USERNAME opensimrs)"
MONGO_DB="$(baca_env .env MONGO_DB_NAME "$DB_NAMA")"
REDIS_DB="$(baca_env .env REDIS_DATABASE 0)"
REDIS_PORT="$(baca_env .env REDIS_PORT 6379)"
# Nama berbahaya ditolak: uninstall hanya untuk database aplikasi, bukan database sistem.
case "$DB_NAMA" in ''|postgres|template0|template1) mati "DB_NAME \"$DB_NAMA\" bukan database aplikasi OpenSIMRS" ;; esac
case "$DB_USER" in ''|postgres) mati "DB_USERNAME \"$DB_USER\" bukan role aplikasi OpenSIMRS" ;; esac
case "$MONGO_DB" in ''|admin|local|config) mati "Database MongoDB \"$MONGO_DB\" bukan database aplikasi OpenSIMRS" ;; esac
[[ "$DB_NAMA$DB_USER$MONGO_USER$MONGO_DB" =~ ^[A-Za-z0-9_]+$ ]] || mati "Nama database/akun di .env mengandung karakter tak terduga"

case "$(uname -s)" in
  Darwin) PLATFORM=mac ;;
  MINGW*|MSYS*|CYGWIN*) mati "Di Windows gunakan uninstall.cmd (PowerShell), bukan Git Bash." ;;
  *) PLATFORM=linux ;;
esac
# Podman harus bisa dihubungi SEBELUM mode dideteksi: di macOS kontainer berjalan di VM (podman machine) yang bisa
# saja mati. Tanpa cek ini deteksi jatuh ke mode native dan semua langkah Podman gagal, sementara berkas tetap dihapus.
if ada podman && ! podman_siap; then
  warn "Podman terpasang tetapi tidak bisa dihubungi (VM podman machine belum menyala, atau koneksi default salah?)"
  # VM bisa mati, atau menyala tetapi koneksinya menunjuk mesin lain / port lama (scripts/lib/podman.sh).
  if [ "$PLATFORM" = mac ] && [ "$SIMULASI" != 1 ]; then
    MESIN="$(podman_mesin)"
    if [ -n "$MESIN" ] && tanya "Sambungkan ke VM Podman '$MESIN' (nyalakan / perbaiki koneksi)"; then podman_sambungkan "$MESIN" || true; fi
  fi
  if ! podman_siap; then
    podman_saran
    if [ "$PODMAN" = 1 ]; then
      if [ "$SIMULASI" = 1 ]; then warn "Simulasi: Podman tidak bisa dihubungi; langkah Podman di bawah akan gagal"
      else mati "Podman tidak bisa dihubungi — tidak ada yang dihapus. Nyalakan dulu (macOS: podman machine start), lalu jalankan ulang."; fi
    elif [ "$SIMULASI" != 1 ]; then
      # Mode belum diketahui: jangan menebak. --ya tidak boleh diam-diam memilih mode native.
      [ "$SEMUA_YA" = 1 ] && mati "Podman tidak bisa dihubungi sehingga mode basis data tidak bisa dideteksi — tidak ada yang dihapus. Nyalakan Podman lalu jalankan ulang (atau pakai --podman)."
      tanya "Basis data OpenSIMRS di mesin ini TIDAK memakai Podman (PostgreSQL/MongoDB/Redis lokal)?" \
        || mati "Dibatalkan — tidak ada yang dihapus. Nyalakan Podman (macOS: podman machine start), lalu jalankan ulang."
      PODMAN=0
    fi
  fi
fi
if [ -z "$PODMAN" ]; then
  PODMAN=0; ada podman && podman container exists opensimrs-db 2>/dev/null && PODMAN=1
fi
if [ "$PLATFORM" = mac ]; then pgadmin() { psql -X -q -p "$DB_PORT" -d postgres "$@"; }; AKSI_PG=aksi
else pgadmin() { sudo -u postgres psql -X -q -p "$DB_PORT" -d postgres "$@"; }; AKSI_PG=aksi_langsung; fi   # sudo bisa meminta sandi

PORT_APLIKASI="5520 8081 8082 8083 8084 8085 8086 8087 8088 8089 8090 8091 8092 8093 8094 8095 8096 8097 8098 8099 8100"
pid_port() { # PID proses yang mendengarkan port aplikasi
  local p
  for p in $PORT_APLIKASI; do
    if ada lsof; then lsof -nP -iTCP:"$p" -sTCP:LISTEN -t 2>/dev/null; elif ada ss; then ss -ltnpH "sport = :$p" 2>/dev/null | grep -Eo 'pid=[0-9]+' | cut -d= -f2; fi
  done | sort -u
}
# Worktree SIMRS Studio (di luar folder repo) yang masih terdaftar di repo ini
worktree_studio() {
  git -c safe.directory='*' worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0,10)}' | tail -n +2 \
    | while IFS= read -r w; do [ "$(cd "$w" 2>/dev/null && pwd)" = "$ROOT" ] || echo "$w"; done
}

# ---------- rencana ----------
LANGKAH=4; [ "$HAPUS_FOLDER" = 1 ] && LANGKAH=$((LANGKAH + 1)); [ "$ALAT_AI" = 1 ] && LANGKAH=$((LANGKAH + 1))
ui_mulai "$LANGKAH" "${TMPDIR:-/tmp}/opensimrs-uninstall-$(date +%Y%m%d-%H%M%S).log"

printf '\n%sHapus instalasi OpenSIMRS%s  %s%s%s\n' "$T" "$N" "$R" "$ROOT" "$N"
echo "  Yang akan dihapus:"
if [ "$PODMAN" = 1 ]; then
  echo "    • Podman: kontainer proyek opensimrs (db, mongodb, redis, dan sisa lain seperti opensimrs-gateway) + volumenya (semua data di dalamnya)"
else
  echo "    • PostgreSQL (port $DB_PORT): database \"$DB_NAMA\" & role \"$DB_USER\""
  echo "    • MongoDB: database \"$MONGO_DB\" & akun \"$MONGO_USER\""
  echo "    • Redis (port $REDIS_PORT, db $REDIS_DB): kunci sesi token-*"
fi
echo "    • Berkas buatan instalasi di repo: node_modules, .env*, dist, studio-service/data, worktree SIMRS Studio"
echo "    • Gateway akses domain (bila ada): kontainer opensimrs-gateway atau /etc/nginx/conf.d/opensimrs-gateway.conf, ~/.opensimrs/gateway-lokal.conf, frontend-service/.env.local buatan installer"
WT="$(worktree_studio)"; [ -n "$WT" ] && echo "$WT" | sed 's/^/        worktree: /'
[ "$HAPUS_FOLDER" = 1 ] && echo "    • FOLDER REPO INI: $ROOT"
[ "$ALAT_AI" = 1 ] && echo "    • Claude Code, Codex & OpenCode CLI (npm global)"
echo "  Tidak dihapus: PostgreSQL/MongoDB/Redis/Node.js, database & akun lain, OpenClaw, Ollama (beserta model lokalnya)."

if [ "$SIMULASI" = 1 ]; then
  warn "Mode simulasi: tidak ada yang dihapus."
elif [ "$SEMUA_YA" != 1 ]; then
  printf '\n  %sKetik HAPUS OPENSIMRS untuk melanjutkan:%s ' "$M" "$N"; read -r JAWAB </dev/tty || JAWAB=""
  [ "$JAWAB" = "HAPUS OPENSIMRS" ] || mati "Dibatalkan — tidak ada yang dihapus."
fi

# ---------- 1. proses berjalan ----------
ui_langkah "Proses OpenSIMRS yang berjalan"
PIDS="$(pid_port || true)"
if [ -z "$PIDS" ]; then ok "Tidak ada proses di port aplikasi"
else
  echo "  PID di port aplikasi: $(echo $PIDS)"
  if [ "$SIMULASI" = 1 ] || tanya "Hentikan proses tersebut (npm run dev, layanan, frontend)?"; then
    aksi "Menghentikan proses OpenSIMRS" kill $PIDS || true
  else
    warn "Proses tetap berjalan; database mungkin gagal dihapus karena masih dipakai"
  fi
fi

# ---------- 2. cadangan ----------
ui_langkah "Cadangan basis data"
CADANGAN=""
if [ "$TANPA_CADANGAN" = 1 ]; then warn "Cadangan dilewati (--tanpa-cadangan)"
elif [ "$SEMUA_YA" = 1 ] || [ "$SIMULASI" = 1 ] || tanya "Cadangkan PostgreSQL & MongoDB dulu (disarankan)?"; then
  CADANGAN="$HOME/opensimrs-cadangan-$(date +%Y%m%d-%H%M%S)"
  [ "$SIMULASI" = 1 ] || mkdir -p "$CADANGAN"
  DB_PASS="$(baca_env .env DB_PASSWORD "")"; MONGO_PASS="$(baca_env .env MONGO_DB_PASSWORD "")"
  # Perintah dibungkus fungsi: ui_jalankan mencatat argumennya ke log (dan menampilkannya bila gagal), jadi sandi tidak
  # boleh muncul sebagai argumen. Berkas kosong dianggap gagal (mis. redirect tetap membuat berkas walau perintah gagal).
  # Tidak pernah meminta sandi (-w, stdin /dev/null): di balik spinner prompt tak terlihat dan uninstall tampak macet.
  # Sandi kosong (mis. instalasi berhenti sebelum .env terisi) → coba tanpa autentikasi; gagal cepat bila Mongo memakai auth.
  cadangan_pg() {
    if [ "$PODMAN" = 1 ]; then podman exec -e PGPASSWORD="$DB_PASS" opensimrs-db pg_dump -w -Fc -h 127.0.0.1 -U "$DB_USER" "$DB_NAMA" > "$CADANGAN/postgres.dump" </dev/null
    else PGPASSWORD="$DB_PASS" pg_dump -w -Fc -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -f "$CADANGAN/postgres.dump" "$DB_NAMA" </dev/null; fi
    [ -s "$CADANGAN/postgres.dump" ]
  }
  cadangan_mongo() {
    if [ "$PODMAN" = 1 ]; then
      podman exec -e MONGO_PASS="$MONGO_PASS" opensimrs-mongodb sh -c 'if [ -n "$MONGO_PASS" ]; then set -- -u "$1" -p "$MONGO_PASS" --authenticationDatabase admin --db "$2"; else set -- --db "$2"; fi; mongodump --quiet "$@" --archive' _ "$MONGO_USER" "$MONGO_DB" > "$CADANGAN/mongo.archive" </dev/null
    elif [ -n "$MONGO_PASS" ]; then
      mongodump --quiet --host 127.0.0.1 -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin --db "$MONGO_DB" --archive="$CADANGAN/mongo.archive" </dev/null
    else
      warn "MONGO_DB_PASSWORD kosong di .env; mencadangkan MongoDB tanpa autentikasi"
      mongodump --quiet --host 127.0.0.1 --db "$MONGO_DB" --archive="$CADANGAN/mongo.archive" </dev/null
    fi
    [ -s "$CADANGAN/mongo.archive" ]
  }
  CADANGAN_GAGAL=""
  if [ "$PODMAN" = 1 ] || ada pg_dump; then aksi "pg_dump $DB_NAMA$([ "$PODMAN" = 1 ] && echo " (Podman)") → $CADANGAN/postgres.dump" cadangan_pg || CADANGAN_GAGAL="$CADANGAN_GAGAL PostgreSQL"
  else warn "pg_dump tidak ditemukan; PostgreSQL tidak dicadangkan"; CADANGAN_GAGAL="$CADANGAN_GAGAL PostgreSQL"; fi
  if [ "$PODMAN" = 1 ] || ada mongodump; then aksi "mongodump $MONGO_DB$([ "$PODMAN" = 1 ] && echo " (Podman)") → $CADANGAN/mongo.archive" cadangan_mongo || CADANGAN_GAGAL="$CADANGAN_GAGAL MongoDB"
  else warn "mongodump tidak ditemukan (MongoDB Database Tools); MongoDB tidak dicadangkan"; CADANGAN_GAGAL="$CADANGAN_GAGAL MongoDB"; fi
  if [ -f .env ] && [ "$SIMULASI" != 1 ]; then cp .env "$CADANGAN/env-root.txt"; chmod 600 "$CADANGAN/env-root.txt" 2>/dev/null || true; fi
  if [ -z "$CADANGAN_GAGAL" ] || [ "$SIMULASI" = 1 ]; then ok "Cadangan: $CADANGAN"
  else
    gagal "Cadangan TIDAK lengkap (gagal:$CADANGAN_GAGAL) — isi folder $CADANGAN tidak bisa dipakai untuk memulihkan data tersebut"
    # Jangan menghapus data yang gagal dicadangkan tanpa persetujuan eksplisit; --ya saja tidak cukup.
    [ "$SEMUA_YA" = 1 ] && mati "Penghapusan dihentikan karena cadangan gagal. Perbaiki penyebabnya, atau jalankan dengan --tanpa-cadangan bila memang ingin menghapus tanpa cadangan."
    tanya "Tetap hapus basis data TANPA cadangan$CADANGAN_GAGAL (data hilang permanen)?" \
      || mati "Dihentikan — basis data dan berkas tidak dihapus. Cadangan sebagian ada di $CADANGAN"
  fi
else warn "Tanpa cadangan"; fi

# ---------- 3–5. basis data ----------
ui_langkah "Basis data OpenSIMRS"
if [ "$PODMAN" = 1 ]; then
  # Bila gagal, berhenti sebelum .env dihapus: tanpa .env, volume yang tertinggal tidak bisa dibuka lagi.
  # --remove-orphans: ikut menghapus kontainer proyek yang sama dari compose lain (mis. opensimrs-gateway dari deploy/server).
  aksi "podman compose down -v --remove-orphans (kontainer + volume OpenSIMRS)" podman compose -f docker-compose.yml down -v --remove-orphans \
    || mati "podman compose down gagal — berkas instalasi (.env dll.) tidak dihapus agar uninstall bisa diulang."
else
  if ada psql; then
    # Database dihapus oleh role aplikasi sendiri (pemiliknya) — tanpa superuser/sudo. Role hanya bisa dihapus superuser.
    DB_PASS="$(baca_env .env DB_PASSWORD "")"
    hapus_db() {
      # -w: tanpa prompt sandi (tak terlihat di balik spinner); gagal → jalur superuser di bawah
      PGPASSWORD="$DB_PASS" psql -w -X -q -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAMA' AND pid <> pg_backend_pid();" \
        -c "DROP DATABASE IF EXISTS $DB_NAMA;" </dev/null
    }
    aksi "PostgreSQL: putuskan koneksi & DROP DATABASE $DB_NAMA (sebagai $DB_USER)" hapus_db \
      || $AKSI_PG "PostgreSQL: DROP DATABASE $DB_NAMA (superuser)" pgadmin -c "DROP DATABASE IF EXISTS $DB_NAMA WITH (FORCE);" \
      || warn "Database $DB_NAMA gagal dihapus"
    if [ "$SIMULASI" = 1 ] || tanya "Hapus juga role PostgreSQL \"$DB_USER\" (butuh hak superuser)?"; then
      $AKSI_PG "PostgreSQL: DROP ROLE $DB_USER" pgadmin -c "DROP ROLE IF EXISTS $DB_USER;" || warn "Role $DB_USER gagal dihapus (masih memiliki objek di database lain?)"
    fi
  else warn "psql tidak ditemukan; PostgreSQL dilewati"; fi
  if ada mongosh; then
    aksi "MongoDB: dropDatabase $MONGO_DB & dropUser $MONGO_USER" mongosh --quiet --host 127.0.0.1 --eval "
      db.getSiblingDB('$MONGO_DB').dropDatabase();
      const a = db.getSiblingDB('admin'); if (a.getUser('$MONGO_USER')) a.dropUser('$MONGO_USER');" || warn "MongoDB gagal dibersihkan (MongoDB memakai autentikasi? hapus manual database $MONGO_DB & akun $MONGO_USER)"
  else warn "mongosh tidak ditemukan; MongoDB dilewati"; fi
  if ada redis-cli; then
    REDIS_PASS="$(baca_env .env REDIS_PASSWORD "")"
    hapus_token() { # SCAN + DEL hanya kunci token-* (bukan FLUSHDB)
      local r=(redis-cli -h 127.0.0.1 -p "$REDIS_PORT" -n "$REDIS_DB"); [ -n "$REDIS_PASS" ] && r+=(-a "$REDIS_PASS" --no-auth-warning)
      "${r[@]}" --scan --pattern 'token-*' | while IFS= read -r k; do "${r[@]}" DEL "$k" >/dev/null; done
    }
    aksi "Redis: hapus kunci sesi token-* (db $REDIS_DB)" hapus_token || warn "Redis gagal dibersihkan"
  else warn "redis-cli tidak ditemukan; Redis dilewati"; fi
fi

# ---------- 6. berkas ----------
ui_langkah "Berkas buatan instalasi"
for w in $WT; do
  aksi "Worktree SIMRS Studio $w" git -c safe.directory='*' worktree remove --force "$w" || warn "Worktree $w gagal dihapus"
done
[ "$SIMULASI" = 1 ] || git -c safe.directory='*' worktree prune 2>/dev/null || true
# Gateway API akses domain (install.sh --domain): kontainer opensimrs-gateway + konfigurasinya di ~/.opensimrs
for c in podman docker; do
  if ada "$c" && "$c" container inspect opensimrs-gateway >/dev/null 2>&1; then
    aksi "$c rm -f opensimrs-gateway (gateway API)" "$c" rm -f opensimrs-gateway || warn "Kontainer opensimrs-gateway ($c) gagal dihapus"
  fi
done
if [ -f "$HOME/.opensimrs/gateway-lokal.conf" ]; then aksi "Konfigurasi gateway ~/.opensimrs/gateway-lokal.conf" rm -f "$HOME/.opensimrs/gateway-lokal.conf"; fi
# Gateway nginx native (Linux tanpa Podman/Docker); nginx-nya sendiri tidak dicopot
if [ -f /etc/nginx/conf.d/opensimrs-gateway.conf ]; then
  hapus_gw_nginx() { sudo rm -f /etc/nginx/conf.d/opensimrs-gateway.conf && { sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null || true; }; }
  aksi_langsung "Gateway nginx /etc/nginx/conf.d/opensimrs-gateway.conf (sudo)" hapus_gw_nginx || warn "Konfigurasi gateway nginx gagal dihapus"
fi
# frontend-service/.env.local hanya bila dibuat install.sh --domain (berkas buatan pengguna dibiarkan)
env_lokal_buatan() { local f="$ROOT/frontend-service/.env.local"; if [ -f "$f" ] && head -1 "$f" | grep -q '^# Dibuat install.sh --domain'; then echo "$f"; fi; }
# node_modules (root, layanan, frontend, SDK), .env*, dist, data Studio — hanya di dalam folder repo
cari_buatan() { find "$ROOT" -maxdepth 3 \( -name node_modules -o -name dist \) -type d -prune -print 2>/dev/null; }
# Catatan: blok ini dijalankan dengan set -e + pipefail, jadi perintah terakhirnya tidak boleh bernilai salah
# (dulu "[ -d … ] && echo" menghentikan skrip diam-diam bila studio-service/data tidak ada).
BERKAS_HAPUS="$( { cari_buatan; find "$ROOT" -maxdepth 2 -name '.env' -type f -print; find "$ROOT" -maxdepth 2 -name '.env.bak*' -type f -print; \
  env_lokal_buatan; if [ -d "$ROOT/studio-service/data" ]; then echo "$ROOT/studio-service/data"; fi; } 2>/dev/null | sort -u)"
JUMLAH=$(printf '%s\n' "$BERKAS_HAPUS" | grep -c . || true)
i=0
while IFS= read -r p; do
  [ -n "$p" ] || continue
  case "$p" in "$ROOT"/*) ;; *) continue ;; esac   # pengaman: hanya di dalam repo
  i=$((i + 1))
  if [ "$SIMULASI" = 1 ]; then printf '  %s(simulasi)%s hapus %s\n' "$R" "$N" "${p#"$ROOT"/}"
  else ui_butir "$i" "$JUMLAH" "${p#"$ROOT"/}"; rm -rf "$p"; fi
done <<<"$BERKAS_HAPUS"
ok "$JUMLAH berkas/folder buatan instalasi $([ "$SIMULASI" = 1 ] && echo "akan dihapus" || echo "dihapus")"

# ---------- opsional ----------
if [ "$ALAT_AI" = 1 ]; then
  ui_langkah "Claude Code, Codex & OpenCode CLI"
  for paket in @anthropic-ai/claude-code @openai/codex @opencode/cli; do
    aksi "npm uninstall -g $paket" npm uninstall -g "$paket" || warn "$paket gagal dihapus (coba dengan sudo)"
  done
fi
if [ "$HAPUS_FOLDER" = 1 ]; then
  ui_langkah "Folder repo"
  case "$ROOT" in "/"|"$HOME"|"") mati "Folder repo tidak aman untuk dihapus: $ROOT" ;; esac
  [ -f "$ROOT/install.sh" ] && [ -f "$ROOT/uninstall.sh" ] || mati "Bukan folder repo OpenSIMRS: $ROOT"
  if [ "$SIMULASI" = 1 ]; then printf '  %s(simulasi)%s hapus folder %s\n' "$R" "$N" "$ROOT"
  else cd "$ROOT/.." && rm -rf "$ROOT" && ok "Folder $ROOT dihapus"; fi
fi

ui_selesai "$([ "$SIMULASI" = 1 ] && echo "Simulasi selesai — tidak ada yang dihapus" || echo "OpenSIMRS dihapus") — log: $UI_LOG"
[ -n "$CADANGAN" ] && [ "$SIMULASI" != 1 ] && cat <<EOF

  Cadangan ada di: $CADANGAN
    Pulihkan PostgreSQL: createdb $DB_NAMA && pg_restore -d $DB_NAMA $CADANGAN/postgres.dump
    Pulihkan MongoDB:    mongorestore --archive=$CADANGAN/mongo.archive
EOF
exit 0
