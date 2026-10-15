# Audit Fitur Notifikasi

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Fitur yang terlihat sebagai "notifikasi" di aplikasi ini ternyata terbagi menjadi dua bagian yang sangat berbeda:

1. Ikon bell di header.
2. Drawer `Panggilan Antrian` yang dibuka dari ikon megaphone.

Hasil audit menunjukkan bahwa yang benar-benar memiliki alur data hanyalah drawer `Panggilan Antrian`. Ikon bell sendiri saat ini belum terhubung ke store, route, API, atau backend notifikasi apa pun. Jadi secara praktis, fitur notifikasi yang aktif di repo ini adalah fitur panggilan antrian lintas modul, bukan notifikasi umum.

Temuan paling penting:

1. Ikon bell dan badge `notif.svg` hanya visual statis; belum ada click handler, state unread, store, atau endpoint backend.
2. Drawer `Panggilan Antrian` tampil dari header global, bukan dari menu tertentu, sehingga muncul lintas semua halaman tanpa filter permission.
3. Drawer memakai store berbeda tergantung path halaman, tetapi fallback-nya tidak konsisten dan beberapa path akan fetch data lalu menampilkan drawer kosong.
4. Role `KASIR` tidak punya permission Antrian Admisi maupun Rawat Jalan, tetapi secara UI tetap melihat trigger drawer di header.
5. Chain backend panggilan antrian hanya dilindungi token, belum terlihat enforcement permission action seperti `PANGGIL`, `LEWATI`, `PROSSES`, `SELESAI`.

## Scope audit

Fitur yang diaudit:

| Area | Lokasi | Catatan |
|---|---|---|
| Trigger drawer | `frontend-service/src/components/section/Header.vue` | Ikon megaphone membuka drawer. |
| Ikon bell | `frontend-service/src/components/section/Header.vue` | Hanya render asset `Bell Notification.svg` dan `notif.svg`. |
| Drawer panggilan | `frontend-service/src/components/section/Header.vue` | Tabs Aktif, Terlewat, Selesai. |
| Card panggilan Admisi | `frontend-service/src/components/Base/CardPanggilanAdmisi.vue` | Tombol Panggil, Lewati, Proses, Selesai. |
| Card panggilan Pelayanan | `frontend-service/src/components/Base/CardPanggilanPelayanan.vue` | Tombol Panggil, Lewati, Proses, Selesai. |
| Store drawer Admisi | `frontend-service/src/stores/antrian/antrianCall.ts` | API ke `admisi-service`. |
| Store drawer Rawat Jalan | `frontend-service/src/stores/rawatJalan/laporanrajal.ts` | API ke `rawat-jalan-service`. |
| Backend penghubung Admisi | `admisi-service/src/controllers/antrian-call-controller.js` | Proxy ke `antrian-service`. |
| Backend penghubung Rawat Jalan | `rawat-jalan-service/src/controllers/antrian_rj-controller.js` | Proxy ke `antrian-service`. |
| Backend data antrian pusat | `antrian-service/src/routes/admisi-antrian.route.js` | Sumber data queue lintas pelayanan. |

## Frontend

### Header dan trigger

Source utama: `frontend-service/src/components/section/Header.vue`.

Di header ada dua ikon yang relevan:

- SVG megaphone dengan `@click="toggleCardPanggilan"`.
- Gambar `Bell Notification.svg` dengan badge `notif.svg`.

Temuan:

- Hanya megaphone yang punya click handler.
- Ikon bell tidak punya `@click`, tidak terhubung ke dialog, drawer, route, store, atau composable apa pun.
- Pencarian lintas repo untuk `notification`, `notifications`, atau `notifikasi` tidak menemukan backend/service notifikasi; referensi `notif` yang terlihat hanya asset `notif.svg` di header.

Kesimpulan:

- Notifikasi umum berbasis bell belum dibangun atau belum dihubungkan.
- Yang aktif sekarang adalah fitur panggilan antrian.

### Drawer `Panggilan Antrian`

Drawer berada di `Header.vue` dan dibuka dari state `isCardPanggilanVisible`.

Isi drawer:

| Tab | Filter status |
|---|---|
| Aktif | `statusPanggilan` dalam `[0,1,3]` |
| Terlewat | `statusPanggilan === 2` |
| Selesai | `statusPanggilan === 4` |

Action tombol yang dipicu dari card:

- `Panggil` -> status `1`
- `Lewati` -> status `2`
- `Proses` -> status `3`
- `Selesai` -> status `4`

Temuan drawer:

- Drawer muncul di header global, bukan di menu spesifik.
- Trigger drawer tidak disembunyikan berdasarkan module, role, atau permission action.
- Tidak ada unread counter, timestamp, grouping, atau list notifikasi umum; drawer ini murni kontrol status antrian.

### Routing store berdasarkan halaman

`Header.vue` memakai `getCurrentStore`:

- Jika path mengandung `/admisi` -> `useAntrianCallStore`
- Jika path mengandung `/rawat-jalan`, `/rawat-inap`, atau `/igd` -> `useRJStore`
- Selain itu -> fallback ke `useAntrianCallStore`

Namun template render card hanya:

- `v-if route.path.includes('/admisi')` -> render `CardPanggilanAdmisi`
- `v-else-if route.path.includes('/rawat-jalan')` -> render `CardPanggilanPelayanan`

Defect yang muncul dari kombinasi ini:

| Kasus | Store yang dipakai | Card yang dirender | Dampak |
|---|---|---|---|
| Halaman Admisi | Store Admisi | Card Admisi | Sesuai. |
| Halaman Rawat Jalan | Store RJ | Card Pelayanan | Sesuai. |
| Halaman Rawat Inap | Store RJ | Tidak ada | Fetch terjadi, drawer kosong. |
| Halaman IGD | Store RJ | Tidak ada | Fetch terjadi, drawer kosong. |
| Halaman Farmasi, Pembayaran, Inventory, Datamaster, dll | Store Admisi | Tidak ada | Fetch Admisi terjadi, drawer kosong. |

Ini berarti notifikasi/panggilan:

- tidak kontekstual per menu,
- tidak konsisten dengan UI yang ditampilkan,
- dan bisa melakukan fetch ke backend walaupun user sedang berada di modul yang tidak terkait.

### Card komponen

Source:

- `frontend-service/src/components/Base/CardPanggilanAdmisi.vue`
- `frontend-service/src/components/Base/CardPanggilanPelayanan.vue`

Temuan:

- Kedua card mendukung aksi penuh `panggil`, `lewati`, `proses`, `selesai`.
- Card selesai khusus `CardPanggilanSelesai.vue` ada, tetapi tidak dipakai di header aktif.
- Komponen icon `BellNotificationIcon.vue` ada, tetapi header justru memakai file gambar `Bell Notification.svg`.

## Store dan API frontend

### Store Admisi

Source: `frontend-service/src/stores/antrian/antrianCall.ts`.

API:

- `GET /antrian-call`
- `PUT /antrian-call/:uuid`

Base yang dipakai:

- `apiAdmisiGet`
- `apiAdmisiPut`

### Store Rawat Jalan

Source: `frontend-service/src/stores/rawatJalan/laporanrajal.ts`.

API:

- `GET /antrian-call`
- `PUT /antrian-call/:uuid`

Base yang dipakai:

- `apiRawatJalanGet`
- `apiRawatJalanPut`

Temuan store:

- Tidak ada store khusus notifikasi umum.
- Tidak ada state unread, read/unread, ack, dismiss, atau kategori notifikasi.
- Nama store `laporanrajal.ts` dipakai juga untuk drawer panggilan, jadi concern laporan dan queue bercampur di file yang sama.

## Backend

### Arsitektur chain

Alur backend panggilan:

1. Frontend header memanggil `admisi-service` atau `rawat-jalan-service`.
2. Kedua service itu bertindak sebagai proxy/controller action untuk panggilan.
3. Data queue sebenarnya berada di `antrian-service` melalui resource `/admisi-antrian`.

#### Admisi service

Source:

- `admisi-service/src/controllers/antrian-call-controller.js`
- `admisi-service/src/services/antrian-call-service.js`
- `admisi-service/src/repositories/antrian-call-repository.js`

Perilaku:

- `GET /antrian-call` mengambil data dari `antrian-service /admisi-antrian/all`
- lalu memfilter `pelayanan == "admisi"`
- lalu membatasi hanya antrian hari ini
- sort berdasarkan `no_antrian_admisi`

Saat update status menjadi `4`:

- admisi-service otomatis membuat queue baru dengan `pelayanan: "poli"`

#### Rawat Jalan service

Source:

- `rawat-jalan-service/src/controllers/antrian_rj-controller.js`
- `rawat-jalan-service/src/services/antrian_rj-service.js`
- `rawat-jalan-service/src/repositories/antrian_rj-repository.js`

Perilaku:

- `GET /antrian-call` mengambil data dari `antrian-service /admisi-antrian/all`
- lalu memfilter `pelayanan == "poli"`
- lalu membatasi hanya antrian hari ini
- sort berdasarkan `no_antrian_poli`

Saat update status menjadi `4`:

- rawat-jalan-service otomatis membuat queue baru dengan `pelayanan: "farmasi"`
- sekaligus update `statusRj` dan `tanggalPeriksa`

#### Antrian service

Source:

- `antrian-service/src/models/antrian.model.js`
- `antrian-service/src/routes/admisi-antrian.route.js`
- `antrian-service/src/services/admisi-antrian.service.js`
- `antrian-service/src/repositories/admisi-antrian.repository.js`

Fakta utama:

- Tabel pusat yang dipakai adalah tabel `antrian`.
- Endpoint sumber data adalah `/api/v3/antrian/admisi-antrian`.
- Resource ini menyimpan `faskes_uuid`, `patient_uuid`, `rawat_jalan_uuid`, `status_panggilan`, `pelayanan`, `jenis_pasien`, dan `pasien_baru`.

### Auth dan permission chain

Temuan backend auth:

- `antrian-service` memakai `authorizationSdk([])` untuk endpoint non-mobile.
- `rawat-jalan-service` memakai `authorizationMiddleware` yang hanya memverifikasi token.
- `admisi-service` route `antrian-call` diexpose langsung pada router service; dari audit sebelumnya pola yang dipakai juga token check, bukan action permission.
- Tidak terlihat `permissionSdk`/permission middleware khusus untuk aksi panggil, lewati, proses, atau selesai di chain ini.

Implikasi:

- user bertoken valid berpotensi mengeksekusi action panggilan bila endpoint diketahui,
- terutama bila UI header tetap membuka akses trigger drawer pada role yang tidak semestinya.

## Role, permission, tenant

### Permission yang relevan

Permission registry yang ada:

| Module | Submodule | Allows |
|---|---|---|
| Admisi | Antrian | `PANGGIL`, `LEWATI`, `PROSSES`, `SELESAI`, `CHECKIN` |
| Rawat Jalan | Antrian | `PANGGIL`, `LEWATI`, `PROSSES`, `SELESAI` |
| Farmasi | Panggil Antrian | `PANGGIL`, `LEWATI`, `VERIFIKASI`, `PENYERAHAN OBAT` |

Tetapi implementasi header saat ini:

- tidak membaca permission tersebut,
- tidak membedakan action per module,
- dan tidak punya branch khusus Farmasi walaupun permission `Panggil Antrian` ada di registry.

### Role lokal

Verifikasi role lokal untuk permission yang relevan:

| Scope | Role | Admisi > Antrian | Rawat Jalan > Antrian |
|---|---|---|---|
| Global | super admin | ada | ada |
| Klinik Contoh | admin | ada | ada |
| Klinik Contoh | KASIR | tidak ada | tidak ada |
| Klinik Sehat | Admin | ada | ada |

Implikasi:

- role `KASIR` tidak punya hak untuk aksi panggilan antrian Admisi maupun Rawat Jalan,
- tetapi UI header tetap memperlihatkan trigger drawer lintas aplikasi,
- dan fallback `getCurrentStore` pada halaman non-pelayanan masih bisa mengarah ke store Admisi.

### Tenant/faskes

Data queue pusat di tabel `antrian`:

| Faskes | Pelayanan | Status | Total |
|---|---|---|---:|
| Klinik Contoh | admisi | `0` | 488 |
| Klinik Contoh | admisi | `1` | 16 |
| Klinik Contoh | admisi | `2` | 22 |
| Klinik Contoh | admisi | `3` | 1 |
| Klinik Contoh | admisi | `4` | 27 |
| Klinik Contoh | poli | `0` | 237 |
| Klinik Contoh | poli | `1` | 7 |
| Klinik Contoh | poli | `2` | 1 |
| Klinik Contoh | poli | `4` | 40 |
| Klinik Contoh | farmasi | `0` | 18 |
| Klinik Contoh | farmasi | `null` | 20 |
| Klinik Contoh | rajal | `0` | 2 |
| Klinik Sehat | admisi | `0` | 41 |
| Klinik Sehat | poli | `0` | 20 |

Catatan tenant:

- data queue sudah tenant-scoped melalui `faskes_uuid`,
- tetapi UI header tidak memberi indikasi tenant/context ketika drawer dibuka,
- dan jika super admin switch tenant, drawer akan mengikuti token aktif tanpa ada label tenant pada drawer.

Catatan data:

- Ada data `pelayanan = "farmasi"` dan `pelayanan = "rajal"` di tabel pusat, sementara drawer header hanya mengenal render Admisi dan Rawat Jalan.
- Ada baris Farmasi dengan `status_panggilan = null`, yang berpotensi tidak pernah masuk ke tab mana pun di frontend.

## Temuan

| Severity | Temuan | Dampak |
|---|---|---|
| P0 | Ikon bell belum memiliki flow apa pun; hanya asset statis di header. | User mengira ada notifikasi umum, padahal fitur belum ada. |
| P0 | Trigger drawer panggilan tampil global di header tanpa filter role/permission. | Role seperti `KASIR` tetap melihat akses UI ke aksi panggilan yang bukan haknya. |
| P0 | Halaman non-Admisi/Rawat Jalan tetap bisa fetch data queue lewat fallback store, tetapi drawer tidak merender card. | Fetch sia-sia, perilaku membingungkan, dan indikasi desain fitur belum kontekstual. |
| P1 | Rawat Inap dan IGD diarahkan ke store Rawat Jalan, tetapi template header hanya merender card untuk path `/rawat-jalan`. | Di Rawat Inap/IGD drawer akan kosong walaupun request backend jalan. |
| P1 | Tidak ada branch khusus Farmasi di header, padahal permission `Panggil Antrian` dan data `pelayanan=farmasi` ada. | Queue Farmasi tidak punya UI header yang sesuai. |
| P1 | Chain backend panggilan antrian belum terlihat memakai permission enforcement action-level. | User bertoken valid berpotensi memanggil endpoint aksi panggilan bila endpoint diketahui. |
| P1 | Store panggilan Rawat Jalan bercampur dengan file store laporan (`laporanrajal.ts`). | Concern feature bercampur dan memperbesar risiko regresi saat revamp. |
| P2 | Badge `notif.svg` selalu statis dan tidak merefleksikan unread count. | Visual affordance menipu dan sulit dipahami user. |
| P2 | Komponen `BellNotificationIcon.vue` dan `CardPanggilanSelesai.vue` ada, tetapi tidak dipakai di flow utama. | Menambah noise dan potensi dead code. |

## Rekomendasi

1. Pisahkan dengan tegas dua fitur ini:
   - `Notifikasi umum` untuk bell
   - `Panggilan antrian` untuk drawer operasional
2. Jika bell belum siap, sembunyikan dulu badge/ikon interaktif palsunya atau hubungkan ke empty state yang jelas.
3. Batasi trigger drawer panggilan berdasarkan route context dan permission efektif user.
4. Pisahkan drawer per domain pelayanan:
   - Admisi
   - Rawat Jalan
   - Rawat Inap atau IGD jika memang memakai queue yang sama
   - Farmasi bila memang perlu panggilan di header
5. Tambahkan permission enforcement end-to-end untuk action `PANGGIL`, `LEWATI`, `PROSSES`, `SELESAI`.
6. Tambahkan label context pada drawer, misalnya tenant aktif dan jenis layanan yang sedang dikontrol.
7. Rapikan store agar queue operasional tidak bercampur dengan laporan.
8. Putuskan apakah queue Farmasi tetap memakai header global, menu Farmasi sendiri, atau layar antrian khusus.

## Pertanyaan terbuka

1. Apakah user memang mengharapkan "notifikasi" sebagai bell center, atau sebenarnya hanya butuh drawer `Panggilan Antrian`?
2. Apakah drawer panggilan seharusnya muncul hanya di modul pelayanan yang relevan, bukan di seluruh aplikasi?
3. Apakah Rawat Inap dan IGD memang harus memakai queue yang sama dengan Rawat Jalan, atau masing-masing perlu store/card sendiri?
4. Apakah Farmasi perlu ikut masuk ke drawer header, mengingat permission dan data queue Farmasi sudah ada di backend?
