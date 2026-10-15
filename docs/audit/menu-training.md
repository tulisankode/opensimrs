# Audit Menu Training

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Training berada setelah Inventory pada router utama. Frontend utama berada di `frontend-service/src/views/Training`. Tidak ditemukan folder store khusus Training di `frontend-service/src/stores`, tidak ditemukan service backend khusus seperti `training-service`, dan tidak ditemukan tabel database `training`/`kelas` khusus untuk menu ini pada hasil scan schema. Menu ini saat ini tampak sebagai UI/stub.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Daftar Kelas | `/training/daftar-kelas` | Daftar peserta/kunjungan kelas training. |
| Booking Kelas | `/training/booking-kelas` | Booking jadwal kelas. |
| Datamaster > Kelas | `/training/datamaster/kelas` | Master kelas/sesi. |
| Laporan | `/training/laporan/rekapitulasi` | Rekapitulasi kunjungan kelas training. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Training dimulai di sekitar `frontend-service/src/router/index.ts:1545`.

| Route | Component/page | Catatan |
|---|---|---|
| `/training` | redirect | Redirect ke `/training/daftar-kelas`. |
| `/training/daftar-kelas` | `TrainingView` + `DaftarKelasPage` | `requiresAuth: true`. |
| `/training/booking-kelas` | `TrainingView` + `BookingKelasPage` | `requiresAuth: true`. |
| `/training/datamaster/kelas` | `TrainingView` + `SectionKelas` | `requiresAuth: true`. |
| `/training/laporan/rekapitulasi` | `TrainingView` + `SectionRekapitulasi` | `requiresAuth: true`. |

Guard global hanya memeriksa `access_token`; belum ada permission route-level.

### Sidebar

Source: `frontend-service/src/views/Training/TrainingView.vue`.

Sidebar dibuat statis:

- Daftar Kelas
- Booking Kelas
- Datamaster > Kelas
- Laporan > Rekapitulasi Kunjungan Kelas Training

Temuan sidebar:

- Sidebar belum difilter berdasarkan permission submodule/feature.
- `showFilterPoli` aktif dan state default adalah `Semua Poli`, padahal menu Training tidak berbasis poli.
- Jika route punya `query.filter`, `onMounted` melakukan redirect ke `/rawat-jalan/poli`. Ini copy-paste bug dari Rawat Jalan dan bisa membawa user keluar dari menu Training.
- `showStockBtn` aktif di sidebar Training; perlu dikonfirmasi apakah memang dibutuhkan.

### Halaman dan Data

Tidak ditemukan import API handler pada `frontend-service/src/views/Training`. Banyak halaman memakai data statis:

| Page | Bukti | Catatan |
|---|---|---|
| `DaftarKelas/DaftarKelasPage.vue` | `itemsPasien = ref([...])` | Data peserta dummy. |
| `BookingKelas/BookingKelasPage.vue` | `itemsPasien = ref([...])` | Data booking dummy. |
| `BookingKelas/CariJadwal.vue` | `bookPayload = ref([...])` | Jadwal kelas dummy. |
| `Datamaster/SectionKelas.vue` | `kelasPayload = ref([...])` | Master kelas dummy. |
| `Laporan/SectionRekapitulasi.vue` | `transaksiKelasPayload = ref([...])` | Laporan dummy. |
| `Layout/HeaderFilterTraining.vue` | `kelasOption = ref(["Zumba", "Gym", "Pilates"])` | Filter kelas hardcoded. |

Dengan kondisi saat ini, menu Training dapat terlihat interaktif, tetapi belum terbukti menyimpan/mengambil data dari backend.

## Backend/API

Tidak ditemukan service root khusus Training.

Hasil scan schema database untuk kata kunci `training`/`kelas` tidak menemukan tabel khusus menu Training. Kemunculan kata `kelas` di database saat ini lebih banyak terkait `kelas_ruangan` pada ruangan/rawat inap, bukan kelas training.

Artinya belum ada kontrak API produksi yang jelas untuk:

- daftar kelas;
- booking kelas;
- master kelas/sesi;
- laporan kunjungan kelas training;
- cancel booking/daftar;
- export/import kelas.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:793`
- `frontend-service/src/stores/datamaster/permission.ts`

Definisi permission Training:

| Submodule/feature | Allows |
|---|---|
| Daftar Kelas | `READ`, `CREATE DAFTAR KELAS`, `BATAL DAFTAR` |
| Booking Kelas | `READ`, `CREATE BOOKING`, `UPDATE BOOKING`, `BATAL BOOKING`, `DAFTAR` |
| Datamaster | `READ`, `CREATE`, `UPDATE`, `DELETE`, `IMPORT KELAS`, `EKSPOR KELAS` |
| Laporan | `READ` |

Mismatches:

- Permission `Datamaster` tidak memiliki feature `Kelas`; sidebar menampilkan `Datamaster > Kelas`.
- Allow memakai `EKSPOR KELAS`, sementara menu lain umumnya memakai `EXPORT`.
- Laporan hanya `READ`; sidebar/laporan kemungkinan nanti perlu `CETAK LAPORAN` jika ada export/print.

Data role lokal:

| Scope | Role | Training |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Karena sidebar tidak difilter permission, role tanpa module Training perlu dicek apakah menu masih tampil dari header/top nav.

## Tenant/Faskes

Data lokal:

| Entitas | Count |
|---|---:|
| Faskes aktif | 2 |
| Role aktif | 4 |
| User aktif | 21 |

Distribusi data Training lokal:

| Entitas | Status |
|---|---|
| Tabel Training/kelas khusus | Tidak ditemukan dari scan schema. |
| Store/API Training | Tidak ditemukan. |
| Service Training | Tidak ditemukan. |

Catatan tenant:

- Belum ada bukti isolasi tenant untuk Training karena belum ada tabel/service yang jelas.
- Role `Admin` Klinik Sehat memiliki permission Training, tetapi belum ada data Training untuk diverifikasi.
- Saat backend nanti dibuat, semua tabel transaksi/master Training perlu `faskes_uuid` dan semua query list/report perlu filter dari token.

## Defect Prioritas

| Prioritas | Defect | Dampak |
|---|---|---|
| P0 | Training belum tersambung ke store/API/backend produksi; data masih dummy. | Menu tidak bisa dipakai sebagai fitur nyata. |
| P1 | `TrainingView.vue` memakai `showFilterPoli`, default `Semua Poli`, dan redirect query filter ke `/rawat-jalan/poli`. | User bisa terseret keluar menu Training dan filter domain salah. |
| P1 | Permission sidebar/action belum diterapkan. | Role tanpa akses bisa melihat menu/aksi. |
| P1 | Tidak ada model/tabel/service Training yang ditemukan. | Belum ada persistensi dan tenant isolation. |
| P2 | Permission Datamaster Training belum punya feature `Kelas`, dan istilah `EKSPOR` tidak konsisten dengan `EXPORT`. | Mapping permission akan rapuh saat guard dipasang. |
| P2 | `showStockBtn` aktif di menu Training. | UI menampilkan aksi stok yang mungkin tidak relevan. |

## Rekomendasi Bertahap

1. Tentukan apakah Training memang masuk scope produk. Jika iya, definisikan kontrak backend dulu: kelas, sesi, booking, daftar, laporan.
2. Buat store khusus Training dan ganti semua `ref([...])` dummy dengan API.
3. Hilangkan copy-paste Rawat Jalan: `showFilterPoli`, default `Semua Poli`, dan redirect `/rawat-jalan/poli`.
4. Rapikan permission menjadi `Datamaster > Kelas`, normalisasi `EXPORT`, dan tambahkan action cetak/export laporan bila dibutuhkan.
5. Tambahkan `faskes_uuid` pada semua tabel Training dan pastikan query tenant-safe.
