# Audit Menu Farmasi

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Farmasi berada setelah Pembayaran pada router utama. Frontend utama berada di `frontend-service/src/views/Farmasi`, store berada di `frontend-service/src/stores/farmasi`, `frontend-service/src/stores/datamasterFarmasi`, dan `frontend-service/src/stores/laporanFarmasi`. Backend utama adalah `farmasi-service` pada port lokal `8084`; ada juga `stok-farmasi-service`, tetapi menu Farmasi yang diaudit di sini memakai base `VITE_BASE_FARMASI`.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Resep Dokter | `/farmasi/resep-dokter` | Order resep, telaah, verifikasi, penyiapan, penyerahan, batal, cetak. |
| Penjualan Obat | `/farmasi/penjualan-obat` | Transaksi obat OTC/APS. |
| Retur Obat & Material | `/farmasi/retur-obat-&-material` | Retur obat dan alkes/material. |
| Farmasi Ruangan | `/farmasi/farmasi-ruangan` | Order alkes/farmasi ruangan dari pelayanan/RME. |
| Riwayat Transaksi | `/farmasi/riwayat-transaksi` | Riwayat resep, penjualan, dan alkes. |
| Datamaster | `/farmasi/datamaster/*` | Aturan pakai, satuan, bentuk sediaan, kategori obat, manufaktur, jenis stok, lokasi stok, item medis, cara pakai, komposisi, konfigurasi harga. |
| Laporan | `/farmasi/laporan/*` | Pendapatan, waktu tunggu, rekap pendapatan resep per apotik. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Farmasi dimulai di sekitar `frontend-service/src/router/index.ts:1002`.

| Route | Component/page | Catatan |
|---|---|---|
| `/farmasi` | redirect | Redirect ke `/farmasi/resep-dokter`. |
| `/farmasi/resep-dokter` | `PharmacyView` + `DoctorPrescriptionPage` | `requiresAuth: true`. |
| `/farmasi/penjualan-obat` | `PharmacyView` + `DrugSalesPage` | `requiresAuth: true`. |
| `/farmasi/retur-obat-&-material` | `PharmacyView` + `DrugReturnsPage` | `requiresAuth: true`. |
| `/farmasi/farmasi-ruangan` | `PharmacyView` + `RoomPharmacyPage` | Route name `farmasi-retur-ruangan`, mismatch dengan path/UI. |
| `/farmasi/riwayat-transaksi` | `PharmacyView` + `TransactionHistoryPage` | `requiresAuth: true`. |
| `/farmasi/datamaster/aturan-pakai` | `RulesOfUsePage` | `requiresAuth: true`. |
| `/farmasi/datamaster/satuan` | `UnitPage` | `requiresAuth: true`. |
| `/farmasi/datamaster/bentuk-sediaan` | `DosageFormPage` | `requiresAuth: true`. |
| `/farmasi/datamaster/kategori-obat` | `DrugCategoryPage` | `requiresAuth: true`. |
| `/farmasi/datamaster/manufaktur` | `ManufacturingPage` | UI memakai `manufaktur`, backend/store memakai `manufacture`. |
| `/farmasi/datamaster/jenis-stok` | `StockTypePage` | `requiresAuth: true`. |
| `/farmasi/datamaster/lokasi-stok` | `StockLocationPage` | `requiresAuth: true`. |
| `/farmasi/datamaster/item-medis` | `MedicalItemPage` | `requiresAuth: true`. |
| `/farmasi/datamaster/cara-pakai` | `HowToUsePage` | `requiresAuth: true`. |
| `/farmasi/datamaster/komposisi` | `CompositionPage` | UI memakai `komposisi`, backend/store memakai `ingredient`. |
| `/farmasi/datamaster/konfigurasi-harga` | `PriceConfigurationPage` | Backend memakai `konfig-harga`. |
| `/farmasi/laporan/pendapatan` | `RevenuePage` | `requiresAuth: true`. |
| `/farmasi/laporan/waktu-tunggu` | `WaitingTimePage` | `requiresAuth: true`. |
| `/farmasi/laporan/rekap-pendapatan-dokter-resep-per-apotik` | `RevenueRecapPage` | Nama route lebih panjang dari label permission/UI. |

Guard global hanya memeriksa `access_token`; belum ada permission route-level.

### Sidebar

Source: `frontend-service/src/views/Farmasi/PharmacyView.vue`.

Sidebar dibuat statis:

- Resep Dokter
- Penjualan Obat
- Retur Obat & Material
- Farmasi Ruangan
- Riwayat Transaksi
- Datamaster
- Laporan

Temuan sidebar:

- Sidebar belum difilter berdasarkan permission submodule/feature.
- `showStockBtn` aktif di sidebar Farmasi, sehingga ada coupling UI ke stock flow.
- Route name `farmasi-retur-ruangan` tidak sesuai dengan label `Farmasi Ruangan`.
- Label laporan di sidebar adalah `Rekap Pendapatan Resep Per Apotik`, sedangkan permission master memakai `Rekap Pendapatan Per Apotik`.

### Store/API Frontend

Base URL lokal:

```txt
VITE_BASE_FARMASI=http://localhost:8084/api/v3/farmasi
```

`baseInstanceFarmasi` di `frontend-service/src/utils/Api.ts` memakai base URL tersebut. `apiFarmasiGet/Post/Put/Delete/Patch` di `frontend-service/src/utils/apiHandler.ts` memanggil `cekHost`, tetapi pada localhost fungsi itu mengembalikan `nextUrl` apa adanya.

Masalah utama: hampir semua store Farmasi tetap mengirim URL yang diawali `/farmasi/...`. Di axios, ini digabung dengan base `/api/v3/farmasi`, sehingga request lokal berpotensi menjadi:

```txt
http://localhost:8084/api/v3/farmasi/farmasi/...
```

Backend Farmasi hanya mendaftarkan route:

```txt
/api/v3/farmasi/...
```

Ini adalah kandidat defect 404 terbesar untuk menu Farmasi.

Contoh store terdampak:

| Store | Contoh endpoint frontend | Endpoint backend yang ada | Catatan |
|---|---|---|---|
| `farmasi/DoctorPrescription.ts` | `/farmasi/prescriptions/all` | `/api/v3/farmasi/prescriptions/all` | Prefix `/farmasi` berulang saat memakai base lokal. |
| `farmasi/DrugSales.ts` | `/farmasi/penjualan-obat` | `/api/v3/farmasi/penjualan-obat` | Sama. |
| `farmasi/DrugRetur.ts` | `/farmasi/retur/all` | `/api/v3/farmasi/retur/all` | Sama. |
| `farmasi/RoomPharmacy.ts` | `/farmasi/alkes/all` | `/api/v3/farmasi/alkes/all` | Sama. |
| `farmasi/TransactionHistory.ts` | `/farmasi/riwayat/all` | `/api/v3/farmasi/riwayat/all` | Sama. |
| `datamasterFarmasi/*` | `/farmasi/datamaster/*` | `/api/v3/farmasi/datamaster/*` | Semua datamaster Farmasi ikut terdampak. |
| `laporanFarmasi/*` | `/farmasi/rekap/*` | `/api/v3/farmasi/rekap/*` | Semua laporan Farmasi ikut terdampak. |
| `rekamMedis/rekamMedis.ts` | `/farmasi/prescriptions/fpo` | `/api/v3/farmasi/prescriptions/fpo` | RME juga terdampak saat mengambil FPO. |

Catatan: `normalizeDatamasterUrl` hanya ada untuk Datamaster global, belum ada normalizer setara untuk Farmasi.

## Backend/API

### Mounting

Source:

- `farmasi-service/src/app.js`
- `farmasi-service/src/routes/routes.js`
- `farmasi-service/.env`

`.env` lokal:

```txt
APPLICATION_PORT=8084
APPLICATION_MODULE=farmasi
API_BASE=api
API_VERSION=v3
```

`farmasi-service/src/routes/routes.js` membuat base route:

```txt
/api/v3/farmasi
```

`app.js` memakai `authorizationSdk([], authConfig)`, lalu `app.use(routes)`. Tidak terlihat permission per endpoint; SDK menerima array kosong.

### Route Backend Farmasi

Endpoint backend utama:

| Area | Endpoint backend |
|---|---|
| Health | `GET /api/v3/farmasi/health` |
| Datamaster | `/datamaster/satuan`, `/bentuk-sediaan`, `/kategori-obat`, `/manufacture`, `/cara-pakai`, `/jenis-stok`, `/lokasi-stok`, `/aturan-pakai`, `/ingredient`, `/bentuk-racikan`, `/item-medis`, `/konfig-harga`, `/harga-item` |
| Resep | `/prescriptions/first-order`, `/add-obat`, `/some-order`, `/all`, `/fpo`, `/:uuid`, `/obat/:uuid`, status telaah/verifikasi/siap/diserahkan/batal, `/cetak/*` |
| Penjualan obat | `/penjualan-obat`, `/penjualan-obat/:uuid/cancel`, `/penjualan-obat/code`, `/penjualan-obat/:uuid` |
| Farmasi ruangan/alkes | `/alkes`, `/alkes/all`, `/alkes/update-verifikasi`, `/alkes/siap-diserahkan`, `/alkes/diserahkan`, `/alkes/batal-siap-diserahkan`, `/alkes/:uuid/items`, `/alkes/items/:uuid` |
| Retur | `/retur`, `/retur/detail`, `/retur/all` |
| Riwayat | `/riwayat/all`, `/riwayat/detail` |
| Laporan | `/rekap/pendapatan`, `/rekap/tat`, `/rekap/pendapatan-apotik` |

Temuan backend:

- Custom `farmasi-service/src/middlewares/authorization-middleware.js` ada, tetapi app memakai `authorizationSdk`; custom middleware tidak terlihat dipakai.
- Tidak ada permission enforcement per endpoint.
- Prefix backend sudah benar di `/api/v3/farmasi`; masalah 404 lokal lebih mungkin berasal dari frontend yang mengirim `/farmasi/...` di atas base Farmasi.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:472`
- `frontend-service/src/stores/datamaster/permission.ts`

Definisi permission Farmasi:

| Submodule/feature | Allows |
|---|---|
| Panggil Antrian | `PANGGIL`, `LEWATI`, `VERIFIKASI`, `PENYERAHAN OBAT` |
| Resep Dokter | Banyak action status resep, update obat, telaah, verifikasi, cetak, batal, penyerahan. |
| Penjualan Obat | `READ`, `CREATE BELI OBAT`, `CREATE ITEM`, `CREATE ITEM OBAT`, `CREATE ITEM MULTIPLE`, `BATAL PEMBELIAN` |
| Retur Obat dan Material | `READ`, `RETUR` |
| Farmasi Ruangan | Action order masuk, pindah lokasi, cetak, verifikasi, penyiapan, penyerahan. |
| Riwayat Transaksi | `READ`, `CETAK` |
| Datamaster | Satuan, Bentuk Sediaan, Kategori Obat, Manufaktur, Jenis Stok, Lokasi Stok, Item Medis, Aturan Pakai, Komposisi, Konfigurasi Harga. |
| Laporan | Pendapatan, Waktu Tunggu, Rekap Pendapatan Per Apotik. |

Mismatches:

- Permission laporan Farmasi disimpan dalam submodule kedua bernama `Riwayat Transaksi`, bukan `Laporan`.
- Permission `Panggil Antrian` tidak muncul di sidebar Farmasi.
- Ada typo allow `MENUGGU PEMBAYARAN CETAK`.
- UI `Rekap Pendapatan Resep Per Apotik`, permission `Rekap Pendapatan Per Apotik`, route `rekap-pendapatan-dokter-resep-per-apotik`.

Data role lokal:

| Scope | Role | Farmasi |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Karena sidebar tidak difilter permission, role tanpa module Farmasi perlu dicek apakah menu masih tampil dari header/top nav. Jika tampil, backend tetap hanya menolak di auth/token level, bukan permission module.

## Tenant/Faskes

Data lokal:

| Entitas | Count |
|---|---:|
| Faskes aktif | 2 |
| Role aktif | 4 |
| User aktif | 21 |

Distribusi data Farmasi lokal:

| Table | Klinik Contoh | Klinik Sehat | Orphan/unknown |
|---|---:|---:|---:|
| `prescriptions` | 48 | 0 | 10 orphan faskes |
| `penjualan_obat` | 8 | 0 | 0 |
| `order_alkes` | 28 | 0 | 8 orphan faskes |
| `retur` | 0 | 0 | 0 |
| `item_medis` | 3 | 0 | 0 |
| `satuan` | 13 | 1 | 0 |
| `lokasi_stok` | 9 | 5 | 0 |

Catatan tenant:

- Ada `prescriptions` dan `order_alkes` dengan `faskes_uuid` yang tidak cocok ke tabel `faskes` aktif. Ini berisiko membuat data tidak muncul di filter tenant normal atau muncul sebagai data orphan.
- Beberapa master Farmasi bersifat multi-tenant, tetapi `ingredients` tidak memiliki `faskes_uuid`.
- Seed role `Klinik Sehat` punya permission Farmasi, tetapi data transaksi Farmasi lokal hampir semua berada di `Klinik Contoh`.

## Defect Prioritas

| Prioritas | Defect | Dampak |
|---|---|---|
| P0 | Prefix API Farmasi dobel: base `/api/v3/farmasi` + store `/farmasi/...`. | Banyak halaman Farmasi berpotensi 404 di local. |
| P1 | Sidebar tidak permission-aware. | Role tanpa akses bisa melihat menu/aksi sebelum backend menolak. |
| P1 | Tidak ada permission enforcement endpoint Farmasi. | Token valid bisa mengakses endpoint lintas action jika tidak dicek di service/controller. |
| P1 | Data orphan faskes pada `prescriptions` dan `order_alkes`. | Risiko data hilang dari tenant atau bocor ke query tanpa join benar. |
| P2 | Submodule laporan Farmasi di permission bernama `Riwayat Transaksi`. | Mapping permission UI menjadi ambigu. |
| P2 | Route name `farmasi-retur-ruangan` untuk path `farmasi-ruangan`. | Menyulitkan guard/telemetry/breadcrumb. |
| P2 | Naming UI/permission/API berbeda untuk `manufaktur/manufacture`, `komposisi/ingredient`, `konfigurasi-harga/konfig-harga`. | Mudah memicu salah mapping saat revamp. |

## Rekomendasi Bertahap

1. Samakan pola URL Farmasi: store sebaiknya memanggil endpoint relatif tanpa prefix `/farmasi`, atau tambahkan normalizer Farmasi di `apiHandler`.
2. Setelah URL jalan, smoke test halaman: Resep Dokter, Penjualan Obat, Farmasi Ruangan, Retur, Riwayat, dan tiga laporan.
3. Rapikan permission: ganti submodule laporan dari `Riwayat Transaksi` ke `Laporan`, normalisasi typo `MENUGGU`, dan mapping label UI.
4. Audit query tenant di Farmasi service, terutama transaksi yang orphan faskes.
5. Baru setelah itu revamp UI/action-level permission.
