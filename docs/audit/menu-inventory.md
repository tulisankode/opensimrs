# Audit Menu Inventory

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Inventory berada setelah Pembayaran pada router utama. Frontend utama berada di `frontend-service/src/views/Inventory`, store berada di `frontend-service/src/stores/inventory`, dan backend utama adalah `inventory-service` pada port lokal `8086`.

Catatan penting: repo juga memiliki `frontend-service/src/views/Stok` dan `frontend-service/src/stores/stok`, serta permission module `STOK`. Namun top navigation hanya menampilkan `Inventory`, dan router utama yang terlihat hanya mendaftarkan `/inventory/*`, bukan `/stok/*`. Jadi audit ini fokus ke menu Inventory yang aktif di router.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Pengadaan Barang > Pembelian Barang Supplier | `/inventory/pengadaan-barang/pembelian-barang-supplier` | Buat/list/update/batal PO supplier. |
| Pengadaan Barang > Verifikasi Pembelian Barang Supplier | `/inventory/pengadaan-barang/verifikasi-pembelian-barang-supplier` | Verifikasi pembelian barang. |
| Pengadaan Barang > Retur & Penggantian Barang Supplier | `/inventory/pengadaan-barang/retur-penggantian-barang-supplier` | Retur supplier dan penggantian. |
| Pengeluaran Barang > Verifikasi & Pengiriman Unit | `/inventory/pengeluaran-barang/verifikasi-pengiriman-unit` | Verifikasi/kirim permintaan unit. |
| Pengeluaran Barang > Pengeluaran Unit | `/inventory/pengeluaran-barang/pengeluaran-unit` | Pengeluaran item dari lokasi stok. |
| Penerimaan Barang > Penerimaan Pembelian | `/inventory/penerimaan-barang/penerimaan-pembelian` | Penerimaan pembelian supplier. |
| Penerimaan Barang > Penerimaan Retur Unit | `/inventory/penerimaan-barang/penerimaan-retur-unit` | Penerimaan retur unit. |
| Datamaster > Supplier | `/inventory/datamaster/supplier` | Master supplier. |
| Riwayat Tarif | `/inventory/riwayat-tarif` | Riwayat harga/tarif item. |
| Kartu Stok & Mutasi | `/inventory/kartustok-mutasi` | Kartu stok dan riwayat mutasi. |
| Stok Opname | `/inventory/stok-opname` | Stok opname dan import kartu stok. |
| Stok Adjustment | `/inventory/stok-adjustment` | Adjustment stok. |
| Laporan > Obat Expired | `/inventory/laporan/obat-expired` | Laporan barang expired. |
| Laporan > Persediaan | `/inventory/laporan/persediaan` | Laporan persediaan. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Inventory dimulai di sekitar `frontend-service/src/router/index.ts:1405`.

| Route | Component/page | Catatan |
|---|---|---|
| `/inventory` | redirect | Redirect ke `/inventory/pengadaan-barang/pembelian-barang-supplier`. |
| `/inventory/pengadaan-barang/pembelian-barang-supplier` | `PurchaseOfSupplierPage` | `requiresAuth: true`. |
| `/inventory/pengadaan-barang/verifikasi-pembelian-barang-supplier` | `VerificationOfGoodsPurchasePage` | `requiresAuth: true`. |
| `/inventory/pengadaan-barang/retur-penggantian-barang-supplier` | `SupplierReturnsPage` | `requiresAuth: true`. |
| `/inventory/pengeluaran-barang/verifikasi-pengiriman-unit` | `UnitDeliveryVerificationPage` | `requiresAuth: true`. |
| `/inventory/pengeluaran-barang/pengeluaran-unit` | `UnitOfExpenditurePage` | `requiresAuth: true`. |
| `/inventory/penerimaan-barang/penerimaan-pembelian` | `PurchaseAcceptancePage` | `requiresAuth: true`. |
| `/inventory/penerimaan-barang/penerimaan-retur-unit` | `ReturnReceiptPage` | `requiresAuth: true`. |
| `/inventory/datamaster/supplier` | `SupplierPage` | `requiresAuth: true`. |
| `/inventory/riwayat-tarif` | `RateHistoryPage` | `requiresAuth: true`. |
| `/inventory/kartustok-mutasi` | `StockAndMutationCardsPage` | `requiresAuth: true`. |
| `/inventory/stok-opname` | `StokOpnamePage` | `requiresAuth: true`. |
| `/inventory/stok-adjustment` | `StokAdjustmentPage` | `requiresAuth: true`. |
| `/inventory/laporan/obat-expired` | `ObatExpiredPage` | `requiresAuth: true`. |
| `/inventory/laporan/persediaan` | `PersediaanPage` | `requiresAuth: true`. |

Guard global hanya memeriksa `access_token`; belum ada permission route-level.

### Sidebar

Source: `frontend-service/src/views/Inventory/InventoryView.vue`.

Sidebar dibuat statis dan mengirim `filter` serta `lokasi-stok-uuid` ke page aktif.

Temuan sidebar:

- Sidebar belum difilter berdasarkan permission submodule/feature.
- Sidebar menerima event `update:searchSidebar` untuk mengisi `selectedLokasiStokUuid`, tetapi perlu dipastikan semua halaman yang menerima prop `lokasi-stok-uuid` memang menggunakannya konsisten.
- Label sidebar `Verifikasi & Pengiriman Unit`, permission Inventory memakai `Verifikasi dan Penerimaan Barang Unit`. Ada mismatch istilah yang cukup besar.
- Ada module/halaman `Stok` lama yang tidak terlihat terhubung ke router/top nav saat ini; ini perlu diputuskan apakah deprecated atau akan digabung dengan Inventory.

### Store/API Frontend

Base URL lokal:

```txt
VITE_BASE_INVENTORY=http://localhost:8086/api/v3/inventory
```

`baseInstanceInventory` di `frontend-service/src/utils/Api.ts` memakai base URL tersebut. `apiInventoryGet/Post/Put/Delete` di `frontend-service/src/utils/apiHandler.ts` memanggil `cekHost`, tetapi pada localhost fungsi itu mengembalikan `nextUrl` apa adanya.

Masalah utama: hampir semua store Inventory tetap mengirim URL yang diawali `/inventory/...`. Di axios, ini digabung dengan base `/api/v3/inventory`, sehingga request lokal berpotensi menjadi:

```txt
http://localhost:8086/api/v3/inventory/inventory/...
```

Backend Inventory hanya mendaftarkan route:

```txt
/api/v3/inventory/...
```

Ini kandidat defect 404 terbesar untuk menu Inventory.

Contoh mapping store:

| Store | Endpoint frontend saat ini | Endpoint backend yang ada | Catatan |
|---|---|---|---|
| `purchasingOfSupplier.ts` | `/inventory/pengadaan/pembelian-barang` | `/api/v3/inventory/pengadaan/pembelian-barang` | Prefix `/inventory` berulang di local. |
| `verificationOfGoodsPurchase.ts` | `/inventory/pengadaan/verifikasi-barang/:uuid` | `/api/v3/inventory/pengadaan/verifikasi-barang/:uuid` | Prefix berulang. |
| `supplierReturns.ts` | `/inventory/pengadaan/retur-supplier` | `/api/v3/inventory/pengadaan/retur-supplier` | Prefix berulang. |
| `unitDeliveryVerification.ts` | `/inventory/pengeluaran/pengiriman-unit` | `/api/v3/inventory/pengeluaran/pengiriman-unit` | Prefix berulang. |
| `unitOfExpenditure.ts` | `/inventory/pengeluaran/pengeluaran-unit` | `/api/v3/inventory/pengeluaran/pengeluaran-unit` | Prefix berulang. |
| `purchaseAcceptance.ts` | `/inventory/penerimaan/pembelian/:uuid` | `/api/v3/inventory/penerimaan/pembelian/:uuid` | Prefix berulang. |
| `returnReceipt.ts` | `/inventory/penerimaan/retur-unit` | `/api/v3/inventory/penerimaan/retur-unit` | Prefix berulang. |
| `supplier.ts` | `/inventory/datamaster/supplier` | `/api/v3/inventory/datamaster/supplier` | Prefix berulang. |
| `rateHistory.ts` | `/inventory/riwayat-tarif` | `/api/v3/inventory/riwayat-tarif` | Prefix berulang. |
| `stokOpname.ts` | `/inventory/stok-opname` | `/api/v3/inventory/stok-opname` | Prefix berulang. |
| `stokAdjustment.ts` | `/inventory/stok-adjustment` | `/api/v3/inventory/stok-adjustment` | Prefix berulang. |
| `inventoryReport.ts` | `/inventory/laporan/persediaan` | `/api/v3/inventory/laporan/persediaan` | Prefix berulang. |
| `expiredDrugReport.ts` | `/inventory/laporan/barang-expired` | `/api/v3/inventory/laporan/barang-expired` | Prefix berulang. |

Temuan tambahan store/API:

- `stockAndMutation.ts` memanggil `/inventory/mutasi/riwayat-mutasi`, tetapi backend route yang terlihat adalah `/api/v3/inventory/mutasi/mutasi`.
- `stockAndMutation.ts` memanggil `POST /inventory/mutasi/kartu-stok/cetak` dan `POST /inventory/mutasi/riwayat-mutasi/cetak`, tetapi backend route mutasi yang terlihat tidak memiliki endpoint cetak.
- `stokOpname.ts` memanggil `PUT /inventory/stok-opname/:uuid`, tetapi backend `stok-opname-routes.js` yang terlihat hanya punya `GET /`, `POST /`, `GET /kartu-stok`, `POST /import`, dan `GET /:stok_opname_uuid`. Tidak terlihat `PUT /:uuid`.
- `storageLocation.ts` memanggil `/inventory/datamaster/lokasi-gudang`, backend ada `/api/v3/inventory/datamaster/lokasi-gudang`.

## Backend/API

### Mounting

Source:

- `inventory-service/src/app.js`
- `inventory-service/src/routes/routes.js`
- `inventory-service/.env`

`.env` lokal:

```txt
APPLICATION_HOST=0.0.0.0
APPLICATION_PORT=8086
APPLICATION_MODULE=inventory
API_BASE=api
API_VERSION=v3
INVENTORY_URL=http://localhost:8086/api/v3
```

`inventory-service/src/routes/routes.js` membuat base route:

```txt
/api/v3/inventory
```

`app.js` memakai `authorizationSdk([])`, lalu `app.use(routes)`. Tidak terlihat permission per endpoint; SDK menerima array kosong.

### Route Backend Inventory

Endpoint backend utama:

| Area | Endpoint backend |
|---|---|
| Datamaster Supplier | `/datamaster/supplier`, `/datamaster/supplier/aktif`, `/:uuid`, `/import` |
| Pengadaan | `/pengadaan/pembelian-barang`, `/pembelian-barang/:uuid`, `/pembelian-barang-batal/:uuid`, `/verifikasi-barang/:uuid`, `/retur-supplier`, `/retur-supplier/available-faktur`, `/available-items`, `/supplier-kategori` |
| Penerimaan | `/penerimaan/pembelian/:uuid`, `/penerimaan/retur-unit`, `/penerimaan/retur-unit/:uuid` |
| Pengeluaran | `/pengeluaran/pengiriman-unit`, `/pengiriman-unit/:uuid`, `/pengiriman-unit/batal/:uuid`, `/pengiriman-unit/verifikasi/:uuid`, `/pengiriman-unit/kirim/:uuid`, `/pengeluaran-unit`, `/pengeluaran-unit/available-stock`, `/pengeluaran-unit/:uuid` |
| Mutasi | `/mutasi/kartu-stok`, `/mutasi/mutasi`, `POST /mutasi/mutasi` |
| Stok Adjustment | `/stok-adjustment`, `/stok-adjustment/:uuid` |
| Stok Opname | `/stok-opname`, `/stok-opname/kartu-stok`, `/stok-opname/import`, `/stok-opname/:stok_opname_uuid` |
| Riwayat Tarif | `/riwayat-tarif`, `/riwayat-tarif/:uuid` |
| Stok API | `/stok`, `/stok/reduce`, `/stok/increase` |
| Datamaster lokasi gudang | `/datamaster/lokasi-gudang` |
| Laporan | `/laporan/barang-expired`, `/laporan/persediaan` |

Temuan backend:

- `stok-opname-routes.js` mendaftarkan `POST /import` dua kali dengan handler yang sama dan log debug berbeda. Ini harus dibersihkan.
- `inventory-service/src/configurations/external-apis.js` fallback `FARMASI_API_URL` adalah alamat IP jaringan internal yang tertanam di kode (port 8086), bukan localhost dan portnya sama dengan inventory. `.env` lokal tidak terlihat mendefinisikan `FARMASI_API_URL`, sehingga fallback ini bisa terpanggil.
- Backend memakai `@opensimrs/model-sdk/instance`, bukan sequelize instance lokal di service.
- Banyak controller sudah mengisi `faskes_uuid` dari `req.author.faskesUuid`, tetapi belum ada permission action-level.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:846` untuk `STOK`
- `datamaster-service/src/helpers/permission-list.js:914` untuk `Inventory`
- `frontend-service/src/stores/datamaster/permission.ts`

Definisi permission Inventory:

| Submodule/feature | Allows |
|---|---|
| Pengadaan Barang > Verifikasi Pembelian Barang Supplier | `READ`, create/update/delete item pembelian, cari multiple, simpan, ambil item, batalkan. |
| Verifikasi Pembelian Barang Supplier | `READ`, `VERIFIKASI`. |
| Retur dan Penggantian Supplier | `READ`, create/delete item retur, cari faktur, simpan penggantian/retur. |
| Pengeluaran Barang > Verifikasi dan Penerimaan Barang Unit | `READ`, cetak, tolak, verifikasi, kirim barang. |
| Pengeluaran Barang > Pengeluaran Barang Unit | `READ`, create pengeluaran, create item, cetak, cari multiple. |
| Penerimaan Barang | Penerimaan Pembelian, Penerimaan Retur Unit. |
| Datamaster Supplier | CRUD/import/export. |
| Riwayat Tarif | `READ`. |
| Kartu Stok dan Mutasi | `READ`, `CETAK`. |
| Stok Opname | create, delete item, rekonsil, simpan draft/akhir, download, import, cetak. |
| Stok Adjustment | `READ`, `ADJUST`, `ADJUST ITEM`. |
| Laporan Inventory | Dua feature bernama `Obat Expired`. |

Mismatches:

- UI punya laporan `Persediaan`, tetapi permission `Laporan Inventory` berisi dua feature sama-sama `Obat Expired`; tidak ada `Persediaan`.
- UI `Verifikasi & Pengiriman Unit`, permission Inventory `Verifikasi dan Penerimaan Barang Unit`.
- UI `Pengeluaran Unit`, permission `Pengeluaran Barang Unit`.
- Permission `Pengadaan Barang` hanya memiliki feature `Verifikasi Pembelian Barang Supplier`, padahal UI juga punya `Pembelian Barang Supplier`.
- Ada module permission `STOK` yang overlap dengan Inventory, sementara router/top nav aktif memakai `Inventory`.

Data role lokal:

| Scope | Role | Inventory | STOK |
|---|---|---|---|
| Global/unknown | super admin | Ada | Ada |
| Klinik Contoh | admin | Ada | Ada |
| Klinik Contoh | KASIR | Tidak ada | Tidak ada |
| Klinik Sehat | Admin | Ada | Ada |

Karena sidebar tidak difilter permission, role tanpa module Inventory perlu dicek apakah menu masih tampil dari header/top nav.

## Tenant/Faskes

Data lokal:

| Entitas | Count |
|---|---:|
| Faskes aktif | 2 |
| Role aktif | 4 |
| User aktif | 21 |

Distribusi data Inventory lokal:

| Table | Klinik Contoh | Klinik Sehat | Orphan/unknown |
|---|---:|---:|---:|
| `master_supplier` | 2 | 0 | 0 |
| `pembelian_Barang_supplier` | 15 | 0 | 0 |
| `pembelian_Barang_supplier_item` | 18 | 0 | 0 |
| `pengeluaran_unit` | 43 | 0 | 0 |
| `pengeluaran_unit_item` | 55 | 0 | 0 |
| `retur_supplier` | 2 | 0 | 0 |
| `retur_unit` | 18 | 0 | 0 |
| `stock_medis` | 20 | 0 | 0 |
| `riwayat_mutasi` | 189 | 0 | 0 |
| `stok_opname` | 0 | 0 | 0 |
| `stok_adjustment` | 0 | 0 | 0 |

Catatan tenant:

- Tidak ditemukan orphan faskes pada tabel inventory utama yang dicek.
- Data Inventory lokal hampir seluruhnya hanya ada di `Klinik Contoh`, walaupun `Admin` Klinik Sehat punya permission Inventory/STOK.
- Smoke test tenant Klinik Sehat perlu menggunakan data baru/seed tambahan agar list kosong tidak disalahartikan sebagai bug.

## Defect Prioritas

| Prioritas | Defect | Dampak |
|---|---|---|
| P0 | Prefix API Inventory dobel: base `/api/v3/inventory` + store `/inventory/...`. | Banyak halaman Inventory berpotensi 404 di local. |
| P1 | Store mutasi memakai `/riwayat-mutasi`, backend memakai `/mutasi`; endpoint cetak mutasi tidak terlihat di backend. | Kartu stok/mutasi dan cetak berpotensi 404. |
| P1 | Store Stok Opname memakai `PUT /stok-opname/:uuid`, backend route `PUT` tidak terlihat. | Simpan/update stok opname berpotensi gagal. |
| P1 | Permission `Persediaan` hilang dan `Obat Expired` duplikat. | Mapping permission laporan Inventory salah. |
| P1 | Tidak ada permission enforcement endpoint Inventory. | Token valid bisa mengakses endpoint lintas action jika tidak dicek. |
| P2 | Module `STOK` dan `Inventory` overlap, sedangkan route aktif hanya Inventory. | Membingungkan guard dan revamp menu. |
| P2 | `FARMASI_API_URL` fallback inventory mengarah ke IP lama/port inventory. | Integrasi external Farmasi bisa gagal di local. |
| P2 | `POST /stok-opname/import` terdaftar dua kali. | Noise debug dan potensi perilaku ganda saat maintenance. |

## Rekomendasi Bertahap

1. Samakan pola URL Inventory: store sebaiknya memanggil endpoint relatif tanpa prefix `/inventory`, atau tambahkan normalizer Inventory di `apiHandler`.
2. Cocokkan ulang endpoint mutasi/stok opname/cetak dengan backend route aktual.
3. Rapikan permission laporan: ganti duplikat `Obat Expired` menjadi `Persediaan`.
4. Putuskan status module `STOK`: deprecated, digabung ke Inventory, atau dibuat route/top nav sendiri.
5. Set `FARMASI_API_URL` lokal yang benar bila inventory membutuhkan API Farmasi.
6. Tambahkan seed/test data Inventory untuk Klinik Sehat agar tenant test tidak kosong.
