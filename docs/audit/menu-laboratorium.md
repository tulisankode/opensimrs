# Audit Menu Laboratorium

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Laboratorium berada setelah Antrian pada router utama. Frontend utama berada di `frontend-service/src/views/Laboratorium`, store berada di `frontend-service/src/stores/Laboratorium`, `frontend-service/src/stores/datamasterLaboratorium`, dan `frontend-service/src/stores/laporanLaboratorium`. Backend utama adalah `lab-service` pada port lokal `8087`.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Order Lab | `/laboratorium/order-lab` | Input order lab, validasi order, cetak label/pengantar. |
| Hasil Pemeriksaan | `/laboratorium/hasil-pemeriksaan` | Input hasil, selesai pemeriksaan, cetak hasil. |
| Expertise | `/laboratorium/expertise` | Input/cancel expertise hasil lab. |
| Datamaster | `/laboratorium/datamaster/*` | Kategori, kelompok, item pemeriksaan, spesimen, tarif lab. |
| Laporan | `/laboratorium/laporan/*` | Kunjungan, waktu tunggu/TAT, rekap jumlah pemeriksaan. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Laboratorium dimulai di sekitar `frontend-service/src/router/index.ts:809`.

| Route | Component/page | Catatan |
|---|---|---|
| `/laboratorium` | redirect | Redirect ke `/laboratorium/order-lab`. |
| `/laboratorium/order-lab` | `LaboratoriumView` + `OrderPage` | `requiresAuth: true`. |
| `/laboratorium/hasil-pemeriksaan` | `LaboratoriumView` + `HasilPemeriksaanPage` | `requiresAuth: true`. |
| `/laboratorium/expertise` | `LaboratoriumView` + `ExpertisePage` | `requiresAuth: true`. |
| `/laboratorium/datamaster/kategori-pemeriksaan` | `KategoriPemeriksaanPage` | `requiresAuth: true`. |
| `/laboratorium/datamaster/kelompok-pemeriksaan` | `KelompokPemeriksaanPage` | `requiresAuth: true`. |
| `/laboratorium/datamaster/item-pemeriksaan` | `ItemPemeriksaanLabPage` | `requiresAuth: true`. |
| `/laboratorium/datamaster/spesimen` | `SpesimenPage` | `requiresAuth: true`. |
| `/laboratorium/datamaster/tarif-lab` | `TarifLabPage` | `requiresAuth: true`. |
| `/laboratorium/laporan/kunjungan` | `KunjunganLabPage` | `requiresAuth: true`. |
| `/laboratorium/laporan/waktu-tunggu` | `WaktuTungguLabPage` | `requiresAuth: true`. |
| `/laboratorium/laporan/rekap-jumlah` | `RekapJumlahPemeriksaanLabPage` | `requiresAuth: true`. |

Guard global hanya memeriksa `access_token`; belum ada permission route-level.

### Sidebar

Source: `frontend-service/src/views/Laboratorium/LaboratoriumView.vue`.

Sidebar dibuat statis:

- Order Lab
- Hasil Pemeriksaan
- Expertise
- Datamaster
- Laporan

Temuan sidebar:

- Sidebar belum difilter berdasarkan permission submodule/feature.
- Icon memakai string lower-case seperti `flask-fill`, `database-fill`, `file-text-fill`. Sidebar lain banyak memakai nama komponen icon seperti `FileReportIcon`/`DatabaseFill`. Perlu dicek apakah komponen Sidebar mendukung dua format ini.
- `showStockBtn` aktif di sidebar Laboratorium; perlu dikonfirmasi apakah memang dibutuhkan di menu Lab.

### Store/API Frontend

Base URL lokal:

```txt
VITE_BASE_LABORATORIUM=http://localhost:8087/api/v3/lab
```

`baseInstanceLaboratorium` di `frontend-service/src/utils/Api.ts` memakai base URL tersebut. `apiLaboratoriumGet/Post/Put/Delete` di `frontend-service/src/utils/apiHandler.ts` memanggil `cekHost`, tetapi pada localhost fungsi itu mengembalikan `nextUrl` apa adanya.

Masalah utama: hampir semua store Laboratorium tetap mengirim URL yang diawali `/lab/...`. Di axios, ini digabung dengan base `/api/v3/lab`, sehingga request lokal berpotensi menjadi:

```txt
http://localhost:8087/api/v3/lab/lab/...
```

Backend Lab hanya mendaftarkan route:

```txt
/api/v3/lab/...
```

Ini adalah kandidat defect 404 terbesar untuk menu Laboratorium.

Contoh store terdampak:

| Store | Contoh endpoint frontend | Endpoint backend yang ada | Catatan |
|---|---|---|---|
| `Laboratorium/orderLab.ts` | `/lab/order-lab` | `/api/v3/lab/order-lab` | Prefix `/lab` berulang saat memakai base lokal. |
| `Laboratorium/hasilPemeriksaan.ts` | `/lab/hasil-pemeriksaan` | `/api/v3/lab/hasil-pemeriksaan` | Sama. |
| `Laboratorium/expertise.ts` | `/lab/expertise/:uuid` | `/api/v3/lab/expertise/:uuid` | Sama. |
| `datamasterLaboratorium/kategoriPemeriksaan.ts` | `/lab/category-pemeriksaan` | `/api/v3/lab/category-pemeriksaan` | Sama. |
| `datamasterLaboratorium/itemPemeriksaanLab.ts` | `/lab/item-pemeriksaan` | `/api/v3/lab/item-pemeriksaan` | Sama. |
| `datamasterLaboratorium/spesimenLab.ts` | `/lab/spesimen` | `/api/v3/lab/spesimen` | Sama. |
| `datamasterLaboratorium/tarifPemeriksaan.ts` | `/lab/tarif-lab` | `/api/v3/lab/tarif-lab` | Sama. |
| `laporanLaboratorium/*` | `/lab/laporan-*`, `/lab/rekap-*` | `/api/v3/lab/laporan-*`, `/api/v3/lab/rekap-*` | Semua laporan ikut terdampak. |

Temuan tambahan store:

- Beberapa export/import Lab masih mengarah ke endpoint Farmasi, misalnya `orderLab.ts`, `hasilPemeriksaan.ts`, `expertise.ts`, `itemPemeriksaanLab.ts`, dan `tarifPemeriksaan.ts` memakai `/farmasi/datamaster/kategori-obat/export` atau import kategori obat. Ini kemungkinan copy-paste lama dan akan salah fungsi.
- Tidak ada normalizer Lab seperti `normalizeDatamasterUrl`.

## Backend/API

### Mounting

Source:

- `lab-service/src/app.js`
- `lab-service/src/routes/routes.js`
- `lab-service/.env`

`.env` lokal:

```txt
APPLICATION_PORT=8087
APPLICATION_MODULE=lab
API_BASE=api
API_VERSION=v3
```

`lab-service/src/routes/routes.js` membuat base route:

```txt
/api/v3/lab
```

`app.js` memakai `authorizationSdk([])`, lalu `app.use(routes)`. Tidak terlihat permission per endpoint; SDK menerima array kosong.

### Route Backend Lab

Endpoint backend utama:

| Area | Endpoint backend |
|---|---|
| Datamaster kategori | `POST/GET/PUT/DELETE /api/v3/lab/category-pemeriksaan` |
| Datamaster item | `POST/GET/PUT/DELETE /api/v3/lab/item-pemeriksaan` |
| Nilai rujukan | `/api/v3/lab/nilai-rujukan/*` |
| Spesimen | `POST/GET/PUT/DELETE /api/v3/lab/spesimen` |
| Kelompok pemeriksaan | `POST/GET/PUT/DELETE /api/v3/lab/kelompok-pemeriksaan` |
| Tarif lab | `POST/GET/PUT/DELETE /api/v3/lab/tarif-lab` |
| Order lab | `POST/GET/PUT/DELETE /api/v3/lab/order-lab`, `PUT /order-lab-batal`, `PUT /order-lab-validasi/:uuid`, `PUT /order-lab-batal-validasi`, `PUT /order-lab-selesai-periksa/:uuid` |
| Hasil pemeriksaan | `POST /api/v3/lab/hasil-pemeriksaan`, `GET /hasil-pemeriksaan/:uuid` |
| Expertise | `POST /api/v3/lab/expertise/:uuid`, `PUT /batal-expertise/:uuid` |
| Laporan | `GET /laporan-kunjungan`, `GET /laporan-tat`, `GET /rekap-pemeriksaan-per-tanggal`, `GET /rekap-pemeriksaan` |

Temuan backend:

- `lab-service/src/routes/routes.js` mengimpor `authorizationSdk` tetapi tidak memakainya di file route.
- Custom `lab-service/src/middlewares/auth-middleware.js` ada, tetapi app memakai `authorizationSdk`; custom middleware tidak terlihat dipakai.
- Tidak ada permission enforcement per endpoint.
- Ada typo nama file controller `keloompok-pemeriksaan-controller.js`.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:608`
- `frontend-service/src/stores/datamaster/permission.ts`

Definisi permission Laboratorium:

| Submodule/feature | Allows |
|---|---|
| Order Lab | `READ`, `CREATE`, update profile/order, batal, rekam medis, cetak label/pengantar, validasi, riwayat pemeriksaan RM. |
| Hasil Pemeriksaan | `READ`, detail RM, riwayat, cetak label/hasil, simpan hasil, selesai. |
| Expertise | `READ`, detail RM, riwayat, cetak hasil, simpan expertise. |
| Datamaster | Kategori Pemeriksaan, Kelompok Pemeriksaan, Item Pemeriksaan + nilai rujukan, Spesimen, Tarif Lab. |
| Laporan | Kunjungan, Waktu Tunggu TAT, Rekap Jumlah Pemeriksaan. |

Mismatches:

- Export name di permission helper adalah `laboraturiumPermission`, typo dari `laboratoriumPermission`. Ini juga dipakai di aggregator, jadi runtime masih bisa jalan, tetapi membingungkan saat refactor.
- UI route/sidebar memakai `Waktu Tunggu (TAT)`, permission memakai `Waktu Tunggu TAT`; masih semakna tetapi perlu mapping eksplisit.
- Store export/import Lab masih copy-paste ke endpoint Farmasi.

Data role lokal:

| Scope | Role | Laboratorium |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Karena sidebar tidak difilter permission, role tanpa module Laboratorium perlu dicek apakah menu masih tampil dari header/top nav.

## Tenant/Faskes

Data lokal:

| Entitas | Count |
|---|---:|
| Faskes aktif | 2 |
| Role aktif | 4 |
| User aktif | 21 |

Distribusi data Lab lokal:

| Table | Klinik Contoh | Klinik Sehat | Orphan/unknown |
|---|---:|---:|---:|
| `order_lab` | 25 | 2 | 0 |
| `order_lab_pemeriksaan` | 36 | 2 | 0 |
| `item_pemeriksaan` | 18 | 6 | 0 |
| `tarif_lab` | 34 | 3 | 0 |
| `category_pemeriksaan` | 17 | 4 | 0 |
| `kelompok_pemeriksaan` | 16 | 2 | 0 |
| `spesimen` | 34 | 6 | 0 |

Catatan tenant:

- Data transaksi Lab sudah tersebar ke `Klinik Contoh` dan `Klinik Sehat`.
- Tidak ditemukan orphan faskes pada `order_lab`.
- Perlu cek query report apakah selalu filter `faskes_uuid` dari token, karena role `Admin` Klinik Sehat memiliki permission Lab dan data Lab Klinik Sehat memang ada.

## Defect Prioritas

| Prioritas | Defect | Dampak |
|---|---|---|
| P0 | Prefix API Lab dobel: base `/api/v3/lab` + store `/lab/...`. | Banyak halaman Lab berpotensi 404 di local. |
| P1 | Export/import beberapa store Lab mengarah ke endpoint Farmasi. | Tombol export/import salah data atau 404. |
| P1 | Sidebar tidak permission-aware. | Role tanpa akses bisa melihat menu/aksi. |
| P1 | Tidak ada permission enforcement endpoint Lab. | Token valid bisa mengakses endpoint lintas action jika tidak dicek di service/controller. |
| P2 | Typo `laboraturiumPermission`. | Mengganggu refactor dan mapping permission. |
| P2 | Icon sidebar lower-case perlu dikonfirmasi kompatibilitasnya. | Risiko icon tidak muncul/inkonsisten. |

## Rekomendasi Bertahap

1. Samakan pola URL Lab: store sebaiknya memanggil endpoint relatif tanpa prefix `/lab`, atau tambahkan normalizer Lab di `apiHandler`.
2. Perbaiki endpoint export/import Lab yang masih mengarah ke Farmasi.
3. Smoke test `Order Lab`, `Hasil Pemeriksaan`, `Expertise`, semua datamaster, dan semua laporan.
4. Rapikan permission name/export typo dan mapping label laporan.
5. Tambahkan guard action-level setelah flow lokal bisa jalan.
