# Audit Menu Rawat Jalan

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Rawat Jalan adalah menu pelayanan setelah Admisi. Frontend utama berada di `frontend-service/src/views/RawatJalan`, tetapi data pelayanan polinya mayoritas diambil dari `admisi-service`, bukan `rawat-jalan-service`. Backend `rawat-jalan-service` saat ini lebih banyak menangani panggilan antrian poli dan laporan.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Poli | `/rawat-jalan/poli` | Daftar pasien rawat jalan, pelayanan, discharge, batal kunjungan. |
| BPJS > Monitoring Kunjungan | `/rawat-jalan/bpjs/monitoring-kunjungan` | Monitoring BPJS. |
| BPJS > Monitoring Riwayat Kunjungan | `/rawat-jalan/bpjs/monitoring-riwayat-kunjungan` | Monitoring riwayat BPJS. |
| BPJS > Monitoring Obat Kunjungan | `/rawat-jalan/bpjs/monitoring-obat-kunjungan` | Monitoring obat BPJS. |
| Laporan > Kunjungan Rawat Jalan | `/rawat-jalan/laporan/kunjungan-rawat-jalan` | Laporan kunjungan RJ. |
| Laporan > Pembatalan Poli | `/rawat-jalan/laporan/pembatalan-poli` | Laporan pembatalan RJ. |
| Laporan > Rekap Tindakan Pasien | `/rawat-jalan/laporan/rekap-tindakan-pasien` | Rekap tindakan pasien RJ. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Rawat Jalan dimulai di sekitar `frontend-service/src/router/index.ts:231`.

| Route | Component/page | Catatan |
|---|---|---|
| `/rawat-jalan` | redirect | Redirect ke `/rawat-jalan/poli`. |
| `/rawat-jalan/poli` | `RawatJalanView` + `PoliPage` | `requiresAuth: true`. |
| `/rawat-jalan/bpjs/monitoring-kunjungan` | `RawatJalanView` + `BPJSMonitoringPage` | `requiresAuth: true`. |
| `/rawat-jalan/bpjs/monitoring-riwayat-kunjungan` | `RawatJalanView` + `BPJSMonitoringPage` | `requiresAuth: true`. |
| `/rawat-jalan/bpjs/monitoring-obat-kunjungan` | `RawatJalanView` + `BPJSMonitoringPage` | `requiresAuth: true`. |
| `/rawat-jalan/laporan/kunjungan-rawat-jalan` | `RawatJalanView` + `LaporanPage` | `requiresAuth: true`. |
| `/rawat-jalan/laporan/pembatalan-poli` | `RawatJalanView` + `LaporanPage` | `requiresAuth: true`. |
| `/rawat-jalan/laporan/rekap-tindakan-pasien` | `RawatJalanView` + `LaporanPage` | `requiresAuth: true`. |

Sama seperti menu sebelumnya, route guard global hanya cek `access_token`, belum cek permission route-level.

### Sidebar

Source: `frontend-service/src/views/RawatJalan/RawatJalanView.vue`.

Sidebar dibuat dari kombinasi statis dan dinamis:

- Poli dibuat dinamis dari `datamaster/lokasi` pada `fetchLokasiData`.
- BPJS dan Laporan dibuat statis di `sidebarBodyList`.

Temuan sidebar:

- `updateSidebarBodyList` selalu melakukan `router.replace({ path: "/rawat-jalan/poli", ... })` di `RawatJalanView.vue:168`.
- `updateFilterMenu` juga selalu replace ke `/rawat-jalan/poli` di `RawatJalanView.vue:178`.
- Akibatnya, saat user masuk ke route BPJS atau Laporan, komponen parent berpotensi memaksa balik ke halaman Poli setelah data lokasi selesai dimuat.
- Sidebar belum difilter berdasarkan permission submodule/feature.

### Store/API Frontend

| Store | Endpoint yang dipakai | Catatan |
|---|---|---|
| `admisi/rawatJalan.ts` | `GET /admisi/rawat-jalan` | Data utama halaman Poli. |
| `admisi/rawatJalan.ts` | `DELETE /admisi/rawat-jalan/cancel` | Batal kunjungan dari halaman Poli. |
| `rawatJalan/laporanrajal.ts` | `GET /report/kunjungan` | Laporan kunjungan via Rawat Jalan service. |
| `rawatJalan/laporanrajal.ts` | `GET /report/batal-kunjungan` | Laporan batal kunjungan via Rawat Jalan service. |
| `rawatJalan/laporan/rekapTindakan.ts` | `GET /report/laporan-tindakan` | Mismatch dengan backend. |
| `rawatJalan/laporanrajal.ts` | `GET/PUT /antrian-call` | Drawer panggilan Rawat Jalan. |

### BPJS

Source:

- `frontend-service/src/views/RawatJalan/Page/BPJSMonitoringPage.vue`
- `frontend-service/src/views/RawatJalan/Layout/Tabel/BPJS/*`

Temuan:

- Data Monitoring Kunjungan, Riwayat Kunjungan, dan Obat Kunjungan masih hardcoded `ref([...])`.
- Tidak terlihat store/API BPJS yang dipanggil.
- Footer paginator masih memakai `totalRecords=120`, bukan data response.
- Tombol Cetak belum terlihat tersambung ke API/print handler.

### RME

Permission Rawat Jalan punya submodule `RME`, tetapi sidebar tidak punya menu RME. RME dibuka dari tabel pasien melalui komponen `MedicalRecord` di:

- `DataAllPasienRawatJalan.vue`
- `DataPelayananRawatJalan.vue`
- `DataDischargeRawatJalan.vue`

Artinya permission RME perlu diputuskan apakah mengikuti module `Rawat Jalan`, module `MedicalRecord/Rekam Medis`, atau keduanya.

## Backend/API

### Mounting

Source: `rawat-jalan-service/src/app.js`.

Backend menyusun base URL dari:

```txt
/${API_BASE}/${API_VERSION}/${API_MODULE}
```

Default `API_MODULE` di source adalah `rajal`, tetapi `.env` lokal memakai `APPLICATION_MODULE=rawat-jalan` dan tidak mendefinisikan `API_MODULE`. Dengan kondisi sekarang backend mount ke `/api/v3/rajal`.

Frontend `.env` memakai:

```txt
VITE_BASE_RAWAT_JALAN=http://localhost:8092/api/v3/rawat-jalan
```

Ini membuat endpoint Rawat Jalan frontend berpotensi 404 di local.

### Route Backend

Source: `rawat-jalan-service/src/routes/routes.js`.

| Endpoint backend aktual | Fungsi |
|---|---|
| `GET /api/v3/rajal/` | Health/simple hello. |
| `GET /api/v3/rajal/antrian-call` | Ambil antrian poli. |
| `PUT /api/v3/rajal/antrian-call/:uuid` | Update status panggilan. |
| `GET /api/v3/rajal/laporan-tindakan` | Rekap tindakan. |
| `GET /api/v3/rajal/report/kunjungan` | Laporan kunjungan. |
| `GET /api/v3/rajal/report/batal-kunjungan` | Laporan batal kunjungan. |

Mismatch tambahan:

- Frontend rekap tindakan memanggil `/report/laporan-tindakan`.
- Backend menyediakan `/laporan-tindakan`.

Jadi walaupun base URL dibetulkan, endpoint rekap tindakan masih perlu disamakan.

### Auth dan Context

Backend route memakai `authorizationMiddleware` di `rawat-jalan-service/src/routes/routes.js:9`.

Middleware:

- Membaca header `Authorization`.
- Memverifikasi JWT via `JwtUtils.veryfy(token)`.
- Menyimpan author/token ke `Context` static global.

Risk:

- Tidak ada permission enforcement per route.
- Tidak ada cek token aktif di Redis/session store.
- `Context` static global berisiko tercampur antar request paralel.
- `AuthenticationService`/`AuthenticationRepository` ada, tetapi tidak terlihat dipakai oleh middleware route.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:126`
- `frontend-service/src/stores/datamaster/permission.ts:149`

Definisi permission Rawat Jalan:

| Submodule/feature | Allows |
|---|---|
| Antrian | `PANGGIL`, `LEWATI`, `PROSSES`, `SELESAI` |
| Poli | `READ`, `BATAL KUNJUNGAN` |
| BPJS-PCARE > Monitoring Kunjungan | `READ`, `CETAK BPJS` |
| BPJS-PCARE > Monitoring Riwayat Kunjungan | `READ`, `CETAK BPJS` |
| BPJS-PCARE > Monitoring Obat Kunjungan | `READ`, `CETAK BPJS` |
| Laporan Rawat Jalan > Kunjungan | `READ`, `CETAK LAPORAN` |
| Laporan Rawat Jalan > Pembatalan Poli | `READ`, `CETAK LAPORAN` |
| Laporan Rawat Jalan > Rekap Pembatalan Pasien | `READ`, `CETAK LAPORAN` |
| RME | Banyak action klinis, termasuk rekam medis, asesmen, SOAP, alkes, tindakan, inform consent, file, resume, surat. |

Data role lokal:

| Scope | Role | Rawat Jalan |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Mismatches:

- Permission laporan punya `Rekap Pembatalan Pasien`, tetapi UI route memakai `Rekap Tindakan Pasien`.
- Permission submodule `BPJS-PCARE`, sidebar menulis `BPJS`.
- Action typo `PROSSES` muncul kembali.
- `Resume Dan DISHCARGE` dan `DISHCARGE` typo di permission RME.
- `CREATEE OBAT RACIKAN` typo di permission SOAP.
- `DELETE SURAT KERERANGAN` typo di permission Cetak Hasil Dan Surat.

## Tenant/Faskes

Pola tenant:

- Rawat Jalan service mengambil `faskesUuid` dari JWT yang disimpan di `Context`.
- Query report menggunakan `faskesUuid` pada `commonFilterReport`.
- Halaman Poli mengambil data dari Admisi, sehingga tenant enforcement utamanya mengikuti Admisi service.
- Drawer antrian poli memanggil Rawat Jalan service, lalu Rawat Jalan service memanggil Antrian/Admisi antrian call via axios dengan token dari `Context`.

Data lokal:

| Data | Klinik Contoh | Klinik Sehat | Faskes tidak dikenal |
|---|---:|---:|---:|
| `rawat_jalans` aktif | 129 | 23 | 1 |
| `rawat_jalans` deleted | 42 | 4 | 0 |
| `history_tindakan` pelayanan RJ | 23 | 0 | 0 |

Ada 1 data `rawat_jalans` dengan faskes UUID `0192b31f-365d-731c-8b16-3a4565c9475e` yang tidak ada di tabel faskes aktif lokal.

## Temuan Defect/Risk

1. Base URL frontend dan backend Rawat Jalan tidak sama.

   Frontend memakai `/api/v3/rawat-jalan`, backend mount ke `/api/v3/rajal`. Ini bisa menyebabkan semua API Rawat Jalan service 404 di local.

2. Endpoint rekap tindakan mismatch.

   Frontend memanggil `/report/laporan-tindakan`, backend menyediakan `/laporan-tindakan`.

3. Sidebar parent bisa memaksa redirect ke Poli.

   `RawatJalanView.vue` memanggil `router.replace("/rawat-jalan/poli")` saat update sidebar. Route BPJS/Laporan bisa terpental ke Poli setelah mount.

4. BPJS Monitoring masih dummy/static.

   Tiga tabel BPJS memakai data hardcoded, paginator hardcoded, dan belum tersambung ke backend.

5. Permission belum enforced.

   Frontend dan backend belum memeriksa action seperti `BATAL KUNJUNGAN`, `CETAK BPJS`, `CETAK LAPORAN`, atau permission RME.

6. Context backend static global.

   `rawat-jalan-service/src/middlewares/context.js` memakai static object. Ini risk untuk request paralel/multi-user.

7. RME terbuka dari tabel pasien tanpa permission guard yang jelas.

   Action RME sangat sensitif, tetapi aksesnya berupa dialog `MedicalRecord` dari halaman Poli/Discharge/Pelayanan.

8. Data tenant lama/tidak dikenal masih ada.

   Ada data `rawat_jalans` dengan faskes UUID yang tidak ada di master faskes aktif.

9. Banyak log debug masih tertinggal.

   Contoh: export Excel, report tindakan, dan error log repository.

## Rekomendasi Revamp

1. Samakan base URL:

   - Opsi A: ubah backend `API_MODULE=rawat-jalan`.
   - Opsi B: ubah frontend `VITE_BASE_RAWAT_JALAN=http://localhost:8092/api/v3/rajal`.
   - Pilih satu pola canonical sebelum revamp route.

2. Samakan endpoint rekap tindakan:

   - Ubah frontend ke `/laporan-tindakan`, atau
   - Tambahkan alias backend `/report/laporan-tindakan`.

3. Hilangkan redirect paksa di `RawatJalanView.vue`.

   Redirect ke `/rawat-jalan/poli` hanya boleh terjadi dari route `/rawat-jalan`, bukan saat parent view mount di route BPJS/Laporan.

4. Buat permission code stabil:

   - `RAWAT_JALAN.POLI.READ`
   - `RAWAT_JALAN.POLI.CANCEL`
   - `RAWAT_JALAN.ANTRIAN.CALL`
   - `RAWAT_JALAN.ANTRIAN.SKIP`
   - `RAWAT_JALAN.ANTRIAN.PROCESS`
   - `RAWAT_JALAN.ANTRIAN.FINISH`
   - `RAWAT_JALAN.BPJS.MONITORING_KUNJUNGAN.READ`
   - `RAWAT_JALAN.BPJS.MONITORING_KUNJUNGAN.PRINT`
   - `RAWAT_JALAN.REPORT.KUNJUNGAN.READ`
   - `RAWAT_JALAN.REPORT.KUNJUNGAN.PRINT`
   - `RAWAT_JALAN.RME.SOAP.CREATE_OBAT`

5. Tentukan ownership RME.

   Jika RME menjadi modul terpisah, permission RME sebaiknya tidak hidup di Rawat Jalan saja. Jika tetap nested per pelayanan, harus ada guard gabungan: pelayanan + RME action.

6. Ganti static `Context` backend dengan request-scoped context atau pass `author/token` eksplisit antar layer.

7. Bersihkan/migrasikan data faskes tidak dikenal sebelum strict tenant enforcement.

## Pertanyaan Terbuka

- Nama canonical endpoint Rawat Jalan mau `rajal` atau `rawat-jalan`?
- BPJS Monitoring masih direncanakan dipakai, atau akan diganti integrasi baru?
- RME akan menjadi permission global Rekam Medis atau nested di tiap pelayanan?
- Apakah `KASIR` memang tidak boleh melihat Rawat Jalan sama sekali?
- Laporan yang benar adalah `Rekap Tindakan Pasien` atau `Rekap Pembatalan Pasien`?
