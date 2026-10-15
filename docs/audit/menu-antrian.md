# Audit Menu Antrian

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Antrian adalah modul lintas layanan. Frontend berada di `frontend-service/src/views/Antrian`, store berada di `frontend-service/src/stores/antrian`, backend utama berada di `antrian-service`, tetapi data yang ditampilkan dan diubah juga menyentuh `admisi-service`, `rawat-jalan-service`, dan `datamaster-service`.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Konfigurasi > Jadwal Dokter | `/antrian/konfigurasi/jadwal-dokter` | Jadwal dokter, poli, kuota JKN/Non-JKN, durasi pelayanan. |
| Konfigurasi > Layar Antrian | `/antrian/konfigurasi/layar-antrian` | Konfigurasi layar panggilan dan isi konten layar. |
| Data Antrian | `/antrian/data-antrian` | Monitoring antrian Admisi, Rawat Jalan, Farmasi. |
| Layar | `/antrian/layar` | Preview/display layar antrian. |
| APM | `/antrian/apm` dan `/antrian/apm/aktif/...` | Alur kiosk/APM untuk pasien JKN, Non-JKN, check-in, print, farmasi. |

## Frontend

### Route

Source route utama: `frontend-service/src/router/index.ts`.

Route Antrian dimulai di sekitar `frontend-service/src/router/index.ts:657`.

| Route | Component/page | Catatan |
|---|---|---|
| `/antrian` | redirect | Redirect ke `/antrian/konfigurasi/jadwal-dokter`. |
| `/antrian/konfigurasi/jadwal-dokter` | `AntrianView` + `KonfigurasiJadwalPage` | `requiresAuth: true`. |
| `/antrian/konfigurasi/layar-antrian` | `AntrianView` + `KonfigurasiLayarPage` | `requiresAuth: true`. |
| `/antrian/data-antrian` | `AntrianView` + `DataAntrianPage` | `requiresAuth: true`. |
| `/antrian/layar` | `AntrianView` + `LayarAntrianPage` | `requiresAuth: true`. |
| `/antrian/apm` | `AntrianView` + `ApmPage` | `requiresAuth: true`. |
| `/antrian/apm/aktif` dan turunannya | halaman APM full page | Semua masih `requiresAuth: true`. |

Guard global di `frontend-service/src/router/index.ts:1675` hanya memeriksa `access_token`. Belum ada pengecekan permission route-level seperti `ANTRIAN.KONFIGURASI.READ` atau `ANTRIAN.APM.PRINT`.

### Sidebar

Source: `frontend-service/src/views/Antrian/AntrianView.vue`.

Sidebar dibuat statis dari `sidebarBodyList` di `AntrianView.vue:7`. Item yang muncul:

- Konfigurasi > Jadwal Dokter
- Konfigurasi > Layar Antrian
- Data antrian
- Layar
- APM

Catatan mismatch:

- Permission master memakai `Data Antrian`, sedangkan sidebar menulis `Data antrian`.
- Permission master memakai `Apm`, sedangkan sidebar menulis `APM`.
- Belum ada filter sidebar berdasarkan `subModules`/`sub_modules`.

### Store/API Frontend

Source utama:

| Store | Endpoint yang dipakai | Catatan |
|---|---|---|
| `antrian/jadwalDokter.ts` | `GET/POST/PUT/DELETE /antrian/jadwal-dokter` | Untuk konfigurasi jadwal; juga ambil poli/dokter dari Datamaster. |
| `antrian/configLayarAntrian.ts` | `GET/POST/PUT/DELETE /antrian/layar-antrian` | Untuk konfigurasi dan display layar. |
| `antrian/configLayarAntrian.ts` | `GET /v3/rajal/antrian-call` | Data panggilan poli diambil dari Rawat Jalan. |
| `antrian/configLayarAntrian.ts` | `GET /admisi/antrian-call` | Data panggilan admisi diambil dari Admisi. |
| `antrian/dataAntrian.ts` | `GET /admisi/rawat-jalan` | Tab Rawat Jalan pada Data Antrian memakai data Admisi. |
| `antrian/dataAntrian.ts` | `GET /antrian/admisi-antrian` | Tab Admisi/Farmasi pada Data Antrian. |
| `antrian/apm.ts` | `POST /admisi/patient/check-patient/apm`, `POST /antrian/apm/...` | APM campuran Admisi + Antrian. |
| `antrian/antrianCall.ts` | `GET/PUT /admisi/antrian-call` | Drawer panggilan di header berada di store Antrian, tapi API Admisi. |

### APM

Source: `frontend-service/src/views/Antrian/APM/ApmPage.vue`.

Temuan:

- Daftar APM masih hardcoded di `ApmPage.vue:71`: `APM 1` untuk pasien/checkin/print dan `APM 2` untuk antrian obat.
- Tidak ada master APM di backend Antrian untuk list device, status device, menu aktif, atau tenant-specific config.
- Route APM aktif memakai `DefaultLayout` dan tetap `requiresAuth: true`, sehingga untuk mode kiosk publik perlu keputusan desain: tetap login operator atau pakai token/API key kiosk khusus.

## Backend/API

### Mounting dan Auth

Source: `antrian-service/src/server.js`.

- Base URL: `/api/v3/antrian` di `server.js:21`.
- Mobile route dilindungi `x-api-key` lewat `apiKeyMiddleware([`${BASE_URL}/mobile`])` di `server.js:49`.
- Beberapa mobile endpoint dikecualikan dari JWT di `jwtExemptEndpoints` mulai `server.js:51`.
- Endpoint selain exempt melewati `authorizationSdk([])` di `server.js:69`.

Catatan penting: `authorizationSdk([])` memvalidasi token, tetapi tidak terlihat ada permission/action enforcement per route.

### Route Backend

Source: `antrian-service/src/routes`.

| Area | Endpoint | Handler |
|---|---|---|
| Jadwal Dokter | `GET /jadwal-dokter`, `GET /jadwal-dokter/all`, `GET /jadwal-dokter/:doctor_uuid/:location_uuid`, `POST`, `PUT`, `DELETE` | `JadwalDokterController` |
| Layar Antrian | `GET /layar-antrian`, `GET /layar-antrian/:uuid`, `POST`, `PUT`, `DELETE` | `LayarAntrianController` |
| Data Antrian | `POST /data-antrian/process-registration`, `POST /admisi-registration`, `POST /farmasi` | `DataAntrianController` |
| APM | `POST /apm/register`, `/check-in`, `/print-antrian`, `/antrian-farmasi` | `APMController` |
| Admisi Antrian | `GET/POST/PUT /admisi-antrian` | `AdmisiAntrianController` |
| Mobile | `/mobile/jadwal-dokter`, `/mobile/apm`, `/mobile/admisi-antrian`, `/mobile/report-antrian` | API key + faskes header |

## Role dan Permission

Permission master ada di:

- `frontend-service/src/stores/datamaster/permission.ts:8`
- `datamaster-service/src/helpers/permission-list.js:4`

Definisi permission Antrian:

| Submodule | Allows |
|---|---|
| Konfigurasi | `READ`, `CREATE`, `UPDATE`, `DELETE` |
| Data Antrian | `READ` |
| Layar | `READ` |
| Apm | `CREATE PASIEN JKN`, `CREATE PASIEN NON-JKN`, `CHECKIN`, `PRINT` |

Data role lokal:

| Scope | Role | Antrian |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Catatan struktur permission:

- `super admin` menyimpan `subModules`.
- Role tenant menyimpan `sub_modules`.
- Kalau enforcement nanti membaca salah satu key saja, permission Antrian bisa gagal untuk sebagian role.

## Tenant/Faskes

Pola tenant pada Antrian:

- Web endpoint mengambil `faskesUuid` dari `req.author`.
- Mobile endpoint mengambil `faskes-uuid` dari header.
- Banyak repository sudah memfilter `faskesUuid`, terutama jadwal dokter dan layar antrian.

Data lokal per tenant:

| Tabel | Klinik Contoh | Klinik Sehat | Faskes tidak dikenal |
|---|---:|---:|---:|
| `antrian` | 879 | 61 | 0 |
| `jadwal_dokter` | 31 | 10 | 3 |
| `layar_antrian` | 31 | 0 | 6 |
| `layar_antrian_poli` | 38 | 0 | 6 |
| `report_antrian` | 2 | 1 | 0 |

Faskes tidak dikenal memakai UUID `0194c099-40dc-759f-962b-168eeb523024`, tetapi UUID itu tidak ada di tabel `faskes` aktif lokal. Ini perlu dimigrasi atau dihapus sebelum tenant enforcement dibuat ketat.

## Temuan Defect/Risk

1. Permission belum enforced per route/backend.

   Web Antrian melewati `authorizationSdk([])`, tetapi belum ada middleware yang memeriksa submodule/action. User dengan token valid berpotensi mengakses endpoint create/update/delete Antrian walaupun role tidak memiliki permission menu tersebut.

2. Frontend route dan sidebar belum mengikuti permission submodule.

   Header hanya memfilter menu top-level dari `localStorage.permission`. Sidebar Antrian statis. Role yang hanya punya sebagian submodule tetap akan melihat seluruh sidebar bila punya module `Antrian`.

3. `KASIR` tidak punya module Antrian, tetapi API tetap token-only.

   Jika user KASIR berhasil memanggil endpoint langsung dengan token valid, backend Antrian belum menolak berdasarkan permission.

4. `AdmisiAntrianService.getAntrianByUuid` dan update tidak mengunci query ke faskes.

   Controller mengirim `faskesUuid`, tetapi service/repository lookup memakai `findByUuid(uuid)` dan `update(uuid, ...)` tanpa `faskesUuid` di `where`. Ini risk cross-tenant update/detail jika UUID diketahui.

5. `LayarAntrianRepository.findOne` bisa throw 500 saat data tidak ditemukan.

   Repository langsung destructure `row` setelah `findOne`; bila row null, service tidak sempat mengubahnya menjadi `NotFoundException`.

6. `APMService.updatePatientMobile` memakai variable `bookingLama` yang tidak pernah didefinisikan.

   Endpoint `PUT /mobile/apm/update-patient/:appointmentUuid` berpotensi selalu gagal saat dieksekusi.

7. `DataAntrianController.regisAdmisi` memakai `BadRequestException` tanpa import.

   Jika body tidak mengirim `jadwal_dokter_uuid`, controller akan ReferenceError, bukan response 400 yang rapi.

8. APM list masih hardcoded di frontend.

   Belum ada master APM per tenant/per device. Ini akan menyulitkan audit permission dan operasional kiosk saat multi-faskes.

9. Banyak `console.log` debug masih tertinggal.

   Ada log payload, kuota, response, dan data pasien di frontend/backend Antrian. Untuk data klinis, ini perlu dibersihkan sebelum produksi.

10. Data tenant lama/tidak dikenal masih ada.

   `jadwal_dokter`, `layar_antrian`, dan `layar_antrian_poli` punya data dengan faskes UUID yang tidak ada di tabel faskes aktif lokal.

## Rekomendasi Revamp

1. Buat registry permission berbasis kode stabil, misalnya:

   - `ANTRIAN.KONFIGURASI.READ`
   - `ANTRIAN.KONFIGURASI.CREATE`
   - `ANTRIAN.KONFIGURASI.UPDATE`
   - `ANTRIAN.KONFIGURASI.DELETE`
   - `ANTRIAN.DATA.READ`
   - `ANTRIAN.LAYAR.READ`
   - `ANTRIAN.APM.CREATE_PASIEN_JKN`
   - `ANTRIAN.APM.CREATE_PASIEN_NON_JKN`
   - `ANTRIAN.APM.CHECKIN`
   - `ANTRIAN.APM.PRINT`

2. Tambahkan `meta.permission` di route frontend Antrian dan guard yang membaca permission efektif.

3. Build sidebar Antrian dari permission efektif, bukan hardcoded list.

4. Tambahkan permission middleware backend per endpoint:

   - `GET /jadwal-dokter` -> `ANTRIAN.KONFIGURASI.READ`
   - `POST /jadwal-dokter` -> `ANTRIAN.KONFIGURASI.CREATE`
   - `PUT /jadwal-dokter` -> `ANTRIAN.KONFIGURASI.UPDATE`
   - `DELETE /jadwal-dokter` -> `ANTRIAN.KONFIGURASI.DELETE`
   - `GET /layar-antrian` -> `ANTRIAN.LAYAR.READ` atau `ANTRIAN.KONFIGURASI.READ` tergantung konteks
   - `POST/PUT/DELETE /layar-antrian` -> `ANTRIAN.KONFIGURASI.*`
   - `POST /apm/check-in` -> `ANTRIAN.APM.CHECKIN`
   - `POST /apm/print-antrian` -> `ANTRIAN.APM.PRINT`

5. Normalisasi struktur permission menjadi satu key canonical. Untuk masa transisi, backend/frontend harus support `subModules` dan `sub_modules`.

6. Perbaiki tenant guard di repository:

   - Detail/update Antrian harus memakai `where: { uuid, faskes_uuid: faskesUuid }`.
   - Update/delete semua entity harus memverifikasi affected row > 0.

7. Putuskan desain APM:

   - Jika APM adalah kiosk publik, jangan pakai token user biasa; gunakan session/device token atau API key scoped per tenant/device.
   - Jika APM harus login operator, permission APM tetap perlu enforced per action.

8. Bersihkan data faskes tidak dikenal sebelum strict enforcement.

## Pertanyaan Terbuka

- Apakah role `KASIR` memang tidak boleh membuka menu Antrian sama sekali?
- Apakah APM harus bisa berjalan tanpa user login di browser?
- Apakah `Layar` hanya boleh READ, atau operator perlu action untuk membuka layar fullscreen/preview tanpa hak konfigurasi?
- Apakah `Konfigurasi > Jadwal Dokter` dan `Konfigurasi > Layar Antrian` perlu dipisah permission-nya?
- Data faskes UUID `0194c099-40dc-759f-962b-168eeb523024` itu sisa seed lama, tenant lama, atau data migrasi?
