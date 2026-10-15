# Audit Menu Pembayaran

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Pembayaran berada setelah Laboratorium pada router utama. Frontend utama berada di `frontend-service/src/views/Pembayaran`, store berada di `frontend-service/src/stores/pembayaran`, dan backend utama adalah `payment-service` pada port lokal `8089`.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Kasir | `/pembayaran/kasir` | Cari bill, buka/tutup kasir, bayar, close bill, cetak. |
| Transaksi > Pelayanan | `/pembayaran/transaksi/pelayanan` | Daftar transaksi pelayanan. |
| Transaksi > APS & OTC | `/pembayaran/transaksi/APSOTC` | Daftar transaksi APS/OTC. |
| Closed Bill | `/pembayaran/closed-bill` | Bill yang sudah ditutup dan pelunasan piutang. |
| Laporan > Pendapatan | `/pembayaran/laporan/pendapatan` | Laporan pendapatan. |
| Laporan > Pembayaran Kunjungan | `/pembayaran/laporan/pembayaran` | Laporan pembayaran kunjungan. |
| Laporan > Closing Kasir | `/pembayaran/laporan/closing` | Laporan closing kasir. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Pembayaran dimulai di sekitar `frontend-service/src/router/index.ts:911`.

| Route | Component/page | Catatan |
|---|---|---|
| `/pembayaran` | redirect | Redirect ke `/pembayaran/kasir`. |
| `/pembayaran/kasir` | `PaymentView` + `CashierPage` | `requiresAuth: true`. |
| `/pembayaran/transaksi/pelayanan` | `PaymentView` + `TransactionPage` | `requiresAuth: true`. |
| `/pembayaran/transaksi/APSOTC` | `PaymentView` + `APSOTC` | `requiresAuth: true`. |
| `/pembayaran/closed-bill` | `PaymentView` + `ClosedBillPage` | `requiresAuth: true`. |
| `/pembayaran/closed-bill/:billUuid/pelunasan` | `PaymentView` + `PelunasanPage` | `requiresAuth: true`, `props: true`. |
| `/pembayaran/laporan/pendapatan` | `LaporanPendapatanPage` | `requiresAuth: true`. |
| `/pembayaran/laporan/pembayaran` | `PembayaranKunjunganPage` | `requiresAuth: true`. |
| `/pembayaran/laporan/closing` | `ClosingCashierPage` | `requiresAuth: true`. |

Temuan route:

- Route `/pembayaran/transaksi` pernah ada tetapi sekarang dikomentari.
- Route pelunasan memiliki karakter non-ASCII/non-breaking space di sekitar `props: true` dan penutup objek route. Ini biasanya masih dianggap whitespace oleh JS, tetapi sebaiknya dibersihkan agar tidak memicu masalah tooling/formatter.
- Guard global hanya memeriksa `access_token`; belum ada permission route-level.

### Sidebar

Source: `frontend-service/src/views/Pembayaran/PaymentView.vue`.

Sidebar dibuat statis:

- Kasir
- Transaksi > Pelayanan, APS & OTC
- Closed Bill
- Laporan > Pendapatan, Pembayaran Kunjungan, Closing Kasir

Temuan sidebar:

- Sidebar belum difilter berdasarkan permission submodule/feature.
- Sidebar URL untuk Pelayanan adalah `/pembayaran/transaksi/Pelayanan`, sedangkan route yang terdaftar adalah `/pembayaran/transaksi/pelayanan`. Jika matching route case-sensitive, klik menu Pelayanan bisa jatuh ke fallback.
- `showStockBtn` aktif di sidebar Pembayaran; perlu dikonfirmasi apakah aksi stok memang relevan di menu ini.

### Store/API Frontend

Base URL lokal:

```txt
VITE_BASE_PEMBAYARAN=http://localhost:8089/api/v3/payment
```

`baseInstancePembayaran` di `frontend-service/src/utils/Api.ts` memakai base URL tersebut. `apiPembayaranGet/Post/Put/Delete` di `frontend-service/src/utils/apiHandler.ts` memanggil `cekHost`, tetapi pada localhost fungsi itu mengembalikan `nextUrl` apa adanya.

Masalah utama: banyak store Pembayaran tetap mengirim URL yang diawali `/payment/...`. Di axios, ini digabung dengan base `/api/v3/payment`, sehingga request lokal berpotensi menjadi:

```txt
http://localhost:8089/api/v3/payment/payment/...
```

Backend Payment me-mount router di:

```txt
/api/v3/payment
```

dan route internalnya sebagian besar tidak diawali `/payment`. Ini kandidat defect 404 terbesar untuk menu Pembayaran.

Contoh mapping store:

| Store | Endpoint frontend saat ini | Endpoint backend yang ada | Catatan |
|---|---|---|---|
| `findBill.ts` | `/payment/payment?search=...` | `/api/v3/payment/payment` | Akan menjadi `/api/v3/payment/payment/payment` di local. |
| `findBill.ts` | `/payment/:uuid`, `/payment/:uuid/items` | `/api/v3/payment/:uuid`, `/api/v3/payment/:uuid/items` | Prefix `/payment` tambahan membuat path salah. |
| `findBill.ts` | `/payment/cashier/open`, `/payment/cashier/close` | `/api/v3/payment/cashier/open`, `/api/v3/payment/cashier/close` | Prefix tambahan membuat path salah. |
| `pelayanan.ts` | `/payment/pelayanan` | `/api/v3/payment/pelayanan` | Prefix tambahan membuat path salah. |
| `apsotc.ts` | `/payment/aps-otc` | `/api/v3/payment/aps-otc` | Prefix tambahan membuat path salah. |
| `closeBill.ts` | `/payment/closed-bills` | `/api/v3/payment/closed-bills` | Prefix tambahan membuat path salah. |
| `laporanPendapatan.ts` | `/payment/report/revenue` | `/api/v3/payment/report/revenue` | Prefix tambahan membuat path salah. |
| `pembayaranKunjungan.ts` | `/payment/report/payment` | `/api/v3/payment/report/payment` | Prefix tambahan membuat path salah. |
| `reportClosingCashier.ts` | `/payment/report/cashier` | `/api/v3/payment/report/cashier` | Prefix tambahan membuat path salah. |

Temuan tambahan store:

- Beberapa endpoint export di frontend tidak ada di backend route yang terlihat:
  - `/report/cashier/export`
  - `/payment/report/revenue/export`
  - `/pembayaran/kunjungan/export`
  - `/pelayanan/export`
  - `/aps-otc/export`
- `findBill.ts` masih memiliki method `updateApi` dan `exportApi` yang mengarah ke `/datamaster/role/...`; ini jelas copy-paste dari Datamaster dan tidak sesuai domain Pembayaran.
- `closeBill.ts` memiliki `downloadApi` yang memanggil `apiPembayaranGet('', payload)`, sehingga request mengarah ke base payment tanpa endpoint eksplisit.

## Backend/API

### Mounting

Source:

- `payment-service/src/app.js`
- `payment-service/src/routes/router.js`
- `payment-service/.env`

`.env` lokal:

```txt
APP_HOST=0.0.0.0
APP_PORT=8089
APPLICATION_PORT=8089
APPLICATION_MODULE=payment
API_BASE=api
API_VERSION=v3
```

`payment-service/src/app.js` me-mount router secara hardcoded:

```txt
app.use('/api/v3/payment', router)
```

Jadi `API_BASE`, `API_VERSION`, dan `APPLICATION_MODULE` tidak terlihat dipakai untuk membentuk route payment.

### Route Backend Payment

Endpoint backend aktual:

| Area | Endpoint backend |
|---|---|
| Payment list/detail | `GET /api/v3/payment/payment`, `GET /:uuid`, `GET /:uuid/items`, `GET /:uuid/detail`, `GET /:uuid/pasien` |
| Bayar/close | `POST /:uuid/voucher`, `POST /:uuid/discount`, `POST /:uuid/close`, `POST /:uuid/payment` |
| Closed bill | `GET /closed-bills`, `GET /closed-bills/:uuid/history`, `POST /closed-bills/:uuid/pay` |
| Transaksi | `GET /aps-otc`, `GET /pelayanan` |
| Kasir | `GET /cashier/check`, `GET /cashier/close-day/check`, `POST /cashier/open`, `POST /cashier/close`, `POST /cashier/close/day` |
| Laporan | `GET /report/cashier`, `GET /report/payment`, `GET /report/revenue` |
| Patient/internal | `GET /mobile-patient/bills`, `POST /internal/bills` |

Temuan backend:

- `app.use(setContext)` berjalan sebelum semua route. `setContext` memverifikasi JWT dan menyimpan author pada `Context` static global.
- Route juga memanggil `authorizationSdk([])` per endpoint, tetapi array permission kosong.
- Tidak ada permission enforcement per action/feature.
- `Context` static global berisiko tercampur antar request paralel karena bukan request-scoped storage.
- `setContext` mengirim response 401 ketika token kosong tetapi tidak langsung `return`; setelah itu kode tetap mencoba `bearerToken.substring(7)`.
- `CashierRepository._getShiftsToCloseQuery` memakai `where({ faskesUuid: faskesUuid, type: 'SHIFT' })`, sedangkan kolom database adalah `faskes_uuid`. Method ini diberi komentar "Sepertinya tidak digunakan", tetapi tetap risk bila dipakai nanti.
- `payment-service/.env` tidak mendefinisikan `PATIENT_SERVICE_URL`, `PHARMACY_SERVICE_URL`, atau `SETTING_SERVICE_URL`, sementara `payment-service/src/configs/external-api.js` punya fallback ke IP lama/port placeholder.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:815`
- `frontend-service/src/stores/datamaster/permission.ts`

Definisi permission Pembayaran:

| Submodule/feature | Allows |
|---|---|
| Kasir | `READ`, `OPEN KASIR`, `BAYAR`, `CETAK INVOICE`, `CETAK RINCIAN BIAYA`, `CLOSE HARIAN`, `CLOSE BILL`, `CLOSE KASIR` |
| Transaksi | `READ`, `CETAK INVOICE`, `CETAK RINCIAN BIAYA` |
| Closed Bill | `READ`, `LUNASKAN` |
| Laporan Pembayaran > Kunjungan | `READ`, `CETAK LAPORAN` |
| Laporan Pembayaran > Closing Kasir | `READ`, `CETAK LAPORAN` |

Mismatches:

- Sidebar punya `Laporan > Pendapatan`, tetapi permission `Laporan Pembayaran` hanya memuat `Kunjungan` dan `Closing Kasir`.
- Sidebar punya `Pembayaran Kunjungan`, permission menyebut `Kunjungan`.
- Endpoint export laporan belum terlihat di backend, padahal permission punya `CETAK LAPORAN`.
- Action `CETAK INVOICE`/`CETAK RINCIAN BIAYA` ada di permission, tetapi endpoint cetak tidak terlihat di `payment-service/src/routes/router.js`.

Data role lokal:

| Scope | Role | Pembayaran |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Ada |
| Klinik Sehat | Admin | Ada |

Role `KASIR` hanya memiliki Pembayaran pada batch ini; ini bagus untuk smoke test role kasir setelah route/API diperbaiki.

## Tenant/Faskes

Data lokal:

| Entitas | Count |
|---|---:|
| Faskes aktif | 2 |
| Role aktif | 4 |
| User aktif | 21 |

Distribusi data Pembayaran lokal:

| Table | Klinik Contoh | Klinik Sehat | Orphan/unknown |
|---|---:|---:|---:|
| `bills` | 51 | 50 | 0 |
| `bill_item` | 138 | 113 | 0 |
| `service_bill` | 51 | 50 | 0 |
| `payment_history` | 21 | 7 | 0 |
| `cashier_report` | 630 | 60 | 0 |

Catatan tenant:

- Tidak ditemukan orphan faskes pada tabel payment utama.
- Repository payment banyak memakai `faskesUuid` dari token context untuk query tenant.
- Karena context disimpan static global, isolasi tenant masih perlu diuji dengan request paralel antar faskes.

## Defect Prioritas

| Prioritas | Defect | Dampak |
|---|---|---|
| P0 | Prefix API Pembayaran dobel: base `/api/v3/payment` + store `/payment/...`. | Banyak halaman Pembayaran berpotensi 404 di local. |
| P0 | Sidebar Pelayanan memakai `/pembayaran/transaksi/Pelayanan`, route yang ada `/pembayaran/transaksi/pelayanan`. | Klik menu Pelayanan bisa gagal/fallback. |
| P1 | Endpoint export/cetak frontend tidak terlihat di backend. | Tombol cetak/export laporan/transaksi berpotensi 404. |
| P1 | Permission `Pendapatan` tidak ada, tetapi sidebar punya Laporan Pendapatan. | Mapping permission laporan tidak lengkap. |
| P1 | Tidak ada permission enforcement endpoint Payment. | Token valid bisa mengakses endpoint lintas action jika tidak dicek. |
| P1 | Context auth payment static global. | Risiko tenant/user context tercampur pada request paralel. |
| P2 | Store Pembayaran masih punya endpoint copy-paste Datamaster Role. | Risiko aksi tidak sengaja salah domain. |
| P2 | Karakter non-ASCII di route pelunasan. | Risiko tooling/formatting dan code review noise. |

## Rekomendasi Bertahap

1. Samakan pola URL Pembayaran: store sebaiknya memanggil endpoint relatif tanpa prefix `/payment`, atau tambahkan normalizer Payment di `apiHandler`.
2. Perbaiki sidebar URL Pelayanan menjadi lowercase sesuai router.
3. Tambahkan/rapikan endpoint export/cetak atau sembunyikan tombol sampai backend tersedia.
4. Tambahkan permission feature `Pendapatan` di `Laporan Pembayaran` bila laporan ini memang dipakai.
5. Ganti `Context` static global dengan request-scoped context atau pastikan SDK sudah menyediakan konteks aman.
6. Smoke test khusus role `KASIR` karena role ini memang hanya punya module Pembayaran.
