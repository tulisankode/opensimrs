# Petunjuk Instalasi OpenSIMRS

> Panduan memasang dan menjalankan OpenSIMRS, untuk **IT rumah sakit/faskes** yang akan mengimplementasikan dan **mahasiswa/pengembang** yang ingin mencoba atau berkontribusi.
>
> Dokumentasi lengkap: https://docs.opensimrs.com
>
> Dokumen terkait: [README](../README.md) · [Spesifikasi Hardware](./SPESIFIKASI-HARDWARE.md) · [Lingkungan Dev/Staging/Production](./LINGKUNGAN.md) · [Manajemen Modul](./MANAJEMEN-MODUL.md) · [Konteks Pengembangan](./KONTEKS-PENGEMBANGAN.md) · [Roadmap](./ROADMAP.md) · [Panduan Kontribusi](../CONTRIBUTING.md) · [Panduan Implementator](./kontributor/IMPLEMENTATOR.md)

> **Tentang nama teknis.** Semua identifier teknis memakai nama `opensimrs`: paket SDK `@opensimrs/*` (folder `packages/`), database PostgreSQL & MongoDB bawaan `opensimrs`, image Docker `opensimrs/*`, kontainer `opensimrs-db`, `opensimrs-redis`, `opensimrs-frontend`, `opensimrs-gateway`, dan jaringan Docker `opensimrs`. Tulis nama-nama itu persis seperti di panduan ini.

---

## Daftar isi

1. [Pilih jalur Anda](#1-pilih-jalur-anda)
2. [Persyaratan](#2-persyaratan)
3. [Gambaran sistem & port](#3-gambaran-sistem--port)
4. [Jalur A — Coba cepat dengan data demo (lokal)](#4-jalur-a--coba-cepat-dengan-data-demo-lokal)
5. [Konfigurasi `.env` secara rinci](#5-konfigurasi-env-secara-rinci)
6. [Data demo & akun demo](#6-data-demo--akun-demo)
7. [Jalur B — Implementasi di faskes](#7-jalur-b--implementasi-di-faskes)
8. [Menjalankan dengan Docker](#8-menjalankan-dengan-docker)
9. [Menjalankan tanpa Docker (instal native)](#9-menjalankan-tanpa-docker-instal-native)
10. [Pemeliharaan: pembaruan & cadangan](#10-pemeliharaan-pembaruan--cadangan)
11. [Pemecahan masalah](#11-pemecahan-masalah)
12. [Daftar periksa](#12-daftar-periksa)

---

## 1. Pilih jalur Anda

**Tujuan pemasangan:**

| Jalur | Untuk siapa | Hasil |
|---|---|---|
| **A. Coba cepat** ([bagian 4](#4-jalur-a--coba-cepat-dengan-data-demo-lokal)) | Mahasiswa, pengembang, IT yang ingin mengevaluasi | OpenSIMRS berjalan di laptop dengan 8 faskes fiktif (satu per segmen) dan akun demo |
| **B. Implementasi di faskes** ([bagian 7](#7-jalur-b--implementasi-di-faskes)) | IT rumah sakit/klinik/puskesmas | OpenSIMRS berisi data faskes Anda sendiri, tanpa data demo, siap diintegrasikan dengan BPJS, SATUSEHAT, dan LIS |

Sangat disarankan menyelesaikan **jalur A dulu** (di laptop atau server uji) sebelum jalur B, agar Anda mengenal alur aplikasi.

**Cara menjalankan** (keduanya setara dan didukung; pilih sesuai kebiasaan tim IT Anda):

| Cara | Pengembangan lokal | Server faskes |
|---|---|---|
| **(a) Dengan Docker** ([bagian 8](#8-menjalankan-dengan-docker)) | `npm run infra:up` (PostgreSQL, MongoDB, Redis di Docker) + `npm run dev`; atau semuanya di Docker dengan `npm run stack:up` | `deploy/server/deploy.sh` + override `deploy/server/docker-compose.server.yml` |
| **(b) Tanpa Docker / native** ([bagian 9](#9-menjalankan-tanpa-docker-instal-native)) | PostgreSQL 16, MongoDB 7, Redis 7, Node.js 22 dipasang langsung + `npm run dev` | Proses manager (pm2 atau unit systemd per layanan) + nginx sebagai reverse proxy |

Perbedaan lingkungan development, staging, dan production (termasuk aturan `.env`) dijelaskan di [Lingkungan](./LINGKUNGAN.md).

---

## 2. Persyaratan

### Perangkat keras

Ringkasan untuk pengembangan; kebutuhan server per segmen faskes (praktik mandiri sampai RS kelas A) ada di [Spesifikasi Hardware](./SPESIFIKASI-HARDWARE.md).

| Komponen | Laptop pengembangan |
|---|---|
| CPU | 4 core |
| RAM | 16 GB (8 GB cukup bila hanya menjalankan `npm run dev:core`) |
| Penyimpanan | SSD, ruang kosong 30 GB |

Membangun semua image Docker sekaligus membutuhkan ruang disk besar (±10 GB lapisan build); sisakan ruang kosong minimal 15 GB saat build.

### Perangkat lunak

| Perangkat lunak | Versi | Keterangan |
|---|---|---|
| Git | ≥ 2.30 | Untuk mengunduh kode |
| Node.js | **22 LTS** | Dipakai CI. Image Docker sebagian layanan memakai Node 25. |
| npm | bawaan Node.js | |
| Docker Engine + Docker Compose v2 | Docker ≥ 24, Compose ≥ 2.20 | Untuk cara (a). Tidak diperlukan pada cara (b) |
| PostgreSQL 16, MongoDB 7, Redis 7 | | Hanya untuk cara (b); pada cara (a) sudah disediakan Docker |
| Sistem operasi | Ubuntu Server LTS / Debian disarankan untuk server; Windows 10/11 atau macOS untuk pengembangan | Di Windows, pakai Docker Desktop + Git Bash atau PowerShell |

---

## 3. Gambaran sistem & port

OpenSIMRS terdiri dari satu frontend (Vue 3) dan 20 layanan backend (Node.js + Express): 19 layanan aplikasi ditambah SIMRS Studio (opsional) dalam satu repo (**monorepo**, tanpa git submodule). Semua layanan memakai **satu database PostgreSQL bersama**, MongoDB untuk isi rekam medis, dan Redis untuk cache token/izin. Tiga paket SDK bersama (`@opensimrs/model-sdk`, `@opensimrs/authorization-sdk`, `@opensimrs/permission-sdk`) ada di folder `packages/`.

| Port | Layanan | Folder | Awalan API |
|---|---|---|---|
| 5520 | Frontend (aplikasi web) | `frontend-service` | – |
| 8081 | Admisi (pasien & registrasi) | `admisi-service` | `/api/v3/admisi` |
| 8082 | Antrian (jadwal, layar TV, APM) | `antrian-service` | `/api/v3/antrian` |
| 8083 | Auth (login, JWT, izin) | `auth-service` | `/api/v3/auth` |
| 8084 | Farmasi | `farmasi-service` | `/api/v3/farmasi` |
| 8085 | IGD | `igd-service` | `/api/v3/pelayanan` |
| 8086 | Inventory (gudang) | `inventory-service` | `/api/v3/inventory` |
| 8087 | Laboratorium + bridging LIS | `lab-service` | `/api/v3/lab`, `/adam-lis` (titik masuk hasil dari LIS) |
| 8088 | Laporan & dashboard | `laporan-service` | `/api/v3/laporan` |
| 8089 | Pembayaran (kasir, tagihan) | `payment-service` | `/api/v3/payment` |
| 8091 | Rawat Inap | `rawat-inap-service` | `/api/v3/ranap` |
| 8092 | Rawat Jalan | `rawat-jalan-service` | `/api/v3/rajal` |
| 8093 | Rekam Medis (RME) | `rekamedis-service` | `/api/v3/rekam-medis` |
| 8094 | Setting (profil faskes, Manajemen Modul, integrasi) | `setting-service` | `/api/v3/setting` |
| 8095 | Stok Farmasi | `stok-farmasi-service` | `/api/v3/stok` |
| 8096 | Datamaster | `datamaster-service` | `/api/v3/datamaster` |
| 8097 | Integrasi SATUSEHAT | `satusehat-service` | `/api/v3/satusehat` |
| 8098 | Integrasi BPJS (PCare & VClaim) | `bpjs-service` | `/api/v3/bpjs` |
| 8099 | Penunjang (Fisioterapi, Radiologi + bridging PACS/RIS, MCU, Patologi Anatomi + bridging LIS PA, Mikrobiologi, Bank Darah RS + bridging UTD, CSSD) | `penunjang-service` | `/api/v3/penunjang`, `/adam-pacs`, `/adam-pa-lis` & `/adam-utd` (titik masuk hasil dari PACS/RIS, sistem PA & UTD) |
| 8100 | Program Puskesmas (KIA/KB, imunisasi, MTBS, sasaran, UKM, laporan dinkes) | `program-puskesmas-service` | `/api/v3/program-puskesmas` |
| 8090 | SIMRS Studio — mode pengembang berbasis AI (opsional; dijalankan langsung di mesin pengembang yang sudah login Claude Code, aktif bila `STUDIO_PENGEMBANG=aktif`) | `studio-service` | `/api/v3/studio` |
| 5432 | PostgreSQL | – | – |
| 27017 | MongoDB | – | – |
| 6379 | Redis | – | – |
| 8080 | Gateway nginx (deploy server, [bagian 8.3](#83-server-dengan-deploysh)) | `deploy/server/gateway.nginx.conf` | semua `/api/v3/*` |
| 2312 | LIS tiruan untuk pengujian (opsional) | `scripts/lis-tiruan.mjs` | – |
| 2412 | PACS/RIS tiruan untuk pengujian (opsional) | `scripts/pacs-tiruan.mjs` | – |
| 2313 | Sistem PA tiruan untuk pengujian (opsional) | `scripts/lis-pa-tiruan.mjs` | – |
| 2413 | UTD tiruan untuk pengujian (opsional) | `scripts/utd-tiruan.mjs` | – |

Port 8090 dipakai SIMRS Studio. Layanan ini tidak ada di `docker-compose.yml` karena dijalankan langsung di mesin pengembang (`npm run dev` / `npm run dev:studio`); lihat [SIMRS Studio](./SIMRS-STUDIO.md).

---

## 4. Jalur A — Coba cepat dengan data demo (lokal)

Ringkasan perintah (penjelasan tiap langkah di bawahnya):

```bash
git clone https://github.com/tulisankode/opensimrs.git
cd opensimrs
cp .env.example .env                       # lalu isi (langkah 2)
npm run infra:up                           # PostgreSQL, MongoDB, Redis di Docker (langkah 3)
npm run install:all                        # dependensi semua layanan + frontend (langkah 4)
#   buat .env tiap layanan & frontend      (langkah 5)
npm run db:migrate                         # (langkah 6)
npm run db:demo:seed                       # (langkah 7)
npm run db:demo:master-penunjang           # opsional
npm run dev                                # (langkah 8) semua layanan + frontend
npm run db:demo:transaksi                  # opsional, setelah semua layanan berjalan
```

### Langkah 1 — Unduh kode

```bash
git clone https://github.com/tulisankode/opensimrs.git
cd opensimrs
```

Repo ini monorepo biasa; **tidak perlu** `--recurse-submodules`.

### Langkah 2 — Berkas `.env` di root repo

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Isi minimal untuk pengembangan lokal (ganti kata sandi sesuka Anda, **jangan** memakai nilai ini di server sungguhan):

```dotenv
# PostgreSQL — dipakai docker compose, migrasi (npm run db:migrate), dan skrip data demo
DB_DIALECT=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=opensimrs
DB_USERNAME=opensimrs
DB_PASSWORD=ganti-sandi-db

# MongoDB — akun root dibuat dari nilai ini saat kontainer pertama kali dibuat
MONGO_INITDB_DATABASE=opensimrs
MONGO_DB_NAME=opensimrs
MONGO_DB_HOST=127.0.0.1
MONGO_DB_PORT=27017
MONGO_DB_AUTH_SOURCE=admin
MONGO_DB_USERNAME=opensimrs
MONGO_DB_PASSWORD=ganti-sandi-mongo

# Redis (lokal: tanpa sandi)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DATABASE=0
REDIS_USERNAME=
REDIS_PASSWORD=

# Kunci JWT HS256 — SAMA di semua layanan (lihat bagian 5.2)
SECRET_KEY=isi-dengan-hasil-openssl-rand-hex-32

# Kata sandi akun demo (bawaan Demo@2026 bila dikosongkan)
DEMO_PASSWORD=
```

Nama database `opensimrs` adalah nama bawaan di `.env.example`; Anda boleh memakai nama lain asalkan konsisten di semua `.env`.

Buat `SECRET_KEY` acak:

```bash
openssl rand -hex 32
# atau tanpa openssl:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Langkah 3 — Jalankan infrastruktur (PostgreSQL, MongoDB, Redis)

**Dengan Docker (cara a):**

```bash
npm run infra:up              # = docker compose up -d db mongodb redis
docker compose ps
```

- `npm run infra:up` hanya menjalankan **infrastruktur**; `npm run infra:down` menghentikannya. Untuk membangun dan menjalankan seluruh aplikasi di Docker, lihat [bagian 8.2](#82-semua-di-docker-satu-mesin).
- Saat volume masih kosong, PostgreSQL memuat `schema.sql` (±11 MB: struktur tabel + data referensi nasional, tanpa data faskes/pasien/pengguna). Proses ini butuh **1–3 menit**; tunggu sampai `docker logs opensimrs-db` menampilkan `database system is ready to accept connections`. Tidak ada role database khusus yang perlu dibuat.
- MongoDB memakai akun root dari `MONGO_DB_USERNAME`/`MONGO_DB_PASSWORD` (`authSource=admin`); `mongo-init.js` hanya menyiapkan database aplikasi dan tidak membuat akun lain.
- Bila MongoDB gagal start di Docker Desktop terbaru, ganti `image: mongo:latest` menjadi `mongo:7.0` (masalah kompatibilitas kernel VM yang sudah dikenal; override server sudah memakai 7.0).

**Tanpa Docker (cara b):** pasang dan siapkan PostgreSQL, MongoDB, dan Redis sesuai [bagian 9.1–9.4](#9-menjalankan-tanpa-docker-instal-native), termasuk memuat `schema.sql`, lalu lanjutkan ke langkah 4.

### Langkah 4 — Pasang dependensi

```bash
npm run install:all
```

Perintah ini menjalankan `npm install` di root, di setiap layanan, dan di `frontend-service`. Prosesnya bisa 10–20 menit pada instalasi pertama.

> **SDK lokal.** Paket `@opensimrs/model-sdk`, `@opensimrs/authorization-sdk`, dan `@opensimrs/permission-sdk` ada di folder `packages/` dan dipasang ke layanan sebagai **salinan** (`"@opensimrs/<sdk>": "file:../packages/<sdk>"` + `install-links=true` di `.npmrc` tiap layanan), sehingga sequelize/mongoose tetap satu instans per layanan. Bila Anda mengubah kode di `packages/`, jalankan `npm run sdk:refresh` (atau `npm run sdk:refresh -- lab-service` untuk layanan tertentu) agar perubahan terlihat.

### Langkah 5 — `.env` tiap layanan dan frontend

Saat dijalankan dengan `npm run dev`, **setiap layanan membaca berkas `.env` di foldernya sendiri** (mis. `auth-service/.env`). Cara termudah: buat satu berkas bersama, salin ke setiap layanan, lalu tambahkan port masing-masing. Rincian dan skrip siap salin ada di [bagian 5.1](#51-env-layanan-backend).

Frontend membaca `frontend-service/.env`; isinya ada di [bagian 5.3](#53-env-frontend).

### Langkah 6 — Migrasi database

```bash
npm run db:migrate
npm run db:migrate:status    # opsional: melihat migrasi yang sudah jalan
```

Migrasi (`database/migrations/*.cjs`) menambah tabel/kolom baru dan menyinkronkan katalog Manajemen Modul. Migrasi aman dijalankan berulang (idempoten).

### Langkah 7 — Isi data demo

```bash
npm run db:demo:seed                   # 8 faskes fiktif + akun demo
npm run db:demo:master-penunjang       # opsional: lengkapi datamaster lab/radiologi/fisio/MCU/PA/Mikro
```

- `schema.sql` hanya berisi struktur dan data referensi nasional (wilayah, ICD-10, ICD-9-CM, SNOMED, LOINC, odontogram), jadi pada database baru `db:demo:seed` bisa langsung dijalankan.
- `db:demo:seed` mencetak daftar akun di akhir prosesnya. Penjelasan akun ada di [bagian 6](#6-data-demo--akun-demo).
- `db:demo:master-penunjang` aman dijalankan berulang. Opsi: `-- --faskes KUM,RSA`, `-- --modul laboratorium`, `-- --kering` (uji coba tanpa menyimpan).
- Untuk mengulang dari awal, `npm run db:demo:reset -- --ya` **menghapus seluruh data faskes dan transaksi** (PostgreSQL dan MongoDB) tetapi mempertahankan data referensi nasional dan katalog modul; lalu jalankan `db:demo:seed` lagi. Flag `--ya` wajib sebagai konfirmasi. Skrip ini membaca koneksi MongoDB dari `rekamedis-service/.env`, jadi langkah 5 harus sudah selesai.

### Langkah 8 — Jalankan aplikasi

```bash
npm run dev
```

`npm run dev` menjalankan **semua** 20 layanan backend (termasuk penunjang, Program Puskesmas, SATUSEHAT, BPJS, dan SIMRS Studio) beserta frontend dalam satu terminal. SIMRS Studio tetap menolak semua permintaan sampai `STUDIO_PENGEMBANG=aktif` diisi di `studio-service/.env` ([SIMRS Studio](./SIMRS-STUDIO.md)).

Pilihan lain:

| Perintah | Isi |
|---|---|
| `npm run dev:core` | Ringan untuk RAM terbatas: auth, datamaster, admisi, dan frontend. Cukup untuk login dan mencoba pendaftaran; modul lain tidak berfungsi. |
| `npm run dev:local` | `infra:up` lalu `dev:core` sekaligus. |
| `npm run dev:<layanan>` | Satu layanan saja, mis. `dev:auth`, `dev:lab`, `dev:penunjang`, `dev:satusehat`, `dev:bpjs`, `dev:frontend`. |

### Langkah 9 — Buka aplikasi

Buka **http://localhost:5520** lalu login dengan `superadmin` / `Demo@2026` (atau nilai `DEMO_PASSWORD` Anda).

Uji login lewat API:

```bash
curl -X POST http://localhost:8083/api/v3/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "superadmin", "password": "Demo@2026"}'
```

### Langkah 10 (opsional) — Transaksi demo

Setelah semua layanan berjalan:

```bash
npm run db:demo:transaksi                                # bawaan: faskes praktik mandiri (PMD)
npm run db:demo:transaksi -- --faskes PMD --bersihkan    # menghapus transaksi yang dibuat skrip
```

Skrip ini menjalankan alur API sungguhan: pengadaan obat, ±30 pasien fiktif, ±60 kunjungan rawat jalan 30 hari terakhir (pendaftaran → periksa → resep → farmasi → kasir), dan penjualan obat bebas. Opsi lain: `--hari 30`, `--benih <angka>`.

Untuk mencoba Virtual Office dan Command Center dalam kondisi sangat ramai (development/staging saja), `db:demo:ramai` mengisi ratusan transaksi fiktif **hari ini** langsung ke PostgreSQL untuk satu faskes demo (bawaan RSA) di semua unit: antrean admisi, poli, IGD, rawat inap dan bed, lab, radiologi, farmasi, serta kasir. Skrip ini tidak memerlukan layanan backend dan ditolak bila `NODE_ENV`/`LINGKUNGAN` = production.

```bash
npm run db:demo:ramai                                    # isi awal (bawaan --faskes RSA --intensitas sangat-ramai)
npm run db:demo:ramai -- --hidup --interval 10           # terus memajukan status & menambah kedatangan; Ctrl+C untuk berhenti
npm run db:demo:ramai -- --bersihkan                     # hapus semua baris yang dibuat skrip ini
```

---

## 5. Konfigurasi `.env` secara rinci

> **Jangan pernah meng-commit berkas `.env`** (sudah ada di `.gitignore`). Berkas ini berisi kata sandi dan kunci. Aturan `.env` per lingkungan (development, staging, production) ada di [Lingkungan](./LINGKUNGAN.md).

### 5.1 `.env` layanan backend

Variabel yang dipakai bersama:

| Variabel | Fungsi |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DIALECT` | Koneksi PostgreSQL bersama |
| `MONGO_DB_HOST`, `MONGO_DB_PORT`, `MONGO_DB_NAME`, `MONGO_DB_USERNAME`, `MONGO_DB_PASSWORD`, `MONGO_DB_AUTH_SOURCE` | MongoDB (rekam medis, SATUSEHAT, BPJS, laporan) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_DATABASE`, `REDIS_USERNAME`, `REDIS_PASSWORD` | Redis (cache token & izin); username/sandi opsional |
| `SECRET_KEY` | Kunci JWT HS256, **wajib sama di semua layanan** |
| `API_BASE=api`, `API_VERSION=v3` | Awalan rute API |
| `SYNC_DB=false` | Skema dikelola migrasi; jangan biarkan ORM mengubah tabel |
| `APPLICATION_PORT`, `APP_PORT`, `PORT`, `SERVER_PORT` | Port layanan. Nama variabelnya berbeda antar layanan, jadi isi **keempatnya** dengan nilai yang sama |
| `APPLICATION_MODULE` | Segmen terakhir awalan API untuk auth (`auth`) dan laporan (`laporan`) |
| URL antar-layanan | Lihat contoh di bawah |
| Kunci API internal: `API_KEY_SECRET`, `API_KEY_CHECK_NORM`, `ADMISI_SECRET_KEY`, `ANTRIAN_KEY_SECRET`, `API_KEY_ANTRIAN` | Kunci antar-layanan/aplikasi mobile. Isi dengan nilai acak (`openssl rand -hex 32`) dan samakan antara layanan pemanggil dan penerima |

**Skrip siap salin.** Buat berkas `.env.layanan` di root (berisi rahasia: jangan di-commit, hapus setelah dipakai):

```dotenv
DB_DIALECT=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=opensimrs
DB_USERNAME=opensimrs
DB_PASSWORD=ganti-sandi-db
DB_POOL={"acquire": 30000, "max": 10, "min": 0, "idle": 10000}
MONGO_DB_HOST=127.0.0.1
MONGO_DB_PORT=27017
MONGO_DB_NAME=opensimrs
MONGO_DB_AUTH_SOURCE=admin
MONGO_DB_USERNAME=opensimrs
MONGO_DB_PASSWORD=ganti-sandi-mongo
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DATABASE=0
REDIS_USERNAME=
REDIS_PASSWORD=
SECRET_KEY=SAMA-DENGAN-ROOT-ENV
API_BASE=api
API_VERSION=v3
APPLICATION_HOST=0.0.0.0
APP_HOST=0.0.0.0
SYNC_DB=false
APPLICATION_TIMEZONE=Asia/Jakarta
# Kunci internal antar-layanan (isi acak, samakan di semua layanan)
API_KEY_SECRET=isi-acak-1
API_KEY_CHECK_NORM=isi-acak-2
ADMISI_SECRET_KEY=isi-acak-3
ANTRIAN_KEY_SECRET=isi-acak-4
API_KEY_ANTRIAN=isi-acak-4
# Alamat antar-layanan (lokal)
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
# Integrasi (mock = respons tiruan; ganti ke "nyata" saat kredensial siap)
SATUSEHAT_MODE=mock
SATUSEHAT_LINGKUNGAN=sandbox
BPJS_MODE=mock
BPJS_LINGKUNGAN=development
LIS_MODE=nyata
```

Lalu salin ke setiap layanan dan tambahkan port-nya.

**Git Bash / Linux / macOS:**

```bash
for pasangan in admisi:8081 antrian:8082 auth:8083 farmasi:8084 igd:8085 inventory:8086 lab:8087 \
  laporan:8088 payment:8089 rawat-inap:8091 rawat-jalan:8092 rekamedis:8093 setting:8094 \
  stok-farmasi:8095 datamaster:8096 satusehat:8097 bpjs:8098 penunjang:8099 studio:8090 program-puskesmas:8100; do
  nama=${pasangan%%:*}; port=${pasangan##*:}
  { cat .env.layanan
    echo "APPLICATION_PORT=$port"; echo "APP_PORT=$port"; echo "PORT=$port"; echo "SERVER_PORT=$port"
    echo "APPLICATION_MODULE=$nama"
  } > "$nama-service/.env"
done
```

**Windows PowerShell:**

```powershell
$layanan = @{ admisi=8081; antrian=8082; auth=8083; farmasi=8084; igd=8085; inventory=8086; lab=8087;
  laporan=8088; payment=8089; 'rawat-inap'=8091; 'rawat-jalan'=8092; rekamedis=8093; setting=8094;
  'stok-farmasi'=8095; datamaster=8096; satusehat=8097; bpjs=8098; penunjang=8099; studio=8090; 'program-puskesmas'=8100 }
foreach ($n in $layanan.Keys) {
  $p = $layanan[$n]
  $isi = (Get-Content .env.layanan -Raw) + "APPLICATION_PORT=$p`nAPP_PORT=$p`nPORT=$p`nSERVER_PORT=$p`nAPPLICATION_MODULE=$n`n"
  Set-Content -Path "$n-service/.env" -Value $isi -Encoding utf8
}
```

Setiap layanan juga punya `.env.example` di foldernya (tanpa nilai rahasia, nama database `opensimrs`). Bila port di berkas itu berbeda dari tabel di bagian 3, **jadikan tabel di bagian 3 sebagai acuan**. Layanan dengan dokumentasi variabel paling lengkap: `satusehat-service/.env.example`, `bpjs-service/.env.example`, `penunjang-service/.env.example`, dan `lab-service/.env.example` (variabel `LIS_*`).

### 5.2 `SECRET_KEY` & JWT HS256

- Token login (JWT) dibuat oleh `auth-service` dan diverifikasi oleh setiap layanan lain memakai `@opensimrs/authorization-sdk` (kode di `packages/authorization-sdk`).
- Algoritmanya **HS256**: satu kunci rahasia `SECRET_KEY` untuk membuat dan memeriksa token. `SECRET_KEY` **harus sama persis** di `auth-service` dan semua layanan lain. Bila berbeda, layanan menolak token dan pengguna seperti "ter-logout" saat membuka modul.
- Variabel `PRIVATE_KEY`/`PUBLIC_KEY` **tidak dipakai lagi**; boleh dihapus atau dibiarkan kosong.
- Dukungan HS256 sudah menjadi bagian kode SDK di `packages/`, jadi tidak ada langkah tambahan setelah `npm install`. Bila Anda mengubah kode SDK, jalankan `npm run sdk:refresh`.

### 5.3 `.env` frontend

Buat `frontend-service/.env`:

```dotenv
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
VITE_BASE_PROGRAM_PUSKESMAS=http://localhost:8100/api/v3/program-puskesmas
VITE_BASE_STUDIO=http://localhost:8090/api/v3/studio
```

- Nilai `VITE_*` **dibakar saat build**. Setelah mengubahnya, mulai ulang frontend atau build ulang image.
- `VITE_KEEP_API_HOST=true` dipakai bila semua API berada di satu domain/gateway (deploy server atau akses lewat domain). Tanpa variabel ini, frontend mengganti host alamat API dengan host halaman yang sedang dibuka dan mempertahankan port layanan (`src/utils/apiHandler.ts`). Untuk lokal biarkan kosong.
- `VITE_BASE_STUDIO` bila kosong memakai `http://localhost:8090/api/v3/studio`.
- `VITE_SHOW_STUB_MENU=true` (opsional) menampilkan menu modul yang belum selesai dibangun; bawaan tersembunyi.
- `ALLOWED_HOSTS` (bukan `VITE_*`): daftar host tambahan, dipisah koma, yang boleh membuka server Vite (dev/preview), mis. `ALLOWED_HOSTS=simrs.contoh.id,api-simrs.contoh.id`. `localhost` dan `127.0.0.1` selalu diizinkan. `vite.config.ts` membacanya dari environment proses atau dari berkas `.env*` di `frontend-service/` (mis. `.env.local` yang ditulis `install.sh --domain`). Di deploy server, nilainya diambil dari `FRONTEND_ALLOWED_HOSTS`.

### 5.4 Konfigurasi integrasi per faskes

Kredensial **SATUSEHAT** (Client ID/Secret, Organization ID), **BPJS PCare/VClaim** (cons-id, secret, user key, dst.), dan **LIS** (URL, API key, kode RS/lab) **tidak** ditaruh di `.env`. Semuanya diisi per faskes di aplikasi: **Setting › Konfigurasi Integrasi**. Rahasia BPJS dan LIS disimpan terenkripsi di database dengan kunci `BPJS_KUNCI_RAHASIA` dan `LIS_KUNCI_RAHASIA` (bila kosong, memakai `SECRET_KEY`). **Jangan mengganti kunci enkripsi atau `SECRET_KEY` setelah data integrasi tersimpan**, karena data lama tidak bisa dibaca lagi.

---

## 6. Data demo & akun demo

`npm run db:demo:seed` membuat **8 faskes fiktif**, satu per segmen, beserta lokasi/poli/kamar, penjamin, pegawai, jadwal dokter, peran & akun, tarif, obat dan stok awal, layar antrian, serta datamaster penunjang.

| Kode faskes | Awalan akun | Segmen |
|---|---|---|
| PMD | `pm` | Dokter praktik mandiri |
| KPS | `kp` | Klinik pratama |
| KUM | `ku` | Klinik utama |
| PKM | `pkm` | Puskesmas |
| RSD | `rsd` | RS kelas D |
| RSC | `rsc` | RS kelas C |
| RSB | `rsb` | RS kelas B |
| RSA | `rsa` | RS kelas A |

### Akun demo

- **Kata sandi semua akun:** nilai `DEMO_PASSWORD` di `.env` root, bawaan **`Demo@2026`**.
- **`superadmin`**: peran `super admin`, bisa berpindah faskes dan satu-satunya yang boleh mengubah Manajemen Modul.
- **Dokter:** `<awalan>.dr.<nama>` (dokter gigi: `<awalan>.drg.<nama>`), mis. `pm.dr.andi`.
- **Staf:** `<awalan>.<peran>` dengan peran `perawat`, `apoteker`, `lab`, `pendaftaran`, `kasir`, `gudang`, `admin`, mis. `rsd.kasir`.
- **Staf penunjang** (hanya bila modulnya aktif di segmen): `<awalan>.fisioterapis`, `<awalan>.radiografer`, `<awalan>.mcu`.
- **Praktik mandiri** berbeda: dokter pemilik (`pm.dr.andi`, akses penuh) dibantu `pm.asisten`.
- Email akun demo memakai domain fiktif `@demo.opensimrs.local`.
- Daftar lengkap dicetak di akhir `db:demo:seed`. Semua nama orang dan faskes demo fiktif.

> Data demo **hanya untuk lingkungan development dan staging** (lihat [Lingkungan](./LINGKUNGAN.md)). Jangan menjalankan `db:demo:seed` atau `db:demo:reset` di production: `db:demo:reset` menghapus semua data faskes dan pasien.

---

## 7. Jalur B — Implementasi di faskes

Jalur ini untuk server yang akan dipakai melayani pasien sungguhan. Panduan peran implementator (asesmen, pelatihan, pendampingan, kewajiban privasi) ada di [Panduan Implementator](./kontributor/IMPLEMENTATOR.md).

> **Status proyek:** OpenSIMRS masih berstatus **alfa** (lihat [CHANGELOG](../CHANGELOG.md)). Uji menyeluruh di lingkungan uji dan jalankan paralel dengan sistem lama sebelum dipakai penuh.

### 7.1 Persiapan

1. **Server:** sesuai [Spesifikasi Hardware](./SPESIFIKASI-HARDWARE.md) untuk segmen faskes Anda; Linux, firewall aktif, hanya port 80/443 (dan SSH) yang terbuka ke jaringan. Port database (5432, 27017, 6379) **jangan** dibuka ke luar.
2. **HTTPS wajib** (sertifikat Let's Encrypt atau CA lain) karena aplikasi memuat data kesehatan.
3. **Akses internet keluar** ke API BPJS dan SATUSEHAT. Keduanya hanya menerima koneksi dari **IP Indonesia**.
4. **Rahasia baru**: kata sandi database, `SECRET_KEY`, dan kunci API internal dibuat acak khusus untuk server ini (lihat [Lingkungan](./LINGKUNGAN.md)).
5. Pasang layanan dengan Docker ([bagian 8.3](#83-server-dengan-deploysh)) atau tanpa Docker ([bagian 9.7](#97-produksi-tanpa-docker-pm2systemd--nginx)).

### 7.2 Database awal

`schema.sql` hanya berisi struktur tabel dan data referensi nasional (wilayah, ICD-10, ICD-9-CM, SNOMED, LOINC, odontogram), **tanpa** data faskes, pasien, atau pengguna. Setelah `schema.sql` dimuat, jalankan `npm run db:migrate` untuk menambah tabel terbaru dan katalog modul. Tidak ada contoh data yang perlu dibersihkan.

Bila server uji pernah diisi data demo dan ingin dikosongkan sebelum dipakai, jalankan `npm run db:demo:reset -- --ya` (mempertahankan data referensi dan katalog modul). Jangan jalankan perintah ini setelah ada data nyata.

### 7.3 Akun superadmin pertama

Saat ini **belum ada wizard instalasi** yang membuat faskes dan superadmin pertama tanpa data demo (tercatat di backlog [ROADMAP](./ROADMAP.md), B-40). Cara sementara yang disarankan:

1. Jalankan `npm run db:demo:seed` dengan `DEMO_PASSWORD` yang **kuat dan rahasia** (bukan `Demo@2026`).
2. Login sebagai `superadmin`, lalu **ganti kata sandinya** (Setting › Profil Akun).
3. Buat faskes Anda (langkah 7.4), pindah ke faskes itu, lalu siapkan akun admin faskes Anda.
4. Nonaktifkan faskes demo di **Datamaster › Faskes** dan nonaktifkan akun demo di **Datamaster › User**, lalu kosongkan `DEMO_PASSWORD` di `.env` server.

Ini satu-satunya pengecualian aturan "tanpa data demo di production" ([Lingkungan](./LINGKUNGAN.md)), dan hanya dilakukan sekali sebelum ada data nyata.

Alternatif untuk pengembang: seeder `npm run db:seed:admin` membuat satu akun admin (bawaan `admin`) dengan menyalin faskes, peran, dan izin dari akun templat `superadmin` yang dibuat oleh `db:demo:seed`. Variabel: `SEED_ADMIN_PASSWORD` (wajib; tanpa nilai ini seeder dilewati), `SEED_ADMIN_USERNAME`, `SEED_ADMIN_TEMPLATE`. Lihat `database/seeders/20261012090000-dev-admin-user.cjs`.

### 7.4 Menyiapkan faskes

Lakukan berurutan sebagai superadmin/admin faskes:

| Urutan | Menu | Isi |
|---|---|---|
| 1 | **Datamaster › Faskes** | Tambah faskes (kode, nama). |
| 2 | **Setting › Manajemen Modul** | Pilih **segmen** faskes, lalu sesuaikan modul/fitur. Lihat [Manajemen Modul](./MANAJEMEN-MODUL.md). |
| 3 | **Setting › Profil Faskes** | Alamat, kontak, PPN, logo & warna tema. |
| 4 | **Datamaster › Lokasi** | Hierarki Site → Building → Level → Ward (poli/bangsal) → Room (kamar) → Bed. Setiap lokasi wajib punya kategori ruangan; poli diberi jenis poli (umum, gigi, mata, ...). |
| 5 | **Datamaster › Pegawai** & praktisi | Pegawai, dokter (SIP/STR, poli pelayanan), perawat, apoteker, dst. |
| 6 | Jadwal dokter (Antrian) | Jadwal praktik per hari. Pendaftaran hanya menerima jadwal yang **harinya** sama dengan hari ini. |
| 7 | **Datamaster › Role** & **Datamaster › User** | Peran dan izin per menu/aksi, lalu akun petugas. Lihat [hak akses](./MANAJEMEN-MODUL.md#3-hubungan-dengan-hak-akses-izin). |
| 8 | Penjamin | Minimal **TUNAI** (umum) dan, bila melayani JKN, penjamin yang namanya diawali **"BPJS"**. |
| 9 | Tarif | Tarif tindakan per unit pelayanan (Rawat Jalan/Rawat Inap/IGD), tarif kamar (jenis Ruangan), tarif lab & penunjang. |
| 10 | Farmasi | Obat/BMHP, konfigurasi harga (satu baris per faskes), depo dan stok awal. Setiap depo wajib punya tujuan order (RJ/RI/IGD). |
| 11 | Datamaster penunjang | Item & paket pemeriksaan lab (dengan LOINC), radiologi, fisioterapi, MCU, PA, mikrobiologi sesuai modul yang aktif. |

Tip: latih seluruh langkah ini dulu di server uji yang berisi data demo; faskes demo bisa dijadikan contoh pengisian.

### 7.5 Integrasi eksternal

Semua diisi di **Setting › Konfigurasi Integrasi** per faskes.

| Integrasi | Prasyarat | Catatan |
|---|---|---|
| **SATUSEHAT** (platform data kesehatan Kemenkes, standar FHIR) | Registrasi faskes di portal SATUSEHAT: Client ID/Secret, Organization ID | Mulai di `SATUSEHAT_LINGKUNGAN=sandbox` dengan `SATUSEHAT_MODE=nyata`. Saat ini yang dikirim: kunjungan rawat jalan berstatus selesai (Encounter) beserta diagnosis ICD-10 (Condition) dan tanda vital (Observation). ID SATUSEHAT dipetakan otomatis saat pengiriman pertama: pasien dan dokter (DPJP) dicari lewat **NIK 16 digit** (pasien beridentitas KTP; dokter dari NIK di data pegawai), sedangkan poli dibuat sebagai Location baru di bawah Organization faskes. ID yang ditemukan disimpan dan dipakai ulang. Pastikan NIK pasien dan dokter benar dan sudah terdaftar di SATUSEHAT; bila tidak ditemukan, kunjungan ditandai data belum lengkap. |
| **BPJS PCare** (FKTP: praktik, klinik pratama, puskesmas) | Kredensial PCare dari BPJS Kesehatan | Modul `bpjs_fktp`. Pendaftaran & kunjungan dikirim otomatis berkala. Uji dulu dengan `BPJS_LINGKUNGAN=development`. |
| **BPJS VClaim** (FKRTL: klinik utama, RS) | Kredensial VClaim | Modul `bpjs_fkrtl`: cek peserta, rujukan, SEP. |
| **LIS** (Laboratory Information System) | URL & API key LIS (format adamLIS) | Nyalakan fitur **Bridging LIS** bila belum aktif di segmen Anda, isi koneksi (URL registrasi, URL ambil hasil, API key, kode RS, kode lab, mode kirim), lalu petakan kode di **Laboratorium › Mapping LIS** (tindakan, unit/dokter/penjamin, item hasil). Gagal kirim ke LIS = validasi order dibatalkan. Titik masuk hasil (push dari LIS, tanpa JWT): `/adam-lis/bridging` di lab-service; alamat ini juga diteruskan gateway. Uji dulu dengan LIS tiruan: `node scripts/lis-tiruan.mjs` (lihat [README LIS tiruan](../scripts/README-lis-tiruan.md)). |
| **PACS/RIS** (Radiologi) | URL & API key PACS/RIS | Nyalakan fitur **Bridging PACS/RIS** (`rad_bridging_pacs`) bila belum aktif di segmen Anda, isi koneksi di **Setting › Konfigurasi Integrasi › Konfigurasi PACS** (URL kirim order, URL ambil hasil, URL viewer, API key, kode RS), lalu petakan kode di **Radiologi › Mapping PACS** (tindakan → kode prosedur & modalitas, unit/dokter/penjamin, ruang/alat → AE Title). Gagal kirim ke PACS = validasi order dibatalkan; tombol **Validasi Saja** tetap tersedia sebagai jalur darurat. Titik masuk hasil (push dari PACS, tanpa JWT; kunci di `?key=` atau header `x-api-key`): `http(s)://<host penunjang-service>/adam-pacs/bridging?key=<kunci masuk>`, atau lewat gateway `https://<domain API>/api/v3/penunjang/radiologi/pacs/hasil?key=<kunci masuk>`. Uji dulu dengan PACS tiruan: `node scripts/pacs-tiruan.mjs` (lihat [README PACS tiruan](../scripts/README-pacs-tiruan.md)). |
| **LIS PA** (sistem informasi patologi anatomi) | URL & API key sistem PA (format adamLIS) | Nyalakan fitur **Bridging LIS Patologi Anatomi** bila belum aktif, isi koneksi di **Konfigurasi LIS PA** (URL registrasi, URL ambil hasil, API key, kode RS), lalu petakan kode di **Patologi Anatomi › Mapping LIS PA** (pemeriksaan, unit/dokter/penjamin, field hasil). Gagal kirim ke LIS PA = validasi order dibatalkan. Titik masuk hasil (push, tanpa JWT): `http(s)://<host penunjang-service>/adam-pa-lis/bridging`, atau lewat gateway `https://<domain API>/api/v3/penunjang/patologi/lis/hasil`, dengan kunci masuk di header `x-api-key`. Uji dulu dengan sistem PA tiruan: `node scripts/lis-pa-tiruan.mjs` (lihat [README sistem PA tiruan](../scripts/README-lis-pa-tiruan.md)). |
| **UTD** (Bank Darah RS → UTD/BDRS eksternal) | URL & API key UTD mitra (kontrak REST generik) | Nyalakan fitur **Bridging Bank Darah (UTD)** (`bdrs_bridging`) bila belum aktif di segmen Anda (RS B/RS A, mati bawaan), isi koneksi di **Setting › Konfigurasi Integrasi › Konfigurasi Bank Darah/UTD** (URL kirim permintaan, URL status dengan templat `{no_registrasi}`, URL cek stok opsional, API key, kode RS), lalu petakan kode di **Bank Darah › Mapping UTD** (komponen wajib; unit/dokter/penjamin opsional). Kantong hanya masuk stok setelah petugas berizin **Stok & Penerimaan › TERIMA KANTONG** menerima kantong `menunggu` yang lolos validasi IMLTD — tidak ada penerimaan otomatis. Titik masuk hasil (push dari UTD, tanpa JWT): `http(s)://<host penunjang-service>/adam-utd/bridging?key=<kunci masuk>`, atau lewat gateway `https://<domain API>/api/v3/penunjang/bank-darah/utd/hasil?key=<kunci masuk>`. Uji dulu dengan UTD tiruan: `node scripts/utd-tiruan.mjs` (lihat [README UTD tiruan](../scripts/README-utd-tiruan.md)). |

> **Titik masuk hasil di belakang gateway.** `deploy/server/gateway.nginx.conf` (dan gateway lokal `install.sh --domain`) hanya meneruskan `/api/v3/<layanan>/…` serta `/adam-lis/` (ke lab-service). Alamat `/adam-pacs/`, `/adam-pa-lis/`, `/adam-utd/`, dan `/adam-hdis/` milik penunjang-service **tidak** diteruskan, dan `/adam-lis/mikrobiologi/…` justru sampai ke lab-service, bukan penunjang-service. Saat sistem eksternal mengirim hasil lewat gateway, daftarkan alias `/api/v3/penunjang/…` berikut (kunci masuk sama):
>
> | Bridging | Alamat langsung (port 8099) | Alias lewat gateway |
> |---|---|---|
> | PACS/RIS | `/adam-pacs/bridging` | `/api/v3/penunjang/radiologi/pacs/hasil` |
> | LIS Patologi Anatomi | `/adam-pa-lis/bridging` | `/api/v3/penunjang/patologi/lis/hasil` |
> | LIS Mikrobiologi | `/adam-lis/mikrobiologi/bridging` | `/api/v3/penunjang/mikrobiologi/lis/hasil` |
> | UTD/BDRS | `/adam-utd/bridging` | `/api/v3/penunjang/bank-darah/utd/hasil` |
> | HDIS (hemodialisa) | `/adam-hdis/bridging` | `/api/v3/penunjang/hemodialisa/hdis/masuk` |
>
> Hasil LIS Patologi Klinik tetap memakai `/adam-lis/bridging` (diteruskan gateway ke lab-service; alias `/api/v3/lab/lis/hasil`).

Ubah `SATUSEHAT_MODE`/`BPJS_MODE` ke `nyata` dan lingkungan ke produksi (`SATUSEHAT_LINGKUNGAN=produksi`, `BPJS_LINGKUNGAN=production`) hanya di production dan setelah uji di sandbox lulus.

### 7.6 Sebelum go-live

- Uji alur lengkap dengan akun per peran (daftar → periksa → resep → farmasi → kasir → laporan).
- Siapkan **cadangan otomatis** dan uji pemulihannya ([bagian 10](#10-pemeliharaan-pembaruan--cadangan)).
- Pastikan akun dan faskes demo sudah nonaktif, dan sandi superadmin sudah diganti.
- Tetapkan siapa yang memegang akun superadmin dan siapa yang menerima laporan masalah.

---

## 8. Menjalankan dengan Docker

### 8.1 Berkas yang tersedia

| Berkas | Isi |
|---|---|
| `docker-compose.yml` | **Satu-satunya** berkas compose: semua layanan, PostgreSQL 16, MongoDB, Redis. Semua layanan memakai satu `.env` root. Layanan yang memakai SDK dibangun dengan konteks root repo (`context: .`, `dockerfile: <layanan>/Dockerfile`): Dockerfile menyalin `packages/` ke `/packages` dan kode layanan ke `/app`. Frontend, bpjs, satusehat, dan penunjang (tanpa SDK) memakai konteks foldernya sendiri. |
| `.dockerignore` | Membatasi konteks build root (tanpa `node_modules`, `.env`, dokumen, dsb.). |
| `deploy/server/docker-compose.server.yml` | Override untuk server: port & `APPLICATION_MODULE` per layanan, alamat antar-layanan memakai nama kontainer, batas memori, gateway nginx, MongoDB 7.0, dan database tidak dibuka ke host. |
| `deploy/server/gateway.nginx.conf` | Gateway nginx (port 8080): semua `/api/v3/<layanan>/` dalam satu domain, ditambah `/adam-lis/` (hasil LIS ke lab-service) dan `/health`. Titik masuk bridging penunjang-service memakai alias `/api/v3/penunjang/…` ([bagian 7.5](#75-integrasi-eksternal)). `studio-service` tidak ada di compose; rutenya di gateway hanya berguna bila Studio dijalankan di jaringan kontainer. |
| `deploy/server/.env.example` | Templat `.env` server. |
| `deploy/server/deploy.sh` | Skrip deploy: build hanya layanan yang berubah → migrasi → jalankan → cek kesehatan → rollback otomatis bila gagal. Dijalankan di server. |
| `.github/workflows/ci.yml` | CI: cek sintaks semua layanan dan `packages/`, uji unit lab-service, muat `schema.sql` + migrasi dua kali (uji idempoten), cek dokumen katalog modul, build frontend. |

### 8.2 Semua di Docker (satu mesin)

Untuk mencoba di satu mesin tanpa Node.js lokal:

```bash
cp .env.example .env          # isi kredensial & SECRET_KEY (bagian 4 langkah 2)
npm run stack:up              # = docker compose up -d --build
npm run stack:down            # menghentikan dan menghapus kontainer (volume data tetap)
```

`docker-compose.yml` saja memberi semua layanan satu `.env` root yang sama, sehingga port, `APPLICATION_MODULE`, dan alamat antar-layanan per layanan belum diatur. Untuk server, selalu pakai override `deploy/server/docker-compose.server.yml` ([bagian 8.3](#83-server-dengan-deploysh)). Bila ingin menjalankan infrastruktur di Docker dan layanan di host, cukup `npm run infra:up` + `npm run dev` (jalur A).

### 8.3 Server dengan `deploy.sh`

Rahasia server disimpan di luar repo, di `~/.opensimrs/.env` (lokasi bisa diganti dengan variabel `OPENSIMRS_STATE_DIR`). `deploy.sh` menyalinnya ke `.env` root, menulis env frontend dari `PUBLIC_API_URL`, membangun image yang berubah, menjalankan migrasi (serta `db:seed:admin` bila `SEED_ADMIN_PASSWORD` diisi), lalu menjalankan semua layanan dan gateway, memeriksa kesehatan, dan melakukan rollback ke image `:previous` bila gagal.

```bash
git clone https://github.com/tulisankode/opensimrs.git /opt/opensimrs
cd /opt/opensimrs
mkdir -p ~/.opensimrs
cp deploy/server/.env.example ~/.opensimrs/.env
nano ~/.opensimrs/.env                       # isi semua rahasia
SERVER_HOST=simrs.contoh.id ./deploy/server/deploy.sh
```

Isi penting di `~/.opensimrs/.env`:
- `DB_*`, `MONGO_*`, `REDIS_*`: kata sandi kuat. `MONGO_DB_AUTH_SOURCE=admin` (layanan memakai akun root MongoDB dari `MONGO_DB_USERNAME`/`MONGO_DB_PASSWORD`).
- `SECRET_KEY` dan kunci API internal: nilai acak (`openssl rand -hex 32`).
- `PUBLIC_API_URL`: alamat API yang dibuka ke browser, mis. `https://api.simrs.contoh.id`. Bila kosong, memakai `http://SERVER_HOST:8080`.
- `FRONTEND_ALLOWED_HOSTS`: domain aplikasi, dipisah koma, mis. `simrs.contoh.id`.

Variabel lingkungan saat menjalankan skrip: `SERVER_HOST` (bawaan `localhost`; dipakai untuk alamat API bawaan dan pesan akhir), `OPENSIMRS_STATE_DIR`, `FORCE_BUILD=1` (build ulang semua image), `MIN_FREE_GB` (pengaman ruang disk, bawaan 8), `CONTAINER_CLI` (`docker` bawaan, atau `podman`).

Port yang dibuka ke host: gateway `8080`, frontend `5520`, dan layanan `8081`–`8096` (dipakai cek kesehatan). Pastikan port tersebut belum dipakai aplikasi lain di server.

#### Dengan Podman (mis. macOS tanpa Docker Desktop)

`deploy.sh` bisa memakai Podman sebagai pengganti Docker. Override server memakai tag `!reset` (Compose v2.24+), jadi `podman compose` harus memakai **docker-compose v2** sebagai provider, bukan `podman-compose` (Python).

```bash
brew install podman docker-compose
podman machine init --cpus 4 --memory 8192 --disk-size 60 opensimrs   # VM bawaan (2 CPU / 2 GB) terlalu kecil
podman machine start opensimrs
# Dockerfile & compose memakai nama image pendek (node:22-alpine, postgres:16-alpine, ...):
# arahkan ke Docker Hub agar build non-interaktif tidak gagal "short-name resolution"
podman machine ssh opensimrs 'mkdir -p ~/.config/containers && printf "unqualified-search-registries = [\"docker.io\"]\nshort-name-mode = \"permissive\"\n" > ~/.config/containers/registries.conf'
podman compose version            # harus menyebut "Docker Compose version v2.x"
CONTAINER_CLI=podman SERVER_HOST=simrs.contoh.id ./deploy/server/deploy.sh
```

Catatan Podman:
- Mode *rootless* cukup karena semua port di atas 1024. Bila ingin memakai port < 1024, jalankan `podman machine set --rootful`.
- Tidak perlu `podman-mac-helper`; `podman compose` memakai soket API Podman secara langsung. Hindari memasangnya bila server masih menjalankan aplikasi lain di Docker Desktop, karena helper mengambil alih soket Docker bawaan.
- Disk VM Podman tumbuh sesuai isi; build pertama ±20 image bisa memakan lebih dari 10 GB di disk host. Cache build dibersihkan dengan `podman image prune` (Podman tidak punya `builder prune`).
- VM harus menyala agar layanan berjalan. Setelah server restart, jalankan `podman machine start opensimrs` (kontainer memakai `restart: unless-stopped` dan ikut menyala kembali).

### 8.4 Server secara manual

Langkah yang sama dengan `deploy.sh`, bila Anda ingin mengendalikan tiap tahap:

```bash
# 1. .env dari templat server, lalu isi semua rahasia
cp deploy/server/.env.example .env
nano .env

# 2. Env frontend (dibakar saat build). Contoh untuk satu domain API lewat gateway:
API=https://api.simrs.contoh.id
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
VITE_BASE_PROGRAM_PUSKESMAS=$API/api/v3/program-puskesmas
VITE_BASE_STUDIO=$API/api/v3/studio
ENV

# 3. Infrastruktur & build. Nama proyek Compose "opensimrs" membuat jaringan bernama opensimrs_opensimrs.
COMPOSE="docker compose -p opensimrs -f docker-compose.yml -f deploy/server/docker-compose.server.yml"
$COMPOSE up -d --wait db mongodb redis          # tunggu schema.sql selesai dimuat (1–3 menit)
$COMPOSE build                                  # lama; bila RAM terbatas, build per layanan

# 4. Migrasi database dari kontainer Node sementara
set -a; . ./.env; set +a
docker run --rm --network opensimrs_opensimrs -v "$PWD:/app" -w /app \
  -e DB_HOST=db -e DB_PORT=5432 -e DB_NAME -e DB_USERNAME -e DB_PASSWORD \
  node:22-alpine sh -c "npm ci --no-audit --no-fund --ignore-scripts && npx sequelize-cli db:migrate"

# 5. Jalankan semua layanan + gateway
$COMPOSE up -d
$COMPOSE ps
```

**Data awal (bagian 6 atau 7.3) di server Docker.** Skrip `database/demo/*.cjs` membaca `.env` root untuk PostgreSQL. Pada database baru cukup `seed-demo.cjs`; `reset-demo.cjs` hanya diperlukan bila database sudah pernah berisi data demo, dan skrip itu membaca koneksi MongoDB dari `rekamedis-service/.env` serta memakai paket `mongodb` milik `rekamedis-service`. Contoh dari kontainer Node sementara (sesuaikan dengan `.env` Anda):

```bash
docker run --rm -it --network opensimrs_opensimrs -v "$PWD:/app" -w /app \
  -e DB_HOST=db -e DB_PORT=5432 -e DB_NAME -e DB_USERNAME -e DB_PASSWORD -e DEMO_PASSWORD \
  node:22-alpine sh -c 'npm ci --no-audit --no-fund --ignore-scripts && node database/demo/seed-demo.cjs'
```

### 8.5 HTTPS di depan gateway

Pasang reverse proxy (nginx, Caddy, Traefik) di server yang meneruskan:
- `https://simrs.contoh.id` → `http://127.0.0.1:5520` (frontend)
- `https://api.simrs.contoh.id` → `http://127.0.0.1:8080` (gateway)

Contoh minimal nginx:

```nginx
server {
    listen 443 ssl;
    server_name api.simrs.contoh.id;
    ssl_certificate     /etc/letsencrypt/live/api.simrs.contoh.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.simrs.contoh.id/privkey.pem;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Buat blok serupa untuk domain frontend ke port 5520. Pastikan `FRONTEND_ALLOWED_HOSTS` memuat domain Anda.

> **Batas laju di belakang gateway.** `payment-service` dan `rawat-inap-service` memakai `express-rate-limit`: **100 permintaan per 5 menit per alamat IP**. Kedua layanan belum mengatur `trust proxy`, sehingga di belakang gateway nginx (dan reverse proxy HTTPS) alamat IP yang terbaca adalah alamat gateway. Akibatnya **semua pengguna dihitung sebagai satu IP**: pada faskes yang sibuk, kasir dan rawat inap bisa menerima galat 429 "Too many requests" setelah 100 permintaan gabungan dalam 5 menit. Ini keterbatasan kode yang sudah diketahui; sampai diperbaiki, pantau galat 429 di log kedua layanan. Hal yang sama berlaku pada akses lewat domain di instalasi lokal ([bagian 9](#akses-instalasi-lokal-lewat-domain-cloudflare-tunnel--reverse-proxy)).

---

## 9. Menjalankan tanpa Docker (instal native)

> **Cara cepat (macOS & Ubuntu/Debian): `./install.sh`.** Skrip ini memeriksa dependensi beserta versinya (Node.js, PostgreSQL, Redis, MongoDB, mongosh, dll.), menawarkan pemasangan yang kurang lewat Homebrew/apt, menyalakan layanan, membuat role/database/akun Mongo, memuat `schema.sql`, membuat semua `.env` dengan kunci acak (tidak menimpa yang sudah ada), lalu menjalankan `install:all`, migrasi, dan data demo. Opsi: `--cek` (hanya cek), `--ya` (tanpa tanya), `--tanpa-demo`, `--jalankan` (langsung `npm run dev`), `--podman` (lihat di bawah), `--domain <domain> --api <domain-api>` (akses lewat domain, lihat [di bawah](#akses-instalasi-lokal-lewat-domain-cloudflare-tunnel--reverse-proxy)), `--tanpa-ai`, `--helpdesk`; daftar lengkap: `./install.sh --help`. Skrip juga menawarkan **alat AI** satu per satu: Claude Code CLI, Codex CLI, dan OpenCode CLI (`@opencode/cli`) lewat `npm install -g`; **Ollama** (LLM lokal untuk agen OpenCode, lewat Homebrew/installer resmi; di Windows lewat winget) **tanpa mengunduh model** — unduh sendiri sesuai RAM/VRAM, mis. `ollama pull qwen3:8b`, lalu daftarkan di SIMRS Studio › Pengaturan & Agen › Konektor; dan **OpenClaw** (Helpdesk) lewat installer resminya yang menyiapkan Node 24.16+ sendiri. Lewati semuanya dengan `--tanpa-ai`; `--helpdesk` tetap diterima tetapi kini bawaan. OpenClaw di mesin pengembang untuk uji coba; untuk produksi, OpenClaw dipasang di VM terpisah ([deploy/helpdesk/README.md](../deploy/helpdesk/README.md)). Khusus development lokal. Setiap langkah tampil dengan **bilah kemajuan** (`[3/9] ██████░░ 33%`, spinner dan waktu berjalan untuk langkah lama, bilah per folder saat `npm install`). Keluaran lengkap tersimpan di berkas log yang disebut di akhir; bila ada langkah gagal, 25 baris terakhir log ditampilkan. Langkah manual di bawah menjelaskan hal yang sama secara rinci.
>
> **macOS/Linux dengan Podman: `./install.sh --podman`.** PostgreSQL, MongoDB, dan Redis dijalankan di kontainer Podman (`podman compose`, file `docker-compose.yml`), sedangkan layanan dan frontend tetap berjalan langsung di mesin (`npm run dev`, cocok untuk development). Tidak perlu memasang PostgreSQL/MongoDB/Redis dari Homebrew/apt. Langkah di MacBook:
>
> ```bash
> brew install podman docker-compose node@22      # docker-compose v2 menjadi provider "podman compose"
> git clone https://github.com/tulisankode/opensimrs.git && cd opensimrs
> ./install.sh --cek --podman                      # cek dependensi saja
> ./install.sh --podman                            # instalasi lengkap (+ --ya untuk tanpa tanya)
> npm run dev                                      # buka http://localhost:5520 — superadmin / Demo@2026
> ```
>
> Yang dilakukan `--podman` (aman dijalankan berulang):
> - membuat VM Podman `opensimrs` (2 CPU, 4 GB RAM, disk 40 GB) bila belum ada, lalu menyalakannya. Bila VM sudah ada tetapi mati, atau menyala tetapi koneksi default Podman menunjuk mesin lain/port SSH lama ("connection refused"), skrip menyalakan VM, menjadikannya koneksi default, dan bila perlu menawarkan mulai ulang VM (`scripts/lib/podman.sh`, dipakai bersama `uninstall.sh`). Galat asli Podman ditampilkan beserta saran pemeriksaan; nama image pendek (`postgres:16-alpine`, `mongo`, `redis`) diarahkan ke Docker Hub;
> - menulis `.env` root (sandi acak) **sebelum** kontainer dinyalakan, karena `podman compose` membacanya untuk nama dan sandi database;
> - menjalankan `podman compose up -d db mongodb redis`; saat volume masih baru, kontainer PostgreSQL membuat role/database `opensimrs` dan memuat `schema.sql` (1–3 menit), kontainer MongoDB membuat akun root `opensimrs`;
> - memeriksa sandi di `.env` cocok dengan volume yang ada, lalu melanjutkan langkah biasa: `.env` tiap layanan, `install:all`, migrasi, dan data demo.
>
> Catatan: port 5432, 27017, dan 6379 harus kosong (hentikan dulu `brew services stop postgresql@16 mongodb-community@7.0 redis` bila terpasang). Setelah komputer restart, jalankan `podman machine start` lalu `podman compose -f docker-compose.yml up -d db mongodb redis` sebelum `npm run dev`. Bila sandi di `.env` sudah tidak cocok dengan volume lama, skrip berhenti dengan petunjuk; `podman compose -f docker-compose.yml down -v` menghapus volume (**data hilang**).
>
> **Windows 10/11: `install.cmd`** (atau `powershell -ExecutionPolicy Bypass -File .\install.ps1`). Skrip ini melakukan langkah yang sama dengan `install.sh`:
> - dependensi dipasang lewat **winget**: Node.js 22, PostgreSQL 16, MongoDB 7.0, mongosh, dan **Memurai Developer**, layanan Redis-kompatibel untuk Windows (edisi Developer gratis untuk development dan perlu dinyalakan ulang berkala);
> - bila PostgreSQL dipasang oleh skrip, sandi superuser `postgres` dibuat acak dan ditampilkan sekali di akhir; bila sudah terpasang, skrip menanyakannya (atau isi variabel `PG_SUPERPASS`);
> - port PostgreSQL dibaca dari `postgresql.conf` layanan Windows-nya; bila berbeda dari 5432 (mis. 5432 dipakai kontainer Docker), nilainya ikut ditulis ke `DB_PORT` di `.env`. Bisa dipaksa dengan variabel `PG_PORT`;
> - Redis di bawah versi 5, termasuk port Redis lama untuk Windows (v3.0), dianggap terlalu lama dan diganti Memurai;
> - opsi: `-Cek`, `-Ya`, `-TanpaDemo`, `-Jalankan`, `-TanpaAi` (lewati Claude Code, Codex, OpenCode, Ollama, dan OpenClaw), `-Helpdesk` (tetap diterima, kini bawaan), `-Domain <domain> -Api <domain-api>` (akses lewat domain). Mode Podman hanya tersedia di `install.sh`. Pemasangan layanan butuh PowerShell **sebagai Administrator**.

Cara ini setara dengan cara Docker: semua komponen dipasang langsung di sistem operasi. Contoh perintah untuk **Ubuntu/Debian**; di **Windows**, pakai installer resmi masing-masing perangkat lunak (PostgreSQL, MongoDB Community Server, Node.js) dan, untuk Redis, Memurai Developer atau paket Redis di WSL (port Redis lama untuk Windows v3.0 terlalu lama; minimal Redis 5). Ganti semua `<...>` dengan nilai Anda sendiri; jangan memakai contoh sandi di server sungguhan.

### Akses instalasi lokal lewat domain (Cloudflare Tunnel / reverse proxy)

Instalasi lokal (`npm run dev`) bisa dibuka dari luar lewat domain HTTPS, mis. untuk uji coba di Mac mini atau mesin kantor. Semua API dilewatkan ke satu gateway di port 8080, karena port layanan (8081–8100) tidak diteruskan tunnel dan tidak melayani HTTPS.

```bash
./install.sh --domain simrs.contoh.id --api api-simrs.contoh.id        # boleh digabung dengan --podman
# Windows: install.cmd -Domain simrs.contoh.id -Api api-simrs.contoh.id
```

Yang dilakukan installer:

1. Menulis `frontend-service/.env.local` (diabaikan git): `ALLOWED_HOSTS=<domain>,<api>` untuk Vite, `VITE_KEEP_API_HOST=true`, dan semua `VITE_BASE_*` diarahkan ke `https://<api>/api/v3/...`. Berkas `.env.local` lama yang bukan buatan installer dicadangkan dulu.
2. Membuat `~/.opensimrs/gateway-lokal.conf` dengan `node scripts/gateway-lokal.mjs`, dari `deploy/server/gateway.nginx.conf` dengan upstream diarahkan ke mesin ini.
3. Menjalankan kontainer nginx `opensimrs-gateway` (Podman, atau Docker bila Podman tidak ada) di port 8080 dengan `--restart=always`. Tanpa Podman/Docker, konfigurasinya tetap dibuat untuk dipakai nginx di mesin itu.

Lalu arahkan tunnel atau reverse proxy:

| Hostname | Layanan |
|---|---|
| `simrs.contoh.id` | `http://localhost:5520` (frontend) |
| `api-simrs.contoh.id` | `http://localhost:8080` (gateway API) |

Konfigurasi gateway lokal sama dengan gateway server, jadi titik masuk bridging penunjang-service dari luar juga memakai alias `/api/v3/penunjang/…` ([bagian 7.5](#75-integrasi-eksternal)), dan batas laju payment/rawat-inap menghitung semua pengguna sebagai satu IP ([bagian 8.5](#85-https-di-depan-gateway)). Cek `https://api-simrs.contoh.id/health` → `{"status":"ok"}`. Bila gateway tidak menyala setelah mesin dinyalakan ulang: `podman start opensimrs-gateway`. Untuk kembali ke `http://localhost:5520` saja, hapus `frontend-service/.env.local`. `uninstall.sh` ikut menghapus gateway, konfigurasinya, dan `.env.local` buatan installer.

### Menghapus instalasi lokal: `./uninstall.sh` (Windows: `uninstall.cmd`)

Pasangan installer ini menghapus **hanya jejak OpenSIMRS**, dengan bilah kemajuan yang sama:
- PostgreSQL: database aplikasi (dihapus oleh role pemiliknya, tanpa superuser) dan role aplikasi (opsional, butuh superuser);
- MongoDB: database dan akun aplikasi;
- Redis: hanya kunci sesi `token-*`, bukan `FLUSHDB`;
- mode Podman: kontainer dan volume OpenSIMRS (`podman compose down -v --remove-orphans`, sehingga sisa kontainer proyek dari compose lain seperti `opensimrs-gateway` ikut terhapus);
- gateway akses domain (bila ada): kontainer `opensimrs-gateway` (Podman/Docker), `~/.opensimrs/gateway-lokal.conf`, dan `frontend-service/.env.local` buatan installer (berkas `.env.local` buatan Anda sendiri dibiarkan);
- berkas buatan instalasi di repo: `node_modules`, `.env` (termasuk cadangan `.env.bak*`), `dist`, data SIMRS Studio, dan worktree Studio.

PostgreSQL, MongoDB, Redis, Node.js, database atau akun lain, OpenClaw, serta Ollama beserta modelnya tidak disentuh.

Pengaman di `uninstall.sh` (macOS/Linux; `uninstall.ps1` belum memilikinya: cadangan yang gagal di Windows tidak menghentikan penghapusan, jadi periksa isi folder cadangan sebelum mengetik konfirmasi):
- **Podman dicek lebih dulu.** Bila Podman terpasang tetapi tidak bisa dihubungi (VM `podman machine` mati di macOS, atau koneksi default menunjuk mesin lain/port lama), skrip menawarkan menyalakan atau menyambungkan ulang VM (`scripts/lib/podman.sh`). Bila tetap gagal, skrip tidak menebak mode basis data: dengan `--ya` skrip berhenti tanpa menghapus apa pun; tanpa `--ya` Anda ditanya apakah basis data memang tidak memakai Podman.
- **Cadangan gagal = berhenti.** Bila `pg_dump`/`mongodump` gagal atau menghasilkan berkas kosong, penghapusan dihentikan kecuali Anda menyetujuinya secara eksplisit; `--ya` saja tidak cukup (pakai `--tanpa-cadangan` bila memang ingin menghapus tanpa cadangan). Salinan `.env` root ikut disimpan di folder cadangan.
- Bila `podman compose down` gagal, skrip berhenti sebelum `.env` dihapus agar uninstall bisa diulang.
- Sandi basis data tidak dicetak ke layar maupun ke berkas log.

```bash
./uninstall.sh --simulasi        # tampilkan apa yang akan dihapus, tanpa menghapus apa pun
./uninstall.sh                   # rencana → cadangan pg_dump/mongodump (ditawarkan) → ketik "HAPUS OPENSIMRS"
./uninstall.sh --hapus-folder    # hapus juga folder repo ini
./uninstall.sh --alat-ai         # hapus juga Claude Code, Codex & OpenCode CLI (npm global); Ollama & OpenClaw tidak dihapus
#   opsi lain: --ya (tanpa tanya), --tanpa-cadangan, --podman
#   Windows: uninstall.cmd -Simulasi | -Ya | -TanpaCadangan | -HapusFolder | -AlatAi   (role PostgreSQL: isi PG_SUPERPASS; tanpa mode Podman)
```

Cadangan disimpan di `~/opensimrs-cadangan-<waktu>/` (Windows: `%USERPROFILE%\opensimrs-cadangan-<waktu>\`). Cara memulihkannya ditampilkan di akhir proses.

### 9.1 Pasang perangkat lunak

```bash
# Node.js 22 LTS (lewat NodeSource atau nvm)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16 (repositori resmi PGDG bila versi distro lebih lama)
sudo apt-get install -y postgresql-16 postgresql-client-16

# Redis 7
sudo apt-get install -y redis-server

# MongoDB 7: tambahkan repositori resmi MongoDB sesuai petunjuk di situs MongoDB, lalu
sudo apt-get install -y mongodb-org
sudo systemctl enable --now postgresql redis-server mongod
```

### 9.2 PostgreSQL: role, database, dan skema

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE opensimrs LOGIN PASSWORD '<sandi-db>';
CREATE DATABASE opensimrs OWNER opensimrs;
SQL

# muat struktur + data referensi nasional (±11 MB, 1–3 menit)
psql -h 127.0.0.1 -U opensimrs -d opensimrs -v ON_ERROR_STOP=1 -q -f schema.sql
```

`schema.sql` tidak memuat pernyataan kepemilikan objek (`OWNER TO`), jadi tidak ada role khusus lain yang perlu dibuat. Setelah dependensi terpasang (langkah 9.5), jalankan `npm run db:migrate`.

### 9.3 MongoDB: akun aplikasi

Buat akun di database `admin` agar cocok dengan `MONGO_DB_AUTH_SOURCE=admin`:

```bash
mongosh <<'JS'
use admin
db.createUser({ user: "opensimrs", pwd: "<sandi-mongo>", roles: [ { role: "readWrite", db: "opensimrs" } ] })
JS
```

Lalu aktifkan autentikasi (`security.authorization: enabled` di `/etc/mongod.conf`) dan mulai ulang `mongod`. Untuk laptop pengembangan, MongoDB tanpa autentikasi yang hanya mendengar `127.0.0.1` bisa dipakai oleh sebagian layanan, tetapi `laporan-service` selalu menyusun URI dengan username/sandi; **disarankan tetap membuat akun** seperti di atas.

### 9.4 Redis

- Pastikan Redis hanya mendengar `127.0.0.1` (`bind 127.0.0.1 -::1` dan `protected-mode yes` di `/etc/redis/redis.conf`; contoh ada di `redis.conf` root repo).
- Untuk lokal, username/sandi Redis boleh kosong. Untuk server, aktifkan `requirepass <sandi-redis>` (atau ACL user) dan isi `REDIS_PASSWORD` (serta `REDIS_USERNAME` bila memakai ACL) di semua `.env`.

### 9.5 `.env`, dependensi, dan menjalankan

```bash
cp .env.example .env              # isi DB_*, MONGO_*, REDIS_*, SECRET_KEY (bagian 4 langkah 2)
npm run install:all
#   buat .env tiap layanan & frontend-service/.env (bagian 5.1 dan 5.3)
npm run db:migrate
npm run db:demo:seed              # hanya development/staging
npm run dev
```

### 9.6 Memeriksa

Sama dengan jalur A langkah 9: buka `http://localhost:5520` dan uji login lewat `curl`.

### 9.7 Produksi tanpa Docker (pm2/systemd + nginx)

- **Proses manager.** Jalankan setiap layanan sebagai proses tersendiri yang otomatis hidup kembali:
  - **pm2:** `npm install -g pm2`, lalu per layanan `pm2 start npm --name opensimrs-auth --cwd /opt/opensimrs/auth-service -- run start` (ulangi untuk semua layanan), kemudian `pm2 save` dan `pm2 startup`.
  - **systemd:** satu unit per layanan, mis. `/etc/systemd/system/opensimrs-auth.service` dengan `WorkingDirectory=/opt/opensimrs/auth-service`, `ExecStart=/usr/bin/npm run start`, `Restart=always`, `User=opensimrs`, `Environment=NODE_ENV=production`; lalu `systemctl enable --now opensimrs-auth`.
  - Periksa skrip `start` di `package.json` tiap layanan (layanan integrasi memakai `node src/server.js`).
- **Frontend.** Bangun sekali dengan env produksi (`frontend-service/.env.production.local`, lihat [bagian 8.4](#84-server-secara-manual) langkah 2) memakai `npm --prefix frontend-service run build-only`, lalu sajikan folder `frontend-service/dist/` sebagai berkas statis lewat nginx (folder `dist/` tidak di-commit).
- **nginx sebagai reverse proxy/gateway.** Pakai `deploy/server/gateway.nginx.conf` sebagai acuan pemetaan `/api/v3/<layanan>/` → port layanan; ganti nama kontainer (`auth-service:8083`, dst.) dengan `127.0.0.1:<port>` dan hapus baris `resolver`. Tambahkan HTTPS seperti [bagian 8.5](#85-https-di-depan-gateway).
- Atur `.env` tiap layanan dengan `SYNC_DB=false` dan alamat antar-layanan `http://127.0.0.1:<port>`. Aturan lain ada di [Lingkungan](./LINGKUNGAN.md).

---

## 10. Pemeliharaan: pembaruan & cadangan

### 10.1 Memperbarui ke versi terbaru

```bash
git pull origin main
npm run install:all          # pengembangan lokal / native
npm run db:migrate
```

Bila pembaruan mengubah `packages/`, jalankan juga `npm run sdk:refresh`. Untuk server Docker: `git pull` lalu `./deploy/server/deploy.sh` (atau langkah manual 8.4). Untuk server native: cadangkan database, `git pull`, `npm run install:all`, `npm run db:migrate`, bangun ulang frontend, lalu mulai ulang proses (pm2/systemd). Baca [CHANGELOG](../CHANGELOG.md) sebelum memperbarui, terutama bagian **Diubah** dan **Keamanan**.

### 10.2 Cadangan

Contoh untuk Docker (`docker compose exec` memakai nama layanan compose):

```bash
# PostgreSQL
docker compose exec -T db pg_dump -U "$DB_USERNAME" "$DB_NAME" | gzip > pg_$(date +%Y%m%d_%H%M).sql.gz

# MongoDB (isi rekam medis)
docker compose exec -T mongodb mongodump --archive --gzip \
  --username "$MONGO_DB_USERNAME" --password "$MONGO_DB_PASSWORD" --authenticationDatabase admin \
  > mongo_$(date +%Y%m%d_%H%M).gz
```

Pada deploy server, tambahkan `-p opensimrs -f docker-compose.yml -f deploy/server/docker-compose.server.yml` setelah `docker compose`. Pada instalasi native, jalankan `pg_dump` dan `mongodump` langsung di host.

Pemulihan:

```bash
gunzip -c pg_YYYYMMDD_HHMM.sql.gz | docker compose exec -T db psql -U "$DB_USERNAME" "$DB_NAME"
docker compose exec -T mongodb mongorestore --archive --gzip \
  --username "$MONGO_DB_USERNAME" --password "$MONGO_DB_PASSWORD" --authenticationDatabase admin < mongo_YYYYMMDD_HHMM.gz
```

- **Selalu cadangkan PostgreSQL dan MongoDB bersamaan.** Rekam medis tersebar di keduanya.
- Jadwalkan harian dengan `cron`, simpan salinan di luar server (terenkripsi), dan **uji pemulihan** secara berkala. Pola 3-2-1 dijelaskan di [Spesifikasi Hardware](./SPESIFIKASI-HARDWARE.md).
- Atur masa simpan cadangan sesuai ketentuan rekam medis yang berlaku dan kebijakan faskes.

---

## 11. Pemecahan masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| **Login gagal** atau langsung ter-logout saat membuka modul; log berisi `invalid algorithm` / `SECRET_KEY is required` | `SECRET_KEY` kosong di `.env` layanan, atau salinan SDK di `node_modules` layanan sudah usang | Isi `SECRET_KEY` (sama di semua layanan), jalankan `npm run sdk:refresh` dari root, lalu mulai ulang layanan. Docker: build ulang image layanan. |
| Login berhasil tetapi modul lain menolak (401) | `SECRET_KEY` berbeda antar layanan | Samakan `SECRET_KEY` di semua `.env`, mulai ulang semua layanan, login ulang. |
| Login gagal "username/password salah" dengan akun demo | Data demo belum diisi, atau `DEMO_PASSWORD` diubah | Jalankan `npm run db:demo:seed`; cek nilai `DEMO_PASSWORD` di `.env` root. |
| Perubahan di `packages/` tidak terlihat di layanan | SDK dipasang sebagai salinan, bukan symlink | `npm run sdk:refresh` (atau `npm run sdk:refresh -- <layanan>`), lalu mulai ulang layanan. |
| **Menu modul tidak muncul** | Modul tidak aktif untuk faskes, peran tidak punya izin, atau belum login ulang | Periksa Setting › Manajemen Modul, lalu Datamaster › Role, lalu login ulang. Lihat [Manajemen Modul](./MANAJEMEN-MODUL.md#3-hubungan-dengan-hak-akses-izin). |
| Menu tampil "Segera" dan tidak bisa dibuka | Modul belum dibangun (status Segera) | Normal. Lihat [ROADMAP](./ROADMAP.md) bila ingin ikut mengerjakan. |
| **Port sudah dipakai** (`EADDRINUSE`) | Aplikasi lain atau proses lama memakai port | Linux/macOS: `lsof -i :8083`; Windows: `netstat -ano \| findstr :8083`. Hentikan prosesnya, atau ubah port layanan di `.env`-nya **dan** URL yang merujuk ke layanan itu di `.env` frontend/layanan lain. PostgreSQL yang sudah terpasang di komputer sering bentrok di 5432. |
| `db:migrate` gagal koneksi tepat setelah kontainer dibuat | PostgreSQL masih memuat `schema.sql` | Tunggu 1–3 menit; cek `docker logs opensimrs-db`. |
| `laporan-service` gagal terhubung ke MongoDB | MongoDB tanpa akun, atau `MONGO_DB_USERNAME`/`MONGO_DB_PASSWORD` kosong | Buat akun MongoDB ([bagian 9.3](#93-mongodb-akun-aplikasi)) dan isi variabelnya. |
| MongoDB tidak mau start di Docker Desktop | Versi MongoDB terbaru tidak cocok dengan kernel VM | Pakai image `mongo:7.0`. |
| `npx vue-tsc --noEmit` melaporkan ±47 galat | Galat sintaks lama di `frontend-service/src/components/icons/*`, bukan karena perubahan Anda | Sudah diketahui dan masuk backlog. Untuk memeriksa berkas yang Anda ubah, buka `http://localhost:5520/src/<path>` (harus 200) dan uji di browser tanpa galat konsol. |
| Cetak PDF tidak terbuka | Popup diblokir browser | Izinkan popup untuk domain aplikasi; bila tetap diblokir, PDF otomatis diunduh. |
| Integrasi BPJS/SATUSEHAT selalu timeout | Server tidak keluar lewat IP Indonesia atau koneksi keluar diblokir | Pastikan IP publik server berada di Indonesia; cek firewall. |
| Disk penuh saat build Docker | Cache build menumpuk | `docker builder prune -af` dan `docker image prune -f`; build layanan satu per satu. `deploy.sh` menolak berjalan bila ruang kosong di bawah `MIN_FREE_GB`. |

Masih buntu? Buka issue di GitHub dengan label `bantuan dibutuhkan`, atau tanyakan di kanal komunitas ([COMMUNITY.md](../COMMUNITY.md)). Sertakan langkah, log (tanpa kata sandi/token/data pasien), OS, serta versi Node dan Docker.

---

## 12. Daftar periksa

### Pengembangan lokal (jalur A)
- [ ] `npm run infra:up` berjalan (atau PostgreSQL/MongoDB/Redis native siap) dan `schema.sql` selesai dimuat
- [ ] `npm run install:all` selesai
- [ ] `.env` root, `.env` tiap layanan, dan `frontend-service/.env` dibuat; `SECRET_KEY` sama di semuanya
- [ ] `npm run db:migrate` sukses
- [ ] `npm run db:demo:seed` sukses
- [ ] `npm run dev` berjalan (layanan + frontend); login `superadmin` berhasil

### Implementasi faskes (jalur B)
- [ ] Server sesuai [Spesifikasi Hardware](./SPESIFIKASI-HARDWARE.md); HTTPS aktif; port database tidak terbuka ke luar
- [ ] Semua sandi dan kunci dibuat baru dan acak; `.env` tidak tersimpan di repo ([Lingkungan](./LINGKUNGAN.md))
- [ ] `schema.sql` dimuat dan migrasi sukses; faskes sendiri dibuat dan segmen diatur
- [ ] Akun/faskes demo dinonaktifkan; sandi superadmin diganti
- [ ] Peran & izin petugas diatur dan diuji per peran
- [ ] Integrasi diuji di sandbox sebelum produksi
- [ ] Cadangan harian PostgreSQL + MongoDB berjalan dan pemulihan sudah diuji
