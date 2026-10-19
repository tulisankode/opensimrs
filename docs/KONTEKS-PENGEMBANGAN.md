# Konteks Pengembangan OpenSIMRS

> Panduan untuk developer yang meneruskan pengembangan OpenSIMRS: cara sistem disusun, konvensi yang dipakai, alur data utama, dan jebakan yang sudah diketahui.
> Arah produk dan daftar pekerjaan ada di [ROADMAP.md](./ROADMAP.md). Instalasi lengkap ada di [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md). Konsep & katalog modul ada di [MANAJEMEN-MODUL.md](./MANAJEMEN-MODUL.md). Etika kontribusi ada di [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 1. Gambaran singkat

OpenSIMRS adalah SIMRS berbasis microservice untuk fasilitas kesehatan Indonesia, dari praktik dokter mandiri sampai rumah sakit kelas A.

- Satu instalasi bisa melayani **banyak faskes**. Setiap data diisolasi dengan `faskes_uuid` yang diambil dari token login.
- Fitur yang tampil per faskes diatur oleh **Manajemen Modul** berdasarkan segmen faskes (lihat [bagian 5](#5-manajemen-modul)).
- Bahasa domain dan sebagian besar identifier kode memakai **Bahasa Indonesia** (`pasien`, `kunjungan`, `penjamin`, `tagihan`). Pertahankan konvensi ini supaya istilah konsisten dengan pengguna klinis.

---

## 2. Arsitektur

```
                   ┌──────────────────────────┐
                   │ frontend-service (Vue 3) │
                   └────────────┬─────────────┘
                                │ REST /api/v3/<layanan>/...
   ┌────────────┬───────────┬───┴───────┬────────────┬─────────────┐
   auth   admisi/antrian  rawat-jalan  rekamedis   farmasi/stok   payment ... (Express)
   └────────────┴───────────┴─────┬─────┴────────────┴─────────────┘
                                  │
        PostgreSQL (satu database bersama) · MongoDB (isi RME) · Redis (cache token & izin)
                                  │
             bpjs-service (PCare/VClaim) · satusehat-service (FHIR Kemenkes)
```

### Layanan

| Layanan | Tanggung jawab |
|---|---|
| `auth-service` | Login, JWT, pindah faskes (superadmin), cache izin di Redis |
| `admisi-service` | Data pasien, registrasi RJ/RI/IGD, penjamin pasien, monitoring kamar |
| `antrian-service` | Jadwal dokter, layar antrian & kiosk TV, APM |
| `rawat-jalan-service` | Antrian poli (panggil, mulai periksa), konteks petugas |
| `rawat-inap-service`, `igd-service` | Pelayanan rawat inap dan IGD |
| `rekamedis-service` | RME (MongoDB), tindakan, resume & discharge, tagihan layanan, tagihan kamar |
| `farmasi-service`, `stok-farmasi-service` | Resep, telaah & penyerahan obat, stok depo |
| `inventory-service` | Gudang, pembelian ke supplier, distribusi ke depo, opname |
| `lab-service` | Order, hasil & validasi lab (Patologi Klinik), tagihan lab, **bridging LIS** (kirim per order/bulk, tarik/terima hasil, mapping) |
| `penunjang-service` | Fisioterapi, Radiologi (+ bridging PACS/RIS), MCU, Patologi Anatomi (+ bridging LIS PA), Mikrobiologi (+ bridging LIS), Bank Darah/UTD, Hemodialisa (+ HDIS), CSSD, Gizi, Kamar Operasi, Koding RM, Mutu & Akreditasi, HR/SDM, Sarpras, Laundry, Ambulans, Kelas Training (port 8099, `/api/v3/penunjang`; satu folder `src/<modul>/` per modul) |
| `program-puskesmas-service` | Program Puskesmas: KIA/KB, imunisasi, MTBS, sasaran, UKM, laporan LB1 & dinkes (port 8100, `/api/v3/program-puskesmas`) |
| `payment-service` | Tagihan, kasir, shift, kuitansi |
| `datamaster-service` | Faskes, lokasi, pegawai, praktisi, tarif, role, dan datamaster lain |
| `setting-service` | Profil faskes, konfigurasi integrasi, cetak, **Manajemen Modul** |
| `laporan-service` | Laporan & rekap |
| `bpjs-service`, `satusehat-service` | Integrasi eksternal (ada langsung di repo root) |
| `studio-service` | SIMRS Studio, mode pengembang berbasis AI (port 8090, `/api/v3/studio`). Dijalankan langsung di mesin pengembang dan tidak ada di `docker-compose.yml`; aktif bila `STUDIO_PENGEMBANG=aktif`. Agen tidak boleh mengubah folder ini. Lihat [SIMRS-STUDIO.md](./SIMRS-STUDIO.md) |

Ada 20 layanan backend (19 layanan aplikasi + `studio-service`). Port masing-masing layanan ada di [tabel port Petunjuk Instalasi](./INSTALLATION_GUIDE.md#3-gambaran-sistem--port) (acuan utama), `.env.example` setiap service, dan `docker-compose.yml`.

### Teknologi

- **Backend:** Node.js + Express. Akses data lewat Sequelize atau knex dan paket bersama `@opensimrs/model-sdk` (definisi model), `@opensimrs/authorization-sdk` (JWT & middleware), serta `@opensimrs/permission-sdk` (izin). Ketiganya ada di folder `packages/`.
- **Frontend:** Vue 3 + TypeScript + PrimeVue + Pinia + Tailwind. Validasi form memakai vee-validate + yup. PDF dibuat dengan pdfmake.
- **Penyimpanan:**
  - PostgreSQL untuk semua data terstruktur, dipakai bersama oleh semua layanan.
  - MongoDB untuk isi rekam medis per sesi pelayanan.
  - Redis untuk cache token dan izin.

---

## 3. Struktur repositori

Repo ini **monorepo**: semua `*-service` dan `frontend-service` adalah folder biasa di satu repo (sejak Oktober 2026; sebelumnya tiap layanan berada di repositori terpisah sebagai git submodule — riwayat commit lama tiap layanan tidak dibawa karena memuat berkas rahasia).

> **Nama teknis.** Semua identifier teknis memakai `opensimrs`: paket SDK `@opensimrs/*`, paket root `opensimrs` dan layanan `opensimrs-<layanan>`, database PostgreSQL & MongoDB bawaan `opensimrs`, image `opensimrs/*`, kontainer `opensimrs-db`/`opensimrs-redis`/`opensimrs-frontend`/`opensimrs-gateway`, jaringan Docker `opensimrs`, dan token warna Tailwind `opensimrs` (`bg-opensimrs-300`, variabel CSS `--opensimrs-*`). Email akun demo memakai `@demo.opensimrs.local`.

```
.
├── <nama>-service/              # kode per layanan (folder biasa)
├── frontend-service/            # frontend Vue 3
├── bpjs-service/ satusehat-service/ penunjang-service/ program-puskesmas-service/
├── studio-service/              # SIMRS Studio (mode pengembang AI; zona merah bagi agen)
├── packages/                    # SDK bersama: model-sdk, authorization-sdk, permission-sdk (@opensimrs/*)
├── scripts/
│   ├── *-tiruan.mjs             # sistem tiruan untuk uji bridging: LIS, LIS mikro, LIS PA, PACS, UTD, HDIS, marketplace (README-*.md)
│   ├── refresh-sdk.mjs          # npm run sdk:refresh — pasang ulang SDK ke layanan
│   ├── dokumen-katalog.mjs      # npm run docs:katalog — tabel katalog di MANAJEMEN-MODUL.md
│   ├── cek-integritas.mjs       # cek lintas berkas (katalog, menu, stempel migrasi, import @/main, fragmen CHANGELOG); dijalankan CI
│   ├── gabung-changelog.mjs     # menggabungkan changelog.d/*.md ke CHANGELOG.md saat rilis
│   ├── gateway-lokal.mjs        # konfigurasi gateway nginx untuk instalasi lokal (install.sh --domain)
│   └── lib/                     # pustaka installer: tampilan.sh (bilah kemajuan), podman.sh (koneksi VM Podman)
├── database/
│   ├── migrations/*.cjs         # migrasi sequelize-cli (SQL mentah, idempoten)
│   ├── data/katalog-modul.json  # SUMBER katalog Manajemen Modul
│   ├── lib/sinkron-katalog.cjs  # menyalin JSON katalog → tabel ref_* & preset_*
│   ├── seeders/
│   └── demo/                    # reset & seeder data demo 8 faskes
├── schema.sql                   # struktur + data referensi nasional (tanpa data faskes/pasien/pengguna)
├── mongo-init.js                # menyiapkan database MongoDB aplikasi (tanpa kredensial)
├── docker-compose.yml           # satu-satunya berkas compose
├── deploy/server/               # deploy.sh, docker-compose.server.yml, gateway.nginx.conf, .env.example
├── deploy/helpdesk/             # Helpdesk AI (OpenClaw di VM terpisah)
├── changelog.d/                 # fragmen CHANGELOG per branch / item Studio
├── install.sh, install.ps1      # installer lokal (pasangannya uninstall.sh, uninstall.ps1)
└── docs/                        # dokumentasi (ROADMAP, konteks ini, audit menu, rencana testing)
```

**Alur commit:** satu fitur yang menyentuh beberapa layanan cukup satu commit di repo ini (kode layanan + migrasi/katalog/dokumen).

---

## 4. Menjalankan secara lokal

Panduan lengkap ada di [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md). Urutan ringkasnya:

```bash
npm run infra:up                 # PostgreSQL, MongoDB, Redis di Docker (stack:up = seluruh tumpukan)
npm run install:all              # dependensi root + semua layanan + frontend
npm run db:migrate               # migrasi database/migrations
npm run db:demo:seed             # isi 8 faskes demo + akun (database baru tidak perlu reset)
npm run db:demo:master-penunjang # (opsional) tambah datamaster lab/radiologi/fisio/MCU/PA/Mikro ke faskes yang sudah ada — idempoten
npm run db:demo:transaksi        # (opsional) transaksi demo via alur API (bawaan faskes PMD; --bersihkan untuk menghapus)
npm run dev                      # semua layanan backend + frontend
npm run dev:core                 # alternatif ringan: auth, datamaster, admisi, frontend
npm run dev:lab                  # satu layanan saja (dev:<layanan>, termasuk dev:frontend)
```

Untuk mengulang data demo dari awal: `npm run db:demo:reset -- --ya` (menghapus data faskes & transaksi, referensi nasional dipertahankan) lalu `db:demo:seed` lagi. Tanpa Docker: lihat [instal native](./INSTALLATION_GUIDE.md#9-menjalankan-tanpa-docker-instal-native).

**Data demo.** Delapan faskes fiktif, satu per segmen: praktik mandiri, klinik pratama, klinik utama, puskesmas, serta RS kelas D, C, B, dan A.
- Akun mengikuti pola `<kode>.dr.<nama>` untuk dokter dan `<kode>.<peran>` untuk staf (`perawat`, `apoteker`, `lab`, `pendaftaran`, `kasir`, `gudang`, `admin`).
- Kode faskes: `pm`, `kp`, `ku`, `pkm`, `rsd`, `rsc`, `rsb`, `rsa`.
- Staf penunjang dibuat bila modulnya aktif: `<kode>.fisioterapis`, `<kode>.radiografer`, `<kode>.mcu`.
- Ada juga satu akun `superadmin` yang bisa berpindah faskes.
- Kata sandi diambil dari variabel lingkungan `DEMO_PASSWORD` (bawaan `Demo@2026`). Daftar lengkap akun dicetak saat seeder selesai.
- **Hanya untuk development dan staging** (lihat [Lingkungan](./LINGKUNGAN.md)). Jangan jalankan reset di server berisi data nyata.

**SDK `@opensimrs/*`** (model-sdk 1.4.0, authorization-sdk 1.2.0, permission-sdk 1.1.0; lisensi ISC dengan atribusi penulis asli; naikkan versi SDK yang diubah) ada di `packages/`. Layanan memasangnya dengan `"@opensimrs/<sdk>": "file:../packages/<sdk>"` dan `.npmrc` berisi `install-links=true`, sehingga SDK terpasang sebagai **salinan** (bukan symlink) dan sequelize/mongoose tetap satu instans per layanan. Akibatnya, perubahan di `packages/` baru terlihat setelah `npm run sdk:refresh` (atau `npm run sdk:refresh -- lab-service`; lihat `scripts/refresh-sdk.mjs`). JWT memakai **HS256 dengan `SECRET_KEY`** (bagian kode `authorization-sdk`); semua layanan harus memakai `SECRET_KEY` yang sama, sedangkan `PRIVATE_KEY`/`PUBLIC_KEY` tidak dipakai. Di Docker, layanan ber-SDK dibangun dengan konteks root repo (`context: .`, `dockerfile: <layanan>/Dockerfile`) agar `packages/` ikut tersalin ke `/packages`.

Konfigurasi rahasia (kredensial database, SATUSEHAT, BPJS) hanya ditaruh di file `.env` yang tidak di-commit. Kredensial integrasi per faskes diisi lewat menu Setting.

---

## 5. Manajemen Modul

Fitur ini adalah kerangka utama produk. Setiap fitur baru hampir pasti perlu terhubung ke sini.

### Model data

```
ref_segmen ──< preset_segmen_modul >── ref_modul ──< ref_fitur ──< ref_bagian ──< ref_bagian_poli >── ref_jenis_poli
                                           │             │            │
                                           └─ ref_rute ──┘            └── modul_syarat → ref_modul
faskes ──1:1── faskes_segmen ──< faskes_modul_override / faskes_fitur_override / faskes_bagian_override
```

- **Modul**: menu besar, mis. `farmasi`. Modul `inti` selalu aktif. Modul `tersedia=false` tampil sebagai "Segera".
- **Fitur**: kemampuan di dalam modul, mis. `farmasi_racikan`. Fitur bisa `wajib` dan bisa punya `modul_syarat` (mis. Obat Kronis BPJS butuh `bpjs_fkrtl`).
- **Bagian**: unit terkecil, mis. satu form asesmen atau satu jenis surat. Bagian bisa dibatasi ke jenis poli tertentu (odontogram hanya di poli gigi).
- **Rute**: rute frontend milik tepat satu modul atau satu fitur. Router menolak rute milik modul atau fitur yang tidak aktif.
- **Faskes tanpa segmen**: semua modul yang tersedia aktif.

### Menambah atau mengubah item katalog

1. Ubah `database/data/katalog-modul.json` (modul, fitur, bagian, rute, preset segmen).
2. Buat migrasi baru yang hanya memanggil `sinkronKatalog`. Contohnya ada di `database/migrations/20261014150000-katalog_daftar_ringkas.cjs`.
3. Jalankan `npm run db:migrate`. **Jangan mengedit migrasi yang sudah dijalankan.**
4. Bila item baru tidak boleh menyala di segmen tertentu, tambahkan kodenya ke `preset.fitur_mati` atau `preset.bagian_mati` untuk segmen itu. Item yang tidak disebut akan **aktif di semua segmen**.

### Menghubungkan UI ke katalog (frontend)

Semua helper berada di `frontend-service/src/stores/modulFaskes.ts`. Konfigurasi dimuat saat login dan di-cache di `localStorage`.

| Helper | Pakai untuk |
|---|---|
| `modulAktif('farmasi')` | Menampilkan atau menyembunyikan elemen milik sebuah modul |
| `fiturAktif('farmasi_racikan')` | Tombol, tab, atau langkah alur milik sebuah fitur |
| `bagianTampil('rme_asesmen', 'Pemeriksaan Gigi', lokasiUuid)` | Bagian form atau daftar yang bisa bergantung pada jenis poli |
| `ruteDiizinkanModul(path)` | Sudah dipakai router guard dan sidebar; cukup daftarkan rutenya di katalog |

Saat menyembunyikan langkah, pastikan alurnya tetap valid. Contoh: bila General Consent mati, pendaftaran langsung tersimpan tanpa dialog persetujuan.

### Backend

`GET /api/v3/setting/modul` mengembalikan konfigurasi faskes yang login (`modul_aktif`, `fitur_aktif`, `bagian_aktif`, katalog berstatus). Layanan lain bisa membacanya; contohnya `payment-service` mengecek fitur Shift Kasir. Penegakan di sisi server masih menjadi backlog (B-11 di ROADMAP).

### Modul dan izin

Menu atas = modul **aktif di faskes** ∩ modul yang ada di **izin pengguna** (`users.permissions`). Karena itu:

- Modul baru perlu definisi izin di `auth-service/src/helpers/permission-list.js` (+ kunci di `mapPermission`) dan entri di `SEMUA_MODUL` pada `auth-service/src/controllers/permission-controller.js`.
- Peran yang sudah ada mendapat izin baru lewat **migrasi izin** (contoh: `database/migrations/20261014230100-izin_pa_mikrobiologi.cjs`) atau lewat sinkron otomatis: menyimpan Manajemen Modul memanggil `POST /api/v3/auth/permission/sinkron-modul` yang menambahkan izin modul aktif ke peran admin faskes (peran yang punya Setting › "Profile Faskes"). Peran lain diatur di Datamaster › Role.
- Editor Role mengambil daftar izin dari `GET /api/v3/auth/permission/katalog` (sumber tunggal), bukan daftar statis frontend.
- Izin sesi tersimpan saat login (`localStorage.permission` dan cache Redis per token) — perubahan izin perlu login ulang, kecuali alur sinkron modul yang memperbarui sesi superadmin.
- Rute modul baru wajib punya **rute induk dengan redirect** (mis. `/patologi-anatomi` → `/patologi-anatomi/order`); tanpanya klik menu jatuh ke dashboard.
- Grup menu **Penunjang** di `components/section/Header.vue` (`MODUL_PENUNJANG`); menu yang tidak muat masuk tombol **Lainnya**.

---

## 6. Konvensi

### Data

- **ID**: `uuid` berupa string uuidv7 yang dibuat aplikasi. Kolom `id` integer hanya untuk urutan internal.
- **Waktu**: `created_at`, `updated_at`, `deleted_at` disimpan sebagai **epoch detik** (BIGINT), bukan milidetik.
- **Hapus**: soft delete (`deleted_at` terisi). Setiap query wajib menyaring `deleted_at IS NULL` dan `faskes_uuid`.
- **Isolasi faskes**: `faskes_uuid` selalu diambil dari token (konteks request), jangan dari body request.
- **JSON di kolom TEXT**: beberapa kolom menyimpan JSON sebagai teks, mis. `tarif.tindakan`, `tarif.unit_pelayanan`, `practitioner.poli_pelayanan`, `users.permissions`. Selalu `JSON.parse` dengan aman.

### API

- Prefiks `/api/v3/<layanan>/...`. Respons berbentuk `{ message, payload }`.
- Database dan API memakai **snake_case**. Instance axios di frontend otomatis mengubah request ke snake_case dan respons ke **camelCase**. Di kode Vue, field ditulis camelCase (`noRm`, `dischargeDate`).

### Kode

- Tulis kode yang mirip dengan kode di sekitarnya: penamaan Indonesia untuk domain, komentar seperlunya, dan alasan ("mengapa") untuk aturan yang tidak jelas.
- Migrasi memakai SQL mentah yang idempoten (`IF NOT EXISTS`), dijalankan dalam transaksi.
- Pesan commit dalam bahasa Indonesia dengan awalan konvensional, mis. `feat(rme): ...`, `fix(kuitansi): ...`, `docs: ...`. Sebut ID backlog bila ada.

### Keamanan

- **Jangan pernah** meng-commit `.env`, kredensial, token, atau data pasien nyata. Repo ini publik.
- Data uji memakai identitas fiktif (lihat `database/demo/`).
- Folder PRD dan dokumen internal berukuran besar tidak di-commit.

---

## 7. Alur bisnis utama

### Rawat jalan

```
Pendaftaran (admisi) ─▶ antrian poli ─▶ panggil ─▶ mulai periksa ─▶ RME ─▶ resep / order lab / tindakan
      │                                                                   │
      └─ tagihan dibuat saat tindakan / validasi lab / verifikasi resep ◀──┘
                                                       ▼
                       Selesai (resume + discharge) ─▶ antrean farmasi (bila ada resep) ─▶ kasir
```

| Status | Nilai |
|---|---|
| `rawat_jalans.status_rj` | 0 batal · 1–3 menunggu · 4 diperiksa · **5 selesai** |
| Antrian poli `status_panggilan` | 0 menunggu · 1 dipanggil · 2 terlewat · 3 diproses · 4 selesai |

**Efek discharge** (`PUT /rekam-medis/pelayanan/discharge`):
- `status_rj` menjadi 5;
- antrian poli selesai;
- antrean farmasi dibuat bila ada resep;
- riwayat tindakan disalin ke PostgreSQL;
- untuk rawat inap, biaya kamar ditagihkan dan bed dikosongkan.

SATUSEHAT hanya menyinkronkan kunjungan RJ berstatus selesai (Encounter + diagnosis ICD-10 + tanda vital dari RME). ID SATUSEHAT pasien & dokter dicari otomatis lewat NIK, Location poli dibuat otomatis, lalu disimpan (`patients.satu_sehat_uuid`, `practitioner.satu_sehat_id`, `lokasi.satu_sehat_id`; lihat `satusehat-service/src/sinkron.js`).

### Penagihan

- Kategori item tagihan: `1` tindakan · `2` obat · `3` alkes · `4` ruangan · `5` penunjang.
- Item yang dihitung ulang sistem mengganti item lama, bukan menambah:
  - `replace_ref`: tindakan per sesi, satu order lab;
  - `replace_category_codes`: kamar saat discharge.
- Pertahankan pola ini untuk sumber tagihan baru.
- Tarif kamar diambil dari tarif berjenis `Ruangan` dengan `lokasi_uuid` = kamar, dan harga per penjamin ada di kolom `penjamin`.

### Layanan penunjang (penunjang-service)

- Struktur: `src/<modul>/rute.js` per modul (`fisioterapi`, `radiologi`, `mcu`, `patologi`, `mikrobiologi`), helper bersama di `src/umum/`:
  - `kunjungan.js` (`cariKunjungan(no_reg)` RJ/RI/IGD, `kunjunganDariRekamMedis`), `tagihan.js` (`kirimTagihan` ke payment-service, `replace_ref` `<modul>:<uuid>`; APS memakai `service_bill.type` `FISIO`/`RAD`/`MCU`/`PA`/`MIKRO`), `nomor.js` (penomoran harian/tahunan), `izin.js` (penegakan izin per aksi dari `users.permissions`).
- Alur umum: order (RME / APS) → **validasi** (tagihan dikirim) → proses → hasil → cetak. Order dari RME ditagihkan ke layanan kunjungan (RJ/RI/IGD); APS ke tagihan APS di kasir.
- Komponen RME penunjang (`components/RekamMedis/Order*/Form*.vue`) memakai props seragam: `method` (`form`/`detail`), `initialState`, `patientData`, `rmType`, `rmDate`, `rmUuid`, `riwayat` (riwayat order pasien untuk tab Cetak Hasil). Order dicocokkan per **No. Reg** kunjungan (uuid rekam medis bisa berbeda antar-dokumen RM kunjungan yang sama).
- MCU membuat order lab PK di lab-service (`is_mcu = true`, tanpa tagihan lab) dan order radiologi (`rad_order` sumber `mcu`, `tanpa_tagihan`). Impor Excel peserta mendaftarkan pasien baru lewat Admisi (`POST /api/v3/admisi/patient`) — env `BASE_URL_API_LAB`, `BASE_URL_API_ADMISI`.

### Bridging LIS (lab-service `src/lis/`)

- Koneksi per faskes (`lab_lis_koneksi`): `url_registrasi`, `url_hasil` (GET, placeholder `{no_registrasi}`/`{no_lab}`), `api_key` (terenkripsi), `kode_rs`, `kode_lab`, `mode_kirim` (`per_order`/`bulk`), `url_registrasi_bulk`, `ukuran_batch` (≤ 149, batas gateway < 150).
- Body registrasi = format adamLIS (`lis-peta.js buatRegistrasi`); kode tindakan, unit, dokter, penjamin diganti kode LIS dari **Laboratorium › Mapping LIS** (`tarif_lab.kode_lis`, `lab_lis_peta_ref`); hasil dipetakan lewat `item_pemeriksaan.kode_lis`.
- "Validasi & Kirim ke LIS": gagal kirim = validasi dibatalkan. No. Lab LIS disimpan di `lab_lis_kirim.lis_no_lab` dan dipakai lebih dulu saat mencocokkan hasil.
- Hasil masuk lewat **push** (`POST /adam-lis/bridging` atau alias `POST /api/v3/lab/lis/hasil`, kunci masuk) atau **tarik** (`POST /api/v3/lab/lis/tarik/:order` → GET `url_hasil`); keduanya lewat `prosesHasil`.
- Kirim massal (MCU): `lab_lis_batch` diproses asinkron; **klaim atomik** per order (`INSERT … ON CONFLICT … WHERE status IN ('baru','gagal')`) mencegah kirim dobel; timeout/502 → status `tidak_pasti` (selesaikan dengan Cek Status sebelum kirim ulang); 409/400 bulk → item penyebab dikeluarkan, sisa dikirim ulang.
- Uji tanpa LIS asli: `node scripts/lis-tiruan.mjs`.

### Rekam medis (MongoDB)

- Satu dokumen `rekam_medises` per kunjungan. `rawat_jalans.rekam_medis_uuid` merujuk ke dokumen itu.
- Isi asesmen disimpan per **sesi** di koleksi `sessions`, satu field per bagian (`anamnesis`, `tanda_vital`, `diagnosis_dokter`, `pemeriksaan_tindakan`, ...).
- Simpan bagian lewat `POST /rekam-medis/assessment` dengan `{ sessionUuid, rekamMedisUuid, isLatest, key, data }`. Ringkasan pasien diperbarui otomatis.

---

## 8. Jebakan yang sudah diketahui

Baca bagian ini sebelum menyentuh area terkait. Sebagian juga tercatat di backlog ROADMAP.

| Area | Jebakan |
|---|---|
| Login & izin | Izin saat login dibaca dari `users.permissions`, **bukan** `role.permissions`. Salin JSON izin ke user saat membuat atau mengubah role. |
| Superadmin | Nama role harus persis `super admin` (huruf kecil). Superadmin tetap butuh `faskes_uuid` dan berpindah faskes lewat endpoint pembaruan token. |
| Penjamin TUNAI | Admisi mencari penjamin bernama "tunai" **tanpa filter faskes** (B-14). Penjamin BPJS harus bernama diawali "BPJS". |
| Jadwal dokter | Pendaftaran hanya menerima jadwal yang **harinya** sama dengan hari ini (jam tidak dicek). |
| Lokasi | `lokasi.kategori_ruangan_uuid` wajib, bahkan untuk poli. Hierarki: Site → Building → Level → Ward (poli, `is_poli=true`) / Room (kamar) → Bed. |
| Kamar rawat inap | `ruangan.uuid` **harus sama** dengan uuid lokasi kamar (Room). `room_monitorings.room_uuid` = kamar, `lokasi_uuid` = bed. |
| Farmasi | Setiap faskes wajib punya satu baris `konfigurasi_harga`. Setiap depo wajib punya `default_tujuan_order_permintaan` (string digit: `0` RI, `1` RJ, `2` IGD, `3` fisioterapi). Batch stok kedaluwarsa diabaikan. |
| Tarif tindakan | `tarif.unit_pelayanan` berisi "Rawat Jalan" / "Rawat Inap" / "IGD". RME menyaring tarif sesuai jenis pelayanan kunjungan. `grand_total` tidak dihitung ulang server. |
| Laboratorium | `item_pemeriksaan.loinc_uuid` dan `kelompok_pemeriksaan.loinc_uuid` wajib merujuk ke baris `loinc` yang ada. |
| Truncate | Jangan pernah `TRUNCATE ... CASCADE` tabel `ref_*`. `lokasi.jenis_poli` ber-FK ke `ref_jenis_poli` sehingga data lokasi bisa ikut terhapus. |
| Frontend | Komponen yang disembunyikan lewat `v-if` membuat `ref`-nya kosong. Fungsi yang memanggil method komponen lewat ref harus aman terhadap null. |
| Tipe | `vue-tsc` punya 47 galat **sintaks** lama di `components/icons/*` yang membuat pemeriksaan semantik tidak berjalan — angka 47 tidak membuktikan apa pun. Verifikasi berkas yang diubah dengan `curl http://localhost:5520/src/<path>` (harus 200) dan uji di browser tanpa `pageerror`. |
| Cetak PDF | Pakai `bukaPdf` (`utils/pdf/bukaPdf.ts`), bukan `pdfMake.createPdf().open()`: galat pembuatan PDF tampil sebagai toast & popup diblokir → unduh. Gambar (logo/lampiran) divalidasi dari isi berkas (`gambarPdfValid`). |
| Izin modul | Mengaktifkan modul di Manajemen Modul tidak otomatis memberi izin ke peran non-admin. Lihat "Modul dan izin" di bagian 5. |
| Lokasi IGD | Kode lokasi IGD per faskes (`<KODE>-IGD`), jangan cari kode persis "IGD". |
| Edit order lab | Mengganti tarif order harus menyinkronkan `observation_item` (sudah ditangani di `OrderLabService.update`; hanya sebelum validasi). |
| SDK `packages/` | SDK dipasang sebagai salinan (`install-links=true`). Mengubah `packages/*` tanpa `npm run sdk:refresh` berarti layanan masih memakai kode lama. Jangan mengganti dependensi menjadi symlink: sequelize/mongoose bisa menjadi dua instans. |
| Docker build | Layanan ber-SDK dibangun dari root repo (`context: .`); berkas yang dibutuhkan image jangan sampai tercakup `.dockerignore` root. Frontend, bpjs, satusehat, dan penunjang memakai konteks foldernya sendiri. |
| Gateway | Gateway nginx hanya meneruskan `/api/v3/<layanan>/` dan `/adam-lis/` (lab-service). Titik masuk bridging baru di penunjang-service wajib punya alias `/api/v3/penunjang/...` (pola `ruteMasuk.post(["/adam-…/bridging", "/api/v3/penunjang/…"])`). Batas laju `payment-service` & `rawat-inap-service` (100/5 menit per IP, tanpa `trust proxy`) menghitung semua pengguna di belakang gateway sebagai satu IP. |
| Windows / Git Bash | Argumen shell berawalan `/` atau `@/` diubah menjadi path Windows (`C:/Program Files/Git/...`). Tulis berkas lewat editor, bukan argumen shell. |

---

## 9. Pengujian

- **Rencana uji & regresi:** [docs/testing/rencana-testing.md](./testing/rencana-testing.md). Tambahkan baris regresi untuk setiap bug yang diperbaiki.
- **Audit menu per modul:** [docs/audit/](./audit/).
- **Uji unit:** sebagian layanan punya folder `test/` (mis. `rekamedis-service`, `bpjs-service`). Jalankan dengan `npm test` di layanan terkait.
- **Uji alur:** jalankan alur end-to-end memakai akun demo segmen yang relevan. Untuk perubahan yang bergantung segmen, uji minimal di satu segmen yang mengaktifkan fitur dan satu yang mematikannya.
- **Pemeriksaan tipe frontend:** `npx vue-tsc --noEmit -p tsconfig.app.json` di `frontend-service` (lihat catatan di bagian 8 — belum andal).
- **Uji UI otomatis:** Chrome headless + `puppeteer-core`, selalu dalam konteks browser terisolasi (`browser.createBrowserContext()`).
- **Bridging LIS:** `npm test` di `lab-service` (uji `lis-peta` & `lis-bulk`) + LIS tiruan `scripts/lis-tiruan.mjs`.
- **Riwayat sesi pengembangan:** [session-claude.md](./session-claude.md) — ringkasan pekerjaan, status terakhir, pertanyaan terbuka, dan backlog.

---

## 10. Glosarium

| Istilah | Arti |
|---|---|
| Faskes | Fasilitas kesehatan (praktik, klinik, puskesmas, rumah sakit) |
| Segmen | Jenis faskes yang menentukan preset modul |
| RJ / RI / IGD | Rawat jalan / rawat inap / instalasi gawat darurat |
| RME | Rekam medis elektronik |
| SOAP | Subjektif, Objektif, Asesmen, Plan; format catatan klinis |
| DPJP | Dokter penanggung jawab pelayanan |
| Penjamin | Pihak pembayar: tunai/umum, BPJS, asuransi swasta |
| FKTP / FKRTL | Faskes tingkat pertama (PCare) / rujukan tingkat lanjut (VClaim, SEP) |
| Depo / Gudang | Lokasi stok tempat penyerahan obat / lokasi penyimpanan pusat |
| BMHP | Bahan medis habis pakai |
| Telaah resep | Pemeriksaan resep oleh apoteker sebelum obat diserahkan |
| Discharge | Pasien selesai dilayani atau pulang; menutup kunjungan |
| SATUSEHAT | Platform interoperabilitas data kesehatan Kemenkes (FHIR) |
| APS | Atas Permintaan Sendiri — pasien penunjang tanpa kunjungan (ditagih di kasir APS) |
| PK / PA / MK | Patologi Klinik (Laboratorium) / Patologi Anatomi / Mikrobiologi Klinik |
| LIS | Laboratory Information System (adamLIS); No. Lab = nomor registrasi di LIS |
| AST / S-I-R | Uji kepekaan antibiotik / Sensitif-Intermediat-Resisten |
| MCU | Medical Check Up perorangan/korporasi (peserta, stasiun, kesimpulan fit/unfit) |
