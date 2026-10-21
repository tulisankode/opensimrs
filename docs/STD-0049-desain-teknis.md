# STD-0049 — Tindak Lanjut Audit Dashboard

Enam temuan audit cepat pada halaman `/dashboard` diverifikasi terhadap kode sebelum diubah. Tabel di bawah mencatat status akhir setelah implementasi, sebagai bukti bahwa perubahan hanya menyasar temuan yang terbukti.

## Status enam temuan

| # | Temuan | Status akhir | Bukti & tindak lanjut |
|---|---|---|---|
| 1 | Izin rute `/dashboard` tidak ada di `permissionRouteRegistry` | **Terbukti, diperbaiki** | `frontend-service/src/utils/permissions.ts`: entri `{ path: "/dashboard", permission: read("Dashboard") }` ditambahkan (izin dasar modul Dashboard, tanpa submodul). Rute didaftarkan via `halamanModul(DashboardView, [...])` di `router/index.ts`. Backend: delapan endpoint `/dashboard/rekap*` kini dilindungi `wajibIzin("Dashboard", null, "READ")`. |
| 2 | Query `laporan-service/src/helpers/izin.js` tanpa isolasi faskes (mencari berdasarkan `username`) | **Terbukti sebagai kelemahan pemilihan identitas** | `username` tidak unik secara global (`packages/model-sdk/models/datamaster/user-model.js`). Diganti: pencarian memakai `uuid = req.author.user_uuid` dan, untuk akun biasa, `faskes_uuid = req.author.faskesUuid` dari token — bukan dari masukan klien. Super admin (dapat berpindah faskes, lihat `auth-service/src/services/authentication-service.js`) dicari dari UUID token saja. Akun tidak ditemukan/terhapus selalu ditolak, tidak pernah diperlakukan sebagai "akun sah berizin kosong". Tidak ada bukti akses lintas faskes sudah terjadi; perbaikan bersifat pencegahan atas pola identitas yang rapuh. |
| 3 | Dashboard memakai `PageToolbar`/`h1.toolbar-heading` | **Tidak sesuai kode asal, kini diperbaiki** | `DashboardView.vue` sebelumnya memakai judul `<div>` biasa. Konten dipindah ke `DashboardPage.vue` baru yang memakai `PageToolbar` + `<h1 class="toolbar-heading text-opensimrs-300">Dashboard</h1>` + tombol muat ulang (`CustomButton icon="PhArrowClockwise"`), mengikuti pola `views/Ccu/DashboardCcuPage.vue`. `DashboardView.vue` menjadi wadah bersidebar (`Sidebar` + `$route.meta.page`). |
| 4 | Dashboard dibungkus `Card` PrimeVue | **Tidak sesuai kode asal, kini diperbaiki** | `DashboardPage.vue` membungkus seluruh konten dengan `Card` (header = `PageToolbar`, content = ringkasan & grafik), sama seperti butir di atas. |
| 5 | Waktu milidetik (`Date.now()`) pada helper izin | **Tidak relevan terhadap konvensi epoch detik tersimpan** | `Date.now()` hanya dipakai `laporan-service/src/helpers/tembolok-izin.js` untuk umur cache 60 detik di memori (jam dapat diinjeksi untuk pengujian). Tidak ada nilai milidetik yang ditulis ke basis data atau dikirim sebagai respons API. Dipertahankan apa adanya. |
| 6 | UUID literal pada `datamaster-service/src/controllers/faskes-controller.js` (`getAllForPatient`) | **Terbukti pada endpoint terdaftar (`GET /mobile/patient`)** | Diganti: controller memanggil `FaskesService.getActiveForPatient(req.author.faskesUuid)`, mengambil paling banyak satu faskes (faskes aktif pada token, bukan dua entri tetap sama untuk semua pemanggil). Penelusuran `frontend-service/src` tidak menemukan pemanggil endpoint ini; perubahan jumlah entri (2 tetap → ≤1 dari token) perlu diperhatikan pemilik klien mobile bila ada. |

## Ringkasan perubahan backend

- **laporan-service**: `helpers/izin.js` menyediakan `buatPembacaIzin(jalankanQuery, tembolok)` dengan dependensi pengganti untuk pengujian dan `helpers/tembolok-izin.js` (cache terpisah per `(user_uuid, faskes_uuid, superadmin)`). `helpers/cocok-izin.js` menambah cabang: modul ditemukan + submodul tidak diminta → izin diberikan. `routes/dashboard-routes.js` memasang `izinDashboard` pada delapan endpoint rekap. `controllers/dashboard-controller.js`: `console.log(author)` dihapus.
- **datamaster-service**: `repositories/faskes-repository.js` menambah `findActiveProfileForPatient(faskesUuid)` (faskes aktif, profil & alamat tidak terhapus). `services/faskes-service.js` menambah `getActiveForPatient` + `petakanFaskesUntukPasien` (fungsi murni, dapat diuji tanpa basis data). `controllers/faskes-controller.js`: `getAllForPatient` memakai `req.author.faskesUuid`, menolak 401 (`payload: null`) bila konteks faskes tidak ada.

## Migrasi, katalog, dan izin

Tidak ada migrasi baru, perubahan skema, perubahan katalog modul/fitur, atau perubahan `permission-list.js` — izin dasar `dashboardPermission = { module: "Dashboard", subModules: [] }` sudah ada sebelumnya di `auth-service/src/helpers/permission-list.js`. `npm run docs:katalog` dijalankan pada tahap coding: tidak ada perubahan dokumentasi (katalog tidak berubah).

## Verifikasi yang dijalankan

- `node --check` pada seluruh berkas JavaScript dan MJS yang diubah atau ditambahkan, termasuk pengujian.
- `npm --prefix laporan-service test -- --test-isolation=none`: 53 uji lulus, termasuk Command Center, Eksekutif, dan 14 uji Dashboard.
- `npm --prefix datamaster-service test` (skrip `test` diubah menjadi `node --test test/*.test.js`, sejalan dengan konvensi layanan lain): 7 uji lulus.
- `node --test --test-isolation=none frontend-service/test/dashboard-izin.test.mjs frontend-service/test/dashboard-page.test.mjs frontend-service/test/penggajian-izin.test.mjs`: 10 uji lulus. Pengujian halaman mengompilasi skrip dan templat Dashboard, serta memeriksa periode terbalik, hasil nol, galat, dan respons yang datang terlambat.
- `npm run docs:katalog`: tidak ada perubahan dokumentasi hasil generator.
- `git diff --check` dan pemeriksaan pola parameter SQL yang menempel pada operator: tidak ada temuan.

## Keterbatasan verifikasi

- Tidak dijalankan server, migrasi, atau koneksi basis data/Redis sungguhan sesuai batasan item ini.
- Pemanggilan awal `node --test` terhalang `spawn EPERM`; pengujian terarah dijalankan dengan `--test-isolation=none`. Dependensi konfigurasi laporan diganti sebelum impor; pengujian Data Master menjalankan kode sumber dengan dependensi pengganti tanpa mengimpor model atau konfigurasi layanan.
- `npm --prefix frontend-service test -- --test-isolation=none` gagal karena suite lama merujuk `src/views/Picu/PicuPage.vue` yang tidak tersedia. Berkas itu berada di luar cakupan item.
- Skrip `test` lama `datamaster-service` (`mocha --exit tests/*`) menjalankan `tests/server.test.js` peninggalan rilis awal yang memakai `require()` di konteks modul ES dan tidak terkait item ini; skrip diganti `node --test test/*.test.js` agar mengarah ke pengujian baru dan sejalan dengan konvensi layanan lain. Berkas `tests/server.test.js` dibiarkan apa adanya karena di luar cakupan item ini.
- `node node_modules/vue-tsc/bin/vue-tsc.js --build --force` telah dijalankan dari `frontend-service`, tetapi gagal dengan TS1005 pada 47 komponen ikon yang tidak diubah, antara lain `AddPrint.vue` dan `AnnouncementIcon.vue`.
- `node node_modules/vite/bin/vite.js build --config test/vite-tanpa-env.config.mjs` gagal saat esbuild membuat proses anak (`spawn EPERM`). Konfigurasi ini memakai `envDir: false`; build penuh belum dapat diverifikasi.
- Pengujian manual di peramban (login, navigasi sidebar Dashboard, tombol muat ulang, validasi periode, kondisi kosong/gagal) belum dilakukan pada sesi ini dan perlu dilakukan sebelum rilis.

## Kontrak dan dampak kompatibilitas

Delapan endpoint rekap tetap memakai metode GET dan bentuk respons sukses yang sama. Identitas akun atau faskes yang tidak lengkap menghasilkan 401 dengan `message: "Konteks autentikasi tidak lengkap"` dan `payload: null`; akun di luar cakupan atau tanpa izin menghasilkan 403 dengan `message: "Akses Dashboard ditolak"` dan `payload: null`. Galat query diteruskan ke penanganan galat layanan, tanpa memakai cache kedaluwarsa. Query data rekap tetap menggunakan faskes token dan kondisi soft delete yang sudah ada.

`GET /api/v3/datamaster/mobile/patient` mempertahankan daftar dengan properti `uuid`, `name`, `distance`, `address`, `phone`, dan `image`. Daftar kini memuat paling banyak satu faskes aktif token; `distance` selalu `null`. Profil serta alamat wajib berada pada faskes yang sama dan tidak terhapus. Faskes tidak aktif/terhapus menghasilkan daftar kosong; konteks faskes kosong menghasilkan 401 dengan `payload: null`. Pemilik klien seluler perlu memeriksa kompatibilitas jumlah entri serta nilai jarak yang kosong.

Halaman ringkasan menolak periode terbalik, menampilkan keadaan memuat, menutup hasil lama saat permintaan gagal, dan mengabaikan respons periode terdahulu. Nilai nol tetap sah; bagian rincian kosong memakai `NoData`.
