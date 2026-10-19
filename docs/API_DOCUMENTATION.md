# Dokumentasi API OpenSIMRS

> Referensi REST API backend OpenSIMRS untuk integrator dan pengembang.
> **Dokumentasi lengkap: https://docs.opensimrs.com/api/**

Dokumen ini disusun dari kode di repositori (`*-service/src/routes`, router lain yang dipasang di `app.js`/`server.js`, dan helper respons tiap layanan). Bila dokumen ini berbeda dengan kode, kode yang berlaku. Untuk layanan yang endpoint-nya sangat banyak, dokumen ini hanya memuat endpoint utama dan merujuk ke berkas rutenya.

## Daftar isi

1. [Pengantar](#1-pengantar)
2. [Autentikasi](#2-autentikasi)
3. [Konvensi permintaan dan respons](#3-konvensi-permintaan-dan-respons)
4. [Batas laju](#4-batas-laju)
5. [Referensi endpoint per layanan](#5-referensi-endpoint-per-layanan)
6. [Titik masuk bridging (tanpa JWT)](#6-titik-masuk-bridging-tanpa-jwt)

---

## 1. Pengantar

OpenSIMRS terdiri atas 19 layanan Express (ditambah frontend Vue 3 di port 5520). Setiap layanan berdiri sendiri dan mendengarkan port masing-masing. Semua layanan memakai satu database PostgreSQL bersama, MongoDB untuk isi rekam medis elektronik, dan Redis untuk sesi login serta cache izin.

### 1.1 Base URL per layanan

Saat pengembangan lokal, setiap layanan diakses langsung lewat port-nya, misalnya `http://localhost:8083/api/v3/auth`.

| Port | Layanan | Folder | Awalan path |
|------|---------|--------|-------------|
| 8081 | Admisi (pasien & registrasi) | `admisi-service` | `/api/v3/admisi` |
| 8082 | Antrian | `antrian-service` | `/api/v3/antrian` |
| 8083 | Auth | `auth-service` | `/api/v3/auth` |
| 8084 | Farmasi | `farmasi-service` | `/api/v3/farmasi` |
| 8085 | IGD | `igd-service` | `/api/v3/pelayanan` |
| 8086 | Inventory (gudang) | `inventory-service` | `/api/v3/inventory` |
| 8087 | Laboratorium + bridging LIS | `lab-service` | `/api/v3/lab`, `/adam-lis` |
| 8088 | Laporan & dashboard | `laporan-service` | `/api/v3/laporan` |
| 8089 | Pembayaran (kasir, tagihan) | `payment-service` | `/api/v3/payment` |
| 8090 | SIMRS Studio (opsional, mode pengembang) | `studio-service` | `/api/v3/studio` |
| 8091 | Rawat Inap (+ ICU) | `rawat-inap-service` | `/api/v3/ranap` |
| 8092 | Rawat Jalan | `rawat-jalan-service` | `/api/v3/rajal` |
| 8093 | Rekam Medis (RME) | `rekamedis-service` | `/api/v3/rekam-medis` |
| 8094 | Setting | `setting-service` | `/api/v3/setting` (lihat [1.3](#13-versi-api)) |
| 8095 | Stok Farmasi | `stok-farmasi-service` | `/api/v3/stok` (lihat [1.3](#13-versi-api)) |
| 8096 | Datamaster | `datamaster-service` | `/api/v3/datamaster` |
| 8097 | Integrasi SATUSEHAT | `satusehat-service` | `/api/v3/satusehat` |
| 8098 | Integrasi BPJS (PCare, VClaim, Antrean Online) | `bpjs-service` | `/api/v3/bpjs` |
| 8099 | Penunjang (radiologi, patologi, MCU, dll.) | `penunjang-service` | `/api/v3/penunjang` + titik masuk bridging |
| 8100 | Program Puskesmas | `program-puskesmas-service` | `/api/v3/program-puskesmas` |

Tabel port lengkap ada di [Panduan Instalasi](./INSTALLATION_GUIDE.md#3-gambaran-sistem--port).

### 1.2 Lewat gateway

Pada deploy server, semua layanan berada di belakang satu gateway nginx (`deploy/server/gateway.nginx.conf`, port host 8080). Gateway meneruskan permintaan berdasarkan awalan path, jadi base URL-nya cukup satu:

```
https://<domain API>/api/v3/<layanan>/...
```

Contoh: `https://api.simrs.contoh.id/api/v3/auth/login`. Path yang tidak dikenali gateway dijawab `404` dengan `{"message":"Endpoint tidak ditemukan"}`. Gateway juga menyediakan `GET /health`.

Gateway hanya meneruskan awalan `/api/v3/<layanan>/` dan `/adam-lis/` (ke lab-service). Untuk titik masuk bridging milik penunjang-service, lihat [bagian 6](#6-titik-masuk-bridging-tanpa-jwt).

### 1.3 Versi API

Versi yang dipakai adalah **`v3`**. Sebagian besar layanan menyusun awalan path dari `API_BASE` (bawaan `api`), `API_VERSION` (bawaan `v3`), dan nama modul.

> **Catatan:** `setting-service` dan `stok-farmasi-service` memakai `v1` bila `API_VERSION` kosong. Instalasi standar (`install.sh`, `.env.example`, panduan instalasi) mengisi `API_VERSION=v3`, dan gateway hanya meneruskan `/api/v3/setting/` dan `/api/v3/stok/`. Pastikan `API_VERSION=v3` terisi di `.env` kedua layanan itu. Layanan `admisi`, `payment`, `rawat-inap`, `bpjs`, `satusehat`, `penunjang`, `program-puskesmas`, dan `studio` memakai awalan `/api/v3/...` yang tertulis tetap di kode.

---

## 2. Autentikasi

Autentikasi memakai JWT HS256 yang diterbitkan `auth-service`. Semua layanan memakai `SECRET_KEY` yang sama. Faskes pengguna selalu dibaca dari token (klaim `faskesUuid`), bukan dari parameter permintaan.

| Item | Nilai (dari kode) |
|------|-------------------|
| Masa berlaku access token | 3600 detik (1 jam) |
| Masa berlaku refresh token | 4200 detik (70 menit) |
| Sesi di Redis | 3 jam, berisi daftar izin pengguna |
| Klaim access token | `role`, `username`, `faskesUuid`, `user_uuid`, `iss: authentication-service` |

### 2.1 Login

```http
POST /api/v3/auth/login
Content-Type: application/json

{
  "username": "superadmin",
  "password": "Demo@2026"
}
```

`superadmin` / `Demo@2026` adalah akun demo dari `npm run db:demo:seed`. Akun ini hanya untuk instalasi lokal atau staging, contohnya `http://localhost:8083/api/v3/auth/login`.

**Respons `200`:**

```json
{
  "message": "Login berhasil!",
  "payload": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "permissions": [
      {
        "module": "Admisi",
        "sub_modules": [
          { "name": "Pendaftaran", "allows": ["READ", "CREATE"], "features": [] }
        ]
      }
    ],
    "user": {
      "faskes_uuid": "01920000-0000-7000-8000-000000000001",
      "role": "super admin",
      "name": "Super Admin"
    }
  }
}
```

Auth-service mengubah semua kunci respons ke `snake_case`, termasuk kunci di dalam `permissions` (`subModules` menjadi `sub_modules`). Isi `permissions` di atas hanya ilustrasi.

**Galat:** username tidak terdaftar atau sandi salah dijawab `401` dengan bentuk `{ "message": "...", "errors": [{ "field": "username" | "password", "message": "..." }] }`. Validasi gagal (username/sandi kosong) dijawab `400`.

### 2.2 Memakai token

Kirim access token di header setiap permintaan ke endpoint terproteksi:

```http
Authorization: Bearer <token>
```

Tanpa token, layanan menjawab `401`. Layanan yang memakai `@opensimrs/authorization-sdk` (auth, datamaster, farmasi, inventory, lab, laporan, payment, setting, stok) juga mewajibkan sesi token masih ada di Redis. Token yang sudah logout atau sesinya habis ditolak dengan:

```json
{
  "message": "Authentikasi gagal",
  "errors": [{ "type": "invalid token", "message": "Token tidak valid atau kadaluarsa" }]
}
```

### 2.3 Refresh token

Kirim refresh token **dan** access token lama. Keduanya wajib.

```http
POST /api/v3/auth/refresh-token
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Respons `200`:**

```json
{
  "message": "Berhasil refresh token",
  "payload": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

Sesi token lama dihapus dari Redis, dan sesi baru dibuat dengan izin terbaru pengguna. Respons refresh tidak memuat `permissions`. Refresh token yang kedaluwarsa dijawab `401` (`"Refresh token telah kadaluarsa"`).

### 2.4 Ganti faskes (khusus super admin)

```http
PUT /api/v3/auth/token/{faskes_uuid}
Authorization: Bearer <token>
```

Endpoint ini menerbitkan token baru untuk faskes lain dan menghapus sesi token lama. Hanya peran `super admin` yang boleh memakainya. Peran lain dijawab `401` ("tidak memiliki izin"). **Respons `202`:**

```json
{
  "message": "Success update token!",
  "payload": {
    "new_token": "eyJhbGciOiJIUzI1NiIs...",
    "new_refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "faskes_name": "Klinik Contoh",
    "faskes_uuid": "01920000-0000-7000-8000-000000000002"
  }
}
```

Pengguna selain super admin terikat pada faskes akunnya, dan faskes itu ditentukan saat login.

### 2.5 Logout

```http
DELETE /api/v3/auth/logout
Authorization: Bearer <token>
```

**Respons `202`:** `{ "message": "<username> berhasil logout" }`. Sesi token dihapus dari Redis.

### 2.6 Izin (hak akses)

Izin pengguna berbentuk `[{ module, subModules: [{ name, allows: [...], features: [{ name, allows: [...] }] }] }]` dan diatur per peran di **Setting › Hak Akses**. Endpoint yang memeriksa izin menjawab `403` bila pengguna tidak punya izinnya, misalnya:

```json
{ "message": "Gagal", "errors": [{ "type": "not allowed", "message": "Anda tidak memiliki hak akese sub modul" }] }
```

Di tabel referensi, kolom **Izin** ditulis `Modul › Submodul › AKSI` (atau `Modul › Submodul › Fitur › AKSI`). Endpoint tanpa catatan izin hanya mewajibkan login. Menu dan fitur yang tersedia juga bergantung pada modul aktif faskes (lihat [Manajemen Modul](./MANAJEMEN-MODUL.md)).

### 2.7 Kunci API (klien non-login)

Beberapa endpoint untuk aplikasi mobile, kiosk, atau sistem eksternal memakai header `x-api-key`, bukan JWT:

| Layanan | Path | Header |
|---------|------|--------|
| Admisi | `/api/v3/admisi/mobile/pasien/*`, `/patient/check-patient`, `/rawat-jalan/mobile*` | `x-api-key` dan `faskes-uuid` (`/rawat-jalan/mobile/jadwal-pemeriksaan/:uuid` cukup `x-api-key`) |
| Antrian | `/api/v3/antrian/mobile/*` | `x-api-key` |
| Datamaster | `/api/v3/datamaster/mobile/*` | `x-api-key` |
| BPJS (WS Antrean) | `/api/v3/bpjs/antrean/ws/*` | Token WS dari `/antrean/ws/token` (header `X-cons-id`, `X-timestamp`, `X-signature`) |
| Bridging hasil | lihat [bagian 6](#6-titik-masuk-bridging-tanpa-jwt) | `x-api-key` atau `?key=` |

Nilai kunci diatur lewat variabel lingkungan atau menu Setting, dan tidak dicantumkan di dokumen ini.

---

## 3. Konvensi permintaan dan respons

### 3.1 Umum

- Body permintaan berformat JSON (`Content-Type: application/json`), kecuali unggah berkas dan impor (`multipart/form-data`).
- Nama field memakai `snake_case` di API dan database.
- ID memakai UUID v7 (`uuid`). Waktu disimpan sebagai epoch detik.
- Penghapusan bersifat *soft delete* (`deleted_at`).
- Data selalu dibatasi pada faskes di token.

### 3.2 Respons sukses

Layanan inti (admisi, rawat jalan, IGD, rawat inap, rekam medis, farmasi, payment, inventory, dll.):

```json
{
  "message": "Berhasil Menampilkan Pasien",
  "payload": { },
  "properties": { }
}
```

`payload` berisi data, sedangkan `properties` hanya ada pada daftar berhalaman. `setting-service` menambahkan `"status": "success"`. Layanan integrasi (bpjs, satusehat, penunjang, program-puskesmas, lab/lis) memakai `{ "message": "...", "payload": ... }` dan, untuk daftar berhalaman, `pagination`.

### 3.3 Respons galat

Bentuk umum layanan inti:

```json
{
  "message": "Validation Error",
  "errors": [{ "field": "no_identity", "message": "..." }]
}
```

| Kode | Arti |
|------|------|
| `400` | Validasi gagal (Zod), data duplikat, atau permintaan salah |
| `401` | Token tidak ada, tidak valid, kedaluwarsa, atau sudah logout |
| `403` | Tidak punya izin, fitur/modul tidak aktif, atau kunci API salah |
| `404` | Data tidak ditemukan |
| `422` | Ditolak sistem eksternal (mis. kirim SATUSEHAT/PCare gagal) |
| `429` | Batas laju terlampaui (lihat [bagian 4](#4-batas-laju)) |
| `500` | Galat server |

Layanan integrasi (bpjs, satusehat, penunjang, program-puskesmas) menjawab galat cukup dengan `{ "message": "..." }`. Titik masuk bridging menjawab `{ "success": false, "message": "..." }`.

### 3.4 Paginasi

Tidak semua layanan memakai format paginasi yang sama.

**Admisi dan layanan inti lain** (`properties`). Contoh: daftar pasien.

```http
GET /api/v3/admisi/patient?page=1&limit=10&q=budi&status=semua
```

- `page` (bawaan 1), `limit` (bawaan 10);
- `q` mencari nama, No. RM, No. identitas, atau alamat;
- `status`: `aktif`, `nonaktif`, atau `semua` (bawaan: hanya pasien aktif).

```json
{
  "message": "Berhasil Menampilkan Pasien",
  "payload": [ { "uuid": "...", "no_rm": "...", "name": "Budi Contoh" } ],
  "properties": {
    "page": 1,
    "page_size": 10,
    "total_page": 3,
    "total_data": 25,
    "next_page": 2,
    "prev_page": null
  }
}
```

**Layanan integrasi** (bpjs, satusehat, penunjang) memakai `pagination`:

```json
{
  "message": "Data berhasil ditampilkan",
  "payload": [ ],
  "pagination": { "page": 1, "limit": 10, "total": 25 }
}
```

`penunjang-service` juga menyertakan `total_page` dan menerima `page_size` sebagai alias `limit`. `satusehat-service` membatasi `limit` paling banyak 100. Nama parameter pencarian berbeda per endpoint (`q`, `cari`, `search`), jadi lihat berkas rute masing-masing.

---

## 4. Batas laju

Batas laju (`express-rate-limit`) hanya aktif di dua layanan:

| Layanan | Batas |
|---------|-------|
| `payment-service` | 100 permintaan / 5 menit per IP |
| `rawat-inap-service` | 100 permintaan / 5 menit per IP |

Bila batas terlampaui, layanan menjawab `429` dengan teks `Too many requests from this IP, please try again after 5 minutes`. Layanan lain tidak menerapkan batas laju di tingkat aplikasi. Batas di gateway atau reverse proxy bergantung pada konfigurasi server masing-masing.

---

## 5. Referensi endpoint per layanan

Path ditulis lengkap. `:uuid` dan sejenisnya adalah parameter path. Semua endpoint mewajibkan `Authorization: Bearer <token>` kecuali disebut lain.

### 5.1 Auth — `/api/v3/auth`

Berkas: `auth-service/src/routes/public-route.js`, `private-route.js`.

| Metode | Path | Keterangan | Izin |
|--------|------|------------|------|
| POST | `/api/v3/auth/login` | Login (tanpa token) | — |
| POST | `/api/v3/auth/refresh-token` | Perbarui token (tanpa header Authorization) | — |
| PUT | `/api/v3/auth/token/:faskes` | Ganti faskes aktif | Peran `super admin` |
| DELETE | `/api/v3/auth/logout` | Logout | — |
| GET | `/api/v3/auth/user` | Daftar pengguna | — |
| GET | `/api/v3/auth/user/deleted` | Daftar pengguna terhapus | — |
| POST | `/api/v3/auth/user` | Tambah pengguna | — |
| PUT | `/api/v3/auth/user/:uuid` | Ubah pengguna | — |
| PATCH | `/api/v3/auth/user/:uuid` | Ubah sandi pengguna | — |
| DELETE | `/api/v3/auth/user/:uuid` | Hapus pengguna | — |
| GET | `/api/v3/auth/user/:uuid/user-role` | Detail pengguna beserta peran | — |
| POST | `/api/v3/auth/user/import` | Impor pengguna (berkas, maks. 50 MB) | — |
| GET | `/api/v3/auth/user/export` | Ekspor pengguna | — |
| GET | `/api/v3/auth/permission/katalog` | Katalog izin modul (editor peran) | — |
| POST | `/api/v3/auth/permission/sinkron-modul` | Sinkron izin modul aktif ke peran admin | — |
| POST | `/api/v3/auth/permission/muat-ulang` | Muat ulang izin sesi | — |
| GET | `/api/v3/auth/health` | Cek kesehatan | Admisi › Laporan Admisi › Kunjungan › READ |

### 5.2 Admisi — `/api/v3/admisi`

Berkas: `admisi-service/src/routes/routes.js`.

**Pasien**

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/admisi/patient` | Daftar pasien (`page`, `limit`, `q`, `status`) |
| GET | `/api/v3/admisi/patient/:uuid` | Detail pasien |
| POST | `/api/v3/admisi/patient` | Daftarkan pasien baru |
| PUT | `/api/v3/admisi/patient/:uuid` | Ubah data pasien |
| PUT | `/api/v3/admisi/patient/aktifkan` | Aktifkan kembali pasien |
| DELETE | `/api/v3/admisi/patient/cancel` | Nonaktifkan pasien |
| DELETE | `/api/v3/admisi/patient/hapus` | Hapus pasien |
| GET | `/api/v3/admisi/patient/history/:uuid` | Riwayat kunjungan pasien |
| GET | `/api/v3/admisi/patient/internal/identity-check` | Cek nomor identitas |
| POST | `/api/v3/admisi/patient/check-patient/apm` | Cek pasien terdaftar (APM) |
| POST | `/api/v3/admisi/patient/import` | Impor pasien |
| GET | `/api/v3/admisi/download` | Unduh templat impor pasien |
| GET / PUT / DELETE | `/api/v3/admisi/file/:uuid` | Lihat / unggah / hapus berkas pasien |

**Registrasi kunjungan**

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/admisi/rawat-jalan` | Daftar kunjungan rawat jalan |
| GET | `/api/v3/admisi/rawat-jalan/today` | Kunjungan rawat jalan hari ini |
| POST | `/api/v3/admisi/rawat-jalan` | Registrasi rawat jalan |
| POST | `/api/v3/admisi/rawat-jalan/apm` | Registrasi rawat jalan dari APM |
| GET | `/api/v3/admisi/rawat-jalan/jadwal-dokter` | Jadwal dokter |
| GET | `/api/v3/admisi/rawat-jalan/:uuid` | Detail kunjungan |
| PUT | `/api/v3/admisi/rawat-jalan/:uuid` | Ubah kunjungan |
| PUT | `/api/v3/admisi/rawat-jalan/farmasi/:uuid` | Ubah data farmasi kunjungan |
| POST | `/api/v3/admisi/rawat-jalan/check-booking` | Cek booking |
| POST | `/api/v3/admisi/rawat-jalan/print-booking` | Data cetak booking |
| DELETE | `/api/v3/admisi/rawat-jalan/cancel` | Batalkan kunjungan rawat jalan |
| GET | `/api/v3/admisi/igd` | Daftar kunjungan IGD |
| GET | `/api/v3/admisi/igd/:uuid` | Detail kunjungan IGD |
| POST | `/api/v3/admisi/igd` | Registrasi IGD |
| PUT | `/api/v3/admisi/igd/:uuid` | Ubah kunjungan IGD |
| DELETE | `/api/v3/admisi/igd/cancel` | Batalkan kunjungan IGD |
| GET | `/api/v3/admisi/rawat-inap` | Daftar kunjungan rawat inap |
| GET | `/api/v3/admisi/rawat-inap/:uuid` | Detail kunjungan rawat inap |
| POST | `/api/v3/admisi/rawat-inap` | Registrasi rawat inap |
| POST | `/api/v3/admisi/rawat-inap/spri` | Registrasi rawat inap dari SPRI |
| PUT | `/api/v3/admisi/rawat-inap/:uuid` | Ubah kunjungan rawat inap |
| DELETE | `/api/v3/admisi/rawat-inap/cancel` | Batalkan kunjungan rawat inap |

**Lain-lain**

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/admisi/monitoring-rooms` | Monitoring kamar |
| GET | `/api/v3/admisi/monitoring-rooms/:uuid` | Detail kamar |
| PATCH | `/api/v3/admisi/monitoring-rooms/:uuid` | Ubah status bed |
| POST / GET / DELETE | `/api/v3/admisi/general-consent/:uuid` | Tambah / daftar / hapus general consent |
| GET | `/api/v3/admisi/general-consent/detail/:uuid` | Detail general consent |
| GET | `/api/v3/admisi/report/{kunjungan, cancel-visit, room, rawat-inap, new-born}` | Laporan admisi |
| GET | `/api/v3/admisi/export/{kunjungan, batal-kunjungan, status-kamar, keperawatan-inap, new-born}` | Ekspor Excel |
| GET | `/api/v3/admisi/rekap/{jenis-kunjungan, dokter, penjamin}` | Rekap kunjungan |
| GET | `/api/v3/admisi/antrian-call` | Daftar panggilan antrian |
| PUT | `/api/v3/admisi/antrian-call/:uuid` | Ubah status panggilan |

**Mobile (kunci API, tanpa JWT)**: header `x-api-key` + `faskes-uuid`.

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/admisi/mobile/pasien/{bootstrap, faskes, poliklinik, patients, jadwal-dokter, bookings}` | Data aplikasi pasien |
| POST | `/api/v3/admisi/mobile/pasien/patients/check` | Cek pasien |
| POST | `/api/v3/admisi/mobile/pasien/bookings` | Buat booking |
| DELETE | `/api/v3/admisi/mobile/pasien/bookings/cancel` | Batalkan booking |
| POST | `/api/v3/admisi/patient/check-patient` | Cek pasien terdaftar |
| GET | `/api/v3/admisi/rawat-jalan/mobile`, `/rawat-jalan/mobile/today` | Daftar kunjungan |
| POST | `/api/v3/admisi/rawat-jalan/mobile` | Registrasi rawat jalan dari mobile |
| DELETE | `/api/v3/admisi/rawat-jalan/mobile/cancel` | Batalkan kunjungan |
| GET | `/api/v3/admisi/rawat-jalan/mobile/jadwal-pemeriksaan/:uuid` | Jadwal pemeriksaan (cukup `x-api-key`) |

### 5.3 Rawat Jalan — `/api/v3/rajal`

Berkas: `rawat-jalan-service/src/routes/routes.js`. Registrasi rawat jalan ada di [Admisi](#52-admisi--apiv3admisi), sedangkan pelayanan (asesmen, tindakan, resep) dicatat lewat [Rekam Medis](#58-rekam-medis--apiv3rekam-medis).

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/rajal/antrian-call` | Antrian poli |
| GET | `/api/v3/rajal/antrian-call/konteks` | Konteks petugas (poli/dokter) |
| PUT | `/api/v3/rajal/antrian-call/:uuid` | Ubah status antrian |
| PUT | `/api/v3/rajal/antrian-call/kunjungan/:rawatJalanUuid/periksa` | Mulai pemeriksaan |
| GET | `/api/v3/rajal/report/kunjungan` | Laporan kunjungan |
| GET | `/api/v3/rajal/report/batal-kunjungan` | Laporan batal kunjungan |
| GET | `/api/v3/rajal/report/laporan-tindakan` | Laporan tindakan (alias: `/api/v3/rajal/laporan-tindakan`) |

### 5.4 IGD — `/api/v3/pelayanan`

Berkas: `igd-service/src/routes/routes.js`. Registrasi IGD ada di Admisi (`/api/v3/admisi/igd`), sedangkan pelayanan dicatat lewat Rekam Medis.

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/pelayanan/igd/report/kunjungan` | Laporan kunjungan IGD |
| GET | `/api/v3/pelayanan/igd/report/batal-kunjungan` | Laporan batal kunjungan IGD |

### 5.5 Rawat Inap — `/api/v3/ranap`

Berkas: `rawat-inap-service/src/routes/router.js`, `icu-routes.js`. Registrasi rawat inap ada di Admisi (`/api/v3/admisi/rawat-inap`). Layanan ini dikenai [batas laju](#4-batas-laju).

| Metode | Path | Keterangan | Izin |
|--------|------|------------|------|
| GET | `/api/v3/ranap/transfer-bed/current-bed/:uuid` | Bed saat ini | — |
| POST | `/api/v3/ranap/transfer-bed/request/:uuid` | Ajukan pindah bed | — |
| PUT | `/api/v3/ranap/transfer-bed/approve/:uuid` | Setujui pindah bed | — |
| PUT | `/api/v3/ranap/transfer-bed/reject/:uuid` | Tolak pindah bed | — |
| GET | `/api/v3/ranap/transfer-bed/all` | Daftar permintaan pindah | — |
| GET | `/api/v3/ranap/transfer-bed/history/:uuid` | Riwayat pindah bed | — |
| GET | `/api/v3/ranap/transfer-bed/request/detail/:uuid` | Detail permintaan | — |
| GET | `/api/v3/ranap/transfer-bed/total-pending` | Jumlah permintaan tertunda | — |
| GET | `/api/v3/ranap/report/{kunjungan, batal-kunjungan, perpindahan}` | Laporan rawat inap | — |
| GET | `/api/v3/ranap/icu/dashboard` | Dasbor ICU | ICU › Dasbor › READ |
| GET | `/api/v3/ranap/icu/perawatan/:perawatan_uuid` | Detail perawatan ICU | ICU › Perawatan › READ |
| POST | `/api/v3/ranap/icu/perpindahan/:perpindahan_uuid/mulai` | Mulai perawatan ICU | ICU › Serah Terima › KELOLA |
| POST | `/api/v3/ranap/icu/perawatan/:perawatan_uuid/keluar` | Keluar ICU | ICU › Serah Terima › KELOLA |
| POST / GET | `/api/v3/ranap/icu/perawatan/:perawatan_uuid/observasi` | Flowsheet observasi | ICU › Flowsheet Observasi › CREATE / READ |
| POST | `/api/v3/ranap/icu/observasi/:observasi_uuid/koreksi` | Koreksi observasi | ICU › Flowsheet Observasi › KOREKSI |
| POST | `/api/v3/ranap/icu/perawatan/:perawatan_uuid/intake-output` | Catat intake/output | ICU › Balance Cairan › CREATE |
| GET | `/api/v3/ranap/icu/perawatan/:perawatan_uuid/balance` | Balance cairan | ICU › Balance Cairan › READ |
| POST / GET | `/api/v3/ranap/icu/perawatan/:perawatan_uuid/skor-sofa` | Skor SOFA | ICU › Skor SOFA › CREATE / READ |
| GET | `/api/v3/ranap/icu/laporan` | Laporan ICU | ICU › Laporan ICU › READ |

### 5.6 Farmasi — `/api/v3/farmasi`

Berkas: `farmasi-service/src/routes/routes.js` (±127 endpoint). Izin memakai modul **Farmasi**.

**Datamaster.** Pola `POST` / `GET` / `PUT :uuid` / `DELETE :uuid` / `POST import` / `GET export` berlaku untuk `satuan`, `bentuk-sediaan`, `kategori-obat`, `manufacture`, `cara-pakai`, `jenis-stok`, `lokasi-stok`, `aturan-pakai`, dan `ingredient` di bawah `/api/v3/farmasi/datamaster/<nama>`. `bentuk-racikan` hanya punya CRUD tanpa impor/ekspor. Contoh: `GET /api/v3/farmasi/datamaster/satuan` (izin Farmasi › Datamaster › Satuan › READ).

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/farmasi/datamaster/item-medis/all` | Daftar item medis |
| GET | `/api/v3/farmasi/datamaster/item-medis/without-pagination` | Daftar item medis tanpa paginasi |
| POST | `/api/v3/farmasi/datamaster/item-medis` | Tambah item medis |
| PUT / DELETE | `/api/v3/farmasi/datamaster/item-medis/:uuid` | Ubah / hapus item medis |
| GET | `/api/v3/farmasi/datamaster/item-medis/:uuid/conversions` | Konversi satuan item |
| GET / PUT | `/api/v3/farmasi/datamaster/konfig-harga` | Konfigurasi harga |
| GET | `/api/v3/farmasi/datamaster/harga-item`, `/harga-item/:uuid` | Harga item |

**Resep, penjualan, alkes**

| Metode | Path | Keterangan | Izin (Farmasi › …) |
|--------|------|------------|--------------------|
| POST | `/api/v3/farmasi/prescriptions/all` | Daftar resep | Resep Dokter › READ |
| GET | `/api/v3/farmasi/prescriptions/:uuid` | Detail resep | Resep Dokter › READ |
| GET | `/api/v3/farmasi/prescriptions/fpo` | Data FPO | Resep Dokter › READ |
| POST | `/api/v3/farmasi/prescriptions/first-order`, `/add-obat` | Order / tambah obat | Resep Dokter › UPDATE OBAT |
| POST | `/api/v3/farmasi/prescriptions/status-telaah` | Simpan telaah | Resep Dokter › RESEP MASUK SIMPAN TELAAH |
| POST | `/api/v3/farmasi/prescriptions/status-verifikasi` | Verifikasi resep | Resep Dokter › RESEP MASUK VERIFIKASI |
| POST | `/api/v3/farmasi/prescriptions/status-siap-diserahkan` | Obat siap diserahkan | Resep Dokter › … SIAP DISERAHKAN |
| POST | `/api/v3/farmasi/prescriptions/status-diserahkan` | Serahkan obat | Resep Dokter › PENYERAHAN OBAT SERAHKAN OBAT |
| POST | `/api/v3/farmasi/prescriptions/batal-order` | Batal order | Resep Dokter › RESEP MASUK BATAL ORDER |
| GET | `/api/v3/farmasi/cetak/{e-ticket, e-resep, invoice}/:uuid` | Cetak etiket / e-resep / invoice | Resep Dokter › … CETAK |
| POST | `/api/v3/farmasi/penjualan-obat` | Penjualan obat bebas | Penjualan Obat › CREATE BELI OBAT |
| GET | `/api/v3/farmasi/penjualan-obat`, `/penjualan-obat/:uuid` | Daftar / detail penjualan | Penjualan Obat › READ |
| PUT | `/api/v3/farmasi/penjualan-obat/:uuid/cancel` | Batal penjualan | Penjualan Obat › BATAL PEMBELIAN |
| POST | `/api/v3/farmasi/alkes` | Order alkes dari RME | Farmasi Ruangan atau izin alkes di RME |
| POST | `/api/v3/farmasi/alkes/all` | Daftar order alkes | Farmasi Ruangan › READ |
| GET | `/api/v3/farmasi/alkes/:uuid` | Detail order alkes | Farmasi Ruangan atau izin alkes di RME |
| POST | `/api/v3/farmasi/retur` | Retur obat/material | Retur Obat dan Material › RETUR |
| POST | `/api/v3/farmasi/riwayat/all`, `/riwayat/detail` | Riwayat transaksi | Riwayat Transaksi › READ |
| GET | `/api/v3/farmasi/rekap/{pendapatan, tat, pendapatan-apotik}` | Rekap farmasi | Riwayat Transaksi › READ (per fitur) |

### 5.7 Stok Farmasi — `/api/v3/stok`

Berkas: `stok-farmasi-service/src/routes/routes.js`.

| Metode | Path | Keterangan |
|--------|------|------------|
| POST / GET | `/api/v3/stok/permintaan-unit` | Buat / daftar permintaan unit |
| GET | `/api/v3/stok/permintaan-unit/:uuid`, `/:uuid/cetak` | Detail / cetak permintaan |
| PUT | `/api/v3/stok/permintaan-unit/:uuid/status` | Ubah status penerimaan |
| GET | `/api/v3/stok/permintaan-unit/search-item` | Cari item |
| POST / GET | `/api/v3/stok/pengeluaran-unit` | Buat / daftar pengeluaran unit |
| GET | `/api/v3/stok/pengeluaran-unit/:uuid`, `/search-item` | Detail / cari item |
| POST / GET | `/api/v3/stok/retur-unit` | Buat / daftar retur unit |
| GET | `/api/v3/stok/retur-unit/:uuid` | Detail retur |
| GET | `/api/v3/stok/health` | Cek kesehatan |

### 5.8 Rekam Medis — `/api/v3/rekam-medis`

Berkas: `rekamedis-service/src/routes/routes.js`. Isi RME disimpan di MongoDB.

| Metode | Path | Keterangan |
|--------|------|------------|
| GET / POST | `/api/v3/rekam-medis/patient` | Ambil / buat rekam medis pasien |
| POST | `/api/v3/rekam-medis/record` | Tambah catatan |
| POST / DELETE | `/api/v3/rekam-medis/session` | Buka / tutup sesi pelayanan |
| POST | `/api/v3/rekam-medis/assessment` | Simpan asesmen |
| POST | `/api/v3/rekam-medis/tindakan` | Simpan tindakan |
| POST | `/api/v3/rekam-medis/order-obat` | Kirim order obat ke farmasi |
| GET | `/api/v3/rekam-medis/item-before` | Item pelayanan sebelumnya |
| GET / POST / PUT | `/api/v3/rekam-medis/chat/catatan` | Catatan perawat |
| GET / POST / PUT | `/api/v3/rekam-medis/chat/instruksi` | Instruksi medis |
| GET / POST / PUT | `/api/v3/rekam-medis/fpo` | Formulir pemberian obat |
| GET / POST | `/api/v3/rekam-medis/inform-consent` | Daftar / buat inform consent |
| GET / DELETE | `/api/v3/rekam-medis/inform-consent/:uuid` | Detail / hapus inform consent |
| GET / PUT | `/api/v3/rekam-medis/pelayanan/resume` | Resume medis |
| PUT | `/api/v3/rekam-medis/pelayanan/discharge` | Pulangkan pasien |
| POST | `/api/v3/rekam-medis/pelayanan/billing-layanan` | Buat tagihan layanan |
| GET | `/api/v3/rekam-medis/pelayanan/history` | Riwayat pelayanan |
| GET / POST / PUT / DELETE | `/api/v3/rekam-medis/pelayanan/files` | Berkas pelayanan |
| GET | `/api/v3/rekam-medis/pelayanan/files/{letters, letter/download, generate-code}` | Surat keterangan |

### 5.9 Pembayaran — `/api/v3/payment`

Berkas: `payment-service/src/routes/router.js`. Layanan ini dikenai [batas laju](#4-batas-laju).

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/payment/cashier/check` | Status kasir (buka/tutup) |
| POST | `/api/v3/payment/cashier/open` | Buka kasir |
| POST | `/api/v3/payment/cashier/close` | Tutup shift |
| GET | `/api/v3/payment/cashier/close-day/check` | Konfirmasi tutup hari |
| POST | `/api/v3/payment/cashier/close/day` | Tutup hari |
| GET | `/api/v3/payment/pelayanan` | Daftar tagihan pelayanan |
| GET | `/api/v3/payment/aps-otc` | Daftar tagihan APS/OTC |
| GET | `/api/v3/payment/payment` | Cari pembayaran |
| GET | `/api/v3/payment/:uuid` | Detail tagihan |
| GET | `/api/v3/payment/:uuid/items` | Item tagihan |
| GET | `/api/v3/payment/:uuid/detail` | Rincian pembayaran |
| GET | `/api/v3/payment/:uuid/pasien` | Data pasien tagihan |
| POST | `/api/v3/payment/:uuid/voucher` | Terapkan voucher |
| POST | `/api/v3/payment/:uuid/discount` | Terapkan diskon |
| POST | `/api/v3/payment/:uuid/payment` | Bayar tagihan |
| POST | `/api/v3/payment/:uuid/close` | Tutup tagihan |
| GET | `/api/v3/payment/closed-bills` | Tagihan tertutup |
| GET | `/api/v3/payment/closed-bills/:uuid/history` | Riwayat pembayaran |
| POST | `/api/v3/payment/closed-bills/:uuid/pay` | Bayar piutang tagihan tertutup |
| GET | `/api/v3/payment/report/{cashier, payment, revenue}` | Laporan kasir / pembayaran / pendapatan |
| GET | `/api/v3/payment/mobile-patient/bills` | Tagihan pasien (aplikasi pasien) |
| POST | `/api/v3/payment/internal/bills` | Pembuatan tagihan antar-layanan (internal) |

### 5.10 Laboratorium — `/api/v3/lab`

Berkas: `lab-service/src/routes/routes.js`, `lab-service/src/lis/lis-rute.js`.

**Datamaster.** Pola `POST` / `GET` / `GET active` / `GET :uuid` / `PUT :uuid` / `DELETE :uuid` / `POST import` berlaku untuk `category-pemeriksaan`, `item-pemeriksaan`, `spesimen`, `kelompok-pemeriksaan`, `tarif-lab`, dan `lab-rujukan` di bawah `/api/v3/lab/<nama>`.

| Metode | Path | Keterangan |
|--------|------|------------|
| POST | `/api/v3/lab/nilai-rujukan/` | Tambah nilai rujukan |
| GET | `/api/v3/lab/nilai-rujukan/:item_pemeriksaan_uuid` | Nilai rujukan per item |
| GET | `/api/v3/lab/nilai-rujukan/show/:uuid` | Detail nilai rujukan |
| PUT / DELETE | `/api/v3/lab/nilai-rujukan/:uuid` | Ubah / hapus |
| POST | `/api/v3/lab/order-lab` | Buat order lab |
| GET | `/api/v3/lab/order-lab` | Daftar order lab |
| GET / PUT | `/api/v3/lab/order-lab/:uuid` | Detail / ubah order |
| PUT | `/api/v3/lab/order-lab-batal` | Batalkan order |
| PUT | `/api/v3/lab/order-lab-selesai-periksa/:uuid` | Selesai periksa |
| PUT | `/api/v3/lab/order-lab-validasi/:uuid` | Validasi order |
| PUT | `/api/v3/lab/order-lab-batal-validasi` | Batal validasi |
| POST | `/api/v3/lab/hasil-pemeriksaan` | Simpan hasil |
| GET | `/api/v3/lab/hasil-pemeriksaan/:uuid` | Lihat hasil |
| POST | `/api/v3/lab/expertise/:uuid` | Simpan expertise |
| PUT | `/api/v3/lab/batal-expertise/:uuid` | Batal expertise |
| GET | `/api/v3/lab/{laporan-kunjungan, laporan-tat, rekap-pemeriksaan, rekap-pemeriksaan-per-tanggal}` | Laporan & rekap |
| PUT | `/api/v3/lab/observation-item/:uuid/{tandai-rujukan, batal-rujukan, kirim-rujukan}` | Rujukan pemeriksaan ke lab luar |
| GET / POST / DELETE | `/api/v3/lab/observation-item/:uuid/berkas-rujukan` | Berkas hasil rujukan |

**Bridging LIS** (`/api/v3/lab/lis`)

| Metode | Path | Keterangan | Izin |
|--------|------|------------|------|
| GET | `/api/v3/lab/lis/koneksi` | Daftar koneksi LIS | Setting › Konfigurasi Integrasi › READ, atau Laboratorium › Order Lab / Hasil Pemeriksaan › READ |
| POST / PUT / DELETE | `/api/v3/lab/lis/koneksi[/:uuid]` | Kelola koneksi | Setting › Konfigurasi Integrasi › UPDATE KONFIGURASI LAINNYA |
| PUT | `/api/v3/lab/lis/koneksi/:uuid/bawaan` | Jadikan LIS bawaan | idem |
| POST | `/api/v3/lab/lis/koneksi/:uuid/kunci-masuk` | Terbitkan kunci masuk | idem |
| GET / PUT | `/api/v3/lab/lis/{pemetaan-item, pemetaan-tarif, pemetaan-ref}` | Pemetaan kode LIS | Datamaster lab atau Konfigurasi Integrasi |
| GET | `/api/v3/lab/lis/kirim`, `/kirim/:orderUuid`, `/kirim/:orderUuid/pratinjau` | Status & pratinjau kiriman | Order Lab / Hasil Pemeriksaan / Konfigurasi Integrasi › READ |
| POST | `/api/v3/lab/lis/kirim/:orderUuid` | Kirim order ke LIS | Laboratorium › Order Lab › VALIDASI ORDER |
| POST | `/api/v3/lab/lis/tarik/:orderUuid` | Tarik hasil dari LIS | Laboratorium › Hasil Pemeriksaan › SIMPAN HASIL |
| GET / POST | `/api/v3/lab/lis/batch[/:uuid]` | Kirim massal (batch) | izin sesuai sumber batch |
| POST | `/api/v3/lab/lis/batch/:uuid/{ulang, hentikan}` | Ulang / hentikan batch | izin sesuai sumber batch |

Titik masuk hasil dari LIS (tanpa JWT) ada di [bagian 6](#6-titik-masuk-bridging-tanpa-jwt).

### 5.11 Penunjang — `/api/v3/penunjang`

Berkas: `penunjang-service/src/rute.js` dan `penunjang-service/src/<modul>/rute.js` (±840 endpoint). Setiap modul mensyaratkan modul atau fiturnya aktif untuk faskes. Daftar subpath tiap modul tertulis di komentar kepala berkas `rute.js`-nya.

| Awalan | Modul | Subpath utama |
|--------|-------|---------------|
| `/api/v3/penunjang/radiologi` | Radiologi | `/pemeriksaan`, `/paket`, `/order`, `/order/kunjungan`, `/worklist`, `/item/:uuid`, `/jadwal`, `/ruang`, `/template`, `/petugas`, `/laporan/kunjungan`, `/referensi/*`, `/pacs` |
| `/api/v3/penunjang/patologi` | Patologi Anatomi | `/pemeriksaan`, `/template`, `/petugas`, `/order`, `/kasus`, `/arsip`, `/laporan/kunjungan`, `/referensi/*`, `/lis` |
| `/api/v3/penunjang/mikrobiologi` | Mikrobiologi Klinik | `/pemeriksaan`, `/organisme`, `/antibiotik`, `/panel`, `/order`, `/worklist`, `/item/:uuid`, `/laporan/*`, `/lis` |
| `/api/v3/penunjang/mcu` | Medical Check Up | perusahaan, paket, peserta, impor, pemeriksaan, invoice, laporan, LIS, PCare |
| `/api/v3/penunjang/fisioterapi` | Fisioterapi / Rehab Medik | `/bed`, `/tindakan`, `/paket`, `/order`, `/slot`, `/jadwal`, `/booking`, `/evaluasi`, `/laporan/*` |
| `/api/v3/penunjang/kamar-operasi` | Kamar Operasi | `/ruang`, `/orders`, `/jadwal` (+ pra-operasi, checklist, laporan operasi/anestesi, pemakaian), `/laporan/rekap` |
| `/api/v3/penunjang/bank-darah` | Bank Darah RS | `/komponen`, `/pengaturan`, `/permintaan`, `/serah-terima`, `/transfusi`, `/reaksi`, `/laporan`, `/utd` |
| `/api/v3/penunjang/utd` | UTD | `/donor`, `/aftap`, `/imltd/worklist`, `/komponen`, `/permintaan`, `/distribusi`, `/laporan`, `/pengaturan` |
| `/api/v3/penunjang/hemodialisa` | Hemodialisa | `/mesin`, `/shift`, `/registrasi`, `/jadwal`, `/resep`, `/sesi`, `/dializer`, `/laporan`, `/hdis` |
| `/api/v3/penunjang/gizi` | Gizi | `/master/*`, `/rawat-inap/:uuid/{skrining, asesmen, order-diet}`, `/distribusi`, `/laporan` |
| `/api/v3/penunjang/cssd` | CSSD | `/master-set`, `/mesin`, `/set`, `/load`, `/stok`, `/distribusi`, `/recall`, `/laporan/*` |
| `/api/v3/penunjang/laundry` | Laundry & Linen | `/linen`, `/stok`, `/penerimaan`, `/batch`, `/distribusi`, `/unit`, `/laporan` |
| `/api/v3/penunjang/ambulans` | Ambulans | `/armada`, `/kru`, `/permintaan`, `/penugasan`, `/perjalanan`, `/tarif`, `/laporan` |
| `/api/v3/penunjang/sarpras` | Sarana & Prasarana | `/aset`, `/laporan-kerusakan`, `/pemeliharaan/jadwal`, `/kalibrasi`, `/utilitas`, `/laporan/*` |
| `/api/v3/penunjang/koding` | Koding Rekam Medis | `/worklist`, `/kunjungan/:tipe/:uuid`, `/checklist`, `/peminjaman`, `/retensi`, `/laporan/*` |
| `/api/v3/penunjang/mutu` | Mutu & Akreditasi | `/instrumen`, `/dokumen`, `/kredensial`, `/dasbor`, `/indikator/*`, `/ikp/*` |
| `/api/v3/penunjang/hr` | HR / SDM | `/referensi`, `/kepegawaian`, `/kredensial` |
| `/api/v3/penunjang/training` | Training | `/kelas`, `/slot`, `/booking`, `/order`, `/laporan/rekapitulasi` |

Contoh endpoint radiologi (`penunjang-service/src/radiologi/order.js`, `hasil.js`):

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/penunjang/radiologi/order` | Daftar order (paginasi `page`, `limit`) |
| GET | `/api/v3/penunjang/radiologi/order/kunjungan` | Order per kunjungan (`rekam_medis_uuid`, `no_reg`, `patient_uuid`) |
| GET | `/api/v3/penunjang/radiologi/order/:uuid` | Detail order |
| POST | `/api/v3/penunjang/radiologi/order` | Buat order (`patient_uuid` wajib) |
| PUT | `/api/v3/penunjang/radiologi/order/:uuid` | Ubah order |
| POST | `/api/v3/penunjang/radiologi/order/:uuid/validasi` | Validasi order (membuat tagihan) |
| POST | `/api/v3/penunjang/radiologi/order/:uuid/batal` | Batalkan order |
| GET | `/api/v3/penunjang/radiologi/worklist` | Worklist pemeriksaan |
| GET | `/api/v3/penunjang/radiologi/item/:uuid` | Detail item pemeriksaan |
| POST | `/api/v3/penunjang/radiologi/item/:uuid/periksa` | Catat pemeriksaan radiografer |
| PUT | `/api/v3/penunjang/radiologi/item/:uuid/hasil` | Simpan expertise |

### 5.12 Laporan & Dashboard — `/api/v3/laporan`

Berkas: `laporan-service/src/routes/laporan-routes.js`, `dashboard-routes.js`, `src/ekstensi/ekstensi-routes.js`.

| Metode | Path | Keterangan | Izin |
|--------|------|------------|------|
| GET | `/api/v3/laporan/rekap/{status-rawat, tindakan, pemeriksaan-lab, diagnosis}` | Rekapitulasi | — |
| GET | `/api/v3/laporan/rekap/{status-rawat, tindakan, pemeriksaan-lab, diagnosis}/export` | Ekspor rekapitulasi | — |
| GET | `/api/v3/laporan/dashboard/rekap` | Ringkasan dashboard | — |
| GET | `/api/v3/laporan/dashboard/rekap/{rawat-jalan, status-rawat, pasien, gender, pendapatan, poli, dpjp}` | Komponen dashboard | — |
| GET | `/api/v3/laporan/dashboard/eksekutif` | Dashboard eksekutif | Dashboard › Eksekutif › READ |
| GET | `/api/v3/laporan/dashboard/eksekutif/rincian/:kode` | Rincian indikator | Dashboard › Eksekutif › RINCIAN |
| POST | `/api/v3/laporan/dashboard/eksekutif/ekspor` | Ekspor PDF | Dashboard › Eksekutif › EKSPOR PDF |
| GET | `/api/v3/laporan/dashboard/eksekutif/target` | Lihat target | Dashboard › Eksekutif › READ atau ATUR TARGET |
| PUT | `/api/v3/laporan/dashboard/eksekutif/target` | Atur target | Dashboard › Eksekutif › ATUR TARGET |
| GET | `/api/v3/laporan/ekstensi` | Ekstensi SIMRS Studio terpasang (disaring menurut izin) | — |
| POST | `/api/v3/laporan/ekstensi/:kode/jalankan` | Jalankan ekstensi laporan | — |
| GET / POST | `/api/v3/laporan/ekstensi/:kode/isian` | Daftar / simpan isian formulir ekstensi | — |
| PUT / DELETE | `/api/v3/laporan/ekstensi/:kode/isian/:uuid` | Ubah / hapus isian | — |

Pengelolaan ekstensi (`/ekstensi/kelola`, `/validasi`, `/pratinjau`, `/impor`, `/:uuid/pasang`, `/:uuid/copot`) hanya untuk superadmin.

### 5.13 Setting — `/api/v3/setting`

Berkas: `setting-service/src/routes/routes.js`, `audit-trail-routes.js`. Lihat juga catatan [versi API](#13-versi-api).

| Metode | Path | Keterangan | Izin |
|--------|------|------------|------|
| GET / PUT | `/api/v3/setting/profil-faskes` | Profil faskes | — |
| GET / PUT | `/api/v3/setting/ppn` | PPN | — |
| GET / PUT | `/api/v3/setting/biaya-administrasi` | Biaya administrasi | — |
| GET | `/api/v3/setting/-/profile-faskes`, `/-/profile-faskes/:faskesUuid` | Profil faskes beserta alamat | — |
| GET | `/api/v3/setting/integrasi` | Konfigurasi integrasi | — |
| PUT | `/api/v3/setting/integrasi-vclaim`, `/integrasi-satu-sehat`, `/integrasi-other` | Simpan konfigurasi integrasi | — |
| GET / PUT | `/api/v3/setting/profile` | Profil pengguna | — |
| GET / PUT | `/api/v3/setting/printer` | Pengaturan printer | — |
| GET | `/api/v3/setting/modul` | Segmen, modul & fitur aktif faskes | — |
| PUT | `/api/v3/setting/modul` | Simpan modul aktif | Superadmin |
| GET | `/api/v3/setting/modul/riwayat` | Riwayat perubahan modul | — |
| PUT | `/api/v3/setting/modul/jenis-poli` | Simpan jenis poli | Superadmin |
| GET | `/api/v3/setting/bantuan/status`, `/bantuan/ringkasan` | Status & ringkasan Helpdesk | — |
| POST | `/api/v3/setting/bantuan/chat` | Chat Helpdesk | — |
| GET / PUT | `/api/v3/setting/bantuan/konfigurasi` | Konfigurasi Helpdesk | Superadmin |
| POST | `/api/v3/setting/bantuan/konfigurasi/uji` | Uji konfigurasi Helpdesk | Superadmin |
| GET | `/api/v3/setting/audit-trail` | Cari audit trail | Setting › Audit Trail › LIHAT |
| GET | `/api/v3/setting/audit-trail/pasien/:patientUuid` | Audit trail per pasien | Setting › Audit Trail › LIHAT |
| GET | `/api/v3/setting/audit-trail/:uuid` | Detail audit trail | Setting › Audit Trail › LIHAT |
| POST | `/api/v3/setting/audit-trail/verifikasi` | Verifikasi integritas | Setting › Audit Trail › LIHAT |
| POST | `/api/v3/setting/audit-trail/ekspor` | Ekspor audit trail | Setting › Audit Trail › EKSPOR |

### 5.14 Datamaster — `/api/v3/datamaster`

Berkas: `datamaster-service/src/routers/*.js` (±240 endpoint). Sebagian besar sumber daya mengikuti pola berikut.

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/datamaster/<sumber>` | Daftar (berhalaman) |
| GET | `/api/v3/datamaster/<sumber>/aktif` | Daftar aktif (untuk pilihan) |
| GET | `/api/v3/datamaster/<sumber>/:uuid` | Detail |
| POST | `/api/v3/datamaster/<sumber>` | Tambah |
| PUT | `/api/v3/datamaster/<sumber>/:uuid` | Ubah |
| DELETE | `/api/v3/datamaster/<sumber>/:uuid` | Hapus |
| GET | `/api/v3/datamaster/<sumber>/export` | Ekspor |
| POST | `/api/v3/datamaster/<sumber>/import` | Impor (`multipart/form-data`, field `file`) |

Nilai `<sumber>`: `diagnosis` (ICD-10), `icd9`, `loinc`, `snomed`, `faskes`, `organization`, `lokasi`, `ruangan`, `kategori_ruangan`, `penjamin`, `practitioner`, `pegawai`, `role`, `tindakan`, `tarif`, `komponen-tarif`, `voucher`, `general-consent` (tanpa impor), `main_menu` dan `sub_menu` (tanpa `aktif`), `gigi`, `kategori_gigi`, `item_gigi`, `oklusi_gigi`.

Endpoint tambahan:

| Metode | Path | Keterangan |
|--------|------|------------|
| GET / POST / PUT / DELETE | `/api/v3/datamaster/{provinsi, kabupaten, kecamatan, kelurahan}[/:id]` | Wilayah (kunci `:id`, ada `import`, tanpa `export`/`aktif`) |
| GET | `/api/v3/datamaster/lokasi/poli/aktif` | Poliklinik aktif |
| GET | `/api/v3/datamaster/lokasi/part_of`, `/lokasi/part_of/:part_of_uuid`, `/lokasi/code/:code` | Hierarki & kode lokasi |
| GET | `/api/v3/datamaster/practitioner/poli/aktif` | Dokter per poli |
| GET | `/api/v3/datamaster/organization/part-of`, `/organization-include-partof` | Hierarki organisasi |
| GET / POST / PUT / PATCH / DELETE | `/api/v3/datamaster/user[/:uuid]` | Pengguna (PATCH = ubah sandi; ekspor `/user/-/export`) |

**Mobile (kunci API `x-api-key`, tanpa JWT):** `GET /api/v3/datamaster/mobile/{faskes, faskes/:uuid, lokasi/poli/aktif, practitioner/:uuid, practitioner/poli/aktif, practitioner/code-antrian/:code, provinsi, kabupaten, kecamatan, kelurahan}`.

### 5.15 Antrian — `/api/v3/antrian`

Berkas: `antrian-service/src/routes/*.route.js`.

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/antrian/jadwal-dokter`, `/jadwal-dokter/all` | Jadwal dokter |
| GET / PUT / DELETE | `/api/v3/antrian/jadwal-dokter/:doctor_uuid/:location_uuid` | Detail / ubah / hapus jadwal |
| POST | `/api/v3/antrian/jadwal-dokter` | Tambah jadwal |
| GET / POST | `/api/v3/antrian/layar-antrian` | Daftar / tambah layar TV |
| GET / PUT / DELETE | `/api/v3/antrian/layar-antrian/:layar_antrian_uuid` | Kelola layar |
| GET / POST | `/api/v3/antrian/layar-antrian/:layar_antrian_uuid/kiosk` | Kunci mode kiosk layar |
| GET | `/api/v3/antrian/kiosk/layar/:layar_antrian_uuid` | Data layar TV (tanpa JWT, dilindungi kunci per layar) |
| POST | `/api/v3/antrian/data-antrian/{process-registration, admisi-registration, farmasi}` | Ambil nomor antrian |
| POST | `/api/v3/antrian/apm/{register, check-in, print-antrian, antrian-farmasi}` | Anjungan Pendaftaran Mandiri |
| GET / POST | `/api/v3/antrian/admisi-antrian` (dan `GET /all`) | Antrian admisi |
| GET / PUT | `/api/v3/antrian/admisi-antrian/:uuid` | Detail / ubah antrian admisi |

**Mobile (`x-api-key`)**: `GET /api/v3/antrian/mobile/jadwal-dokter` (juga `/all` dan `/available-kuota`), `POST /mobile/apm/process-registration`, `PUT /mobile/apm/update-patient/:appointmentUuid`, `POST /mobile/admisi-antrian`, dan `DELETE /mobile/report-antrian/cancel-booking`.

### 5.16 Inventory — `/api/v3/inventory`

Berkas: `inventory-service/src/routes/*.js` (±69 endpoint).

| Awalan | Isi |
|--------|-----|
| `/api/v3/inventory/datamaster/supplier` | CRUD supplier, `aktif`, `import` |
| `/api/v3/inventory/datamaster/lokasi-gudang` | Daftar lokasi gudang |
| `/api/v3/inventory/pengadaan` | `pembelian-barang`, `verifikasi-barang/:uuid`, `retur-supplier`, `available-items`, `supplier-kategori` |
| `/api/v3/inventory/penerimaan` | `pembelian/:uuid`, `retur-unit` |
| `/api/v3/inventory/pengeluaran` | `pengiriman-unit` (verifikasi/kirim/batal), `pengeluaran-unit` |
| `/api/v3/inventory/mutasi` | `kartu-stok`, `mutasi`, `riwayat-mutasi` |
| `/api/v3/inventory/stok` | `GET /`, `POST /reduce`, `POST /increase` |
| `/api/v3/inventory/stok-adjustment`, `/stok-opname`, `/riwayat-tarif` | Penyesuaian, opname, riwayat tarif |
| `/api/v3/inventory/laporan` | `barang-expired`, `persediaan` |
| `/api/v3/inventory/marketplace` | Pembelian via marketplace: `konfigurasi`, `penawaran`, `pemetaan`, `permintaan`, `laporan` (izin per aksi) |
| `/api/v3/inventory/webhook/:koneksi_uuid` | Webhook marketplace (tanpa JWT) |

### 5.17 BPJS — `/api/v3/bpjs`

Berkas: `bpjs-service/src/rute.js`, `antrean-route.js`.

| Metode | Path | Keterangan | Izin |
|--------|------|------------|------|
| GET / PUT | `/api/v3/bpjs/pcare/konfigurasi` | Konfigurasi PCare (kredensial ditampilkan tersamar) | — |
| POST | `/api/v3/bpjs/pcare/uji-koneksi` | Uji koneksi PCare | — |
| GET | `/api/v3/bpjs/pcare/peserta/:nomor` | Cek peserta | — |
| GET | `/api/v3/bpjs/pcare/referensi/:jenis` | Referensi PCare (`q`) | — |
| GET / PUT | `/api/v3/bpjs/pcare/pemetaan` | Pemetaan kode | — |
| GET | `/api/v3/bpjs/pcare/kunjungan` | Daftar sinkron kunjungan (`pagination`) | — |
| POST | `/api/v3/bpjs/pcare/kunjungan/:uuid/kirim` | Kirim kunjungan ke PCare | — |
| POST | `/api/v3/bpjs/pcare/pekerja/jalankan` | Jalankan sinkronisasi otomatis | — |
| GET | `/api/v3/bpjs/pcare/mcu/kunjungan`, `/pcare/mcu/status/:pesertaUuid` | MCU PCare | — |
| POST | `/api/v3/bpjs/pcare/mcu/operasi` | Operasi data MCU PCare | — |
| GET / PUT | `/api/v3/bpjs/vclaim/konfigurasi` | Konfigurasi VClaim | — |
| POST | `/api/v3/bpjs/vclaim/uji-koneksi` | Uji koneksi VClaim | — |
| GET | `/api/v3/bpjs/vclaim/peserta/:nomor` | Cek peserta (`tgl`) | — |
| GET | `/api/v3/bpjs/vclaim/rujukan/:noKartu` | Daftar rujukan | — |
| GET | `/api/v3/bpjs/vclaim/referensi/:jenis` | Referensi VClaim | — |
| GET | `/api/v3/bpjs/vclaim/pasien/:noKartu` | Cari pasien lokal dari nomor kartu | — |
| GET | `/api/v3/bpjs/vclaim/sep` | Daftar SEP (`pagination`) | — |
| POST | `/api/v3/bpjs/vclaim/sep` | Terbitkan SEP | Bila memakai surat kontrol/SPRI: izin PILIH SURAT SEP |
| DELETE | `/api/v3/bpjs/vclaim/sep/:noSep` | Hapus SEP | — |
| GET / PUT | `/api/v3/bpjs/vclaim/pemetaan-poli` | Pemetaan poli VClaim | — |
| GET / POST | `/api/v3/bpjs/vclaim/rencana-kontrol` | Daftar / buat rencana kontrol | izin surat: READ / CREATE RENCANA KONTROL |
| GET / PUT / DELETE | `/api/v3/bpjs/vclaim/rencana-kontrol/:uuid` | Detail / ubah / hapus | READ / UPDATE / DELETE RENCANA KONTROL |
| POST | `/api/v3/bpjs/vclaim/rencana-kontrol/:uuid/cek-status` | Cek status ke BPJS | CREATE atau UPDATE RENCANA KONTROL |
| GET / POST | `/api/v3/bpjs/vclaim/spri` | Daftar / buat SPRI | READ / CREATE SPRI |
| GET / PUT / DELETE | `/api/v3/bpjs/vclaim/spri/:uuid` | Detail / ubah / hapus SPRI | READ / UPDATE / DELETE SPRI |
| POST | `/api/v3/bpjs/vclaim/spri/:uuid/cek-status` | Cek status SPRI | CREATE atau UPDATE SPRI |
| GET / PUT | `/api/v3/bpjs/antrean/konfigurasi` | Konfigurasi Antrean Online | — |
| GET | `/api/v3/bpjs/antrean/monitoring` | Monitoring antrean (`pagination`) | — |
| GET | `/api/v3/bpjs/antrean/booking/:kodeBooking` | Detail booking | — |
| POST | `/api/v3/bpjs/antrean/booking/:kodeBooking/kirim-ulang` | Kirim ulang | — |

Rute rencana kontrol dan SPRI juga mensyaratkan fitur `vclaim_rencana_kontrol` aktif.

**WS Antrean Online (dipanggil BPJS/Mobile JKN, tanpa JWT)** — `/api/v3/bpjs/antrean/ws`:

| Metode | Path | Keterangan |
|--------|------|------------|
| POST | `/api/v3/bpjs/antrean/ws/token` | Terbitkan token WS (header `X-cons-id`, `X-timestamp`, `X-signature`); respons `payload.token`, `payload.expires_in` (3600) |
| POST | `/api/v3/bpjs/antrean/ws/{status-antrean, ambil-antrean, sisa-antrean, batal-antrean, check-in, pasien-baru}` | Operasi WS antrean |
| GET | `/api/v3/bpjs/antrean/ws/jadwal-operasi` | Jadwal operasi |

### 5.18 SATUSEHAT — `/api/v3/satusehat`

Berkas: `satusehat-service/src/rute.js`. Kredensial SATUSEHAT diisi lewat menu Setting.

| Metode | Path | Keterangan |
|--------|------|------------|
| GET | `/api/v3/satusehat/health` | Cek kesehatan (tanpa token) |
| GET | `/api/v3/satusehat/status` | Ringkasan konfigurasi & jumlah sinkron per status |
| POST | `/api/v3/satusehat/uji-koneksi` | Uji koneksi |
| GET | `/api/v3/satusehat/sinkron` | Daftar sinkron kunjungan rawat jalan (`page`, `limit` ≤ 100, `status`, `q`; `pagination`) |
| POST | `/api/v3/satusehat/sinkron/rawat-jalan/:uuid` | Kirim satu kunjungan (`200` terkirim, `422` gagal) |
| POST | `/api/v3/satusehat/pekerja/jalankan` | Jalankan pengiriman otomatis untuk faskes pengguna |

### 5.19 Program Puskesmas — `/api/v3/program-puskesmas`

Berkas: `program-puskesmas-service/src/<modul>/rute.js` (±48 endpoint). Izin memakai modul **Program Puskesmas**. Semua path di bawah ini berawalan `/api/v3/program-puskesmas`.

| Awalan | Isi | Izin (submodul) |
|--------|-----|-----------------|
| `/kia` | `anc` (CRUD, `riwayat/:patientUuid`), `persalinan`, `nifas`, `kohort` | KIA |
| `/kb` | `pelayanan` (CRUD) | KB |
| `/imunisasi` | daftar/catat imunisasi, `riwayat/:patientUuid`, `:uuid/kirim-ulang`, `jenis-vaksin` | Imunisasi; Datamaster › Jenis Vaksin & Jadwal |
| `/mtbs` | CRUD formulir MTBS/MTBM | MTBS/MTBM |
| `/sasaran` | daftar, `ringkasan`, tambah, ubah | Sasaran Program |
| `/ukm` | `kegiatan` (CRUD), `ringkasan` | Kegiatan UKM |
| `/laporan` | `lb1`, `kia`, `imunisasi`, `program`, `:jenis/ekspor`, `format/:jenis` | Laporan Dinkes |
| `/referensi` | `pasien`, `kunjungan` (`patient_uuid` wajib), `kelurahan` | — |

### 5.20 SIMRS Studio — `/api/v3/studio`

Layanan opsional untuk mode pengembang berbasis AI. Layanan ini hanya aktif bila `STUDIO_PENGEMBANG=aktif` dan tidak ditujukan untuk integrasi. Lihat [SIMRS Studio](./SIMRS-STUDIO.md).

---

## 6. Titik masuk bridging (tanpa JWT)

Sistem eksternal (LIS, PACS/RIS, sistem PA, UTD, HDIS) mengirim hasil ke SIMRS memakai **kunci masuk per koneksi**, bukan token login. Kunci dikirim di header `x-api-key` atau parameter `?key=`, dan diterbitkan dari menu konfigurasi koneksi masing-masing. Respons sukses berbentuk `{ "success": true, "message": "...", "payload": ... }`, sedangkan galat berbentuk `{ "success": false, "message": "..." }`.

| Bridging | Alamat langsung (port layanan) | Alamat lewat gateway |
|----------|-------------------------------|----------------------|
| LIS Patologi Klinik | `POST /adam-lis/bridging` (lab-service, 8087) | `POST /adam-lis/bridging` atau `POST /api/v3/lab/lis/hasil` |
| PACS/RIS (Radiologi) | `POST /adam-pacs/bridging` (penunjang-service, 8099) | `POST /api/v3/penunjang/radiologi/pacs/hasil` |
| LIS Patologi Anatomi | `POST /adam-pa-lis/bridging` (8099) | `POST /api/v3/penunjang/patologi/lis/hasil` |
| LIS Mikrobiologi | `POST /adam-lis/mikrobiologi/bridging` (8099) | `POST /api/v3/penunjang/mikrobiologi/lis/hasil` |
| UTD (Bank Darah) | `POST /adam-utd/bridging` (8099) | `POST /api/v3/penunjang/bank-darah/utd/hasil` |
| HDIS (Hemodialisa) | `POST /adam-hdis/bridging` (8099) | `POST /api/v3/penunjang/hemodialisa/hdis/masuk` |

> **Penting saat memakai gateway:** gateway hanya meneruskan `/api/v3/<layanan>/…` dan `/adam-lis/` (ke lab-service). Alamat `/adam-pacs/`, `/adam-pa-lis/`, `/adam-utd/`, dan `/adam-hdis/` **tidak** diteruskan sehingga dijawab `404`. Alamat `/adam-lis/mikrobiologi/…` justru sampai ke lab-service, bukan penunjang-service. Karena itu, sistem eksternal yang mengirim lewat gateway harus memakai alias `/api/v3/penunjang/…` di kolom terakhir tabel. Kunci masuknya sama.

Contoh permintaan:

```http
POST /api/v3/penunjang/radiologi/pacs/hasil
x-api-key: <kunci masuk>
Content-Type: application/json
```

Format body tiap bridging mengikuti kontrak sistem mitra. Lihat skrip simulator di `scripts/` (`lis-tiruan.mjs`, `pacs-tiruan.mjs`, `lis-pa-tiruan.mjs`, `utd-tiruan.mjs`) dan [Panduan Instalasi](./INSTALLATION_GUIDE.md) bagian integrasi.

---

> Kontak pengembang: `dev@opensimrs.id` · Kanal komunitas: [COMMUNITY.md](../COMMUNITY.md)
