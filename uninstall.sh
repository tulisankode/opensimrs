#!/usr/bin/env bash
# =====================================================================================
#  OpenSIMRS — hapus instalasi lokal (pasangan install.sh; macOS/Ubuntu/Debian)
#
#  Yang dihapus — HANYA milik OpenSIMRS:
#    1. Proses OpenSIMRS yang masih berjalan (port 5520, 8081–8099) — dengan konfirmasi.
#    2. (Opsional, ditawarkan) cadangan: pg_dump + mongodump ke ~/opensimrs-cadangan-<waktu>/.
#    3. PostgreSQL: database & role aplikasi (bawaan "opensimrs", dibaca dari .env).
#    4. MongoDB: database & akun aplikasi "opensimrs".
#    5. Redis: kunci sesi OpenSIMRS (token-*) di database Redis aplikasi — BUKAN FLUSHDB.
#       Mode Podman: kontainer opensimrs-db/-mongodb/-redis beserta volumenya (podman compose down -v).
#    6. Berkas buatan instalasi di folder repo: node_modules, .env*, dist, data Studio, log; worktree SIMRS Studio.
#    7. (--hapus-folder) folder repo ini seluruhnya.
#
#  TIDAK dihapus: PostgreSQL/MongoDB/Redis/Node.js itu sendiri, database/akun lain, Claude Code & Codex CLI
#  (kecuali --alat-ai), OpenClaw.
#
#  Pemakaian:
#    ./uninstall.sh                 interaktif (menampilkan rencana, meminta ketik "HAPUS OPENSIMRS")
#    ./uninstall.sh --simulasi      tampilkan apa yang akan dihapus, tanpa menghapus apa pun
#    ./uninstall.sh --ya            tanpa pertanyaan (cadangan tetap dibuat kecuali --tanpa-cadangan)
#    ./uninstall.sh --tanpa-cadangan  lewati pg_dump/mongodump
#    ./uninstall.sh --hapus-folder  hapus juga folder repo ini (setelah semua langkah lain)
#    ./uninstall.sh --alat-ai       hapus juga Claude Code CLI & Codex CLI global (npm uninstall -g)
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
if [ -z "$PODMAN" ]; then
  PODMAN=0; ada podman && podman container exists opensimrs-db 2>/dev/null && PODMAN=1
fi
if [ "$PLATFORM" = mac ]; then pgadmin() { psql -X -q -p "$DB_PORT" -d postgres "$@"; }; AKSI_PG=aksi
else pgadmin() { sudo -u postgres psql -X -q -p "$DB_PORT" -d postgres "$@"; }; AKSI_PG=aksi_langsung; fi   # sudo bisa meminta sandi

PORT_APLIKASI="5520 8081 8082 8083 8084 8085 8086 8087 8088 8089 8090 8091 8092 8093 8094 8095 8096 8097 8098 8099"
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
  echo "    • Podman: kontainer opensimrs-db, opensimrs-mongodb, opensimrs-redis + volumenya (semua data di dalamnya)"
else
  echo "    • PostgreSQL (port $DB_PORT): database \"$DB_NAMA\" & role \"$DB_USER\""
  echo "    • MongoDB: database \"$MONGO_DB\" & akun \"$MONGO_USER\""
  echo "    • Redis (port $REDIS_PORT, db $REDIS_DB): kunci sesi token-*"
fi
echo "    • Berkas buatan instalasi di repo: node_modules, .env*, dist, studio-service/data, worktree SIMRS Studio"
WT="$(worktree_studio)"; [ -n "$WT" ] && echo "$WT" | sed 's/^/        worktree: /'
[ "$HAPUS_FOLDER" = 1 ] && echo "    • FOLDER REPO INI: $ROOT"
[ "$ALAT_AI" = 1 ] && echo "    • Claude Code CLI & Codex CLI (npm global)"
echo "  Tidak dihapus: PostgreSQL/MongoDB/Redis/Node.js, database & akun lain, OpenClaw."

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
  if [ "$PODMAN" = 1 ]; then
    aksi "pg_dump $DB_NAMA (Podman) → $CADANGAN/postgres.dump" sh -c "podman exec -e PGPASSWORD='$DB_PASS' opensimrs-db pg_dump -Fc -h 127.0.0.1 -U '$DB_USER' '$DB_NAMA' > '$CADANGAN/postgres.dump'" || warn "pg_dump gagal"
    aksi "mongodump $MONGO_DB (Podman) → $CADANGAN/mongo.archive" sh -c "podman exec opensimrs-mongodb mongodump --quiet -u '$MONGO_USER' -p '$MONGO_PASS' --authenticationDatabase admin --db '$MONGO_DB' --archive > '$CADANGAN/mongo.archive'" || warn "mongodump gagal"
  else
    if ada pg_dump; then aksi "pg_dump $DB_NAMA → $CADANGAN/postgres.dump" env PGPASSWORD="$DB_PASS" pg_dump -Fc -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -f "$CADANGAN/postgres.dump" "$DB_NAMA" || warn "pg_dump gagal"
    else warn "pg_dump tidak ditemukan; PostgreSQL tidak dicadangkan"; fi
    if ada mongodump; then aksi "mongodump $MONGO_DB → $CADANGAN/mongo.archive" mongodump --quiet --host 127.0.0.1 -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin --db "$MONGO_DB" --archive="$CADANGAN/mongo.archive" || warn "mongodump gagal"
    else warn "mongodump tidak ditemukan (MongoDB Database Tools); MongoDB tidak dicadangkan"; fi
  fi
  [ -f .env ] && { [ "$SIMULASI" = 1 ] || cp .env "$CADANGAN/env-root.txt"; }
  ok "Cadangan: $CADANGAN"
else warn "Tanpa cadangan"; fi

# ---------- 3–5. basis data ----------
ui_langkah "Basis data OpenSIMRS"
if [ "$PODMAN" = 1 ]; then
  aksi "podman compose down -v (kontainer + volume OpenSIMRS)" podman compose -f docker-compose.yml down -v || warn "podman compose down gagal"
else
  if ada psql; then
    # Database dihapus oleh role aplikasi sendiri (pemiliknya) — tanpa superuser/sudo. Role hanya bisa dihapus superuser.
    DB_PASS="$(baca_env .env DB_PASSWORD "")"
    hapus_db() {
      PGPASSWORD="$DB_PASS" psql -X -q -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAMA' AND pid <> pg_backend_pid();" \
        -c "DROP DATABASE IF EXISTS $DB_NAMA;"
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
# node_modules (root, layanan, frontend, SDK), .env*, dist, data Studio — hanya di dalam folder repo
cari_buatan() { find "$ROOT" -maxdepth 3 \( -name node_modules -o -name dist \) -type d -prune -print 2>/dev/null; }
BERKAS_HAPUS="$( { cari_buatan; find "$ROOT" -maxdepth 2 -name '.env' -type f -print; find "$ROOT" -maxdepth 2 -name '.env.bak*' -type f -print; \
  [ -d "$ROOT/studio-service/data" ] && echo "$ROOT/studio-service/data"; } 2>/dev/null | sort -u)"
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
  ui_langkah "Claude Code CLI & Codex CLI"
  for paket in @anthropic-ai/claude-code @openai/codex; do
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
