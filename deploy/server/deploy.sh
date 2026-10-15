#!/usr/bin/env bash
# Deploy OpenSIMRS ke server (staging/produksi): build → migrasi → jalankan → health check; rollback otomatis bila gagal.
#   Jalankan di server: ./deploy/server/deploy.sh  (bisa juga dari runner CI self-hosted)
# Rahasia ada di $STATE_DIR/.env (TIDAK di repo); disalin ke .env root saat deploy.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.docker/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Pengaman disk: build penuh 16 image bisa menghabiskan disk hingga Docker crash
FREE_GB=$(df -Pk "$HOME" | awk 'NR==2{printf "%d", $4/1048576}')
if (( FREE_GB < ${MIN_FREE_GB:-8} )); then
  echo "ERROR: disk tersisa ${FREE_GB} GB (< ${MIN_FREE_GB:-8} GB). Bersihkan dulu: docker builder prune -af" >&2
  exit 1
fi

STATE_DIR="${OPENSIMRS_STATE_DIR:-$HOME/.opensimrs}"
SERVER_HOST="${SERVER_HOST:-localhost}"
cd "$ROOT"

[[ -f "$STATE_DIR/.env" ]] || { echo "ERROR: $STATE_DIR/.env belum ada (lihat deploy/server/.env.example)." >&2; exit 1; }
cp "$STATE_DIR/.env" .env
set -a; source .env; set +a

compose() { docker compose -p opensimrs -f docker-compose.yml -f deploy/server/docker-compose.server.yml "$@"; }
APP_SERVICES=(admisi-services antrian-service auth-service farmasi-service igd-service inventory-service lab-service laporan-service payment-service rawat-inap-service rawat-jalan-service rekamedis-service setting-service stok-farmasi-service datamaster-service satusehat-service bpjs-service penunjang-service frontend-service)
PORTS=(8081 8082 8083 8084 8085 8086 8087 8088 8089 8091 8092 8093 8094 8095 8096 5520 8080)

# Semua API lewat gateway (satu domain), mis. PUBLIC_API_URL=https://api.simrs.contoh.id
API="${PUBLIC_API_URL:-http://$SERVER_HOST:8080}"
echo "==> Env frontend untuk server (dibakar saat build): API $API"
cat > frontend-service/.env.production.local <<ENV
VITE_KEEP_API_HOST=true
VITE_BASE_URL=$API
VITE_BASE_AUTH=$API/api/v3/auth
VITE_URL_SETTING=$API/api/v3/setting
VITE_BASE_DATAMASTER=$API/api/v3/datamaster
VITE_BASE_PEMBAYARAN=$API/api/v3/payment
VITE_BASE_LABORATORIUM=$API/api/v3/lab
VITE_BASE_ADMISI=$API/api/v3/admisi
VITE_BASE_IGD=$API/api/v3/pelayanan/igd
VITE_BASE_FARMASI=$API/api/v3/farmasi
VITE_BASE_RAWAT_JALAN=$API/api/v3/rawat-jalan
VITE_BASE_REKAM_MEDIS=$API/api/v3
VITE_BASE_RAWAT_INAP=$API/api/v3/ranap
VITE_BASE_INVENTORY=$API/api/v3/inventory
VITE_BASE_DASHBOARD=$API/api/v3/laporan
VITE_BASE_ANTRIAN=$API/api/v3/antrian
VITE_BASE_STOK=$API/api/v3
VITE_BASE_SATUSEHAT=$API/api/v3/satusehat
VITE_BASE_BPJS=$API/api/v3/bpjs
VITE_BASE_PENUNJANG=$API/api/v3/penunjang
ENV

echo "==> Simpan image saat ini sebagai :previous (untuk rollback)"
for img in $(compose config --images 2>/dev/null | grep '^opensimrs/'); do
  docker image inspect "$img" >/dev/null 2>&1 && docker tag "$img" "${img%:*}:previous"
done

free_gb() { df -Pk "$HOME" | awk 'NR==2{printf "%d", $4/1048576}'; }

# Kunci build per layanan = hash tree folder layanan (+ packages/ untuk layanan ber-SDK, + env frontend).
# Layanan yang tidak berubah tidak dibangun ulang: build ulang 16 image (npm install penuh) menambah ±10 GB layer.
build_key() {
  local dir="$1"; [[ "$1" == "admisi-services" ]] && dir="admisi-service"
  local key; key="$(git -C "$ROOT" rev-parse "HEAD:$dir" 2>/dev/null || echo none)"
  if [[ "$dir" == "frontend-service" ]]; then
    key="$key-$(shasum frontend-service/.env.production.local | cut -c1-12)"
  elif grep -q '"@opensimrs/' "$ROOT/$dir/package.json" 2>/dev/null; then
    key="$key-$(git -C "$ROOT" rev-parse HEAD:packages 2>/dev/null || echo none)"
  fi
  echo "$key"
}
BUILT_DIR="$STATE_DIR/built"; mkdir -p "$BUILT_DIR"
BUILT_NOW=()   # "svc key", dicatat ke $BUILT_DIR hanya bila deploy sehat (rollback = build ulang berikutnya)

echo "==> Bersihkan image yatim & cache build lama sebelum build (disk tersisa $(free_gb) GB)"
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --max-used-space 4gb >/dev/null 2>&1 || true

echo "==> Build image (hanya service yang berubah; FORCE_BUILD=1 untuk semua)"
for svc in "${APP_SERVICES[@]}"; do
  key="$(build_key "$svc")"
  img="$(compose config --images "$svc" 2>/dev/null | head -1)"
  if [[ "${FORCE_BUILD:-0}" != "1" && "$(cat "$BUILT_DIR/$svc" 2>/dev/null)" == "$key" ]] && docker image inspect "$img" >/dev/null 2>&1; then
    echo "--- lewati $svc (tidak berubah)"
    continue
  fi
  if (( $(free_gb) < ${MIN_BUILD_FREE_GB:-5} )); then
    docker builder prune -af >/dev/null 2>&1 || true
    if (( $(free_gb) < ${MIN_BUILD_FREE_GB:-5} )); then
      echo "ERROR: disk tinggal $(free_gb) GB saat build $svc; build dihentikan (container lama tetap berjalan)" >&2
      exit 1
    fi
  fi
  echo "--- build $svc"
  compose build "$svc"   # berurutan: build paralel 16 image menghabiskan RAM
  BUILT_NOW+=("$svc $key")
done

echo "==> Infrastruktur (Postgres, Mongo, Redis)"
compose up -d --wait db mongodb redis
# Start pertama memuat schema.sql (±11 MB); selama itu Postgres belum menerima koneksi TCP
echo "==> Menunggu Postgres siap"
for _ in $(seq 1 200); do
  docker exec opensimrs-db pg_isready -h 127.0.0.1 -U "$DB_USERNAME" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 3
done
docker exec opensimrs-db pg_isready -h 127.0.0.1 -U "$DB_USERNAME" -d "$DB_NAME"

echo "==> Migrasi database (sequelize-cli, database/migrations)"
docker run --rm --network opensimrs_opensimrs -v "$ROOT:/app" -w /app \
  -e DB_HOST=db -e DB_PORT=5432 -e DB_NAME -e DB_USERNAME -e DB_PASSWORD \
  -e SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-}" \
  node:22-alpine sh -c "npm ci --no-audit --no-fund --ignore-scripts >/dev/null && npx sequelize-cli db:migrate && { [ -z \"\$SEED_ADMIN_PASSWORD\" ] || npx sequelize-cli db:seed --seed 20261012090000-dev-admin-user.cjs; }"

echo "==> Menjalankan service"
compose up -d --no-build "${APP_SERVICES[@]}" gateway
# gateway.nginx.conf di-mount sebagai berkas tunggal: setelah git menulis ulang berkas (inode baru)
# kontainer tetap membaca isi lama, "nginx -s reload" tidak cukup → buat ulang kontainer gateway
compose up -d --no-build --force-recreate gateway

healthy() {
  for _ in $(seq 1 60); do
    local down=0
    for p in "${PORTS[@]}"; do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$p/" || true)
      [[ "$code" == "000" ]] && down=1
    done
    # satusehat-service tidak membuka port ke host: periksa lewat gateway
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:8080/api/v3/satusehat/health" || true)
    [[ "$code" != "200" ]] && down=1
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:8080/api/v3/bpjs/health" || true)
    [[ "$code" != "200" ]] && down=1
    [[ $down -eq 0 ]] && return 0
    sleep 3
  done
  return 1
}

if healthy; then
  for entry in ${BUILT_NOW[@]+"${BUILT_NOW[@]}"}; do echo "${entry#* }" > "$BUILT_DIR/${entry%% *}"; done
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -f --max-used-space 8gb >/dev/null 2>&1 || true   # batasi cache build ±8 GB (tanpa batas bisa puluhan GB)
  echo "==> Deploy OpenSIMRS berhasil: http://$SERVER_HOST:5520"
else
  echo "ERROR: ada service yang tidak merespons" >&2
  for p in "${PORTS[@]}"; do printf '%s:%s ' "$p" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:$p/" || true)"; done; echo >&2
  compose ps >&2 || true
  echo "==> Rollback ke image :previous" >&2
  for img in $(compose config --images 2>/dev/null | grep '^opensimrs/'); do
    docker image inspect "${img%:*}:previous" >/dev/null 2>&1 && docker tag "${img%:*}:previous" "$img"
  done
  compose up -d --no-build "${APP_SERVICES[@]}" gateway || true
  exit 1
fi
