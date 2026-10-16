# =====================================================================================
#  OpenSIMRS - instalasi lokal TANPA Docker untuk Windows 10/11 (PowerShell 5.1+, winget)
#
#  Yang dilakukan (aman dijalankan berulang):
#    1. Cek dependensi & versi: Node.js >= 20 (disarankan 22), PostgreSQL >= 15, MongoDB >= 6,
#       mongosh, Redis-kompatibel (Memurai). Yang kurang ditawarkan untuk dipasang lewat winget.
#    2. Menyalakan layanan Windows: PostgreSQL, MongoDB, Memurai.
#    3. Membuat role & database PostgreSQL "opensimrs" + memuat schema.sql (sekali saja).
#    4. Membuat akun MongoDB "opensimrs".
#    5. Membuat .env root, .env tiap layanan, dan frontend-service\.env (TIDAK menimpa yang sudah ada).
#    6. npm run install:all -> npm run db:migrate -> data demo (opsional).
#    7. Alat AI SIMRS Studio: Claude Code CLI & Codex CLI (npm global). OpenClaw (Helpdesk) hanya dengan -Helpdesk.
#
#  Pemakaian (dari folder repo):
#    .\install.cmd                         (paling mudah; sama dengan perintah di bawah)
#    powershell -ExecutionPolicy Bypass -File .\install.ps1 [-Cek] [-Ya] [-TanpaDemo] [-Jalankan] [-TanpaAi] [-Helpdesk]
#      -Cek        hanya cek dependensi, tidak mengubah apa pun
#      -Ya         jawab "ya" untuk semua pertanyaan
#      -TanpaDemo  lewati data demo
#      -Jalankan   langsung "npm run dev" setelah selesai
#      -TanpaAi    lewati pemasangan Claude Code CLI & Codex CLI
#      -Helpdesk   pasang juga OpenClaw (Helpdesk) dengan installer resminya - untuk uji coba; produksi di VM terpisah
#                  (deploy\helpdesk\README.md)
#
#  Sandi superuser PostgreSQL ("postgres"):
#    - Bila PostgreSQL dipasang oleh skrip ini, sandinya dibuat acak dan ditampilkan SEKALI di akhir.
#    - Bila PostgreSQL sudah terpasang, skrip menanyakannya (atau isi variabel lingkungan PG_SUPERPASS).
#
#  Port PostgreSQL dibaca dari postgresql.conf layanan Windows-nya (bawaan 5432); bisa dipaksa lewat variabel
#  lingkungan PG_PORT, mis. bila port 5432 dipakai kontainer Docker.
#
#  Hanya untuk development lokal. Untuk server/production lihat docs/INSTALLATION_GUIDE.md & docs/LINGKUNGAN.md.
# =====================================================================================
param(
  [switch]$Cek,
  [switch]$Ya,
  [switch]$TanpaDemo,
  [switch]$Jalankan,
  [switch]$TanpaAi,
  [switch]$Helpdesk
)

# "Continue": di PowerShell 5.1 keluaran stderr program native (mis. NOTICE psql) tidak boleh menghentikan skrip;
# keberhasilan perintah native dicek lewat $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT

$DB_NAMA = "opensimrs"; $DB_USER = "opensimrs"; $MONGO_USER = "opensimrs"
$LAYANAN = [ordered]@{ "admisi"=8081; "antrian"=8082; "auth"=8083; "farmasi"=8084; "igd"=8085; "inventory"=8086;
  "lab"=8087; "laporan"=8088; "payment"=8089; "rawat-inap"=8091; "rawat-jalan"=8092; "rekamedis"=8093;
  "setting"=8094; "stok-farmasi"=8095; "datamaster"=8096; "satusehat"=8097; "bpjs"=8098; "penunjang"=8099; "studio"=8090 }
$PG_SUPERPASS_BARU = $null

# ---------- tampilan ----------
function Judul($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor White }
function Ok($t)    { Write-Host "  [OK] $t" -ForegroundColor Green }
function Warn($t)  { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Gagal($t) { Write-Host "  [X]  $t" -ForegroundColor Red }
function Mati($t)  { Write-Host ""; Write-Host "GAGAL: $t" -ForegroundColor Red; exit 1 }
function Tanya($t) {
  if ($Ya) { return $true }
  $j = Read-Host "  ? $t [y/N]"
  return ($j -match '^(y|ya)$')
}
function Ada($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Mayor($v) { if ($v -match '(\d+)') { return [int]$Matches[1] } else { return 0 } }
function Acak([int]$bytes = 32) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return (($b | ForEach-Object { $_.ToString("x2") }) -join "")
}
function TulisUtf8($path, $isi) {
  if (-not [System.IO.Path]::IsPathRooted($path)) { $path = Join-Path $ROOT $path }
  [System.IO.File]::WriteAllText($path, $isi, (New-Object System.Text.UTF8Encoding($false)))
}
function SegarkanPath {
  $m = [Environment]::GetEnvironmentVariable("Path", "Machine"); $u = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$m;$u"
  # PostgreSQL, MongoDB, Memurai tidak selalu masuk PATH: tambahkan folder bin versi terbaru
  $tambah = @()
  $pg = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object { Mayor $_.Directory.Parent.Name } -Descending | Select-Object -First 1
  if ($pg) { $tambah += $pg.DirectoryName }
  $mg = Get-ChildItem "C:\Program Files\MongoDB\Server\*\bin\mongod.exe" -ErrorAction SilentlyContinue | Sort-Object { [version]($_.Directory.Parent.Name + ".0") } -Descending | Select-Object -First 1
  if ($mg) { $tambah += $mg.DirectoryName }
  foreach ($d in @("C:\Program Files\Memurai", "$env:LOCALAPPDATA\Programs\mongosh", "C:\Program Files\mongosh", "C:\Program Files\nodejs")) {
    if (Test-Path $d) { $tambah += $d }
  }
  if ($tambah.Count -gt 0) { $env:Path = (($tambah -join ";") + ";" + $env:Path) }
}
function PortSiap([int]$port) {
  try { $c = New-Object System.Net.Sockets.TcpClient; $a = $c.BeginConnect("127.0.0.1", $port, $null, $null)
        $ok = $a.AsyncWaitHandle.WaitOne(1000) -and $c.Connected; $c.Close(); return $ok } catch { return $false }
}
function RedisPing {
  try {
    $c = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 6379); $s = $c.GetStream(); $s.ReadTimeout = 2000
    $w = [System.Text.Encoding]::ASCII.GetBytes("PING`r`n"); $s.Write($w, 0, $w.Length)
    $buf = New-Object byte[] 64; $n = $s.Read($buf, 0, 64); $c.Close()
    return ([System.Text.Encoding]::ASCII.GetString($buf, 0, $n) -like "+PONG*")
  } catch { return $false }
}
function RedisMayor {
  # versi server Redis-kompatibel yang sedang berjalan (0 bila tidak terbaca)
  try {
    $c = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 6379); $s = $c.GetStream(); $s.ReadTimeout = 2000
    $w = [System.Text.Encoding]::ASCII.GetBytes("INFO server`r`n"); $s.Write($w, 0, $w.Length)
    $buf = New-Object byte[] 4096; $n = $s.Read($buf, 0, 4096); $c.Close()
    if ([System.Text.Encoding]::ASCII.GetString($buf, 0, $n) -match 'redis_version:(\d+)') { return [int]$Matches[1] }
  } catch { }
  return 0
}
function PortPg {
  if ($env:PG_PORT) { return [int]$env:PG_PORT }
  # ambil folder data dari perintah layanan (-D "...") lalu baca baris "port = ..." di postgresql.conf
  $svc = Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "postgresql*" } |
    Sort-Object { Mayor ($_.Name -replace '^\D+', '') } -Descending | Select-Object -First 1
  if ($svc -and $svc.PathName -match '-D\s+"([^"]+)"') {
    $conf = Join-Path $Matches[1] "postgresql.conf"
    if (Test-Path $conf) {
      $baris = Get-Content $conf | Where-Object { $_ -match '^\s*port\s*=\s*(\d+)' } | Select-Object -Last 1
      if ($baris -and $baris -match '(\d+)') { return [int]$Matches[1] }
    }
  }
  return 5432
}
function Tunggu($label, [scriptblock]$cek) {
  for ($i = 0; $i -lt 30; $i++) { if (& $cek) { Ok "$label siap"; return }; Start-Sleep -Seconds 1 }
  Mati "$label belum merespons. Periksa layanan Windows-nya (services.msc) lalu jalankan ulang."
}
function Admin { return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }

SegarkanPath

# ---------- 1. cek dependensi ----------
Judul "Cek dependensi (Windows)"
$kurang = @()
function CekVersi($nama, $cmd, [int]$min, [scriptblock]$ambilVersi) {
  if (-not (Ada $cmd)) { Gagal "$nama belum terpasang"; $script:kurang += $nama; return }
  $v = ""; try { $v = (& $ambilVersi | Out-String).Trim() } catch { }
  $m = Mayor $v
  if ($min -gt 0 -and $m -gt 0 -and $m -lt $min) { Gagal "$nama versi $m terlalu lama (minimal $min): $v"; $script:kurang += $nama }
  else { Ok "${nama}: $v" }
}
CekVersi "node"       "node"    20 { (node -v) -replace '^v', '' }
CekVersi "npm"        "npm"     0  { npm -v }
CekVersi "postgresql" "psql"    15 { ((psql --version) -replace '^.*\) ', '') }
CekVersi "mongodb"    "mongod"  6  { ((mongod --version | Select-Object -First 1) -replace '^db version v', '') }
CekVersi "mongosh"    "mongosh" 0  { mongosh --version }
# klien redis@4/ioredis@5 butuh server >= 5; port Redis lama untuk Windows (Microsoft, v3.0) tidak cukup
$rv = 0
if (RedisPing) { $rv = RedisMayor }
elseif (Ada "redis-server") { $rv = Mayor ((redis-server --version | Out-String) -replace '^.*v=', '') }
if (Ada "memurai") { Ok "redis: Memurai terpasang" }
elseif ($rv -ge 5) { Ok "redis: server Redis-kompatibel versi $rv" }
elseif ($rv -gt 0) { Gagal "redis versi $rv terlalu lama (minimal 5), perlu Memurai"; $kurang += "redis" }
else { Gagal "redis (Memurai) belum terpasang"; $kurang += "redis" }
if ((Ada "node") -and ((Mayor (node -v)) -lt 22)) { Warn "Node.js 22 LTS disarankan (terpasang $(node -v))" }

if ($kurang.Count -gt 0) {
  Write-Host ""
  Warn ("Kurang/terlalu lama: " + ($kurang -join ", "))
  if ($Cek) { exit 1 }
  if (-not (Ada "winget")) { Mati "winget tidak tersedia. Pasang 'App Installer' dari Microsoft Store, atau pasang dependensi di atas secara manual." }
  if (-not (Admin)) { Warn "Pemasangan layanan (PostgreSQL/MongoDB/Memurai) butuh hak Administrator. Bila gagal, jalankan ulang PowerShell sebagai Administrator." }
  $paket = @()
  foreach ($d in $kurang) {
    switch ($d) {
      "node"       { $paket += "OpenJS.NodeJS.22" }
      "npm"        { $paket += "OpenJS.NodeJS.22" }
      "postgresql" { $paket += "PostgreSQL.PostgreSQL.16" }
      "mongodb"    { $paket += "MongoDB.Server" }
      "mongosh"    { $paket += "MongoDB.Shell" }
      "redis"      { $paket += "Memurai.MemuraiDeveloper" }
    }
  }
  $paket = $paket | Select-Object -Unique
  if (-not (Tanya ("Pasang dengan winget: " + ($paket -join ", ") + "?"))) { Mati "Pasang dependensi di atas lalu jalankan ulang." }
  foreach ($p in $paket) {
    Write-Host "  ... winget install $p"
    $arg = @("install", "--id", $p, "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements")
    if ($p -eq "MongoDB.Server") { $arg += @("--version", "7.0.28") }   # sama dengan MongoDB 7.0 di konfigurasi server
    if ($p -eq "PostgreSQL.PostgreSQL.16") {
      # sandi superuser ditentukan skrip agar bisa dipakai membuat role aplikasi
      $script:PG_SUPERPASS_BARU = Acak 12
      $arg += @("--override", "--mode unattended --unattendedmodeui none --superpassword $($script:PG_SUPERPASS_BARU) --serverport 5432")
    }
    & winget @arg
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { Warn "winget $p selesai dengan kode $LASTEXITCODE" }
  }
  SegarkanPath
  # cek ulang
  foreach ($c in @("node", "npm", "psql", "mongod", "mongosh")) { if (-not (Ada $c)) { Mati "$c masih belum ditemukan setelah instalasi. Tutup lalu buka lagi PowerShell, kemudian jalankan ulang skrip." } }
}
Ok "Semua dependensi tersedia"

# Alat AI (tidak menghalangi instalasi; dipasang di langkah 7).
function VersiAlat($cmd) {
  if (-not (Ada $cmd)) { return $null }
  $v = (& $cmd --version 2>$null | Out-String)
  if ($v -match '(\d+(\.\d+)+)') { return $Matches[1] } else { return $null }
}
foreach ($a in @(@("claude", "Claude Code CLI (agen SIMRS Studio)"), @("codex", "Codex CLI (agen SIMRS Studio, opsional)"), @("openclaw", "OpenClaw (Helpdesk; produksi di VM terpisah)"))) {
  $v = VersiAlat $a[0]
  if ($v) { Ok "$($a[1]): $v" } else { Warn "$($a[1]) belum terpasang" }
}
if ($Cek) { exit 0 }

# ---------- 2. nyalakan layanan ----------
Judul "Menyalakan PostgreSQL, MongoDB, Memurai (Redis)"
foreach ($pola in @("postgresql*", "MongoDB*", "Memurai*", "Redis*")) {
  Get-Service -Name $pola -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne "Running" } | ForEach-Object {
    $nama = $_.Name
    if ($_.StartType -eq "Disabled") { Warn "Layanan $nama dinonaktifkan (Disabled), dilewati"; return }
    try { Start-Service $nama -ErrorAction Stop; Ok "Layanan $nama dinyalakan" } catch { Warn "Tidak bisa menyalakan $nama (butuh Administrator?)" }
  }
}
$PG_PORT = PortPg
if ($PG_PORT -ne 5432) { Warn "PostgreSQL memakai port $PG_PORT (dari postgresql.conf / PG_PORT)" }
Tunggu "PostgreSQL" { PortSiap $PG_PORT }
Tunggu "Redis"      { RedisPing }
Tunggu "MongoDB"    { PortSiap 27017 }

# ---------- nilai rahasia: pakai ulang dari .env bila ada ----------
function Ambil($kunci) {
  if (-not (Test-Path (Join-Path $ROOT ".env"))) { return "" }
  $baris = Get-Content (Join-Path $ROOT ".env") | Where-Object { $_ -match "^$kunci=" } | Select-Object -First 1
  if ($baris) { return ($baris -replace "^$kunci=", "") } else { return "" }
}
if (Test-Path .env) {
  $alasan = $null
  if (-not (Ambil "DB_PASSWORD") -or -not (Ambil "MONGO_DB_PASSWORD") -or -not (Ambil "SECRET_KEY")) { $alasan = "belum lengkap" }
  # .env lama dari instalasi lain (mis. database kerja di kontainer Docker) jangan dipakai: migrasi membaca .env root
  elseif ((Ambil "DB_NAME") -ne $DB_NAMA -or (Ambil "DB_USERNAME") -ne $DB_USER -or (Ambil "DB_PORT") -ne "$PG_PORT") {
    $alasan = "mengarah ke database lain ($(Ambil 'DB_USERNAME')@$(Ambil 'DB_HOST'):$(Ambil 'DB_PORT')/$(Ambil 'DB_NAME'))"
  }
  if ($alasan) {
    $cad = ".env.bak." + (Get-Date -Format "yyyyMMddHHmmss")
    Move-Item .env $cad -ErrorAction Stop
    Warn ".env root $alasan -> dicadangkan ke $cad dan dibuat ulang"
  }
}
function AmbilAtauAcak($kunci, [int]$n) { $v = Ambil $kunci; if ($v) { return $v } else { return (Acak $n) } }
$DB_PASS    = AmbilAtauAcak "DB_PASSWORD" 16
$MONGO_PASS = AmbilAtauAcak "MONGO_DB_PASSWORD" 16
$SECRET     = AmbilAtauAcak "SECRET_KEY" 32
$K1 = AmbilAtauAcak "API_KEY_SECRET" 32; $K2 = AmbilAtauAcak "API_KEY_CHECK_NORM" 32
$K3 = AmbilAtauAcak "ADMISI_SECRET_KEY" 32; $K4 = AmbilAtauAcak "ANTRIAN_KEY_SECRET" 32

# ---------- 3. PostgreSQL ----------
Judul "PostgreSQL: role, database, skema"
$superPass = $PG_SUPERPASS_BARU
if (-not $superPass) { $superPass = $env:PG_SUPERPASS }
if (-not $superPass) {
  $aman = Read-Host "  Sandi superuser PostgreSQL (user 'postgres')" -AsSecureString
  $superPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($aman))
}
function PgAdmin($sql) {
  $env:PGPASSWORD = $superPass
  $hasil = & psql -X -q -h 127.0.0.1 -p $PG_PORT -U postgres -d postgres -tAc $sql 2>&1
  $kode = $LASTEXITCODE; Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($kode -ne 0) { Mati "Perintah PostgreSQL gagal (sandi superuser benar?): $hasil" }
  return (($hasil | Out-String).Trim())
}
if ((PgAdmin "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'") -eq "1") {
  PgAdmin "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS'" | Out-Null; Ok "Role $DB_USER sudah ada (sandi disamakan dengan .env)"
} else {
  PgAdmin "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS'" | Out-Null; Ok "Role $DB_USER dibuat"
}
if ((PgAdmin "SELECT 1 FROM pg_database WHERE datname='$DB_NAMA'") -eq "1") { Ok "Database $DB_NAMA sudah ada" }
else { PgAdmin "CREATE DATABASE $DB_NAMA OWNER $DB_USER" | Out-Null; Ok "Database $DB_NAMA dibuat" }

$env:PGPASSWORD = $DB_PASS
$sudah = (& psql -X -h 127.0.0.1 -p $PG_PORT -U $DB_USER -d $DB_NAMA -tAc "SELECT to_regclass('public.kelurahan') IS NOT NULL" | Out-String).Trim()
if ($sudah -eq "t") { Ok "schema.sql sudah dimuat sebelumnya (dilewati)" }
else {
  Write-Host "  ... memuat schema.sql (struktur + referensi nasional, 1-3 menit)"
  & psql -X -q -h 127.0.0.1 -p $PG_PORT -U $DB_USER -d $DB_NAMA -v ON_ERROR_STOP=1 -f schema.sql | Out-Null
  if ($LASTEXITCODE -ne 0) { Mati "Gagal memuat schema.sql" }
  Ok "schema.sql dimuat"
}
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

# ---------- 4. MongoDB ----------
Judul "MongoDB: akun aplikasi"
$js = Join-Path $env:TEMP ("opensimrs-mongo-" + (Acak 4) + ".js")
TulisUtf8 $js @"
const a = db.getSiblingDB('admin');
if (a.getUser('$MONGO_USER')) { a.updateUser('$MONGO_USER', { pwd: '$MONGO_PASS' }); print('diperbarui'); }
else { a.createUser({ user: '$MONGO_USER', pwd: '$MONGO_PASS', roles: [{ role: 'readWrite', db: '$DB_NAMA' }] }); print('dibuat'); }
"@
$hasil = (& mongosh --quiet --host 127.0.0.1 --file $js 2>&1 | Out-String).Trim()
Remove-Item $js -ErrorAction SilentlyContinue
if ($hasil -match "dibuat|diperbarui") { Ok "Akun MongoDB $MONGO_USER $($Matches[0])" }
else { Gagal "Tidak bisa membuat akun MongoDB: $hasil"
       Mati "MongoDB tampaknya sudah memakai autentikasi. Buat akun '$MONGO_USER' (readWrite pada '$DB_NAMA', authSource admin) secara manual, isi MONGO_DB_PASSWORD di .env, lalu jalankan ulang." }

# ---------- 5. berkas .env ----------
Judul "Berkas .env"
$umum = @"
DB_DIALECT=postgres
DB_HOST=127.0.0.1
DB_PORT=$PG_PORT
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
"@ -replace "`r`n", "`n"

function TulisEnv($berkas, $port, $modul) {
  if (Test-Path (Join-Path $ROOT $berkas)) { Warn "$berkas sudah ada (tidak ditimpa)"; return }
  $isi = $umum + "`n"
  if ($port) { $isi += "APPLICATION_PORT=$port`nAPP_PORT=$port`nPORT=$port`nSERVER_PORT=$port`nAPPLICATION_MODULE=$modul`n" }
  TulisUtf8 $berkas $isi
  Ok "$berkas dibuat"
}
TulisEnv ".env" $null $null
foreach ($n in $LAYANAN.Keys) { if (Test-Path "$n-service") { TulisEnv "$n-service\.env" $LAYANAN[$n] $n } }

# .env layanan lama yang tidak cocok dengan root -> login/koneksi DB akan gagal
foreach ($n in $LAYANAN.Keys) {
  $f = "$n-service\.env"; if (-not (Test-Path $f)) { continue }
  foreach ($v in @("DB_NAME", "DB_USERNAME", "DB_PORT", "DB_PASSWORD", "SECRET_KEY", "MONGO_DB_PASSWORD")) {
    $baris = Get-Content $f | Where-Object { $_ -match "^$v=" } | Select-Object -First 1
    $nilai = ""; if ($baris) { $nilai = $baris -replace "^$v=", "" }
    if ($nilai -ne (Ambil $v)) { Warn "${f}: $v berbeda dengan .env root. Samakan, atau hapus berkas itu lalu jalankan ulang skrip."; break }
  }
}

if (Test-Path "frontend-service\.env") { Warn "frontend-service\.env sudah ada (tidak ditimpa)" }
else {
  $fe = @"
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
"@ -replace "`r`n", "`n"
  TulisUtf8 "frontend-service\.env" ($fe + "`n")
  Ok "frontend-service\.env dibuat"
}

# ---------- 6. dependensi npm, migrasi, data demo ----------
function JalankanNpm($argumen) {
  & npm.cmd @argumen
  if ($LASTEXITCODE -ne 0) { Mati ("npm " + ($argumen -join " ") + " gagal (kode $LASTEXITCODE)") }
}
Judul "Dependensi npm (10-20 menit pada instalasi pertama)"
# npm audit menghubungi registry untuk tiap layanan dan bisa menggantung di jaringan lambat; jalankan terpisah bila perlu
$env:npm_config_audit = "false"; $env:npm_config_fund = "false"
JalankanNpm @("run", "install:all"); Ok "Dependensi terpasang"

Judul "Migrasi database"
JalankanNpm @("run", "db:migrate"); Ok "Migrasi selesai"

if ($TanpaDemo) { Warn "Data demo dilewati (-TanpaDemo)" }
else {
  Judul "Data demo"
  $env:PGPASSWORD = $DB_PASS
  $jml = (& psql -X -h 127.0.0.1 -p $PG_PORT -U $DB_USER -d $DB_NAMA -tAc "SELECT count(*) FROM faskes" 2>$null | Out-String).Trim()
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($jml -and $jml -ne "0") { Ok "Database sudah berisi $jml faskes (data demo dilewati; reset: npm run db:demo:reset -- --ya)" }
  elseif (Tanya "Isi data demo (8 faskes fiktif + akun demo)?") {
    JalankanNpm @("run", "db:demo:seed"); JalankanNpm @("run", "db:demo:master-penunjang")
  }
}

# ---------- 7. alat AI: agen SIMRS Studio (Claude Code, Codex) & Helpdesk (OpenClaw) ----------
if ($TanpaAi) { Warn "Alat AI dilewati (-TanpaAi)" }
else {
  Judul "Alat AI untuk SIMRS Studio"
  foreach ($a in @(@("claude", "@anthropic-ai/claude-code", "Claude Code CLI"), @("codex", "@openai/codex", "Codex CLI"))) {
    if (Ada $a[0]) { Ok "$($a[2]) sudah terpasang ($(VersiAlat $a[0]))" }
    elseif (Tanya "Pasang $($a[2]) ($($a[1])) untuk agen SIMRS Studio?") {
      & npm.cmd install -g --no-audit --no-fund $a[1]
      if ($LASTEXITCODE -eq 0) { Ok "$($a[2]) terpasang" } else { Warn "$($a[2]) gagal dipasang; pasang manual: npm install -g $($a[1])" }
    }
  }
  SegarkanPath
  Write-Host "    Login akun: SIMRS Studio > Pengaturan & Agen > Hubungkan akun Claude / Hubungkan akun ChatGPT"
}
if ($Helpdesk) {
  Judul "OpenClaw (Helpdesk)"
  Warn "Untuk produksi, pasang OpenClaw di VM terpisah dari server SIMRS (deploy\helpdesk\README.md). Di mesin ini hanya untuk uji coba."
  if (Ada "openclaw") { Ok "OpenClaw sudah terpasang ($(VersiAlat 'openclaw'))" }
  elseif (Tanya "Pasang OpenClaw dengan installer resmi (openclaw.ai/install.ps1; menyiapkan Node 24.16+ sendiri)?") {
    # Dijalankan di proses PowerShell terpisah agar installer tidak menghentikan skrip ini.
    & powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://openclaw.ai/install.ps1 | iex"
    if ($LASTEXITCODE -ne 0) { Warn "Pemasangan OpenClaw gagal; lihat https://docs.openclaw.ai/install" }
    SegarkanPath
  }
  Write-Host "    Lanjutkan: deploy\helpdesk\README.md langkah 3-5 (agen terbatas, sinkron panduan, sambungkan setting-service)"
}

# ---------- selesai ----------
Judul "Selesai"
Write-Host "  Jalankan aplikasi:"
Write-Host "    npm run dev          # semua layanan + frontend"
Write-Host "    npm run dev:core     # ringan: auth, datamaster, admisi, frontend"
Write-Host ""
Write-Host "  Buka http://localhost:5520 - login demo: superadmin / Demo@2026"
Write-Host "  Kata sandi DB, Mongo, dan kunci aplikasi tersimpan di .env (jangan di-commit / dibagikan)."
if ($PG_SUPERPASS_BARU) {
  Write-Host ""
  Warn "Sandi superuser PostgreSQL ('postgres') yang dibuat skrip: $PG_SUPERPASS_BARU"
  Warn "Simpan di pengelola sandi Anda; sandi ini TIDAK disimpan di mana pun."
}
if ($Jalankan) { & npm.cmd run dev }
