# Audit Menu Datamaster

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Datamaster tetap jadi pondasi paling sensitif sebelum revamp karena memegang User, Role, Faskes, master klinis, dan sumber permission lintas modul. Dibanding menu lain, defect Datamaster saat ini bukan lagi dominan di prefix API, karena normalisasi `/datamaster` di frontend sudah ada. Masalah besarnya justru ada di konsistensi permission, tenant scope, dan perilaku CRUD User/Role.

Temuan paling penting pada audit lanjutan ini:

1. Top nav hanya filter level module dari `localStorage.permission`, sedangkan route guard tetap hanya cek token.
2. Sidebar Datamaster statis dan tidak membaca permission submenu atau feature.
3. Shape permission aktif di data lokal terbelah: `super admin` masih `subModules`, tenant role dan user mayoritas `sub_modules`.
4. Form edit Role dan User di frontend membaca `subModules`, sedangkan backend mengembalikan JSON permission apa adanya dari database.
5. Edit User di backend tidak memproses `permissions`, walaupun frontend tetap menampilkan checklist permission.
6. Backend Datamaster memakai `authorizationSdk`, tetapi belum ada `permissionSdk` per route.
7. Faskes, Diagnosis, ICD9, Snomed, LOINC, dan master gigi bersifat global, tetapi belum terlihat guard eksplisit yang membatasi akses global hanya untuk role tertentu.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| User | `/datamaster/user` | Kelola user tenant. |
| Role | `/datamaster/role` | Kelola role dan matrix permission. |
| Pegawai | `/datamaster/pegawai` | Master pegawai. |
| Praktisi | `/datamaster/praktisi` | Master praktisi/dokter. |
| Ruangan | `/datamaster/ruangan` | Master ruangan. |
| Kategori Ruangan | `/datamaster/kategori-ruangan` | Master kategori ruangan. |
| Diagnosis (ICD 10) | `/datamaster/diagnosis-icd10` | Master diagnosis. |
| ICD 9 CM | `/datamaster/icd9-cm` | Master ICD9. |
| Snomed CT | `/datamaster/snomed-ct` | Master SNOMED. |
| LOINC | `/datamaster/loinc` | Master LOINC. |
| Tarif | `/datamaster/tarif` | Master tarif layanan. |
| Komponen Tarif | `/datamaster/komponen-tarif` | Master komponen tarif. |
| Tindakan | `/datamaster/tindakan` | Master tindakan. |
| Faskes | `/datamaster/faskes` | Master tenant/faskes. |
| Organisasi | `/datamaster/organisasi` | Master organisasi. |
| Lokasi | `/datamaster/lokasi` | Master lokasi/poli/unit. |
| Penjamin | `/datamaster/penjamin` | Master penjamin. |
| Voucher | `/datamaster/voucher` | Master voucher. |
| General Consent | `/datamaster/general-consent` | Template general consent. |
| Super Admin > Gigi FDI | `/datamaster/super-admin/gigi-fdi` | Master gigi global. |
| Super Admin > Kategori Gigi | `/datamaster/super-admin/kategori-gigi` | Master kategori gigi global. |
| Super Admin > Item Gigi | `/datamaster/super-admin/item-gigi` | Master item gigi global. |
| Super Admin > Oklusi | `/datamaster/super-admin/oklusi` | Master oklusi global. |

## Frontend

### Route

Source utama:

- `frontend-service/src/router/index.ts`
- `frontend-service/src/views/Datamaster/DatamasterView.vue`

Route Datamaster dimulai di sekitar `frontend-service/src/router/index.ts:347`.

| Route | Component/page | Catatan |
|---|---|---|
| `/datamaster` | redirect | Redirect ke `/datamaster/user`. |
| `/datamaster/user` | `DatamasterView` + `UserPage` | `requiresAuth: true`. |
| `/datamaster/role` | `DatamasterView` + `RolePage` | `requiresAuth: true`. |
| `/datamaster/ruangan` | `DatamasterView` + `RuanganPage` | `requiresAuth: true`. |
| `/datamaster/kategori-ruangan` | `DatamasterView` + `KategoriRuanganPage` | `requiresAuth: true`. |
| `/datamaster/tarif` | `DatamasterView` + `TarifPage` | `requiresAuth: true`. |
| `/datamaster/komponen-tarif` | `DatamasterView` + `KomponenTarifPage` | `requiresAuth: true`. |
| `/datamaster/tindakan` | `DatamasterView` + `TindakanPage` | `requiresAuth: true`. |
| `/datamaster/icd9-cm` | `DatamasterView` + `ICD9CMPage` | `requiresAuth: true`. |
| `/datamaster/snomed-ct` | `DatamasterView` + `SnomedCTPage` | `requiresAuth: true`. |
| `/datamaster/loinc` | `DatamasterView` + `LoincPage` | `requiresAuth: true`. |
| `/datamaster/diagnosis-icd10` | `DatamasterView` + `DiagnosisICD10Page` | `requiresAuth: true`. |
| `/datamaster/praktisi` | `DatamasterView` + `PraktisiPage` | `requiresAuth: true`. |
| `/datamaster/pegawai` | `DatamasterView` + `PegawaiPage` | `requiresAuth: true`. |
| `/datamaster/penjamin` | `DatamasterView` + `PenjaminPage` | `requiresAuth: true`. |
| `/datamaster/voucher` | `DatamasterView` + `VoucherPage` | `requiresAuth: true`. |
| `/datamaster/faskes` | `DatamasterView` + `FaskesPage` | `requiresAuth: true`. |
| `/datamaster/lokasi` | `DatamasterView` + `LokasiPage` | `requiresAuth: true`. |
| `/datamaster/organisasi` | `DatamasterView` + `OrganisasiPage` | `requiresAuth: true`. |
| `/datamaster/general-consent` | `DatamasterView` + `GeneralConsentPage` | `requiresAuth: true`. |
| `/datamaster/super-admin/gigi-fdi` | `DatamasterView` + `GigiFDIPage` | `requiresAuth: true`. |
| `/datamaster/super-admin/kategori-gigi` | `DatamasterView` + `KategoriGigi` | `requiresAuth: true`. |
| `/datamaster/super-admin/item-gigi` | `DatamasterView` + `ItemGigiPage` | `requiresAuth: true`. |
| `/datamaster/super-admin/oklusi` | `DatamasterView` + `OklusiPage` | `requiresAuth: true`. |

Temuan route:

- Semua route Datamaster hanya diberi `requiresAuth: true`; belum ada meta permission per halaman.
- Nama route Praktisi tertulis `datamaster-paktisi`, bukan `datamaster-praktisi`.
- Guard global di `frontend-service/src/router/index.ts:1675` hanya mengecek ada atau tidaknya `access_token`.

### Sidebar dan top nav

Source:

- `frontend-service/src/components/section/Header.vue`
- `frontend-service/src/views/Datamaster/DatamasterView.vue`

Top nav:

- Dibangun dari `templistMenu`.
- Disaring dari `localStorage.permission` hanya pada level `module`.
- `Dashboard` selalu dimasukkan manual.

Sidebar Datamaster:

- Dibuat statis melalui `sidebarBodyList`.
- Seluruh submenu Datamaster selalu tampil jika user sudah masuk ke menu Datamaster.
- Group `Super Admin` hanya muncul bila `localStorage.user.role === "super admin"`.

Temuan sidebar/top nav:

- Tidak ada filter per submenu atau feature berdasarkan permission efektif user.
- Role tanpa permission Datamaster masih bisa mencoba membuka URL Datamaster secara langsung karena guard route tidak memeriksa permission.
- Penentuan `Super Admin` memakai string role, bukan permission khusus.

### Store dan API frontend

Base URL lokal:

```txt
VITE_BASE_DATAMASTER=http://localhost:8096/api/v3/datamaster
```

Datamaster memakai `baseInstanceDatamaster`. Berbeda dari Pembayaran dan Inventory, Datamaster sudah punya normalizer khusus:

```ts
const normalizeDatamasterUrl = (url: string) => {
  if (url === "/datamaster") return "/";
  if (url.startsWith("/datamaster/")) return url.replace(/^\/datamaster/, "");
  return url;
};
```

Artinya store masih boleh mengirim URL seperti `/datamaster/faskes/aktif`, lalu frontend akan memotong prefix ekstra sebelum request dikirim. Jadi defect prefix ganda `/api/v3/datamaster/datamaster/...` yang sempat muncul sudah ditangani di `frontend-service/src/utils/apiHandler.ts`.

Store utama yang dipakai menu Datamaster:

| Domain | Store frontend | Endpoint yang dipakai | Catatan |
|---|---|---|---|
| Faskes | `stores/datamaster/faskes.ts` | `/datamaster/faskes`, `/aktif`, `/export`, `/import` | Konsisten dengan backend. |
| Role | `stores/datamaster/role.ts` | `/datamaster/role`, `/aktif`, `/export`, `/import` | Konsisten, tetapi payload permission memakai `subModules` di frontend. |
| User | `stores/user.ts` | `/datamaster/user`, `/deleted`, `/-/export`, `/import` | Store User berada di luar folder `stores/datamaster`. |
| Praktisi | `stores/datamaster/praktisi.ts` | `/datamaster/practitioner`, `/aktif`, `/poli/aktif` | Nama UI berbeda dengan path backend. |
| Lokasi | `stores/datamaster/lokasi.ts` | `/datamaster/lokasi`, `/part_of`, `/aktif`, `/code/:code` | Konsisten dengan backend. |
| Tarif | `stores/datamaster/tarif.ts` | `/datamaster/tarif`, `/export`, `/import` | Konsisten dengan backend. |
| Gigi/Oklusi | `stores/datamaster/gigiFDI.ts`, `kategoriGigi.ts`, `itemGigi.ts`, `oklusiGigi.ts` | `/datamaster/gigi`, `/kategori_gigi`, `/item_gigi`, `/oklusi_gigi` | Menu super admin. |

Temuan store/API frontend:

- `frontend-service/src/stores/user.ts` mengirim query `total=${limit}`, sedangkan backend `GET /user` membaca `pageSize`. Akibatnya limit pagination user berisiko diabaikan dan backend jatuh ke default `10`.
- Form Role dan User membangun permission dengan shape `subModules`, bukan `sub_modules`.
- `frontend-service/src/views/Datamaster/User/DetailUser.vue` dan form edit User/Role membaca `menuItem.subModules` secara langsung; jika backend mengirim `sub_modules`, UI detail/prefill akan kosong atau tidak sinkron.

## Backend

### App dan router

Source:

- `datamaster-service/src/app.js`
- `datamaster-service/src/routers/router.js`
- `datamaster-service/src/routers/mobile-router.js`

Karakter backend Datamaster:

- Service berjalan di port lokal `8096`.
- `mobileRouts` dipasang lebih dulu di `/api/v3/datamaster`.
- Setelah itu `authorizationSdk` dipasang untuk validasi token, dengan whitelist beberapa route mobile.
- Middleware `snake_case-middleware.js` hanya mengubah `req.body`, `req.query`, dan `req.params` ke snake_case.
- Router utama menggabungkan banyak resource router tanpa permission middleware per resource.

Mobile route yang dibypass dari auth token user tetapi tetap memakai API key:

- `/mobile/faskes/:uuid`
- `/mobile/faskes`
- `/mobile/lokasi/poli/aktif`
- `/mobile/practitioner/:uuid`
- `/mobile/practitioner/poli/aktif`
- `/mobile/provinsi`
- `/mobile/kabupaten`
- `/mobile/kecamatan`
- `/mobile/kelurahan`
- `/mobile/practitioner/code-antrian/:code`

### Route backend utama

| Domain | Endpoint utama |
|---|---|
| Faskes | `GET /faskes`, `GET /faskes/aktif`, `GET /faskes/export`, `POST /faskes`, `PUT /faskes/:uuid`, `DELETE /faskes/:uuid`, `POST /faskes/import` |
| Role | `GET /role`, `GET /role/aktif`, `GET /role/export`, `POST /role`, `PUT /role/:uuid`, `DELETE /role/:uuid`, `POST /role/import` |
| User | `GET /user`, `GET /user/deleted`, `GET /user/:uuid`, `GET /user/-/export`, `POST /user`, `PUT /user/:uuid`, `PATCH /user/:uuid`, `DELETE /user/:uuid`, `POST /user/import` |
| Praktisi | `GET /practitioner`, `GET /practitioner/aktif`, `GET /practitioner/poli/aktif`, `GET /practitioner/export`, `POST /practitioner`, `PUT /practitioner/:uuid`, `DELETE /practitioner/:uuid` |
| Lokasi | `GET /lokasi`, `GET /lokasi/part_of`, `GET /lokasi/part_of/:part_of_uuid`, `GET /lokasi/code/:code`, `GET /lokasi/aktif`, `GET /lokasi/poli/aktif`, `GET /lokasi/export`, `POST /lokasi`, `PUT /lokasi/:uuid`, `DELETE /lokasi/:uuid`, `POST /lokasi/import` |
| Tarif | `GET /tarif`, `GET /tarif/aktif`, `GET /tarif/export`, `POST /tarif`, `PUT /tarif/:uuid`, `DELETE /tarif/:uuid`, `POST /tarif/import` |
| Super Admin Gigi | `GET/POST/PUT/DELETE` untuk `/gigi`, `/kategori_gigi`, `/item_gigi`, `/oklusi_gigi`, plus `/aktif`, `/export`, `/import` |

Temuan backend:

- Belum terlihat `permissionSdk("Datamaster", ...)` pada route Datamaster mana pun.
- Karena `snake_case-middleware` hanya mengubah request, response permission dari database tidak dinormalisasi kembali ke camelCase.
- `GET /user` punya kontrak query yang berbeda dari store frontend: backend membaca `pageSize`, frontend mengirim `total`.

### Tenant switch dan auth

Source:

- `frontend-service/src/stores/auth.ts`
- `auth-service/src/services/authentication-service.js`
- `auth-service/src/repositories/authentication-repository.js`

Alur tenant switch saat super admin:

1. Header menampilkan selector faskes hanya untuk role `super admin`.
2. Saat faskes dipilih, frontend memanggil `PUT /token/:faskesUuid`.
3. Frontend hanya mengubah `access_token` dan `faskes` di localStorage, lalu reload.

Temuan tenant switch:

- `AuthenticationService.updateToken()` mengambil `{ permission } = AuthenticationRepository.findByUsername(username)`, padahal repository mengembalikan `permissions`.
- Token baru lalu disimpan ke Redis dengan shape `{permission}` tunggal, bukan `{permissions}` seperti flow login biasa.
- Jika nanti `permissionSdk` benar-benar dipakai luas, alur switch tenant super admin berisiko kehilangan context permission di Redis.
- Frontend tidak memperbarui `localStorage.permission` atau `localStorage.user` setelah switch tenant.

## Role, permission, dan tenant

### Permission master Datamaster

Permission registry frontend dan backend sama-sama mendefinisikan module `Datamaster` dengan 23 submenu.

Mismtach label yang terlihat:

| Sidebar/route | Permission registry |
|---|---|
| Praktisi | Praktisioner |
| Diagnosis (ICD 10) | Diagnosis ICD-10 |
| Snomed CT | Snomed-CT |
| ICD 9 CM | ICD-9 CM |

Catatan:

- Permission Praktisioner juga punya allow `DETAIL DATA PRAKSTISI`, yang tampak salah eja.
- Sampai audit ini selesai, mismatch label ini belum meledak karena UI belum memakai exact match untuk mengunci submenu Datamaster. Saat revamp guard mulai ketat, ini akan jadi titik rawan.

### Shape permission di data lokal

Hasil verifikasi database lokal:

| Scope | Role | Punya module Datamaster | Shape permission |
|---|---|---:|---|
| Global | super admin | Y | `subModules` |
| Klinik Contoh | admin | Y | `sub_modules` |
| Klinik Contoh | KASIR | N | `-` |
| Klinik Sehat | Admin | Y | `sub_modules` |

Shape permission user aktif:

- `opensimrs-service-center` masih `subModules`
- hampir semua user tenant lain sudah `sub_modules`

Implikasi langsung:

- `FormRole.vue` memanggil `matchingModule.subModules.find(...)`.
- `TambahDataUserPage.vue` memanggil `matchingModule.subModules.find(...)`.
- `DetailUser.vue` merender `menuItem.subModules`.

Karena repository backend hanya `JSON.parse()` lalu mengirim JSON apa adanya, role dan user tenant dengan `sub_modules` tidak selaras dengan ekspektasi frontend yang memakai `subModules`.

### Tenant/faskes aktif

Faskes aktif lokal:

| UUID | Code | Name | Status |
|---|---|---|---|
| `01981726-d5cf-7bc4-97ca-9804168283f7` | AMBA | Klinik Contoh | Aktif |
| `01985e53-92d6-762c-ba36-9bc18ab4be3b` | KSHA | Klinik Sehat | Aktif |

Distribusi data tenant-scoped utama:

| Tabel | Klinik Contoh | Klinik Sehat | Null/Global |
|---|---:|---:|---:|
| `role` | 2 | 1 | 1 |
| `users` | 17 | 4 | 0 |
| `pegawai` | 35 | 6 | 0 |
| `practitioner` | 32 | 6 | 0 |
| `ruangan` | 1 | 1 | 0 |
| `kategori_ruangan` | 5 | 1 | 0 |
| `organization` | 19 | 2 | 0 |
| `lokasi` | 111 | 29 | 0 |
| `penjamin` | 5 | 1 | 0 |
| `voucher` | 9 | 9 | 0 |

Distribusi data global:

| Tabel | Total | Scope |
|---|---:|---|
| `diagnosis` | 12371 | Global |
| `icd9` | 4626 | Global |
| `snomed` | 40826 | Global |
| `loinc` | 2394 | Global |
| `gigi` | 52 | Global |
| `kategori_gigi` | 6 | Global |
| `item_gigi` | 38 | Global |
| `oklusi_gigi` | 15 | Global |

Catatan tenant:

- Faskes memang global karena tidak memakai `faskes_uuid`.
- Master klinis referensi besar seperti Diagnosis, ICD9, Snomed, dan LOINC juga global.
- Master gigi yang ditempatkan di group `Super Admin` juga global.
- User, Role, Pegawai, Praktisi, Ruangan, Lokasi, Organisasi, Penjamin, dan Voucher tenant-scoped.

## Temuan

| Severity | Temuan | Dampak |
|---|---|---|
| P0 | Frontend Role/User detail dan prefill edit mengharapkan `subModules`, sedangkan hampir semua role dan user tenant di database tersimpan sebagai `sub_modules`. | Detail permission user bisa kosong dan edit role/user berisiko tidak memuat permission existing dengan benar. |
| P0 | Edit User di backend tidak memproses `permissions`, sementara frontend tetap menampilkan checklist permission saat edit user. | UX menyesatkan: operator merasa permission user berubah, padahal backend mengabaikannya. |
| P1 | Route Datamaster hanya dilindungi token lewat `authorizationSdk`; belum ada `permissionSdk` per endpoint. | User bertoken valid berpotensi mengakses API Datamaster di luar hak role-nya. |
| P1 | `updateToken` di auth service menyimpan `{permission}` tunggal ke Redis, bukan `{permissions}`. | Alur switch tenant super admin berisiko tidak kompatibel dengan enforcement permission berbasis Redis. |
| P1 | Faskes dan master global lain belum terlihat punya guard role eksplisit. | Tenant user berpotensi menjangkau data global jika endpoint diketahui. |
| P1 | Store User mengirim `total=${limit}`, backend membaca `pageSize`. | Pagination list user berpotensi tidak sesuai limit yang dipilih frontend. |
| P2 | Nama route `datamaster-paktisi` typo dan label permission Datamaster tidak konsisten dengan UI. | Menambah noise saat guard/analytics/refactor route dan permission. |
| P2 | Top nav dan sidebar Datamaster tidak disusun dari permission efektif user. | Menu terlihat lebih luas dari hak akses sebenarnya dan memicu false affordance. |

## Rekomendasi

1. Tetapkan satu shape permission canonical untuk seluruh stack. Pilih salah satu: `subModules` atau `sub_modules`.
2. Buat adapter dua arah yang eksplisit jika sementara masih harus kompatibel dengan data lama.
3. Perbaiki flow User update: backend harus menerima dan menyimpan perubahan `permissions`, atau frontend edit user harus berhenti menampilkan matrix permission jika memang tidak didukung.
4. Tambahkan `permissionSdk` per route Datamaster, minimal untuk `READ`, `CREATE`, `UPDATE`, `DELETE`, `IMPORT`, dan `EXPORT`.
5. Tambahkan meta permission per route frontend dan bangun sidebar dari permission efektif, bukan array statis.
6. Pisahkan policy global vs tenant secara eksplisit:
   - global: Faskes, Diagnosis, ICD9, Snomed, LOINC, master gigi
   - tenant: User, Role, Pegawai, Praktisi, Ruangan, Lokasi, Organisasi, Penjamin, Voucher
7. Perbaiki kontrak pagination User agar frontend dan backend sama-sama memakai `pageSize` atau `limit`.
8. Rapikan alur switch tenant super admin agar token baru juga membawa context `permissions` yang benar ke Redis dan localStorage.

## Pertanyaan terbuka

1. Apakah matrix permission per user memang boleh berbeda dari role, atau seharusnya selalu mengikuti role tanpa override manual?
2. Apakah Faskes CRUD harus dibatasi hanya untuk `super admin`, sementara tenant admin cukup baca profil faskes-nya sendiri?
3. Apakah master global seperti Diagnosis, ICD9, Snomed, LOINC, dan master gigi memang sengaja dikelola dari aplikasi yang sama, atau nanti akan dipisah ke service/admin console lain?
4. Saat revamp nanti, apakah Datamaster tetap dipertahankan sebagai satu menu besar, atau akan dipecah menjadi group `Tenant Master`, `Clinical Reference`, dan `Global Admin`?
