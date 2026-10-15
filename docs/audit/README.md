# Audit Menu, Role, Permission, Tenant

Tanggal mulai: 2026-05-14

Dokumen ini dipakai sebagai log audit bertahap sebelum revamp. Fokus audit tidak langsung melebar ke seluruh aplikasi, tetapi dibagi per menu utama agar setiap temuan bisa ditelusuri ke route, sidebar, role, permission, tenant, dan endpoint backend yang terkait.

## Metode Audit

Setiap menu dibuatkan satu file Markdown dengan format berikut:

1. Ringkasan menu dan status audit.
2. Peta source frontend: route, sidebar, store, dan komponen utama.
3. Peta backend/API: service, router, controller, dan tenant scope.
4. Role dan permission: definisi permission, data role lokal, dan mismatch nama.
5. Tenant/faskes: bagaimana faskes dipilih, disimpan di token, dan dipakai di query.
6. Temuan defect/risk.
7. Rekomendasi untuk revamp.
8. Pertanyaan terbuka untuk dikonfirmasi.

## Status Menu

| Urutan | Menu | File | Status | Catatan |
|---:|---|---|---|---|
| 1 | Datamaster | [menu-datamaster.md](./menu-datamaster.md) | Draft v1 selesai | Ada mismatch `subModules/sub_modules`, edit User belum menyimpan permission, dan master global belum dibatasi per role. |
| 2 | Antrian | [menu-antrian.md](./menu-antrian.md) | Draft v1 selesai | Modul lintas Antrian, Admisi, Rawat Jalan, dan Datamaster. |
| 3 | Admisi | [menu-admisi.md](./menu-admisi.md) | Draft v1 selesai | Diaudit setelah Datamaster sesuai arahan user. |
| 4 | Rawat Jalan | [menu-rawat-jalan.md](./menu-rawat-jalan.md) | Draft v1 selesai | Ada mismatch base URL `/rawat-jalan` vs `/rajal` dan endpoint rekap tindakan. |
| 5 | Rawat Inap | [menu-rawat-inap.md](./menu-rawat-inap.md) | Draft v1 selesai | Ada mismatch base URL `/rawat-inap` vs `/ranap`; halaman Ruangan memakai Admisi, sedangkan Perpindahan/Laporan memakai Rawat Inap service. |
| 6 | IGD | [menu-igd.md](./menu-igd.md) | Draft v1 selesai | Ada mismatch endpoint laporan IGD dan copy-paste redirect ke `/rawat-jalan/poli`. |
| 7 | Farmasi | [menu-farmasi.md](./menu-farmasi.md) | Draft v1 selesai | Ada mismatch prefix API `/farmasi` ganda dan data transaksi orphan faskes. |
| 8 | Laboratorium | [menu-laboratorium.md](./menu-laboratorium.md) | Draft v1 selesai | Ada mismatch prefix API `/lab` ganda dan export/import Lab masih mengarah ke Farmasi. |
| 9 | Fisioterapi | [menu-fisioterapi.md](./menu-fisioterapi.md) | Draft v1 selesai | Masih banyak data dummy, route order duplikat, dan integrasi RME belum memakai `rmType` fisioterapi. |
| 10 | Training | [menu-training.md](./menu-training.md) | Draft v1 selesai | Masih UI/stub, tanpa store/API/service khusus, dan ada copy-paste filter Rawat Jalan. |
| 11 | Pembayaran | [menu-pembayaran.md](./menu-pembayaran.md) | Draft v1 selesai | Ada mismatch prefix API `/payment` ganda, sidebar Pelayanan beda case, dan endpoint export belum terlihat di backend. |
| 12 | Inventory | [menu-inventory.md](./menu-inventory.md) | Draft v1 selesai | Ada mismatch prefix API `/inventory` ganda, endpoint mutasi/stok opname tidak selaras, dan permission laporan duplikat. |
| 13 | Laporan | - | Belum diaudit | - |
| 14 | Setting/Profile | - | Belum diaudit | Bukan menu top nav, tetapi diakses dari dialog akun. |
| 15 | Dashboard | - | Belum diaudit | Selalu dimunculkan di header. |

## Status Fitur Pendukung

| Urutan | Fitur | File | Status | Catatan |
|---:|---|---|---|---|
| 1 | Notifikasi/Header | [fitur-notifikasi.md](./fitur-notifikasi.md) | Draft v1 selesai | Ikon bell belum punya alur; fitur yang aktif sebenarnya drawer `Panggilan Antrian` lintas Admisi/Rawat Jalan. |

## Sumber Global Yang Sudah Dipetakan

- Top navigation dibuat dari `templistMenu` di `frontend-service/src/components/section/Header.vue`.
- Top navigation difilter berdasarkan `permission` di `localStorage`, tetapi hanya level `module`.
- Route guard utama ada di `frontend-service/src/router/index.ts` dan hanya memeriksa keberadaan `access_token`.
- Pemilihan tenant/faskes dilakukan di `Header.vue`; hanya role string `super admin` yang melihat selector faskes.
- Token tenant diperbarui lewat `auth-service` endpoint `PUT /token/:faskes`.
- Permission master ada di dua tempat yang mirip: `frontend-service/src/stores/datamaster/permission.ts` dan `datamaster-service/src/helpers/permission-list.js`.
- Backend Datamaster memakai `authorizationSdk` untuk validasi token, tetapi belum terlihat memakai `permissionSdk` per endpoint.

## Data Local Saat Audit

Database lokal berisi dua faskes aktif:

| Faskes | Code | Status |
|---|---|---|
| Klinik Contoh | AMBA | Aktif |
| Klinik Sehat | KSHA | Aktif |

Role lokal yang relevan:

| Scope | Role | Module permission |
|---|---|---:|
| Global/null faskes | super admin | 16 |
| Klinik Contoh | admin | 15 |
| Klinik Contoh | KASIR | 1 |
| Klinik Sehat | Admin | 15 |

Catatan penting: role/user `admin` lokal menyimpan struktur permission Datamaster dengan key `sub_modules`, sedangkan `super admin` memakai `subModules`. Ini berpotensi menjadi sumber mismatch saat permission enforcement dibuat lebih ketat.
