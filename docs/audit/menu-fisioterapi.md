# Audit Menu Fisioterapi

Tanggal audit: 2026-05-14  
Status: Draft v1 selesai

## Ringkasan

Menu Fisioterapi berada setelah IGD pada router utama. Frontend utama berada di `frontend-service/src/views/Fisioterapi`. Tidak ditemukan folder store khusus Fisioterapi di `frontend-service/src/stores`, dan tidak ditemukan service backend khusus seperti `fisioterapi-service` pada root project. Ada tabel database `order_fisio`, tetapi data lokalnya masih kosong.

Submenu yang terlihat di sidebar:

| Submenu | Route utama | Fungsi |
|---|---|---|
| Order Fisioterapi | `/fisioterapi/order-fisioterapi` | Daftar/order pasien fisioterapi, tindakan, buka RM. |
| Penjadwalan Terapi | `/fisioterapi/penjadwalan-fisioterapi` | Penjadwalan terapi dan bed/jam/petugas. |
| Evaluasi Terapi | `/fisioterapi/evaluasi-terapi` | Evaluasi terapi pasien. |
| Booking Terapi | `/fisioterapi/booking-terapi` | Booking jadwal terapi. |
| Datamaster > Bed Ruangan | `/fisioterapi/datamaster/bed-ruangan` | Master bed/ruangan terapi. |
| Laporan | `/fisioterapi/laporan/*` | Kunjungan, rekap kunjungan jenis, rekap terapi, rekap pendapatan. |

## Frontend

### Route

Source: `frontend-service/src/router/index.ts`.

Route Fisioterapi dimulai di sekitar `frontend-service/src/router/index.ts:1302`.

| Route | Component/page | Catatan |
|---|---|---|
| `/fisioterapi` | redirect | Redirect ke `/fisioterapi/order-fisioterapi`. |
| `/fisioterapi/order-fisioterapi` | `FisioterapiView` + `DoctorPrescriptionPage` | Duplikat route pertama; page salah karena memakai halaman Farmasi. |
| `/fisioterapi/datamaster/bed-ruangan` | `FisioterapiView` + `BedRuanganPage` | `requiresAuth: true`. |
| `/fisioterapi/order-fisioterapi` | `FisioterapiView` + `OrderFisioterapiPage` | Duplikat path dan name yang sama; ini kandidat bug router. |
| `/fisioterapi/penjadwalan-fisioterapi` | `PenjadwalanTerapiPage` | `requiresAuth: true`. |
| `/fisioterapi/evaluasi-terapi` | `EvaluasiTerapiPage` | `requiresAuth: true`. |
| `/fisioterapi/booking-terapi` | `BookingTerapiPage` | `requiresAuth: true`. |
| `/fisioterapi/laporan/kunjungan` | `KunjunganPage` | `requiresAuth: true`. |
| `/fisioterapi/laporan/rekapitulasi-kunjungan-jenis-fisioterapi` | `RekapitulasiKunjunganJenisFisioterapiPage` | `requiresAuth: true`. |
| `/fisioterapi/laporan/rekapitulasi-terapi` | `RekapitulasiTerapiPage` | `requiresAuth: true`. |
| `/fisioterapi/laporan/rekapitulasi-pendapatan-fisioterapi` | `RekapitulasiPendapatanFisioterapiPage` | `requiresAuth: true`. |

Temuan route:

- Ada dua route dengan path dan name sama: `/fisioterapi/order-fisioterapi` dan `fisioterapi-order-fisioterapi`.
- Route pertama memakai `DoctorPrescriptionPage` dari Farmasi. Route kedua memakai `OrderFisioterapiPage`. Ini bisa memicu warning/override di Vue Router dan membuat halaman yang terbuka tidak deterministik saat maintenance.

### Sidebar

Source: `frontend-service/src/views/Fisioterapi/FisioterapiView.vue`.

Sidebar dibuat statis:

- Order Fisioterapi
- Penjadwalan Terapi
- Evaluasi Terapi
- Booking Terapi
- Datamaster > Bed Ruangan
- Laporan > Kunjungan, Rekapitulasi Kunjungan Jenis Fisioterapi, Rekapitulasi Terapi, Rekapitulasi Pendapatan Fisioterapi

Temuan sidebar:

- Sidebar belum difilter berdasarkan permission submodule/feature.
- `showStockBtn` aktif di sidebar Fisioterapi; perlu dikonfirmasi kebutuhan stok dari menu ini.
- Sidebar memiliki laporan `Rekapitulasi Pendapatan Fisioterapi`, tetapi permission module Fisioterapi tidak memuat feature itu di `Laporan Fisio`; feature tersebut ada di module `Laporan` global.

### Halaman dan Data

Tidak ditemukan import API handler pada `frontend-service/src/views/Fisioterapi`. Banyak halaman memakai data statis:

| Page | Bukti | Catatan |
|---|---|---|
| `OrderFisioterapiPage.vue` | `itemsPasien = ref([...])`, `listTindakan = ref([...])` | Data pasien/tindakan dummy. |
| `PenjadwalanTerapiPage.vue` | `itemsPasien = ref([...])` | Data jadwal dummy. |
| `EvaluasiTerapiPage.vue` | `itemsPasien = ref([...])` | Data evaluasi dummy. |
| `BookingTerapiPage.vue` | `itemsPasien = ref([...])` | Data booking dummy. |
| `BedRuanganPage.vue` | `dataBedruangan = ref([...])` | Datamaster bed dummy. |
| `Report/*` | `reportData` atau `itemsPasien = ref([...])` | Laporan dummy. |

Temuan RME:

- `OrderFisioterapiPage.vue`, `EvaluasiTerapiPage.vue`, dan beberapa form membuka `<MedicalRecord ref="medicalRecord" :patientData="{}" />`.
- Komponen tersebut tidak mengirim `rmType="fisioterapi"` dan `patientData` masih `{}`.
- `MedicalRecord.vue` default `rmType` adalah `rawat-jalan`, sehingga dialog RM Fisioterapi berisiko terbuka sebagai Rawat Jalan.
- `MedicalRecord.vue` memetakan `props.rmType === 'fisioterapi'` menjadi `jenisKunjunganKey = 'fisio'` untuk API, tetapi `MedicalRecordDetail.vue` menampilkan komponen detail Fisioterapi dengan kondisi `rmType == 'fisio'`. Jika prop tetap `fisioterapi`, detail Fisioterapi tidak tampil; jika prop tidak dikirim, makin jatuh ke default Rawat Jalan.

## Backend/API

Tidak ditemukan service root khusus Fisioterapi. Direktori service yang relevan di root hanya:

- `farmasi-service`
- `lab-service`
- `stok-farmasi-service`

Database memiliki tabel:

```txt
order_fisio
```

Kolom penting `order_fisio` mencakup:

- `faskes_uuid`
- `no_order`, `no_reg`, `patient_uuid`, `no_rm`
- `rekam_medis_uuid`, `rekam_medis_pelayanan_uuid`
- `payment_method`, `pelayanan`, `lokasi_uuid`
- `dokter_pengirim_uuid`, `tanggal_terapi`, `jenis_fisio`
- `status_fisio`, `bed_ruangan_uuid`, `jam_terapi`, `petugas_fisio`
- field discharge/rujukan/instruksi

Tetapi tidak ditemukan route/service yang jelas memakai tabel ini dari menu Fisioterapi frontend saat audit ini.

## Role dan Permission

Permission master:

- `datamaster-service/src/helpers/permission-list.js:669`
- `frontend-service/src/stores/datamaster/permission.ts`

Definisi permission Fisioterapi:

| Submodule/feature | Allows |
|---|---|
| Order Fisioterapi | `READ`, `CREATE ORDER`, `CREATE TINDAKAN`, update assessment/rincian/profile, delete tindakan, batal order, rekam medis, validasi dokter, cetak label, riwayat. |
| Penjadwalan Terapi | `READ`, rekam medis, riwayat pemeriksaan, simpan dan mulai terapi. |
| Evaluasi Terapi | `READ`, `EVALUASI`. |
| Booking Terapi | `READ`, create/update/batal booking, daftar. |
| Datamaster > Bed Ruangan | CRUD/import/export. |
| Laporan Fisio | Kunjungan, Rekapitulasi Kunjungan Jenis Fisioterapi, Rekapitulasi Terapi. |
| RME | Rekam Medis, Assesmen, SOAPIER, Alkes dan Penunjang, Inform Consent, Unggah Berkas, Resume dan Discharge, Cetak Hasil dan Surat. |

Mismatches:

- Permission `Laporan Fisio` tidak memiliki `Rekapitulasi Pendapatan Fisioterapi`, padahal sidebar punya menu tersebut. Feature ini berada di `laporanPermission` global.
- Ada typo `ASSESMENT`/`Assesmen`; sebaiknya dinormalisasi menjadi `ASSESSMENT`/`Asesmen`.
- `SOAPIER` permission hanya berisi action obat plan, sementara UI Fisioterapi memakai implementation/evaluation/reassessment.
- `Alkes dan Penunjang` punya allow `ORDER ALKES CREATE OBAT MULTIPLE`, kemungkinan copy-paste dari Farmasi/RME.

Data role lokal:

| Scope | Role | Fisioterapi |
|---|---|---|
| Global/unknown | super admin | Ada |
| Klinik Contoh | admin | Ada |
| Klinik Contoh | KASIR | Tidak ada |
| Klinik Sehat | Admin | Ada |

Karena sidebar tidak difilter permission, role tanpa module Fisioterapi perlu dicek apakah menu masih tampil dari header/top nav.

## Tenant/Faskes

Data lokal:

| Entitas | Count |
|---|---:|
| Faskes aktif | 2 |
| Role aktif | 4 |
| User aktif | 21 |

Distribusi data Fisioterapi lokal:

| Table | Count |
|---|---:|
| `order_fisio` | 0 |

Catatan tenant:

- Tabel `order_fisio` sudah multi-tenant karena memiliki `faskes_uuid`, tetapi belum ada data lokal.
- Karena frontend masih dummy dan tidak ada service khusus yang ditemukan, isolasi tenant untuk Fisioterapi belum bisa divalidasi end-to-end.
- Role `Admin` Klinik Sehat memiliki permission Fisioterapi, tetapi tidak ada data `order_fisio` untuk diverifikasi.

## Defect Prioritas

| Prioritas | Defect | Dampak |
|---|---|---|
| P0 | Route `/fisioterapi/order-fisioterapi` terdaftar dua kali dengan name sama; salah satunya memakai `DoctorPrescriptionPage` Farmasi. | Halaman order Fisioterapi bisa salah render/warning router dan sulit dirawat. |
| P0 | Fisioterapi belum tersambung ke store/API produksi; banyak data masih `ref([...])`. | Menu terlihat jalan tetapi tidak memakai data backend. |
| P1 | MedicalRecord di halaman Fisioterapi tidak mengirim `rmType="fisioterapi"` dan `patientData` masih `{}`. | RME Fisioterapi bisa terbuka sebagai Rawat Jalan atau gagal memuat data pasien. |
| P1 | Mismatch `fisioterapi` vs `fisio` pada komponen MedicalRecord detail. | Form detail fisioterapi bisa tidak muncul. |
| P1 | Permission sidebar/action belum diterapkan. | Role tanpa akses bisa melihat menu/aksi. |
| P2 | Laporan Pendapatan Fisioterapi berada di permission global Laporan, bukan module Fisioterapi. | Mapping permission menu menjadi ambigu. |
| P2 | Typo/copy-paste permission RME Fisioterapi. | Menyulitkan guard action-level saat revamp. |

## Rekomendasi Bertahap

1. Bersihkan route duplikat dan pastikan `/fisioterapi/order-fisioterapi` hanya mengarah ke `OrderFisioterapiPage`.
2. Tentukan ownership backend Fisioterapi: service baru, masuk `rekamedis-service`, atau service lain. Setelah itu buat store khusus Fisioterapi.
3. Ganti data dummy dengan API minimal: list order, detail order, create/update/batal, jadwal, booking, bed, laporan.
4. Perbaiki integrasi RME: kirim `rmType="fisioterapi"`, `patientData` aktual, dan samakan key `fisioterapi`/`fisio`.
5. Rapikan permission laporan dan RME sebelum action-level guard dipasang.
