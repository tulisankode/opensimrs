# shellcheck shell=bash
# Tampilan terminal untuk install.sh & uninstall.sh: judul langkah dengan bilah kemajuan keseluruhan, spinner + waktu
# berjalan untuk perintah lama (keluaran lengkap ke berkas log), dan bilah per butir (mis. npm install per layanan).
# Tanpa terminal (CI, keluaran dialihkan) atau OPENSIMRS_UI=0: teks polos tanpa kode warna/kursor.
#
# Pemakaian:  . scripts/lib/tampilan.sh ; ui_mulai 9 "/tmp/opensimrs-install.log" ; ui_langkah "Cek dependensi" ;
#             ui_jalankan "Memuat schema.sql" psql ... ; ui_butir 3 18 "auth-service"

if [ -t 1 ] && [ "${OPENSIMRS_UI:-1}" != 0 ]; then
  UI_INTERAKTIF=1
  H=$'\033[32m'; K=$'\033[33m'; M=$'\033[31m'; T=$'\033[1m'; R=$'\033[2m'; N=$'\033[0m'
else
  UI_INTERAKTIF=0; H=""; K=""; M=""; T=""; R=""; N=""
fi
# Karakter bilah: blok penuh bila terminal UTF-8, selain itu ASCII.
case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
  *UTF-8*|*utf8*|*UTF8*|*utf-8*) UI_PENUH="█"; UI_KOSONG="░" ;;
  *) UI_PENUH="#"; UI_KOSONG="-" ;;
esac
UI_TOTAL=1; UI_KE=0; UI_LOG="/dev/null"; UI_T0=$(date +%s)

ok()    { printf '  %s✔%s %s\n' "$H" "$N" "$1"; }
warn()  { printf '  %s!%s %s\n' "$K" "$N" "$1"; }
gagal() { printf '  %s✘%s %s\n' "$M" "$N" "$1"; }
judul() { printf '\n%s==> %s%s\n' "$T" "$1" "$N"; }

# Bilah teks: _bilah <persen> <lebar>
_bilah() {
  local p=$1 lebar=$2 isi i s=""
  [ "$p" -lt 0 ] && p=0; [ "$p" -gt 100 ] && p=100
  isi=$((p * lebar / 100))
  for ((i = 0; i < lebar; i++)); do if [ $i -lt $isi ]; then s+="$UI_PENUH"; else s+="$UI_KOSONG"; fi; done
  printf '%s' "$s"
}
_lama() { local d=$(( $(date +%s) - $1 )); printf '%dm%02ds' $((d / 60)) $((d % 60)); }

# ui_mulai <jumlah-langkah> <berkas-log>
ui_mulai() {
  UI_TOTAL=$1; UI_KE=0; UI_LOG=$2; UI_T0=$(date +%s)
  mkdir -p "$(dirname "$UI_LOG")" 2>/dev/null || true
  : >"$UI_LOG" 2>/dev/null || UI_LOG=/dev/null
}

# ui_langkah "Judul" — judul langkah berikutnya + bilah kemajuan keseluruhan.
ui_langkah() {
  UI_KE=$((UI_KE + 1))
  local p=$(( (UI_KE - 1) * 100 / UI_TOTAL ))
  printf '\n%s[%d/%d]%s %s%s%s  %s%s %3d%%%s %s%s%s\n' "$T" "$UI_KE" "$UI_TOTAL" "$N" "$T" "$1" "$N" \
    "$H" "$(_bilah $p 20)" "$p" "$N" "$R" "$(_lama "$UI_T0")" "$N"
  printf '\n== [%d/%d] %s ==\n' "$UI_KE" "$UI_TOTAL" "$1" >>"$UI_LOG" 2>/dev/null || true
}

# ui_butir <ke> <total> "label" — bilah per butir di satu baris (ditimpa); baris akhir saat ke == total.
ui_butir() {
  local ke=$1 total=$2 p=$(( $1 * 100 / $2 ))
  if [ "$UI_INTERAKTIF" = 1 ]; then
    printf '\r\033[K  %s%s%s %3d%%  %d/%d  %s' "$H" "$(_bilah $p 24)" "$N" "$p" "$ke" "$total" "$3"
    [ "$ke" -ge "$total" ] && printf '\n'
  else
    printf '  [%d/%d] %s\n' "$ke" "$total" "$3"
  fi
}

# ui_jalankan "label" perintah... — jalankan dengan spinner & waktu berjalan; keluaran ke log.
# Gagal → tampilkan 25 baris terakhir log dan kembalikan kode keluarnya. Jangan untuk perintah yang meminta masukan
# (sudo, brew, apt): prompt-nya tidak akan terlihat.
ui_jalankan() {
  local label=$1 kode=0 t0; shift; t0=$(date +%s)
  printf '\n$ %s\n' "$*" >>"$UI_LOG" 2>/dev/null || true
  if [ "$UI_INTERAKTIF" != 1 ]; then
    echo "  … $label"
    "$@" >>"$UI_LOG" 2>&1 || kode=$?
  else
    "$@" >>"$UI_LOG" 2>&1 &
    local pid=$! i=0 putar='|/-\' akhir
    while kill -0 "$pid" 2>/dev/null; do
      akhir="$(tail -n 1 "$UI_LOG" 2>/dev/null | tr -d '\r' | cut -c1-60)"
      printf '\r\033[K  %s%s%s %s  %s%s  %s%s' "$K" "${putar:i++%4:1}" "$N" "$label" "$R" "$(_lama "$t0")" "$akhir" "$N"
      sleep 0.2
    done
    wait "$pid" || kode=$?
    printf '\r\033[K'
  fi
  if [ "$kode" = 0 ]; then
    ok "$label ${R}($(_lama "$t0"))${N}"
  else
    gagal "$label (kode $kode) — log lengkap: $UI_LOG"
    tail -n 25 "$UI_LOG" 2>/dev/null | sed 's/^/      /'
  fi
  return "$kode"
}

# ui_selesai "pesan" — bilah 100% + total waktu.
ui_selesai() {
  printf '\n%s%s 100%%%s  %s  %s(%s)%s\n' "$H" "$(_bilah 100 20)" "$N" "$1" "$R" "$(_lama "$UI_T0")" "$N"
}
