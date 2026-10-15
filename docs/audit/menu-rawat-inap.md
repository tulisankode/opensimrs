# Audit Menu Rawat Inap

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Rawat Inap berada setelah Rawat Jalan pada router utama. Frontend utama berada di `frontend-service/src/views/RawatInap`, tetapi sumber data menu ini terbagi ke beberapa service:

- daftar pasien ruangan, detail pasien, monitoring kamar, dan batal kunjungan memakai `admisi-service`;
- perpindahan bangsal, riwayat perpindahan, dan laporan kunjungan/perpindahan memakai `rawat-inap-service`;
- rekap tindakan pasien Rawat Inap masih memakai store laporan Rawat Jalan.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Ruang Rawatan | `/rawat-inap/ruangan` | Daftar pasien rawat inap berdasarkan ruangan/bed, buka RME, dan batal kunjungan. |
| Perpindahan Bangsal | `/rawat-inap/perpindahan-bangsal` | Approval request perpindahan bed/bangsal. |
| BPJS > Monitoring Kunjungan | `/rawat-inap/bpjs/monitoring-kunjungan` | Monitoring BPJS, saat ini masih dummy/static. |
| BPJS > Monitoring Riwayat Kunjungan | `/rawat-inap/bpjs/monitoring-riwayat-kunjungan` | Monitoring riwayat BPJS, saat ini masih dummy/static. |
| BPJS > Monitoring Obat Kunjungan | `/rawat-inap/bpjs/monitoring-obat-kunjungan` | Monitoring obat BPJS, saat ini masih dummy/static. |
| Laporan > Kunjungan Rawat Inap | `/rawat-inap/laporan/kunjungan-rawat-inap` | Laporan kunjungan RI. |
| Laporan > Perpindahan Pasien | `/rawat-inap/laporan/perpindahan-pasien` | Laporan perpindahan pasien RI. |
| Laporan > Pembatalan Dirawat | `/rawat-inap/laporan/pembatalan-dirawat` | Laporan batal rawat RI. |
| Laporan > Rekap Tindakan Pasien | `/rawat-inap/laporan/rekap-tindakan-pasien` | Rekap tindakan pasien RI. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Rawat Inap dimulai di sekitar `frontend-service/src/router/index.ts:1172`.

| Route | Component/page | Catatan |
|---|---|---|
| `/rawat-inap` | redirect | Redirect ke `/rawat-inap/ruangan`. |
| `/rawat-inap/ruangan` | `RawatInapView` + `RuanganPage` | `requiresAuth: true`. |
| `/rawat-inap/perpindahan-bangsal` | `RawatInapView` + `PerpindahanBangsal` | `requiresAuth: true`. |
| `/rawat-inap/bpjs/monitoring-kunjungan` | `RawatInapView` + `BPJSMonitoringPage` | `requiresAuth: true`. |
| `/rawat-inap/bpjs/monitoring-riwayat-kunjungan` | `RawatInapView` + `BPJSMonitoringPage` | `requiresAuth: true`. |
| `/rawat-inap/bpjs/monitoring-obat-kunjungan` | `RawatInapView` + `BPJSMonitoringPage` | `requiresAuth: true`. |
| `/rawat-inap/laporan/kunjungan-rawat-inap` | `RawatInapView` + `LaporanPage` | `requiresAuth: true`. |
| `/rawat-inap/laporan/perpindahan-pasien` | `RawatInapView` + `LaporanPage` | `requiresAuth: true`. |
| `/rawat-inap/laporan/pembatalan-dirawat` | `RawatInapView` + `LaporanPage` | `requiresAuth: true`. |
| `/rawat-inap/laporan/rekap-tindakan-pasien` | `RawatInapView` + `LaporanPage` | `requiresAuth: true`. |

Guard global tetap hanya memeriksa `access_token`. Belum terlihat permission route-level untuk `RAWAT_INAP.RUANGAN.READ`, `RAWAT_INAP.PERPINDAHAN.APPROVE`, atau laporan/cetak.

### Sidebar

Source: `frontend-service/src/views/RawatInap/RawatInapView.vue`.

Sidebar dibuat dari kombinasi dinamis dan statis:

- daftar `Ruang Rawatan` diambil dari `monitoringKamarStore.getMonitoringKamar({ page: 1, limit: 9999 })`;
- `Perpindahan Bangsal`, `BPJS`, dan `Laporan` dibuat statis di `sidebarBodyList`.

Temuan sidebar:

- `updateSidebarBodyList` selalu melakukan `router.replace({ path: "/rawat-inap/ruangan", ... })`.
- `updateFilterMenu` juga selalu replace ke `/rawat-inap/ruangan`.
- Akibatnya, saat user masuk ke BPJS/Laporan/Perpindahan, parent `RawatInapView` berpotensi memaksa balik ke halaman Ruangan setelah data kamar selesai dimuat.
- Sidebar belum difilter berdasarkan permission submodule/feature.

### Store/API Frontend

| Store | Endpoint yang dipakai | Service target | Catatan |
|---|---|---|---|
| `admisi/rawatInap.ts` | `GET /rawat-inap` | Admisi | Data utama halaman Ruangan. |
| `admisi/rawatInap.ts` | `GET /rawat-inap/:uuid` | Admisi | Detail RI untuk buka RME/detail pasien. |
| `admisi/rawatInap.ts` | `DELETE /rawat-inap/cancel` | Admisi | Batal kunjungan dari halaman Ruangan. |
| `admisi/monitoringKamar.ts` | `GET /monitoring-rooms` | Admisi | Master/list bed untuk sidebar ruangan. |
| `rawatInap/perpindahanBangsal.ts` | `GET /transfer-bed/all` | Rawat Inap | List request perpindahan. |
| `rawatInap/perpindahanBangsal.ts` | `PUT /transfer-bed/approve/:uuid` | Rawat Inap | Approve perpindahan. |
| `rawatInap/perpindahanBangsal.ts` | `PUT /transfer-bed/reject/:uuid` | Rawat Inap | Reject perpindahan. |
| `rawatInap/perpindahanBangsal.ts` | `POST /transfer-bed/request/:uuid` | Rawat Inap | Request perpindahan dari RME. |
| `rawatInap/laporanranap.ts` | `GET /report/kunjungan` | Rawat Inap | Laporan kunjungan RI. |
| `rawatInap/laporanranap.ts` | `GET /report/batal-kunjungan` | Rawat Inap | Laporan batal RI. |
| `rawatInap/laporanranap.ts` | `GET /report/perpindahan` | Rawat Inap | Laporan perpindahan pasien. |
| `rawatInap/exportexcelranap.ts` | memakai `rawatJalan/laporan/rekapTindakan` | Rawat Jalan | Rekap tindakan RI mengambil store Rawat Jalan. |

### BPJS

Source:

- `frontend-service/src/views/RawatInap/Page/BPJSMonitoringPage.vue`
- `frontend-service/src/views/RawatInap/Layout/Tabel/BPJS/*`

Temuan:

- Data Monitoring Kunjungan, Riwayat Kunjungan, dan Obat Kunjungan masih hardcoded `ref([...])`.
- Tidak terlihat store/API BPJS yang dipanggil.
- Footer paginator masih memakai `totalRecords=120`, bukan data response.
- Tombol Cetak belum terlihat tersambung ke API/print handler.

### RME dan Perpindahan

RME dibuka dari:

- `RuanganPage.vue`, melalui `MedicalRecord rmType="rawat-inap"`;
- `PerpindahanBangsal.vue`, melalui `MedicalRecord rmType="rawat-inap"` dengan `initialTab="perpindahan"` dan `isApprovalMode=true`.

Store `rekamMedis.ts` juga memanggil Rawat Inap service untuk:

- `POST /transfer-bed/request/:uuidRawatInap`;
- `GET /transfer-bed/history/:uuidRawatInap`.

Artinya permission detail pasien/RME/perpindahan perlu dibuat jelas, karena aksi klinis dan aksi pindah bangsal berjalan dari komponen RME, bukan hanya dari menu Perpindahan Bangsal.

### Header Filter

Source: `frontend-service/src/views/RawatInap/Layout/Header/DataPoliBPJSHeader.vue`.

Ada beberapa kondisi template seperti:

```vue
v-if="currentRouteName === 'ruangan' || 'perpindahan-bangsal'"
```

Ekspresi tersebut selalu truthy karena string `'perpindahan-bangsal'` selalu bernilai benar. Dampaknya filter pasien/dokter/pembayaran bisa muncul pada halaman yang tidak semestinya.

## Backend/API

### Mounting

Source: `rawat-inap-service/src/app.js`.

Backend Rawat Inap mount ke:

```txt
/api/v3/ranap
```

Frontend `.env` memakai:

```txt
VITE_BASE_RAWAT_INAP=http://localhost:8091/api/v3/rawat-inap
```

Ini membuat semua endpoint `rawat-inap-service` yang dipanggil frontend berpotensi 404 di local:

- `/transfer-bed/*`
- `/report/kunjungan`
- `/report/batal-kunjungan`
- `/report/perpindahan`

Catatan: halaman Ruangan masih bisa sebagian jalan karena memakai `admisi-service`, bukan `rawat-inap-service`.

### Route Backend Rawat Inap Service

Source: `rawat-inap-service/src/routes/router.js`.

| Endpoint backend aktual | Fungsi |
|---|---|
| `GET /api/v3/ranap/transfer-bed/current-bed/:uuid` | Ambil bed pasien RI saat ini. |
| `POST /api/v3/ranap/transfer-bed/request/:uuid` | Request pindah bed. |
| `PUT /api/v3/ranap/transfer-bed/reject/:uuid` | Reject request pindah bed. |
| `PUT /api/v3/ranap/transfer-bed/approve/:uuid` | Approve request pindah bed dan update bed. |
| `GET /api/v3/ranap/transfer-bed/all` | List request pindah bed pending. |
| `GET /api/v3/ranap/transfer-bed/history/:uuid` | Riwayat pindah bed pasien. |
| `GET /api/v3/ranap/transfer-bed/request/detail/:uuid` | Detail request pindah bed. |
| `GET /api/v3/ranap/transfer-bed/total-pending` | Total request pending. |
| `GET /api/v3/ranap/report/kunjungan` | Laporan kunjungan RI. |
| `GET /api/v3/ranap/report/batal-kunjungan` | Laporan batal RI. |
| `GET /api/v3/ranap/report/perpindahan` | Laporan perpindahan pasien. |

### Route Terkait di Admisi

Source: `admisi-service/src/routes/routes.js`.

Endpoint yang dipakai halaman Ruangan:

| Endpoint | Fungsi |
|---|---|
| `GET /api/v3/admisi/rawat-inap` | List pasien RI. |
| `GET /api/v3/admisi/rawat-inap/:uuid` | Detail RI. |
| `DELETE /api/v3/admisi/rawat-inap/cancel` | Batal RI. |
| `GET /api/v3/admisi/monitoring-rooms` | List monitoring kamar/bed. |

### Auth dan Context

`rawat-inap-service` memakai `authorizationMiddleware` yang:

- membaca `Authorization`;
- verifikasi JWT via `JwtUtils.veryfy(token)`;
- menyimpan author ke `Context` static global.

Risk:

- Tidak ada permission enforcement per endpoint.
- Tidak ada cek token aktif di Redis/session store.
- `Context` static global berisiko tercampur antar request paralel.
- Error validasi report memakai `throw new Error(...)`, sehingga request tanpa tanggal bisa menjadi HTTP 500, bukan 400.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:231`
- `frontend-service/src/stores/datamaster/permission.ts:279`

Definisi permission Rawat Inap:

| Submodule/feature | Allows |
|---|---|
| Rawat Inap | `READ`, `BATAL DIRAWAT` |
| Perpindahan Bangsal | `READ`, `BATAL TERIMA`, `SETUJU DAN TERIMA` |
| BPJS-PCARE > Monitoring Kunjungan | `READ`, `CETAK BPJS` |
| BPJS-PCARE > Monitoring Riwayat Kunjungan | `READ`, `CETAK BPJS` |
| BPJS-PCARE > Monitoring Obat Kunjungan | `READ`, `CETAK BPJS` |
| Laporan > Monitoring Rawat Inap | `READ`, `CETAK LAPORAN` |
| Laporan > Perpindahan Pasien | `READ`, `CETAK LAPORAN` |
| Laporan > Pembatalan Berobat | `READ`, `CETAK LAPORAN` |
| Laporan > Rekap Tindakan Pasien | `READ`, `CETAK LAPORAN` |
| Detail Pasien | Banyak action klinis, termasuk Rekam Medis, Asesmen, SOAP Dokter, Inform Consent, Alkes dan Penunjang, Perpindahan, FPO, Unggah Berkas, Resume, dan Cetak Hasil/Surat. |

Data role lokal:

| Scope | Role | Rawat Inap |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Mismatches:

- Permission `Rawat Inap` menjadi submodule utama, sedangkan sidebar menulis `Ruang Rawatan`.
- Permission `BPJS-PCARE`, sidebar menulis `BPJS`.
- Permission laporan memakai `Monitoring Rawat Inap`, UI route memakai `Kunjungan Rawat Inap`.
- Permission laporan memakai `Pembatalan Berobat`, UI route memakai `Pembatalan Dirawat`.
- Permission `BATAL TERIMA`/`SETUJU DAN TERIMA` belum langsung dipetakan ke endpoint `reject`/`approve`.
- Ada typo permission `Dishcarge` dan `DISHCARGE`.

## Tenant/Faskes

Pola tenant:

- `admisi-service` mengambil `faskesUuid` dari JWT Context untuk list/detail/batal RI.
- `rawat-inap-service` mengambil `faskesUuid` dari JWT Context untuk perpindahan dan report.
- Query perpindahan dan report sudah memasukkan `faskesUuid`.
- Pemilihan tenant tetap berasal dari token yang diperbarui lewat header global.

Data lokal:

| Data | Klinik Contoh | Klinik Sehat | Faskes tidak dikenal |
|---|---:|---:|---:|
| `rawat_inaps` aktif status 1 | 10 | 0 | 0 |
| `rawat_inaps` aktif status 3 | 10 | 0 | 0 |
| `rawat_inaps` aktif status 4 | 4 | 0 | 0 |
| `rawat_inaps` deleted/status 0 | 2 | 0 | 0 |
| `room_monitorings` aktif | 54 | 3 | 0 |
| `room_monitorings` deleted | 124 | 0 | 0 |
| `perpindahans` aktif | 0 | 0 | 0 |

Berbeda dari beberapa menu sebelumnya, data lokal Rawat Inap tidak menunjukkan faskes UUID tidak dikenal pada tabel yang dicek.

## Temuan Defect/Risk

1. Base URL frontend dan backend Rawat Inap tidak sama.

   Frontend memakai `/api/v3/rawat-inap`, backend mount ke `/api/v3/ranap`. Perpindahan bangsal, laporan RI, riwayat perpindahan dari RME, dan request pindah bed bisa 404 di local.

2. Parent sidebar Rawat Inap bisa memaksa balik ke halaman Ruangan.

   `RawatInapView` memanggil `router.replace("/rawat-inap/ruangan")` setelah fetch ruangan dan saat filter berubah. Ini berpotensi mengganggu halaman Perpindahan, BPJS, dan Laporan.

3. Kondisi `v-if` di header filter selalu true.

   Pola `currentRouteName === 'ruangan' || 'perpindahan-bangsal'` membuat sebagian filter tampil di semua halaman karena operand kedua adalah string truthy.

4. BPJS Rawat Inap masih dummy/static.

   Tiga tabel BPJS memakai data hardcoded dan paginator statis `120`, sehingga belum bisa diaudit sebagai fitur produksi.

5. Rekap tindakan pasien RI memakai store Rawat Jalan.

   `LaporanPage.vue` dan `exportexcelranap.ts` memakai `useRekapTindakanStore` dari `rawatJalan/laporan/rekapTindakan`. Ini membuat data RI bergantung pada endpoint Rawat Jalan yang sebelumnya juga punya mismatch.

6. Permission belum ditegakkan di frontend route/sidebar maupun backend.

   Role KASIR tidak punya Rawat Inap, tetapi backend hanya validasi token. Jika user memiliki token valid dan mengetahui endpoint, belum ada guard action seperti `BATAL DIRAWAT`, `SETUJU DAN TERIMA`, atau `CETAK LAPORAN`.

7. Context backend static global.

   Sama seperti Rawat Jalan, `Context` disimpan di static object. Pada traffic paralel, ini berisiko mencampur author/faskes antar request.

8. Error report tanpa tanggal menjadi 500.

   `ReportService` melempar `new Error("start_date and end_date perlu diisi")`; error middleware akan mengembalikan 500. Ini seharusnya 400 karena input query tidak valid.

9. Status dan label Rawat Inap belum konsisten.

   UI tab memakai `selectedTab` `2`, `1`, `0` untuk semua/dirawat/discharge, sedangkan backend memakai `statusRi` 1, 3, 4 dan filter mengubah 1 menjadi `[1,3]`, 0 menjadi `[4]`, 2 menjadi `[1,3,4]`. Ini perlu dibakukan agar tidak membingungkan saat revamp.

10. Banyak debug log tersisa.

   Ditemukan `console.log`/`console.error` debugging pada view, controller, repository, dan export Excel. Ini akan membuat debugging produksi noisy dan bisa membocorkan data pasien di console.

## Rekomendasi Revamp

1. Pilih canonical base path Rawat Inap.

   Opsi cepat untuk local: ubah `VITE_BASE_RAWAT_INAP` menjadi `/api/v3/ranap`. Opsi lebih konsisten nama menu: mount backend ke `/api/v3/rawat-inap` atau sediakan alias kompatibel.

2. Pisahkan ownership data per submenu.

   Ruangan tetap bisa lewat Admisi, tetapi Perpindahan/Laporan/RME perlu kontrak API yang jelas agar tidak saling tergantung ke store Rawat Jalan.

3. Normalisasi permission code.

   Usulan kode stabil:

   - `RAWAT_INAP.RUANGAN.READ`
   - `RAWAT_INAP.RUANGAN.CANCEL`
   - `RAWAT_INAP.TRANSFER.READ`
   - `RAWAT_INAP.TRANSFER.APPROVE`
   - `RAWAT_INAP.TRANSFER.REJECT`
   - `RAWAT_INAP.TRANSFER.REQUEST`
   - `RAWAT_INAP.BPJS.MONITORING_VISIT.READ`
   - `RAWAT_INAP.BPJS.MONITORING_HISTORY.READ`
   - `RAWAT_INAP.BPJS.MONITORING_MEDICINE.READ`
   - `RAWAT_INAP.REPORT.VISIT.READ`
   - `RAWAT_INAP.REPORT.TRANSFER.READ`
   - `RAWAT_INAP.REPORT.CANCEL.READ`
   - `RAWAT_INAP.REPORT.ACTION_RECAP.READ`
   - `RAWAT_INAP.RME.*`

4. Tambahkan `meta.permission` pada router dan filter sidebar dari permission efektif user.

   Dengan begitu role seperti KASIR tidak melihat menu Rawat Inap dan tidak bisa akses route langsung.

5. Tambahkan middleware permission backend.

   Mapping awal:

   - `DELETE /admisi/rawat-inap/cancel` -> `RAWAT_INAP.RUANGAN.CANCEL`
   - `PUT /ranap/transfer-bed/approve/:uuid` -> `RAWAT_INAP.TRANSFER.APPROVE`
   - `PUT /ranap/transfer-bed/reject/:uuid` -> `RAWAT_INAP.TRANSFER.REJECT`
   - `POST /ranap/transfer-bed/request/:uuid` -> `RAWAT_INAP.TRANSFER.REQUEST`
   - `GET /ranap/report/*` -> permission laporan masing-masing

6. Ganti Context static ke request-scoped context.

   Minimal, lewat `req.user`/`res.locals.jwtData`; lebih baik pakai pattern yang sama di semua service.

7. Implementasi BPJS RI perlu diputuskan.

   Jika belum ada bridging BPJS, tampilkan empty state berbasis API dan sembunyikan tombol cetak. Jika sudah ada, buat store terpisah dan jangan gunakan dummy table.

## Pertanyaan Terbuka

1. Apakah base path resmi yang diinginkan untuk Rawat Inap adalah `/ranap` atau `/rawat-inap`?
2. Apakah Rekap Tindakan Pasien RI memang boleh memakai endpoint laporan tindakan Rawat Jalan dengan filter `pelayanan=ri`, atau perlu endpoint khusus di `rawat-inap-service`/`laporan-service`?
3. Apakah permission `Detail Pasien` berada di bawah module Rawat Inap, atau harus dipindah ke module Rekam Medis global?
4. Untuk perpindahan bangsal, apakah `BATAL TERIMA` berarti reject request, dan `SETUJU DAN TERIMA` berarti approve request?
