# Audit Menu IGD

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu IGD adalah menu pelayanan gawat darurat setelah Rawat Inap pada router utama. Frontend berada di `frontend-service/src/views/IGD`. Pola ownership datanya mirip Rawat Inap:

- daftar pasien IGD, detail pasien, dan batal kunjungan memakai `admisi-service`;
- laporan kunjungan dan batal IGD memakai `igd-service`;
- rekap tindakan pasien IGD masih memakai store laporan tindakan Rawat Jalan.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Pasien IGD | `/igd/pasien-igd` | Daftar pasien IGD, buka RME, dan batal kunjungan. |
| BPJS > Monitoring Kunjungan | `/igd/bpjs/monitoring-kunjungan` | Monitoring BPJS, saat ini masih dummy/static. |
| BPJS > Monitoring Riwayat Kunjungan | `/igd/bpjs/monitoring-riwayat-kunjungan` | Monitoring riwayat BPJS, saat ini masih dummy/static. |
| BPJS > Monitoring Obat Kunjungan | `/igd/bpjs/monitoring-obat-kunjungan` | Monitoring obat BPJS, saat ini masih dummy/static. |
| Laporan > Kunjungan IGD | `/igd/laporan/kunjungan-igd` | Laporan kunjungan IGD. |
| Laporan > Pembatalan Dirawat | `/igd/laporan/pembatalan-dirawat` | Laporan batal IGD. |
| Laporan > Rekap Tindakan Pasien | `/igd/laporan/rekap-tindakan-pasien` | Rekap tindakan pasien IGD. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route IGD dimulai setelah Rawat Inap, sekitar `frontend-service/src/router/index.ts:1253`.

| Route | Component/page | Catatan |
|---|---|---|
| `/igd` | redirect | Redirect ke `/igd/pasien-igd`. |
| `/igd/pasien-igd` | `IGDView` + `PasienIgdPage` | `requiresAuth: true`. |
| `/igd/bpjs/monitoring-kunjungan` | `IGDView` + `BPJSPage` | `requiresAuth: true`. |
| `/igd/bpjs/monitoring-riwayat-kunjungan` | `IGDView` + `BPJSPage` | `requiresAuth: true`. |
| `/igd/bpjs/monitoring-obat-kunjungan` | `IGDView` + `BPJSPage` | `requiresAuth: true`. |
| `/igd/laporan/kunjungan-igd` | `IGDView` + `LaporanIGDPage` | `requiresAuth: true`. |
| `/igd/laporan/pembatalan-dirawat` | `IGDView` + `LaporanIGDPage` | `requiresAuth: true`. |
| `/igd/laporan/rekap-tindakan-pasien` | `IGDView` + `LaporanIGDPage` | `requiresAuth: true`. |

Guard global hanya memeriksa `access_token`, belum memakai permission route-level.

### Sidebar

Source: `frontend-service/src/views/IGD/IGDView.vue`.

Sidebar dibuat statis:

- Pasien IGD
- BPJS > Monitoring Kunjungan, Riwayat Kunjungan, Obat Kunjungan
- Laporan > Kunjungan IGD, Pembatalan Dirawat, Rekap Tindakan Pasien

Temuan sidebar:

- Sidebar belum difilter berdasarkan permission submodule/feature.
- `showFilterPoli` masih dipakai di sidebar IGD, padahal menu IGD tidak memiliki daftar poli dinamis seperti Rawat Jalan.
- Pada `onMounted`, jika route punya `query.filter`, kode melakukan `router.replace({ path: "/rawat-jalan/poli" })`. Ini tampak copy-paste dari Rawat Jalan dan bisa membawa user keluar dari menu IGD ke Rawat Jalan.

### Store/API Frontend

| Store | Endpoint yang dipakai | Service target | Catatan |
|---|---|---|---|
| `admisi/igd.ts` | `GET /igd` | Admisi | Data utama halaman Pasien IGD. |
| `admisi/igd.ts` | `GET /igd/:uuid` | Admisi | Detail IGD untuk buka RME/detail pasien. |
| `admisi/igd.ts` | `DELETE /igd/cancel` | Admisi | Batal kunjungan IGD. |
| `igd/laporan.ts` | `GET /report/kunjungan` | IGD service | Laporan kunjungan IGD dari frontend. |
| `igd/laporan.ts` | `GET /report/batal-kunjungan` | IGD service | Laporan batal IGD dari frontend. |
| `igd/exportexceligd.ts` | memakai `rawatJalan/laporan/rekapTindakan` | Rawat Jalan | Rekap tindakan IGD mengambil store Rawat Jalan. |

Catatan: `admisi/igd.ts` masih menyimpan dummy `return` setelah `return apiAdmisiGet(...)`. Kode itu tidak akan pernah dieksekusi, tetapi menandakan sisa stub lama.

### BPJS

Source:

- `frontend-service/src/views/IGD/BPJS/BPJSPage.vue`
- `frontend-service/src/views/IGD/BPJS/MonitoringKunjungan.vue`
- `frontend-service/src/views/IGD/BPJS/MonitoringRiwayatKunjungan.vue`
- `frontend-service/src/views/IGD/BPJS/MonitoringObatKunjungan.vue`

Temuan:

- Tiga tabel BPJS masih memakai hardcoded `ref([...])`.
- Tidak terlihat store/API BPJS yang dipanggil.
- Footer pagination BPJS dikomentari sebagai `FIXME`.
- Tombol cetak/print BPJS belum terlihat sebagai flow produksi.

### RME

RME dibuka dari `PasienIgdPage.vue` melalui `MedicalRecord rmType="igd"`.

Jika pasien belum memiliki `rekamMedisUuid`, frontend membuat rekam medis baru dengan:

- `pelayanan: "igd"`;
- `lokasiUuid` dari `lokasiStore.getByCodeApi("IGD")`;
- data pasien dan nomor pelayanan dari detail IGD.

Permission detail pasien/RME perlu dipastikan apakah mengikuti module IGD, Rekam Medis global, atau keduanya.

## Backend/API

### Mounting

Source: `igd-service/src/app.js`.

Backend IGD menyusun base URL dari:

```txt
/${API_BASE}/${API_VERSION}/${API_MODULE}
```

Default source:

```txt
API_MODULE=pelayanan
```

File `.env` lokal berisi:

```txt
APPLICATION_MODULE=igd
APPLICATION_PORT=8085
APP_PORT=8085
```

Tetapi `app.js` membaca `API_MODULE`, bukan `APPLICATION_MODULE`, dan route internal juga masih diawali `/igd`. Dengan kondisi source saat ini:

- jika `API_MODULE` tidak diset, backend mount menjadi `/api/v3/pelayanan`;
- route laporan backend menjadi `/api/v3/pelayanan/igd/report/kunjungan`;
- frontend memakai `VITE_BASE_IGD=http://localhost:8085/api/v3/igd` dan store memanggil `/report/kunjungan`, sehingga request menjadi `/api/v3/igd/report/kunjungan`;
- jika `API_MODULE=igd` diset, backend route menjadi `/api/v3/igd/igd/report/kunjungan`, masih berbeda dari frontend.

Jadi laporan IGD berpotensi 404 di local.

Catatan tambahan: `igd-service/src/app.js` tidak terlihat memuat `dotenv/config` langsung, sehingga service ini bergantung pada launcher untuk memasukkan env.

### Route Backend IGD Service

Source: `igd-service/src/routes/routes.js`.

Endpoint backend aktual relatif terhadap base:

| Endpoint relatif | Fungsi |
|---|---|
| `GET /igd/report/kunjungan` | Laporan kunjungan IGD. |
| `GET /igd/report/batal-kunjungan` | Laporan batal IGD. |

Endpoint rekap tindakan ada di controller/service/repository, tetapi route `routes.get('/laporan-tindakan', ...)` masih dikomentari.

### Route Terkait di Admisi

Source: `admisi-service/src/routes/routes.js`.

Endpoint yang dipakai halaman Pasien IGD:

| Endpoint | Fungsi |
|---|---|
| `GET /api/v3/admisi/igd` | List pasien IGD. |
| `GET /api/v3/admisi/igd/:uuid` | Detail IGD. |
| `POST /api/v3/admisi/igd` | Registrasi IGD. |
| `PUT /api/v3/admisi/igd/:uuid` | Update IGD. |
| `DELETE /api/v3/admisi/igd/cancel` | Batal IGD. |

### Auth dan Context

`igd-service` memakai `authorizationMiddleware` yang:

- membaca `Authorization`;
- verifikasi JWT via `JwtUtils.veryfy(token)`;
- menyimpan author ke `Context` static global.

Risk:

- Tidak ada permission enforcement per endpoint.
- Tidak ada cek token aktif di Redis/session store.
- `Context` static global berisiko tercampur antar request paralel.
- `ReportService` melempar `new Error("start_date and end_date perlu diisi")`, sehingga query tanggal kosong menjadi 500, bukan 400.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:355`
- `frontend-service/src/stores/datamaster/permission.ts` berisi struktur IGD yang setara.

Definisi permission IGD:

| Submodule/feature | Allows |
|---|---|
| IGD | `READ`, `BATAL IGD` |
| BPJS-PCARE > Monitoring Kunjungan | `READ`, `CETAK BPJS` |
| BPJS-PCARE > Monitoring Riwayat Kunjungan | `READ`, `CETAK BPJS` |
| BPJS-PCARE > Monitoring Obat Kunjungan | `READ`, `CETAK BPJS` |
| Laporan IGD > Kunjungan | `READ`, `CETAK LAPORAN` |
| Laporan IGD > Pembatalan Berobat | `READ`, `CETAK LAPORAN` |
| Laporan IGD > Rekap Tindakan Pasien | `READ`, `CETAK LAPORAN` |
| Detail Pasien | Banyak action klinis, termasuk Rekam Medis, Asesmen IGD/Triase, SOAP Dokter, Inform Consent, Alkes dan Penunjang, Perpindahan, FPO, Unggah Berkas, Resume, dan Cetak Hasil/Surat. |

Data role lokal:

| Scope | Role | IGD |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Mismatches:

- Permission submodule `IGD`, sidebar menulis `Pasien IGD`.
- Permission `BPJS-PCARE`, sidebar menulis `BPJS`.
- Permission laporan punya `Pembatalan Berobat`, UI route memakai `Pembatalan Dirawat`.
- Permission `Detail Pasien` ada di module IGD, tetapi RME dibuka lewat komponen MedicalRecord lintas menu.
- Ada typo `Resume Dan Dishcarge` dan `DISHCARGE`.

## Tenant/Faskes

Pola tenant:

- `admisi-service` memakai `faskesUuid` dari JWT Context untuk list/detail/batal IGD.
- `igd-service` memakai `faskesUuid` dari JWT Context untuk laporan.
- Query utama IGD dan laporan sudah memasukkan `faskesUuid`.
- Pemilihan tenant tetap berasal dari token yang diperbarui lewat header global.

Data lokal:

| Data | Klinik Contoh | Klinik Sehat | Faskes tidak dikenal |
|---|---:|---:|---:|
| `instalasi_gawat_darurats` aktif status 1 | 2 | 1 | 0 |
| `instalasi_gawat_darurats` aktif status 2 | 15 | 0 | 0 |
| `instalasi_gawat_darurats` deleted/status 0 | 17 | 0 | 0 |
| `instalasi_gawat_darurats` deleted/status 1 | 2 | 0 | 0 |
| `instalasi_gawat_darurats` deleted/status 2 | 1 | 0 | 0 |
| `history_tindakan` pelayanan IGD | 16 | 0 | 0 |

Tidak ditemukan faskes UUID tidak dikenal pada tabel IGD yang dicek.

## Temuan Defect/Risk

1. Endpoint laporan IGD frontend dan backend tidak selaras.

   Frontend memanggil `/api/v3/igd/report/kunjungan`, sementara backend saat default source menyediakan `/api/v3/pelayanan/igd/report/kunjungan`. Jika `API_MODULE=igd` diset pun backend menjadi `/api/v3/igd/igd/report/kunjungan`.

2. `IGDView` bisa redirect ke Rawat Jalan.

   Saat ada `route.query.filter`, `IGDView.vue` melakukan `router.replace({ path: "/rawat-jalan/poli" })`. Ini jelas copy-paste bug dan bisa membuat user keluar dari menu IGD.

3. BPJS IGD masih dummy/static.

   Monitoring Kunjungan, Riwayat Kunjungan, dan Obat Kunjungan belum mengambil data API. Footer pagination juga masih `FIXME`.

4. Rekap tindakan pasien IGD memakai store Rawat Jalan.

   `LaporanPage.vue` dan `exportexceligd.ts` memakai `useRekapTindakanStore` dari Rawat Jalan. Sementara route rekap tindakan di `igd-service` masih dikomentari.

5. Permission belum ditegakkan di frontend route/sidebar maupun backend.

   Role KASIR tidak punya IGD, tetapi backend hanya validasi token. Belum ada guard action untuk `BATAL IGD`, report, cetak, atau detail pasien.

6. Context backend static global.

   Sama seperti service lain, `Context` disimpan pada static object. Ini berisiko pada request paralel.

7. Error laporan tanpa tanggal menjadi 500.

   `igd-service` memakai `throw new Error(...)` untuk query wajib `start_date`/`end_date`; semestinya menjadi 400.

8. Sisa stub dan debug masih ada.

   `admisi/igd.ts` punya dummy return unreachable setelah API call. Beberapa file export/logging masih memakai `console.log`/`console.error`.

9. Label status dan route perlu dibakukan.

   UI tab memakai `selectedTab` 2/1/0 untuk semua/pelayanan/discharge, backend memakai `statusIgd` 1/2 dan filter mengubah 2 menjadi `[1,2]`. Ini perlu dibuat eksplisit dalam kontrak revamp.

## Rekomendasi Revamp

1. Pilih canonical endpoint IGD.

   Rekomendasi paling konsisten dengan frontend: mount backend ke `/api/v3/igd` dan ubah route internal menjadi `/report/kunjungan` dan `/report/batal-kunjungan`. Jangan gabungkan `API_MODULE=igd` dengan route `/igd/report`.

2. Hapus redirect salah di `IGDView`.

   Jika IGD membutuhkan filter query sendiri, arahkan tetap ke `/igd/pasien-igd`, bukan `/rawat-jalan/poli`.

3. Normalisasi permission code.

   Usulan kode stabil:

   - `IGD.PASIEN.READ`
   - `IGD.PASIEN.CANCEL`
   - `IGD.BPJS.MONITORING_VISIT.READ`
   - `IGD.BPJS.MONITORING_HISTORY.READ`
   - `IGD.BPJS.MONITORING_MEDICINE.READ`
   - `IGD.REPORT.VISIT.READ`
   - `IGD.REPORT.CANCEL.READ`
   - `IGD.REPORT.ACTION_RECAP.READ`
   - `IGD.RME.*`

4. Tambahkan `meta.permission` pada route dan filter sidebar dari permission efektif user.

5. Tambahkan middleware permission backend.

   Mapping awal:

   - `DELETE /admisi/igd/cancel` -> `IGD.PASIEN.CANCEL`
   - `GET /igd/report/kunjungan` -> `IGD.REPORT.VISIT.READ`
   - `GET /igd/report/batal-kunjungan` -> `IGD.REPORT.CANCEL.READ`
   - rekap tindakan -> `IGD.REPORT.ACTION_RECAP.READ`

6. Putuskan ownership rekap tindakan.

   Kalau rekap tindakan memang global lintas pelayanan, pindahkan ke `laporan-service` atau `rekam-medis-service`. Kalau tetap per module, aktifkan route di `igd-service` dan buat store IGD sendiri.

7. Implementasi BPJS IGD perlu diputuskan.

   Jika belum ada bridging BPJS, ubah menjadi empty state berbasis API dan sembunyikan fitur cetak. Jika sudah ada, buat store/API yang jelas.

## Pertanyaan Terbuka

1. Endpoint resmi IGD yang diinginkan: `/api/v3/igd/report/...` atau `/api/v3/pelayanan/igd/report/...`?
2. Apakah rekap tindakan IGD harus tinggal di IGD service, Rawat Jalan service dengan filter `pelayanan=igd`, atau service laporan global?
3. Apakah `Detail Pasien` IGD harus diproteksi oleh permission IGD, permission Rekam Medis global, atau kombinasi keduanya?
4. Apakah label UI `Pembatalan Dirawat` ingin disamakan dengan permission `Pembatalan Berobat`?
