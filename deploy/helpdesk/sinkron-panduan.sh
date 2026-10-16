#!/usr/bin/env bash
# Salin pengetahuan agen Helpdesk dari repo ke workspace OpenClaw: AGENTS.md, docs/panduan-pengguna/*.md,
# database/data/katalog-modul.json. Hanya berkas dari commit (git archive), bukan perubahan lokal yang belum di-commit.
#
#   WORKSPACE=/home/helpdesk/.openclaw/workspaces/helpdesk-opensimrs ./deploy/helpdesk/sinkron-panduan.sh
#   TUJUAN=helpdesk@vm-helpdesk:/home/helpdesk/.openclaw/workspaces/helpdesk-opensimrs ./deploy/helpdesk/sinkron-panduan.sh
#   REF=v1.0.0 ...   # versi panduan tertentu (bawaan: HEAD)
set -euo pipefail

AKAR="$(cd "$(dirname "$0")/../.." && pwd)"
REF="${REF:-HEAD}"
SEMENTARA="$(mktemp -d)"
trap 'rm -rf "$SEMENTARA"' EXIT

git -C "$AKAR" archive "$REF" docs/panduan-pengguna database/data/katalog-modul.json deploy/helpdesk/AGENTS.md | tar -x -C "$SEMENTARA"
mkdir -p "$SEMENTARA/isi"
mv "$SEMENTARA/docs/panduan-pengguna" "$SEMENTARA/isi/panduan-pengguna"
mv "$SEMENTARA/database/data/katalog-modul.json" "$SEMENTARA/isi/katalog-modul.json"
mv "$SEMENTARA/deploy/helpdesk/AGENTS.md" "$SEMENTARA/isi/AGENTS.md"
echo "Pengetahuan dari $REF ($(git -C "$AKAR" rev-parse --short "$REF")): $(ls "$SEMENTARA/isi/panduan-pengguna" | wc -l) berkas panduan"

if [ -n "${TUJUAN:-}" ]; then
  rsync -a --delete "$SEMENTARA/isi/" "$TUJUAN/"
  echo "Terkirim ke $TUJUAN"
elif [ -n "${WORKSPACE:-}" ]; then
  mkdir -p "$WORKSPACE"
  rsync -a --delete "$SEMENTARA/isi/" "$WORKSPACE/" 2>/dev/null || { rm -rf "${WORKSPACE:?}/panduan-pengguna"; cp -r "$SEMENTARA/isi/." "$WORKSPACE/"; }
  echo "Disalin ke $WORKSPACE"
else
  echo "Isi WORKSPACE (lokal) atau TUJUAN (rsync/SSH)." >&2
  exit 1
fi
echo "Agen membaca pengetahuan baru pada sesi berikutnya. Bila perlu: openclaw sandbox recreate --agent helpdesk-opensimrs"
