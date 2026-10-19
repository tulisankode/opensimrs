# =====================================================================================
#  OpenSIMRS - hapus instalasi lokal di Windows (pasangan install.ps1)
#
#  Yang dihapus - HANYA milik OpenSIMRS:
#    1. Proses OpenSIMRS yang masih berjalan (port 5520, 8081-8100) - dengan konfirmasi.
#    2. (Opsional, ditawarkan) cadangan pg_dump + mongodump ke %USERPROFILE%\opensimrs-cadangan-<waktu>\.
#    3. PostgreSQL: database aplikasi (dihapus oleh role pemiliknya) & role aplikasi (opsional, butuh sandi superuser).
#    4. MongoDB: database & akun aplikasi. Redis/Memurai: kunci sesi token-* (BUKAN FLUSHDB).
#    5. Berkas buatan instalasi di folder repo: node_modules, .env, dist, data Studio; worktree SIMRS Studio.
#    6. (-HapusFolder) folder repo ini seluruhnya.  (-AlatAi) Claude Code, Codex & OpenCode CLI global.
#
#  TIDAK dihapus: PostgreSQL/MongoDB/Memurai/Node.js itu sendiri, database/akun lain, OpenClaw, Ollama (beserta model lokalnya).
#
#  Pemakaian (dari folder repo):
#    .\uninstall.cmd [-Simulasi] [-Ya] [-TanpaCadangan] [-HapusFolder] [-AlatAi]
#      -Simulasi       tampilkan apa yang akan dihapus tanpa menghapus apa pun
#      -Ya             tanpa pertanyaan (cadangan tetap dibuat kecuali -TanpaCadangan)
#      -TanpaCadangan  lewati pg_dump/mongodump
#      -HapusFolder    hapus juga folder repo ini
#      -AlatAi         hapus juga Claude Code, Codex & OpenCode CLI (npm uninstall -g)
#  Sandi superuser PostgreSQL untuk menghapus role: variabel lingkungan PG_SUPERPASS, atau ditanyakan.
# =====================================================================================
param(
  [switch]$Simulasi,
  [switch]$Ya,
  [switch]$TanpaCadangan,
  [switch]$HapusFolder,
  [switch]$AlatAi
)

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT

function Judul($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor White }
function Ok($t)    { Write-Host "  [OK] $t" -ForegroundColor Green }
function Warn($t)  { Write-Host "  [!]  $t" -ForegroundColor Yellow }
function Mati($t)  { Write-Progress -Activity "Hapus instalasi OpenSIMRS" -Completed; Write-Host ""; Write-Host "GAGAL: $t" -ForegroundColor Red; exit 1 }
function Tanya($t) {
  if ($Ya) { return $true }
  $j = Read-Host "  ? $t [y/N]"
  return ($j -match '^(y|ya)$')
}
function Ada($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Mayor($v) { if ($v -match '(\d+)') { return [int]$Matches[1] } else { return 0 } }
# Sama dengan install.ps1: PATH dari registry + folder bin PostgreSQL/MongoDB/Memurai/mongosh yang tidak selalu masuk PATH.
function SegarkanPath {
  $m = [Environment]::GetEnvironmentVariable("Path", "Machine"); $u = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$m;$u"
  $tambah = @()
  $pg = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Sort-Object { Mayor $_.Directory.Parent.Name } -Descending | Select-Object -First 1
  if ($pg) { $tambah += $pg.DirectoryName }
  $mg = Get-ChildItem "C:\Program Files\MongoDB\Server\*\bin\mongod.exe" -ErrorAction SilentlyContinue | Sort-Object { [version]($_.Directory.Parent.Name + ".0") } -Descending | Select-Object -First 1
  if ($mg) { $tambah += $mg.DirectoryName }
  foreach ($d in @("C:\Program Files\Memurai", "$env:LOCALAPPDATA\Programs\mongosh", "C:\Program Files\mongosh", "C:\Program Files\MongoDB\Tools\100\bin", "C:\Program Files\nodejs")) {
    if (Test-Path $d) { $tambah += $d }
  }
  if ($tambah.Count -gt 0) { $env:Path = (($tambah -join ";") + ";" + $env:Path) }
}
SegarkanPath
# Aksi: dijalankan, atau hanya ditampilkan pada -Simulasi. Blok mengembalikan $true bila berhasil.
function Aksi($label, [scriptblock]$blok) {
  if ($Simulasi) { Write-Host "  (simulasi) $label" -ForegroundColor DarkGray; return $true }
  Write-Host "  ... $label"
  $hasil = & $blok
  if ($hasil -ne $false) { Ok $label; return $true } else { Warn "$label gagal"; return $false }
}
# Hapus folder TANPA mengikuti junction/symlink (rmdir /s tidak masuk ke junction; Remove-Item -Recurse di PS 5.1 bisa).
function HapusFolder($path) {
  if (-not (Test-Path -LiteralPath $path)) { return $true }
  $item = Get-Item -LiteralPath $path -Force
  if ($item.PSIsContainer) { & cmd /c rmdir /s /q "`"$path`"" 2>$null } else { Remove-Item -LiteralPath $path -Force }
  return -not (Test-Path -LiteralPath $path)
}

# ---------- konfigurasi dari .env (bawaan sama dengan install.ps1) ----------
function BacaEnv($kunci, $bawaan) {
  if (Test-Path ".env") {
    $baris = Get-Content ".env" | Where-Object { $_ -match "^$kunci=" } | Select-Object -Last 1
    if ($baris) { $v = ($baris -replace "^$kunci=", "").Trim().Trim('"'); if ($v) { return $v } }
  }
  return $bawaan
}
$DB_NAMA = BacaEnv "DB_NAME" "opensimrs"; $DB_USER = BacaEnv "DB_USERNAME" "opensimrs"; $DB_PASS = BacaEnv "DB_PASSWORD" ""
$PG_PORT = [int](BacaEnv "DB_PORT" "5432")
$MONGO_USER = BacaEnv "MONGO_DB_USERNAME" "opensimrs"; $MONGO_PASS = BacaEnv "MONGO_DB_PASSWORD" ""; $MONGO_DB = BacaEnv "MONGO_DB_NAME" $DB_NAMA
$REDIS_DB = BacaEnv "REDIS_DATABASE" "0"; $REDIS_PORT = BacaEnv "REDIS_PORT" "6379"; $REDIS_PASS = BacaEnv "REDIS_PASSWORD" ""
if (@("", "postgres", "template0", "template1") -contains $DB_NAMA) { Mati "DB_NAME '$DB_NAMA' bukan database aplikasi OpenSIMRS" }
if (@("", "postgres") -contains $DB_USER) { Mati "DB_USERNAME '$DB_USER' bukan role aplikasi OpenSIMRS" }
if (@("", "admin", "local", "config") -contains $MONGO_DB) { Mati "Database MongoDB '$MONGO_DB' bukan database aplikasi OpenSIMRS" }
if ("$DB_NAMA$DB_USER$MONGO_USER$MONGO_DB" -notmatch '^[A-Za-z0-9_]+$') { Mati "Nama database/akun di .env mengandung karakter tak terduga" }

$PORT_APLIKASI = @(5520) + (8081..8100)
$wt = @()
$daftar = (& git -c "safe.directory=*" worktree list --porcelain 2>$null) | Where-Object { $_ -like "worktree *" } | ForEach-Object { $_.Substring(9) }
if ($daftar) { $wt = @($daftar | Select-Object -Skip 1 | Where-Object { (Resolve-Path $_ -ErrorAction SilentlyContinue).Path -ne $ROOT }) }

$langkah = 4 + [int][bool]$AlatAi + [int][bool]$HapusFolder
$ke = 0
function Langkah($t) {
  $script:ke++
  $p = [int](($script:ke - 1) * 100 / $langkah)
  Write-Progress -Id 0 -Activity "Hapus instalasi OpenSIMRS" -Status "[$($script:ke)/$langkah] $t" -PercentComplete $p
  Judul "[$($script:ke)/$langkah] $t"
}

# ---------- rencana & konfirmasi ----------
Write-Host ""
Write-Host "Hapus instalasi OpenSIMRS  $ROOT" -ForegroundColor White
Write-Host "  Yang akan dihapus:"
Write-Host "    - PostgreSQL (port $PG_PORT): database '$DB_NAMA' (& role '$DB_USER' bila disetujui)"
Write-Host "    - MongoDB: database '$MONGO_DB' & akun '$MONGO_USER'"
Write-Host "    - Redis/Memurai (port $REDIS_PORT, db $REDIS_DB): kunci sesi token-*"
Write-Host "    - Berkas buatan instalasi di repo: node_modules, .env, dist, studio-service\data, worktree SIMRS Studio"
foreach ($w in $wt) { Write-Host "        worktree: $w" }
Write-Host "    - Gateway akses domain (bila ada): kontainer opensimrs-gateway, %USERPROFILE%\.opensimrs\gateway-lokal.conf, frontend-service\.env.local buatan installer"
if ($HapusFolder) { Write-Host "    - FOLDER REPO INI: $ROOT" -ForegroundColor Red }
if ($AlatAi) { Write-Host "    - Claude Code, Codex & OpenCode CLI (npm global)" }
Write-Host "  Tidak dihapus: PostgreSQL/MongoDB/Memurai/Node.js, database & akun lain, OpenClaw, Ollama (beserta model lokalnya)."
if ($Simulasi) { Warn "Mode simulasi: tidak ada yang dihapus." }
elseif (-not $Ya) {
  $j = Read-Host "`n  Ketik HAPUS OPENSIMRS untuk melanjutkan"
  if ($j -ne "HAPUS OPENSIMRS") { Mati "Dibatalkan - tidak ada yang dihapus." }
}

# ---------- 1. proses berjalan ----------
Langkah "Proses OpenSIMRS yang berjalan"
$proses = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $PORT_APLIKASI -contains $_.LocalPort } |
  Select-Object -ExpandProperty OwningProcess -Unique)
if (-not $proses.Count) { Ok "Tidak ada proses di port aplikasi" }
else {
  Write-Host "  PID di port aplikasi: $($proses -join ', ')"
  if ($Simulasi -or (Tanya "Hentikan proses tersebut (npm run dev, layanan, frontend)?")) {
    Aksi "Menghentikan proses OpenSIMRS" { foreach ($id in $proses) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }; $true } | Out-Null
  } else { Warn "Proses tetap berjalan; database mungkin gagal dihapus karena masih dipakai" }
}

# ---------- 2. cadangan ----------
Langkah "Cadangan basis data"
$cadangan = $null
if ($TanpaCadangan) { Warn "Cadangan dilewati (-TanpaCadangan)" }
elseif ($Ya -or $Simulasi -or (Tanya "Cadangkan PostgreSQL & MongoDB dulu (disarankan)?")) {
  $cadangan = Join-Path $env:USERPROFILE ("opensimrs-cadangan-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  if (-not $Simulasi) { New-Item -ItemType Directory -Force $cadangan | Out-Null }
  if (Ada "pg_dump") {
    Aksi "pg_dump $DB_NAMA -> $cadangan\postgres.dump" {
      $env:PGPASSWORD = $DB_PASS
      & pg_dump -Fc -h 127.0.0.1 -p $PG_PORT -U $DB_USER -f (Join-Path $cadangan "postgres.dump") $DB_NAMA
      $k = $LASTEXITCODE; Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue; $k -eq 0 } | Out-Null
  } else { Warn "pg_dump tidak ditemukan; PostgreSQL tidak dicadangkan" }
  if (Ada "mongodump") {
    Aksi "mongodump $MONGO_DB -> $cadangan\mongo.archive" {
      & mongodump --quiet --host 127.0.0.1 -u $MONGO_USER -p $MONGO_PASS --authenticationDatabase admin --db $MONGO_DB "--archive=$(Join-Path $cadangan 'mongo.archive')"
      $LASTEXITCODE -eq 0 } | Out-Null
  } else { Warn "mongodump tidak ditemukan (MongoDB Database Tools); MongoDB tidak dicadangkan" }
  if ((Test-Path ".env") -and -not $Simulasi) { Copy-Item ".env" (Join-Path $cadangan "env-root.txt") }
  Ok "Cadangan: $cadangan"
} else { Warn "Tanpa cadangan" }

# ---------- 3. basis data ----------
Langkah "Basis data OpenSIMRS"
if (Ada "psql") {
  # Database dihapus oleh role aplikasi sendiri (pemiliknya) - tanpa superuser.
  $okDb = Aksi "PostgreSQL: putuskan koneksi & DROP DATABASE $DB_NAMA (sebagai $DB_USER)" {
    $env:PGPASSWORD = $DB_PASS
    & psql -X -q -h 127.0.0.1 -p $PG_PORT -U $DB_USER -d postgres -v ON_ERROR_STOP=1 `
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAMA' AND pid <> pg_backend_pid();" `
      -c "DROP DATABASE IF EXISTS $DB_NAMA;" | Out-Null
    $k = $LASTEXITCODE; Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue; $k -eq 0 }
  if ($Simulasi -or (Tanya "Hapus juga role PostgreSQL '$DB_USER' (butuh sandi superuser 'postgres')?")) {
    $super = $env:PG_SUPERPASS
    if (-not $super -and -not $Simulasi -and -not $Ya) {
      $aman = Read-Host "  Sandi superuser PostgreSQL (user 'postgres')" -AsSecureString
      $super = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($aman))
    }
    if (-not $super -and -not $Simulasi) { Warn "Role '$DB_USER' tidak dihapus: sandi superuser tidak tersedia (isi PG_SUPERPASS)" }
    else { Aksi "PostgreSQL: DROP ROLE $DB_USER$(if (-not $okDb) { ' (dan DROP DATABASE ... WITH (FORCE))' })" {
      $env:PGPASSWORD = $super
      $perintah = @("-X", "-q", "-h", "127.0.0.1", "-p", $PG_PORT, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1")
      if (-not $okDb) { $perintah += @("-c", "DROP DATABASE IF EXISTS $DB_NAMA WITH (FORCE);") }
      & psql @perintah -c "DROP ROLE IF EXISTS $DB_USER;" | Out-Null
      $k = $LASTEXITCODE; Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue; $k -eq 0 } | Out-Null }
  }
} else { Warn "psql tidak ditemukan; PostgreSQL dilewati" }

if (Ada "mongosh") {
  Aksi "MongoDB: dropDatabase $MONGO_DB & dropUser $MONGO_USER" {
    $js = Join-Path $env:TEMP ("opensimrs-hapus-" + [guid]::NewGuid().ToString("N").Substring(0, 8) + ".js")
    [IO.File]::WriteAllText($js, "db.getSiblingDB('$MONGO_DB').dropDatabase(); const a = db.getSiblingDB('admin'); if (a.getUser('$MONGO_USER')) a.dropUser('$MONGO_USER');")
    & mongosh --quiet --host 127.0.0.1 --file $js | Out-Null
    $k = $LASTEXITCODE; Remove-Item $js -ErrorAction SilentlyContinue; $k -eq 0 } | Out-Null
} else { Warn "mongosh tidak ditemukan; MongoDB dilewati (hapus manual database '$MONGO_DB' & akun '$MONGO_USER' bila perlu)" }

$cli = @("memurai-cli", "redis-cli") | Where-Object { Ada $_ } | Select-Object -First 1
if ($cli) {
  Aksi "Redis: hapus kunci sesi token-* (db $REDIS_DB)" {
    $a = @("-h", "127.0.0.1", "-p", $REDIS_PORT, "-n", $REDIS_DB); if ($REDIS_PASS) { $a += @("-a", $REDIS_PASS, "--no-auth-warning") }
    $kunci = @(& $cli @a --scan --pattern "token-*")
    foreach ($k in $kunci) { if ($k) { & $cli @a DEL $k | Out-Null } }
    Write-Host "      $($kunci.Count) kunci"; $true } | Out-Null
} else { Warn "redis-cli/memurai-cli tidak ditemukan; Redis dilewati" }

# ---------- 4. berkas ----------
Langkah "Berkas buatan instalasi"
foreach ($w in $wt) {
  Aksi "Worktree SIMRS Studio $w" { HapusFolder $w } | Out-Null
}
if (-not $Simulasi) { & git -c "safe.directory=*" worktree prune 2>$null }
# Gateway API akses domain (install.ps1 -Domain): kontainer opensimrs-gateway + konfigurasinya
foreach ($c in @("podman", "docker")) {
  if (Ada $c) {
    & $c container inspect opensimrs-gateway 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Aksi "$c rm -f opensimrs-gateway (gateway API)" { & $c rm -f opensimrs-gateway 2>$null | Out-Null; $LASTEXITCODE -eq 0 } | Out-Null }
  }
}
$konfGw = Join-Path $env:USERPROFILE ".opensimrs\gateway-lokal.conf"
if (Test-Path $konfGw) { Aksi "Konfigurasi gateway $konfGw" { Remove-Item $konfGw -Force; $true } | Out-Null }
$target = @()
$target += Get-ChildItem -Path $ROOT -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "node_modules" }
foreach ($d in (Get-ChildItem -Path $ROOT -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @("node_modules", ".git") })) {
  $target += Get-ChildItem -Path $d.FullName -Directory -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @("node_modules", "dist") }
  if ($d.Name -eq "packages") { foreach ($s in (Get-ChildItem $d.FullName -Directory)) { $target += Get-ChildItem $s.FullName -Directory -Force | Where-Object { $_.Name -eq "node_modules" } } }
}
$target += Get-ChildItem -Path $ROOT -Filter ".env" -File -Force -Depth 1 -ErrorAction SilentlyContinue
$target += Get-ChildItem -Path $ROOT -Filter ".env.bak*" -File -Force -Depth 1 -ErrorAction SilentlyContinue
if (Test-Path (Join-Path $ROOT "studio-service\data")) { $target += Get-Item (Join-Path $ROOT "studio-service\data") }
# frontend-service\.env.local hanya bila dibuat installer (-Domain); berkas buatan pengguna dibiarkan
$envLokal = Join-Path $ROOT "frontend-service\.env.local"
if ((Test-Path $envLokal) -and ((Get-Content $envLokal -TotalCount 1) -like "# Dibuat install.sh --domain*")) { $target += Get-Item $envLokal -Force }
$target = @($target | Where-Object { $_ -and $_.FullName.StartsWith($ROOT) } | Sort-Object FullName -Unique)
$i = 0
foreach ($t in $target) {
  $i++; $rel = $t.FullName.Substring($ROOT.Length + 1)
  if ($Simulasi) { Write-Host "  (simulasi) hapus $rel" -ForegroundColor DarkGray; continue }
  Write-Progress -Id 1 -ParentId 0 -Activity "Menghapus berkas buatan instalasi" -Status "$i/$($target.Count) $rel" -PercentComplete ([int]($i * 100 / [Math]::Max($target.Count, 1)))
  if (-not (HapusFolder $t.FullName)) { Warn "Gagal menghapus $rel (masih dipakai proses lain?)" }
}
Write-Progress -Id 1 -Activity "Menghapus berkas buatan instalasi" -Completed
Ok "$($target.Count) berkas/folder buatan instalasi $(if ($Simulasi) { 'akan dihapus' } else { 'dihapus' })"

# ---------- opsional ----------
if ($AlatAi) {
  Langkah "Claude Code, Codex & OpenCode CLI"
  foreach ($p in @("@anthropic-ai/claude-code", "@openai/codex", "@opencode/cli")) {
    Aksi "npm uninstall -g $p" { & npm.cmd uninstall -g $p | Out-Null; $LASTEXITCODE -eq 0 } | Out-Null
  }
}
if ($HapusFolder) {
  Langkah "Folder repo"
  if (-not ((Test-Path (Join-Path $ROOT "install.ps1")) -and (Test-Path (Join-Path $ROOT "uninstall.ps1")))) { Mati "Bukan folder repo OpenSIMRS: $ROOT" }
  if ($ROOT -eq $env:USERPROFILE -or $ROOT.Length -le 3) { Mati "Folder repo tidak aman untuk dihapus: $ROOT" }
  if ($Simulasi) { Write-Host "  (simulasi) hapus folder $ROOT" -ForegroundColor DarkGray }
  else { Set-Location (Split-Path $ROOT -Parent); if (HapusFolder $ROOT) { Ok "Folder $ROOT dihapus" } else { Warn "Folder $ROOT belum terhapus seluruhnya (berkas sedang dipakai?)" } }
}

Write-Progress -Id 0 -Activity "Hapus instalasi OpenSIMRS" -Completed
Write-Host ""
if ($Simulasi) { Write-Host "Simulasi selesai - tidak ada yang dihapus." -ForegroundColor Green }
else {
  Write-Host "OpenSIMRS dihapus." -ForegroundColor Green
  if ($cadangan) {
    Write-Host "  Cadangan ada di: $cadangan"
    Write-Host "    Pulihkan PostgreSQL: createdb $DB_NAMA ; pg_restore -d $DB_NAMA $cadangan\postgres.dump"
    Write-Host "    Pulihkan MongoDB:    mongorestore --archive=$cadangan\mongo.archive"
  }
}
