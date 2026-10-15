# Stabilization Patch Status

Tanggal: 2026-05-14

Dokumen ini mencatat patch stabilisasi yang sudah diterapkan dan sisa defect/API mismatch yang masih perlu ditangani sebelum revamp UI.

## Patch yang sudah diterapkan

### Permission frontend

- Permission reader sudah menormalisasi legacy `subModules`, legacy `sub_modules`, dan canonical internal `submodules`.
- Helper `hasPermission(module, submodule, action, feature?)` tersedia di `frontend-service/src/utils/permissions.ts`.
- Route guard sekarang mengecek token dan permission efektif. Route tanpa `meta.permission` akan memakai registry URL terpusat.
- Halaman tanpa permission akan diarahkan ke `/403`.
- Sidebar global `components/section/Sidebar.vue` memfilter item berdasarkan permission route/URL, jadi semua menu yang memakai komponen ini tidak lagi full-static.
- Top navigation tetap filter module, dan Training/Fisioterapi disembunyikan di produksi kecuali `VITE_SHOW_STUB_MENU=true`.

### Permission master

- Permission master frontend dan backend Datamaster diselaraskan untuk:
  - `Pembayaran > Laporan Pembayaran > Pendapatan`
  - `Inventory > Laporan Inventory > Persediaan`
  - `Fisioterapi > Laporan Fisio > Rekapitulasi Pendapatan Fisioterapi`
  - `Laporan > Rekapitulasi Diagnosis berdasarkan Umur Pasien`

Catatan migrasi: role existing di database yang sudah menyimpan JSON permission lama tetap perlu di-refresh/migrasi agar item baru muncul di permission efektif user.

### API URL normalization

- `apiHandler.ts` sudah menormalisasi prefix service:
  - `/farmasi/...` pada Farmasi service
  - `/lab/...` pada Laboratorium service
  - `/payment/...` pada Payment service
  - `/inventory/...` pada Inventory service
  - `/rawat-jalan/...`, `/rajal/...`, dan legacy `/v3/rajal/...` pada Rawat Jalan service

Ini mencegah URL ganda seperti `/api/v3/farmasi/farmasi/...`.
- Bug yang ditutup: halaman Antrian Layar memanggil Rawat Jalan ke path salah seperti `/api/v3/rawat-jalan/v3/rajal/antrian-call`.

### Admisi ke Antrian service URL

- `admisi-service` sekarang menormalisasi base URL Antrian dari `BASE_URL_API_ANTRIAN`, `BASE_URL_ANTRIAN`, `ANTRIAN_SERVICE_URL`, atau `VITE_BASE_ANTRIAN`.
- Jika env belum diset pada development lokal, fallback aman dipakai: `http://localhost:8082/api/v3/antrian`.
- `API_KEY_ANTRIAN` juga fallback ke `ANTRIAN_KEY_SECRET` agar mobile call Admisi-Antrian memakai secret yang sama dengan Antrian service.
- Bug yang ditutup: `GET /api/v3/admisi/antrian-call` gagal 500 dengan `ERR_INVALID_URL` karena axios membentuk URL `undefined/admisi-antrian/all`.
- Jika Antrian service tidak running/timeout, Admisi sekarang mengembalikan 503 `Service Unavailable` yang eksplisit, bukan 500 generik.

### Admisi Rawat Inap list

- Bug yang ditutup: `GET /api/v3/admisi/rawat-inap` gagal 500 karena include `LokasiModel as ruangan` dipasang langsung pada `RawatInapModel`, padahal asosiasi model yang tersedia adalah `RawatInap -> monitoring_room -> room`.
- Filter `room` sekarang memakai nested alias `monitoring_room.room.name`, sehingga filter ruangan tetap bekerja tanpa eager-loading error.

### Backend permission middleware

- `farmasi-service` memiliki `permissionSdk(module, submodule, action, feature?)`.
- Endpoint penting Farmasi sudah diberi permission middleware bertahap:
  - Resep Dokter
  - Penjualan Obat
  - Farmasi Ruangan/Alkes
  - Retur
  - Riwayat Transaksi
  - Laporan/Rekap
  - Cetak
  - Contoh CRUD Datamaster Satuan

### Tenant safety contoh

- `farmasi-service` Penjualan Obat detail/cancel sekarang lookup/update memakai `uuid + faskes_uuid`.
- Cancel Penjualan Obat tetap mengecek affected row.

## Status per menu

| Menu | Frontend route guard | Sidebar permission-aware | Backend permission | Tenant/API status |
|---|---|---|---|---|
| Datamaster | Registry route tersedia | Ya, via Sidebar global | Belum dipasang per endpoint | Perlu audit endpoint detail/update/delete dan role update permission |
| Antrian | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | Audit menemukan detail/update Antrian belum konsisten `uuid + faskesUuid` |
| Admisi | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | URL call ke Antrian sudah dipatch; static/global context masih perlu diganti request-scoped |
| Rawat Jalan | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | Redirect sidebar ke Poli sudah dicegah pada halaman laporan/BPJS |
| Rawat Inap | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | Redirect sidebar ke Ruangan sudah dicegah; list Rawat Inap sudah dipatch dari eager-loading error |
| IGD | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | BPJS IGD ditandai stub dan disembunyikan produksi |
| Farmasi | `meta.permission` + registry | Ya | Sudah sebagian besar endpoint penting | Penjualan Obat sudah tenant-safe contoh; endpoint lain perlu audit lanjutan |
| Laboratorium | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | Export/import Lab masih perlu dicek karena audit menemukan referensi Farmasi |
| Fisioterapi | Registry route tersedia, stub | Ya, via Sidebar global | Belum ada service khusus | Ditahan produksi sampai store/API/backend real tersedia |
| Training | Registry route tersedia, stub | Ya, via Sidebar global | Belum ada service khusus | Ditahan produksi sampai store/API/backend real tersedia |
| Pembayaran | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | Sidebar URL Pelayanan sudah dinormalisasi lowercase |
| Inventory | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | Permission `Persediaan` diperbaiki di master; role existing perlu migrasi |
| Laporan | Registry route tersedia | Ya, via Sidebar global | Belum dipasang | Sidebar title URL diperbaiki ke `/laporan/jumlah-kunjungan` |
| Notifikasi/Header | Module nav ternormalisasi | N/A | Belum dipasang | Drawer panggilan masih perlu permission action-level dan context route |

## Bug/API mismatch yang masih perlu patch backend

1. Backend permission belum merata.
   - Service terdampak: Datamaster, Antrian, Admisi, Rawat Jalan, Rawat Inap, IGD, Laboratorium, Pembayaran, Inventory.
   - Risiko: token valid masih bisa memanggil endpoint action yang tidak dimiliki role.

2. Static/global context masih ada di beberapa service.
   - Service terdampak dari audit: Admisi, Rawat Jalan, Rawat Inap, IGD, Pembayaran.
   - Risiko: request paralel antar tenant bisa salah author/faskes.

3. Detail/update/delete belum semua memakai `uuid + faskesUuid`.
   - Contoh sudah dipatch: Farmasi Penjualan Obat.
   - Perlu disapu di semua repository service lain.

4. Update/delete belum semua cek affected row.
   - Wajib untuk endpoint UPDATE, DELETE, CANCEL, APPROVE, dan status transition.

5. Endpoint dummy/stub belum real.
   - Training dan Fisioterapi belum punya store/API/backend produksi yang lengkap.
   - SEP Admisi masih perlu keputusan API/service owner.
   - BPJS IGD masih stub/static.

6. Permission data existing perlu migrasi.
   - Permission master sudah diperbaiki, tetapi role/user lama yang menyimpan JSON permission tidak otomatis mendapatkan feature baru.

7. Laboratorium export/import masih perlu audit implementasi.
   - Audit mencatat beberapa export/import Lab masih mengarah ke path Farmasi.

8. Pembayaran report/export/cetak masih perlu validasi backend.
   - Audit mencatat beberapa action cetak/export ada di permission tetapi endpoint belum jelas terlihat.

9. Inventory endpoint mismatch masih perlu validasi backend.
   - Audit mencatat mismatch endpoint mutasi/stok opname dan route import stok opname ganda.

## Smoke test wajib

### Super admin

- Login dan pastikan Dashboard terbuka.
- Semua module non-stub sesuai permission tampil di top nav.
- Training/Fisioterapi/SEP/BPJS IGD tidak tampil/403 saat `VITE_SHOW_STUB_MENU` tidak aktif.
- Farmasi: buka Resep Dokter, Penjualan Obat, Retur, Farmasi Ruangan, Datamaster, Laporan.
- Switch faskes lalu cek detail/cancel Penjualan Obat tidak mengambil data faskes lain.

### Admin tenant

- Login dengan role tenant yang masih memakai `sub_modules`.
- Pastikan top nav, route guard, dan sidebar tetap membaca permission.
- Direct URL ke menu tanpa permission harus 403.
- Akses Farmasi endpoint tanpa action yang sesuai harus 403 dari backend.

### KASIR

- Login dan pastikan Pembayaran dapat dibuka bila permission ada.
- Direct URL ke Farmasi, Inventory, Lab, Training, Fisioterapi, SEP, BPJS IGD harus 403 jika permission tidak ada.
- Pastikan sidebar Pembayaran hanya menampilkan submenu yang punya permission efektif.
