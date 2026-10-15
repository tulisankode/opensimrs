# Audit Menu Admisi

Status: Draft v1 selesai  
Tanggal audit: 2026-05-14  
Scope: menu top-level `Admisi`, submenu Rawat Jalan, Rawat Inap, IGD, SEP, Data Pasien, Monitoring Kamar, Laporan Admisi, Antrian Call, role, permission, dan tenant/faskes yang memengaruhinya.

## Ringkasan

Menu Admisi adalah workflow operasional utama untuk registrasi kunjungan, data pasien, kamar, general consent, dan laporan. Secara tenant, sebagian besar data sudah difilter memakai `faskesUuid` dari token. Namun kontrol akses masih lemah: frontend hanya menyembunyikan menu level module, sidebar Admisi statis, route guard hanya cek token, dan backend Admisi belum menerapkan permission per endpoint.

Temuan paling penting:

1. Route dan sidebar Admisi tidak difilter berdasarkan permission submenu/aksi.
2. Backend Admisi memakai JWT middleware custom, tetapi tidak mengecek token di Redis/session dan tidak memakai permission middleware.
3. Context tenant disimpan di static object global, bukan request-scoped context.
4. Halaman SEP masih memakai dummy data lokal dan belum terlihat endpoint SEP di `admisi-service`.
5. Route `/admisi/laporan/penjamin` ada, permission `Penjamin` ada, tetapi menu sidebar Penjamin dikomentari.
6. Ada mismatch permission `subModules` vs `sub_modules` pada data role lokal.
7. Ada mismatch nama/case permission, misalnya `Status kamar` vs `Status Kamar`, dan `Rekap Kunjungan` vs `Rekap Jumlah Pasien BPJS`.
8. Data lokal punya 1 record `rawat_jalans` tanpa faskes, ini perlu dibersihkan sebelum tenant enforcement diperketat.

## Source Map

| Area | File | Catatan |
|---|---|---|
| Top nav | `frontend-service/src/components/section/Header.vue` | Module `Admisi` muncul bila ada module permission di `localStorage.permission`. |
| Route Admisi | `frontend-service/src/router/index.ts` | Route `/admisi/*` line 514-653. |
| Route guard | `frontend-service/src/router/index.ts` | Guard hanya cek `access_token` line 1671-1688. |
| Sidebar Admisi | `frontend-service/src/views/Admisi/AdmisiView.vue` | Sidebar statis mulai line 7; menu Penjamin laporan dikomentari line 90-94. |
| Page pendaftaran | `frontend-service/src/views/Admisi/AdmisiPage.vue` | Rawat Jalan, Rawat Inap, IGD memakai satu page dengan `pageType`. |
| Page SEP | `frontend-service/src/views/Admisi/SEPAdmisiPage.vue` | `itemsPasien` dummy mulai line 41. |
| Page Data Pasien | `frontend-service/src/views/Admisi/PatientDataPage.vue` | Data pasien, general consent, upload berkas, cetak kartu. |
| Page Monitoring Kamar | `frontend-service/src/views/Admisi/RoomMonitoringPage.vue` | Monitoring room/bed dan update bed. |
| Page Laporan | `frontend-service/src/views/Admisi/AdmisiReportPage.vue` | Switch laporan berdasarkan route. |
| Store Admisi | `frontend-service/src/stores/admisi/*` | Rawat jalan, rawat inap, IGD, pasien, monitoring kamar, general consent, laporan. |
| Backend app | `admisi-service/src/app.js` | Base URL `app.use("/api/v3/admisi", routes)` line 39. |
| Backend routes | `admisi-service/src/routes/routes.js` | Mobile routes line 22-28, web auth line 31, core routes line 38-115. |
| Backend auth middleware | `admisi-service/src/middlewares/authorization-middleware.js` | JWT verify dan context line 5-17. |
| Backend context | `admisi-service/src/middlewares/context.js` | Static object context global. |
| Permission frontend | `frontend-service/src/stores/datamaster/permission.ts` | Module Admisi mulai line 34. |
| Permission backend helper | `datamaster-service/src/helpers/permission-list.js` | Module Admisi mulai line 27. |

## Route dan Sidebar

Route frontend Admisi:

| Route | Page | Sidebar |
|---|---|---|
| `/admisi` | Redirect ke `/admisi/rawat-jalan` | Ya, title Admisi |
| `/admisi/rawat-jalan` | `AdmisiPage` | Rawat Jalan |
| `/admisi/rawat-inap` | `AdmisiPage` | Rawat Inap |
| `/admisi/igd` | `AdmisiPage` | IGD |
| `/admisi/sep/rawat-jalan` | `SEPAdmisiPage` | SEP > Rawat Jalan |
| `/admisi/sep/rawat-inap` | `SEPAdmisiPage` | SEP > Rawat Inap |
| `/admisi/sep/igd` | `SEPAdmisiPage` | SEP > IGD |
| `/admisi/data-pasien` | `PatientDataPage` | Data Pasien |
| `/admisi/monitoring-kamar` | `RoomMonitoringPage` | Monitoring Kamar |
| `/admisi/laporan/kunjungan` | `AdmisiReportPage` | Laporan > Kunjungan |
| `/admisi/laporan/penjamin` | `AdmisiReportPage` | Route ada, sidebar dikomentari |
| `/admisi/laporan/batal-kunjungan` | `AdmisiReportPage` | Laporan > Batal Kunjungan |
| `/admisi/laporan/status-kamar` | `AdmisiReportPage` | Laporan > Status Kamar |
| `/admisi/laporan/keperawatan-inap-pasien` | `AdmisiReportPage` | Laporan > Keperawatan Inap Pasien |
| `/admisi/laporan/bayi-baru-lahir` | `AdmisiReportPage` | Laporan > Bayi Baru Lahir |
| `/admisi/laporan/rekap-kunjungan` | `AdmisiReportPage` | Laporan > Rekap Kunjungan |

Catatan:

- Sidebar Admisi tidak membaca `localStorage.permission`.
- Route `/admisi/laporan/penjamin` tetap bisa dibuka langsung walaupun menu sidebar-nya tidak tampil.
- Semua route di atas hanya memakai `requiresAuth: true`, belum memakai meta permission.

## Permission

Permission master Admisi:

| Submodule | Allows/features |
|---|---|
| Antrian | PANGGIL, LEWATI, PROSSES, SELESAI, CHECKIN |
| Admisi RJ | READ, CREATE PASIEN RJ, CREATE GENERAL CONSENT, UPDATE ADMISI RJ, CETAK KUNJUNGAN, CETAK LABEL, DELETE GENERAL CONSENT, BATAL RJ |
| Admisi RI | READ, CREATE BAYI BARU LAHIR, CREATE PASIEN RI, CREATE GENERAL CONSENT, UPDATE ADMISI RI, CETAK GENERAL CONSENT, CETAK KUNJUNGAN, CETAK LABEL, DELETE GENERAL CONSENT |
| Admisi IGD | CREATE PASIEN IGD, CREATE GENERAL CONSENT, UPDATE ADMISI IGD, UPDATE GENERAL CONSENT, BATAL IGD, CETAK GENERAL CONSENT, CETAK KUNJUNGAN, CETAK LABEL, DELETE GENERAL CONSENT |
| SEP | READ, CREATE SEP, CREATE SEP MANUAL, DELETE, SIMPAN SEP MANUAL, DELETE PASIEN |
| Data Pasien | READ, CREATE PASIEN, UPDATE BERKAS RM, UPDATE DATA PASIEN, DELETE PASIEN, DELETE BERKAS RM, IMPORT DATA PASIEN, CETAK KARTU PASIEN, UPLOAD BERKAS RM, PREVIEW BERKAS RM, GENERAL CONSENT |
| Monitoring Kamar | READ, CREATE BAD, DELETE BAD, SETTING BAD |
| Laporan Admisi | Kunjungan, Penjamin, Batal Kunjungan, Status kamar, Keperawatan Inap Pasien, Bayi Baru Lahir, Rekap Kunjungan/Rekap Jumlah Pasien BPJS |

Data role lokal saat audit:

| Tenant/scope | Role | Admisi module | Struktur submenu |
|---|---|---|---|
| Global/null faskes | super admin | Ada | `subModules` |
| Klinik Contoh | admin | Ada | `sub_modules` |
| Klinik Contoh | KASIR | Tidak ada | Tidak relevan |
| Klinik Sehat | Admin | Ada | `sub_modules` |

Implikasi:

- `super admin` cocok dengan permission helper yang memakai `subModules`.
- `admin`/`Admin` lokal punya Admisi, tetapi key submenu adalah `sub_modules`.
- Jika permission SDK dipasang tanpa adapter, role tenant berisiko gagal permission check walaupun secara data mereka punya izin.
- Action `PROSSES` dan `CREATE BAD/DELETE BAD/SETTING BAD` kemungkinan typo. Untuk revamp sebaiknya dibuat permission code stabil, bukan label bebas.

## Backend/API

Base endpoint:

```txt
/api/v3/admisi
```

Endpoint web utama:

| Area | Endpoint |
|---|---|
| Rawat Jalan | `GET /rawat-jalan`, `GET /rawat-jalan/today`, `POST /rawat-jalan`, `PUT /rawat-jalan/:uuid`, `DELETE /rawat-jalan/cancel`, `GET /rawat-jalan/jadwal-dokter` |
| IGD | `GET /igd`, `GET /igd/:uuid`, `POST /igd`, `PUT /igd/:uuid`, `DELETE /igd/cancel` |
| Rawat Inap | `GET /rawat-inap`, `GET /rawat-inap/:uuid`, `POST /rawat-inap`, `POST /rawat-inap/spri`, `PUT /rawat-inap/:uuid`, `DELETE /rawat-inap/cancel` |
| Data Pasien | `GET /patient`, `GET /patient/:uuid`, `POST /patient`, `PUT /patient/:uuid`, `DELETE /patient/cancel`, `GET /patient/history/:uuid`, `POST /patient/import` |
| Berkas Pasien | `GET /file/:uuid`, `PUT /file/:uuid`, `DELETE /file/:uuid` |
| Monitoring Kamar | `GET /monitoring-rooms`, `GET /monitoring-rooms/:uuid`, `PATCH /monitoring-rooms/:uuid` |
| General Consent | `GET /general-consent/:uuid`, `GET /general-consent/detail/:uuid`, `POST /general-consent/:uuid`, `DELETE /general-consent/:uuid` |
| Laporan | `GET /report/kunjungan`, `/report/cancel-visit`, `/report/room`, `/report/rawat-inap`, `/report/new-born` |
| Export Laporan | `GET /export/kunjungan`, `/export/batal-kunjungan`, `/export/status-kamar`, `/export/keperawatan-inap`, `/export/new-born` |
| Rekap | `GET /rekap/jenis-kunjungan`, `/rekap/dokter`, `/rekap/penjamin` |
| Antrian Call | `GET /antrian-call`, `PUT /antrian-call/:uuid` |

Endpoint mobile sebelum JWT middleware:

| Area | Endpoint | Auth |
|---|---|---|
| Cek pasien | `POST /patient/check-patient` | `x-api-key` + `faskes-uuid` |
| Rawat Jalan mobile | `GET/POST/DELETE /rawat-jalan/mobile*` | `x-api-key` + `faskes-uuid` |
| Jadwal pemeriksaan mobile | `GET /rawat-jalan/mobile/jadwal-pemeriksaan/:uuid` | `x-api-key` |

Catatan:

- Endpoint web dilindungi `AuthorizationMiddleware`.
- Endpoint mobile mengandalkan API key dan header `faskes-uuid`.
- Tidak ditemukan endpoint SEP khusus di `admisi-service/src/routes/routes.js`; frontend SEP saat audit masih memakai dummy `itemsPasien`.

## Tenant/Faskes

Model tenant yang terlihat:

- Web: JWT diverifikasi, lalu payload token disimpan ke `Context` sebagai `CTX_AUTHOR`.
- Repository/service banyak membaca `Context.get(CTX_AUTHOR).faskesUuid`.
- Mobile: tenant dibaca dari header `faskes-uuid`.

Data lokal Admisi per tenant:

| Table | Klinik Contoh | Klinik Sehat | Tanpa faskes |
|---|---:|---:|---:|
| `patients` | 1421 | 119 | 0 |
| `rawat_jalans` | 129 | 23 | 1 |
| `rawat_inaps` | 24 | 0 | 0 |
| `instalasi_gawat_darurats` | 17 | 1 | 0 |
| `room_monitorings` | 54 | 3 | 0 |
| `general_consents` | 70 | 7 | 0 |

Catatan penting:

- Ada 1 `rawat_jalans` tanpa faskes. Ini harus diaudit/dibersihkan sebelum enforcement tenant diperketat.
- `Context` backend saat ini static/global. Pada server paralel, ini berisiko kebocoran context antar request. Untuk revamp, ganti ke request-scoped context atau teruskan `author` eksplisit dari middleware ke service/repository.

## Temuan

### 1. Permission belum enforce di backend

`admisi-service/src/routes/routes.js` hanya memasang `AuthorizationMiddleware`, tidak memasang permission middleware seperti `permissionSdk("Admisi", ...)`.

Dampak: user dengan token valid, termasuk role yang tidak punya module Admisi, berpotensi mengakses endpoint Admisi jika mengetahui URL.

Rekomendasi: setiap route diberi policy, misalnya:

```js
routes.get("/rawat-jalan", permissionSdk("Admisi", "Admisi RJ", null, "READ"), RawatJalanController.getAll);
routes.post("/rawat-jalan", permissionSdk("Admisi", "Admisi RJ", null, "CREATE PASIEN RJ"), RawatJalanController.registRawatJalan);
```

### 2. Auth middleware Admisi tidak mengecek token session

Middleware Admisi memverifikasi JWT, tetapi tidak mengecek Redis/token store seperti `authorizationSdk`. Logout atau token rotation bisa tidak efektif di service ini jika JWT masih valid.

Rekomendasi: gunakan `authorizationSdk` yang konsisten atau tambahkan validasi Redis di middleware Admisi.

### 3. Context tenant tidak request-scoped

`Context` menyimpan data di static object. Ini praktis untuk local, tapi rawan pada request paralel.

Rekomendasi: gunakan `AsyncLocalStorage` Node.js atau injeksi `request.author` sampai repository/service.

### 4. SEP belum terhubung backend

Frontend route dan permission SEP ada, tetapi `SEPAdmisiPage.vue` masih memakai dummy data dan tidak terlihat endpoint SEP di Admisi routes.

Rekomendasi: sebelum revamp UI SEP, tentukan apakah SEP akan:

- memakai service BPJS/bridging tersendiri,
- disimpan di Admisi,
- atau dipindah ke module terpisah.

### 5. Sidebar tidak konsisten dengan route/permission

Route `/admisi/laporan/penjamin` dan permission feature `Penjamin` ada, tetapi menu sidebar Penjamin dikomentari.

Rekomendasi: putuskan apakah Penjamin report masih dipakai. Jika tidak, hapus route dan permission; jika ya, tampilkan menu berdasarkan permission.

### 6. Nama permission tidak konsisten

Contoh:

| Frontend/sidebar | Permission/helper |
|---|---|
| Status Kamar | Status kamar |
| Rekap Kunjungan | Rekap Jumlah Pasien BPJS di backend helper/auth JSON |
| Proses | PROSSES |
| Bed | BAD |

Dampak: exact string permission akan rapuh.

Rekomendasi: gunakan kode permission stabil seperti `ADMISI.RJ.CREATE`, `ADMISI.REPORT.STATUS_ROOM.READ`, lalu label UI dipisah.

### 7. General Consent tersebar di beberapa permission

General Consent muncul di Admisi RJ/RI/IGD dan Data Pasien, sementara endpoint backend ada sebagai route standalone `/general-consent`.

Rekomendasi: tentukan ownership permission:

- apakah General Consent mengikuti konteks kunjungan RJ/RI/IGD,
- atau jadi permission Data Pasien,
- atau keduanya dengan policy yang eksplisit.

## Rekomendasi Revamp Untuk Admisi

1. Buat registry permission berbasis code:
   - `ADMISI.RJ.READ`
   - `ADMISI.RJ.CREATE`
   - `ADMISI.RJ.CANCEL`
   - `ADMISI.RI.READ`
   - `ADMISI.IGD.CREATE`
   - `ADMISI.PATIENT.UPDATE`
   - `ADMISI.MONITORING_ROOM.SETTING_BED`
   - `ADMISI.REPORT.KUNJUNGAN.READ`

2. Tambahkan `meta.permission` di route frontend.

3. Sidebar Admisi dibangun dari permission effective user, bukan hardcoded list.

4. Backend route diberi middleware permission per endpoint.

5. Normalisasi schema permission ke satu format. Rekomendasi: buat adapter baca `subModules` dan `sub_modules` sementara, lalu migrasi data ke satu format.

6. Ganti `Context` static dengan request-scoped context.

7. Bersihkan data tanpa faskes dan tambah guard agar write tidak bisa membuat data tenant null.

8. Selesaikan keputusan SEP sebelum revamp layar: endpoint, ownership service, dan permission.

## Pertanyaan Terbuka

1. Apakah role `KASIR` memang tidak boleh membuka Admisi sama sekali?
2. Apakah `admin/Admin` tenant boleh semua aksi Admisi, termasuk delete/cancel/import?
3. Apakah laporan Penjamin masih dipakai?
4. SEP akan hidup di Admisi, BPJS module, atau service terpisah?
5. Untuk General Consent, permission mengikuti pasien atau kunjungan?
6. Apakah mobile API key perlu permission granular juga, atau cukup faskes-level trust?
