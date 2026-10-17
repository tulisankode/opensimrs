# Rancangan: QA & Permintaan dari Halaman (SIMRS Studio)

> Status: **rancangan**, belum diimplementasikan. Pelengkap [STUDIO-PENGEMBANG.md](./STUDIO-PENGEMBANG.md) (§7.1 Permintaan, §7.6 QA).
> Disusun 2026-10-16. Kode yang disentuh: `studio-service/**` (zona merah agen) dan `frontend-service`. Karena itu fitur ini dikerjakan programmer lewat PR, bukan lewat item Studio.

## Daftar isi
1. [Ringkasan](#1-ringkasan)
2. [Masalah](#2-masalah)
3. [Tujuan & non-tujuan](#3-tujuan--non-tujuan)
4. [Aktor & hak akses](#4-aktor--hak-akses)
5. [Pengalaman pengguna](#5-pengalaman-pengguna)
6. [Konteks otomatis](#6-konteks-otomatis)
7. [Menemukan item asal](#7-menemukan-item-asal)
8. [Sesi QA halaman](#8-sesi-qa-halaman)
9. [Model data](#9-model-data)
10. [API](#10-api)
11. [Frontend](#11-frontend)
12. [Integrasi agen & kanban](#12-integrasi-agen--kanban)
13. [Privasi & keamanan](#13-privasi--keamanan)
14. [Kasus khusus](#14-kasus-khusus)
15. [Fase & breakdown](#15-fase--breakdown)
16. [Rencana uji](#16-rencana-uji)
17. [Keputusan terbuka](#17-keputusan-terbuka)

---

## 1. Ringkasan

Saat **Mode Pengembang aktif**, setiap halaman OpenSIMRS menampilkan tombol mengambang **QA**. Tombol ini hanya terlihat oleh pengguna yang punya izin SIMRS Studio. Dari halaman yang sedang dibuka, penguji dapat:

- **menjalankan checklist QA** dari rencana uji item Studio yang membuat atau mengubah halaman itu, langsung sambil memakai halamannya;
- **membuat Temuan QA** (bug) atau **Permintaan tambahan** dengan konteks halaman yang terisi otomatis. Hasilnya langsung masuk ke kanban kolom **Permintaan**, tertaut ke item asal, lalu dirangkum agen seperti permintaan biasa.

## 2. Masalah

- Penguji harus berpindah dari halaman yang diuji ke SIMRS Studio, lalu menulis ulang konteksnya: halaman apa, modul apa, langkah apa, galat apa. Konteks sering kurang, sehingga agen menebak.
- Checklist uji (`studio_uji`) hanya bisa diisi di halaman item Studio, terpisah dari halaman yang diuji.
- Permintaan lanjutan untuk modul yang sudah selesai tidak tertaut ke item asalnya. Agen mulai dari nol tanpa membaca PRD dan desain lama.
- Galat yang muncul di halaman (mis. `column reference "faskes_uuid" is ambiguous` di CSSD › Laporan) hilang begitu toast tertutup.

## 3. Tujuan & non-tujuan

**Tujuan (terukur):**
- Permintaan dari halaman memuat rute, modul, dan item asal secara otomatis (100% item bersumber `halaman`).
- Waktu dari temuan sampai masuk kanban ≤ 1 menit, tanpa membuka halaman Studio.
- Kasus uji yang gagal di halaman dapat dijadikan Temuan QA dengan **satu klik**, dengan langkah dan harapan terisi dari kasus uji.
- Riwayat QA regresi untuk item yang sudah selesai tersimpan per sesi tanpa menimpa hasil QA rilis aslinya.

**Non-tujuan:**
- Tidak tersedia di produksi. Studio memang mati di produksi; masukan pengguna produksi tetap lewat Helpdesk.
- Bukan alat uji otomatis (E2E). Cek otomatis tetap di tahap QA item.
- Tidak merekam layar atau video, dan tidak mengirim data halaman ke agen tanpa tindakan pengguna.

## 4. Aktor & hak akses

| Aktor | Yang bisa dilakukan |
|---|---|
| Superadmin | Semua; selalu melihat tombol QA saat Mode Pengembang aktif |
| QA (peran dengan izin `SIMRS Studio › QA`) | Sesi QA halaman, mengisi checklist, membuat Temuan QA |
| Pengusul (izin `SIMRS Studio › Permintaan CREATE`) | Membuat Temuan/Permintaan dari halaman |
| Pengguna lain | Tidak melihat tombol |

Aturan tampil tombol (frontend, sinkron): `studioAktif() && (isSuperadmin() || bolehStudio("Permintaan", "CREATE") || bolehStudio("QA", ["UPDATE", "JALANKAN UJI"]))`. Penegakan sebenarnya tetap di backend (`pastikan(req, …)`).

Izin baru **tidak diperlukan**. Fitur ini memakai submodul yang sudah ada:
- **Permintaan › CREATE** untuk membuat temuan atau permintaan;
- **QA › UPDATE** untuk mengisi checklist dan menyimpan sesi.

*(Keputusan terbuka K1: tombol khusus superadmin, atau berbasis izin seperti di atas.)*

## 5. Pengalaman pengguna

### 5.1 Tombol
- Tombol mengambang di pojok kanan bawah dengan ikon `PhBugBeetle` dan label pendek **QA**. Posisinya di atas tombol Bantuan, dan bisa digeser bila menutupi tombol aplikasi. Posisi diingat per pengguna di `localStorage`.
- Bila halaman ini punya item asal yang sedang di tahap **qa**, tombol diberi badge titik.
- Tombol tidak tampil di halaman Studio sendiri (`/studio/**`), halaman login, dan halaman galat.

### 5.2 Panel (drawer kanan, tidak menutup halaman)
Kepala panel menampilkan konteks ringkas: **CSSD › Laporan** · modul `cssd` · item asal **STD-0010 (Selesai)**, beserta tautan untuk membuka item itu di Studio.

Panel berisi tiga tab:

1. **Checklist QA**
   - Berisi kasus uji item asal yang relevan dengan halaman ini (§8): kode, skenario, langkah, harapan, dan pilihan status **Lulus / Gagal / N/A**. Catatan opsional.
   - Kasus **Gagal** menampilkan tombol **Jadikan temuan**, yang membuka tab Temuan dengan isian terisi.
   - Bagian bawah tab: **Selesaikan sesi** (ringkasan lulus/gagal) dan **Lihat semua kasus**. Secara bawaan hanya kasus yang cocok dengan halaman yang ditampilkan.
2. **Temuan QA** (bug)
   - **Judul**, wajib, dengan saran otomatis: "Galat di CSSD › Laporan: column reference … is ambiguous".
   - **Langkah reproduksi**, terisi dari kasus uji bila berasal dari checklist.
   - **Hasil yang diharapkan** dan **hasil yang terjadi**, diisi otomatis dengan galat API terakhir bila ada (§6).
   - **Prioritas**, bawaan P2. P1 disarankan bila ada galat 5xx.
   - **Lampiran** opsional: tangkapan layar halaman (§13) atau berkas.
   - **Kirim**. Hasilnya item baru berjenis **perbaikan**, tertaut ke item asal.
3. **Permintaan tambahan**
   - Isian sama dengan formulir Permintaan Baru: masalah, siapa, harapan, contoh.
   - Modul terisi otomatis. Hasilnya item baru berjenis **fitur**, tertaut ke item asal.

Setelah dikirim, muncul toast "STD-0016 dibuat dari halaman ini · Buka". Panel tetap terbuka, sehingga penguji bisa lanjut ke kasus berikutnya.

### 5.3 Alur ringkas
```
Penguji buka halaman ──► klik QA ──► panel (konteks + item asal)
   ├─ Checklist: centang lulus/gagal ──► gagal ──► "Jadikan temuan" ──┐
   ├─ Temuan QA ───────────────────────────────────────────────────────┤
   └─ Permintaan tambahan ─────────────────────────────────────────────┤
                                                                        ▼
            POST /studio/item (sumber: halaman, induk, konteks) ──► kanban "Permintaan"
                                                                        │
                                       agen merangkum (konteks + PRD/desain induk) ◄┘
```

## 6. Konteks otomatis

Dikumpulkan frontend saat panel dibuka, lalu dikirim sebagai `konteks` (JSON). Penguji dapat melihat dan menghapus isinya sebelum mengirim, lewat bagian "Konteks yang dikirim".

| Kunci | Sumber | Contoh |
|---|---|---|
| `rute` | `route.path` (parameter UUID diganti `:uuid`) | `/cssd/laporan` |
| `nama_rute` | `route.name` | `cssd-laporan` |
| `judul_halaman` | judul menu atau `document.title` | `CSSD › Laporan` |
| `modul` | `modulUntukPath(path)` (stores/modulFaskes) | `cssd` |
| `fitur` | fitur katalog dengan rute yang cocok | `null` |
| `komponen` | `route.matched[].components.default.__file` (hanya mode dev Vite; dibuang bila tidak ada) | `src/views/Cssd/LaporanCssdPage.vue` |
| `galat_terakhir` | 5 galat API terakhir di halaman ini: metode, path API tanpa query, status, pesan (§13) | `GET /penunjang/cssd/laporan/kegagalan 500 column reference …` |
| `peran` | peran pengguna (bukan nama atau username) | `super admin` |
| `segmen` | segmen faskes aktif | `rs_b` |
| `versi` | versi aplikasi + branch dari `/studio/aplikasi/status` | `1.0.0-alpha.1 · rs-lokal@47a9b7f` |
| `peramban` | lebar layar & user agent ringkas | `1366×768 · Chrome 141` |

Yang **tidak** dikirim:
- nilai isian form;
- isi tabel;
- query string;
- `localStorage`;
- token;
- UUID pasien atau kunjungan, karena path di-normalisasi.

Penangkap galat dipasang sebagai satu interceptor respons di `utils/Api.ts`, yang dipakai bersama semua instance axios. Galat disimpan di ring buffer memori, maksimal 20 entri per rute, dan tidak pernah dipersist.

## 7. Menemukan item asal

Endpoint `GET /studio/halaman/konteks?rute=…&modul=…&komponen=…` mengembalikan kandidat item yang membuat atau mengubah halaman, berurutan dari skor tertinggi:

| Sinyal | Skor | Keterangan |
|---|---|---|
| `komponen` ada di berkas item (`berkas[]` atau `riwayat_commit[].berkas`) | 100 | Paling akurat; hanya tersedia di mode dev |
| Item mengubah berkas di folder view yang sama (`dirname(komponen)`) | 60 | Halaman lain dalam modul yang sama |
| `modul` ada di `aktivasi.modul` item | 50 | Item yang menyalakan modul itu |
| `modul` ada di `modul_terdampak` | 30 | Dari triase |
| Diperbarui ≤ 30 hari | +10 | Pemecah seri |

- Item `dibatalkan` dan `deleted_at` diabaikan.
- Hasil: `{ utama, kandidat[≤5], sesi_terbuka }`.
- Penguji dapat mengganti item asal dari daftar kandidat, atau memilih **Tanpa item asal**.
- Untuk halaman bawaan yang tidak dibuat lewat Studio (mis. Admisi), `utama = null`. Tab Checklist kosong, sedangkan Temuan dan Permintaan tetap bisa dikirim dengan konteks modul.

## 8. Sesi QA halaman

**Kasus uji yang ditampilkan:**
- Semua `studio_uji` milik item asal yang belum dihapus.
- Kasus yang "cocok dengan halaman" ditaruh di atas. Cocok berarti teks skenario, langkah, atau harapan menyebut judul halaman, nama menu, atau segmen rute (mis. "Laporan", "Kegagalan").
- Kasus lainnya tetap bisa dibuka lewat **Lihat semua kasus**.

**Ke mana hasilnya ditulis**, tergantung tahap item asal:

| Tahap item asal | Hasil centang ditulis ke |
|---|---|
| `qa` | Langsung ke `studio_uji` (status, catatan, `diuji_oleh`), sama seperti mengisi checklist di halaman item. Gerbang QA membaca hasil ini |
| `rilis`, `selesai` | **Sesi QA regresi** (`studio_sesi_qa` + `studio_sesi_qa_hasil`). Hasil QA rilis asli di `studio_uji` **tidak ditimpa** |
| tahap lain | Checklist hanya-baca (belum waktunya QA); Temuan/Permintaan tetap bisa |

- Satu sesi dibuat otomatis saat kasus pertama dicentang, per pengguna, per item asal, per hari.
- **Selesaikan sesi** mengisi `selesai_pada` dan ringkasan.
- Temuan yang dibuat dari kasus gagal tercatat di `temuan_item_uuid` pada hasil sesi, sehingga laporan sesi bisa menautkan ke STD temuan.
- Di halaman item asal (Studio), bagian QA mendapat tab **Riwayat regresi** berisi daftar sesi, penguji, jumlah lulus/gagal, dan tautan temuan.

## 9. Model data

Migrasi baru `YYYYMMDDHHMMSS-studio_qa_halaman.cjs`. Nomor diberikan saat PR agar urut paling akhir. Migrasinya idempoten.

```sql
ALTER TABLE studio_item
  ADD COLUMN IF NOT EXISTS sumber     VARCHAR(20) NOT NULL DEFAULT 'studio', -- studio | halaman
  ADD COLUMN IF NOT EXISTS induk_uuid UUID,                                   -- item asal (lanjutan dari)
  ADD COLUMN IF NOT EXISTS konteks    JSONB;                                  -- §6, sudah disaring
CREATE INDEX IF NOT EXISTS studio_item_induk_idx ON studio_item (induk_uuid) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS studio_sesi_qa (
  id BIGSERIAL PRIMARY KEY, uuid UUID NOT NULL UNIQUE,
  item_uuid UUID NOT NULL,             -- item asal yang diuji
  rute VARCHAR(255), modul VARCHAR(100),
  penguji VARCHAR(255) NOT NULL, faskes_uuid VARCHAR(255),
  mulai_pada BIGINT NOT NULL, selesai_pada BIGINT,
  ringkasan JSONB,                     -- { lulus, gagal, na, belum }
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, deleted_at BIGINT
);
CREATE TABLE IF NOT EXISTS studio_sesi_qa_hasil (
  id BIGSERIAL PRIMARY KEY, uuid UUID NOT NULL UNIQUE,
  sesi_uuid UUID NOT NULL, uji_uuid UUID NOT NULL,
  status VARCHAR(10) NOT NULL,         -- lulus | gagal | na
  catatan TEXT, temuan_item_uuid UUID,
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
  UNIQUE (sesi_uuid, uji_uuid)
);
```

Rollback (`down`) menghapus kedua tabel dan ketiga kolom.

## 10. API

Semua endpoint di `studio-service` (`/api/v3/studio`), wajib Mode Pengembang aktif (`pastikanBukanProduksi` dan status aktif), dan diaudit.

| Metode & path | Izin | Body / query | Respons `{ message, payload }` |
|---|---|---|---|
| `GET /halaman/konteks` | bolehBaca | `rute, modul, komponen?` | `{ utama, kandidat[], sesi_terbuka, uji[] }`; `uji[]` adalah kasus item utama, diurutkan dengan yang cocok halaman di atas |
| `POST /item` *(diperluas)* | Permintaan CREATE | field lama + `sumber: "halaman"`, `induk_uuid?`, `konteks?`, `jenis` (`perbaikan`/`fitur`), `langkah?`, `hasil_terjadi?` | item baru (tahap permintaan, agen merangkum) |
| `POST /halaman/sesi/uji` | QA UPDATE | `{ item_uuid, uji_uuid, status, catatan?, rute, modul }` | item `qa` → `studio_uji` diperbarui; selainnya → hasil sesi (sesi dibuat bila belum ada) |
| `POST /halaman/sesi/:uuid/selesai` | QA UPDATE | – | sesi + ringkasan |
| `GET /item/:uuid/sesi-qa` | bolehBaca | – | riwayat sesi regresi item |
| `POST /item/:uuid/lampiran` *(sudah ada)* | Permintaan CREATE | dipanggil setelah item dibuat untuk tangkapan layar | lampiran |

Validasi `POST /item` dari halaman:
- `konteks` disaring di backend dengan daftar kunci yang diizinkan (§6) dan panjang maksimal per nilai;
- seluruh teks melewati `pastikanBebasDataPribadi`;
- `induk_uuid` harus item yang ada dan tidak dihapus;
- `jenis = perbaikan` mewajibkan langkah reproduksi atau `hasil_terjadi`.

## 11. Frontend

| Berkas | Isi |
|---|---|
| `components/studio/TombolQaHalaman.vue` (baru) | Tombol mengambang + drawer tiga tab; dipasang sekali di layout utama (di samping `TombolBantuan`) |
| `components/studio/PanelChecklistQa.vue` (baru) | Daftar kasus, status, "Jadikan temuan", selesaikan sesi |
| `components/studio/FormTemuanQa.vue` (baru) | Form temuan/permintaan + pratinjau konteks + lampiran |
| `utils/galatTerakhir.ts` (baru) | Ring buffer galat API per rute; dipanggil interceptor respons di `utils/Api.ts` |
| `utils/konteksHalaman.ts` (baru) | Menyusun konteks §6 (normalisasi path, modul, komponen dev) |
| `stores/simrsStudio.ts` | Getter `bolehQaHalaman` |
| `views/SimrsStudio/Template/BerandaStudio.vue` | Kartu kanban: lencana **Dari halaman** + "lanjutan STD-0010" |
| `views/SimrsStudio/Template/ItemStudio.vue` | Kepala item: tautan induk & daftar turunan; tab QA **Riwayat regresi** |

Tombol hanya dimuat (`defineAsyncComponent`) bila `studioAktif()`, sehingga bundle pengguna biasa tidak bertambah.

## 12. Integrasi agen & kanban

- **Prompt tahap permintaan** untuk item `sumber = halaman` mendapat blok tambahan:
  - "Konteks halaman" (tabel §6);
  - bila ada induk: ringkasan **PRD** dan **desain teknis terbaru item induk** (dipotong ±8.000 karakter) beserta daftar berkas yang pernah diubah induk.

  Dengan begitu agen tahu ini lanjutan, bukan modul baru.
- **Risiko awal** mengikuti induk. Item tidak boleh lebih rendah dari `risiko_min` induk, misalnya ICU tetap minimal Tinggi.
- **Desain teknis**: agen diminta mengubah berkas induk yang ada, bukan membuat modul paralel.
- **Kanban**:
  - kartu menampilkan lencana **Dari halaman** dan **↳ STD-0010**;
  - filter baru **Sumber: halaman**;
  - item induk menampilkan jumlah turunan yang masih terbuka.

## 13. Privasi & keamanan

- **Tangkapan layar** dibuat di peramban dengan `html2canvas` dan dimuat hanya saat diminta.
  - Sebelum dikirim, penguji **wajib** meninjau gambarnya di editor kecil. Ada alat **kotak sensor**, dan bawaannya otomatis menutup sel tabel serta isian form.
  - Penguji juga harus mencentang "Sudah disamarkan, tanpa data pasien asli", yang sudah diwajibkan `tambahLampiran`.
  - Gambar disimpan di folder lampiran Studio di server dan **tidak pernah di-commit**.
- **Galat terakhir**: hanya metode, path API tanpa query, status, dan pesan galat, dipotong 300 karakter. Pesan yang memuat pola data pribadi (NIK, HP, email) disensor sebelum disimpan di buffer.
- **Path**: segmen UUID, angka panjang (≥6 digit), dan nomor RM diganti `:id`.
- **Konteks** di backend disaring dengan daftar kunci yang diizinkan, sehingga kunci asing dibuang.
- **Produksi**: endpoint menolak dengan `pastikanBukanProduksi()`, dan tombol tidak dirender karena `studioAktif()` bernilai false.
- **Audit**: "Membuat temuan dari halaman /cssd/laporan", "Sesi QA regresi STD-0010 dimulai/selesai".

## 14. Kasus khusus

| Kasus | Perilaku |
|---|---|
| Halaman tanpa item asal (fitur bawaan) | Checklist kosong dengan penjelasan; Temuan/Permintaan tetap bisa, `induk_uuid = null` |
| Banyak kandidat item asal | Pilih yang skornya tertinggi; penguji dapat mengganti |
| Item asal masih coding (belum QA) | Checklist hanya-baca; temuan disarankan dikirim sebagai **pesan** ke item itu (tombol "Kirim ke diskusi STD-…") alih-alih item baru |
| Item asal tahap `qa`, kasus gagal | Status ditulis ke `studio_uji`; "Jadikan temuan" menawarkan **Minta revisi ke item ini** (kembali ke coding) atau **item baru** |
| Rute dinamis `/pasien/:uuid/...` | Path dinormalisasi; modul tetap terdeteksi |
| Batas tugas/biaya agen tercapai | Item tetap dibuat; pesan sistem "agen belum dijalankan" (perilaku `buatItem` saat ini) |
| Mode Pengembang dimatikan saat panel terbuka | Panel menutup (event `EVENT_STUDIO`); draf isian disimpan di `sessionStorage` |

## 15. Fase & breakdown

**F1: Tombol, konteks, temuan/permintaan → kanban (±3–4 hari)**
1. Migrasi kolom `sumber`, `induk_uuid`, `konteks`.
2. `POST /item` diperluas; penyaring konteks; `GET /halaman/konteks` (item asal, tanpa sesi).
3. `galatTerakhir.ts` + interceptor; `konteksHalaman.ts`.
4. `TombolQaHalaman.vue` + `FormTemuanQa.vue` (tanpa tangkapan layar).
5. Prompt: blok konteks halaman + ringkasan induk; risiko awal mengikuti induk.
6. Kanban: lencana sumber & induk; kepala item: tautan induk/turunan.
7. Uji unit backend (penyaring konteks, skor item asal) + dokumen.

**F2: Checklist QA di halaman + sesi regresi (±3 hari)**
1. Tabel `studio_sesi_qa` + `studio_sesi_qa_hasil`.
2. `POST /halaman/sesi/uji`, selesai sesi, `GET /item/:uuid/sesi-qa`.
3. `PanelChecklistQa.vue`; "Jadikan temuan"; tab Riwayat regresi di ItemStudio.

**F3: Tangkapan layar dengan sensor (±2 hari)**
1. `html2canvas` (dimuat saat diminta) + editor kotak sensor + sensor otomatis tabel/form.
2. Unggah sebagai lampiran item.

Ketiganya bisa satu PR per fase. F1 berdiri sendiri, dan F2 serta F3 tidak mengubah kontrak F1.

## 16. Rencana uji

| Kode | Skenario | Harapan |
|---|---|---|
| QH-01 | Mode Pengembang mati | Tombol QA tidak tampil; endpoint `/halaman/*` menolak |
| QH-02 | Pengguna tanpa izin Studio | Tombol tidak tampil; `POST /item` 403 |
| QH-03 | Buka `/cssd/laporan`, klik QA | Konteks: modul `cssd`, item asal STD-0010 |
| QH-04 | Laporan Kegagalan memicu 500, lalu buat temuan | "Hasil yang terjadi" terisi pesan galat; path tanpa query |
| QH-05 | Kirim temuan | Item baru jenis perbaikan, `sumber=halaman`, `induk_uuid`=STD-0010, muncul di kanban Permintaan; agen merangkum dengan konteks PRD induk |
| QH-06 | Teks memuat NIK asli (bukan 9999…) | Ditolak pemeriksa data pribadi |
| QH-07 | Item asal tahap `qa`, centang gagal | `studio_uji` berubah; gerbang QA melihatnya |
| QH-08 | Item asal `selesai`, centang kasus | Sesi regresi dibuat; `studio_uji` asli tidak berubah |
| QH-09 | "Jadikan temuan" dari kasus gagal | Langkah & harapan terisi; `temuan_item_uuid` tercatat di hasil sesi |
| QH-10 | Halaman bawaan tanpa item asal | Checklist kosong; temuan tetap terkirim tanpa induk |
| QH-11 | Konteks berisi kunci asing/nilai panjang | Backend membuang/memotong |
| QH-12 | Bundle produksi tanpa Studio | Komponen QA tidak ikut dimuat (async) |

## 17. Keputusan terbuka

| # | Pertanyaan | Usulan |
|---|---|---|
| K1 | Tombol khusus superadmin, atau semua pengguna dengan izin Studio (Permintaan CREATE / QA UPDATE)? | Berbasis izin. Superadmin tetap selalu bisa, dan peran QA dapat menguji tanpa akun superadmin |
| K2 | Tangkapan layar di F1 atau ditunda ke F3? | F3. Risiko data pasien perlu editor sensor yang matang lebih dulu |
| K3 | Temuan pada item yang sudah selesai: item baru tertaut, atau membuka kembali item lama? | Item baru tertaut (`induk_uuid`), agar riwayat dan rilis item lama tetap bersih. Untuk item yang masih di QA, tawarkan "Minta revisi" ke item itu |
| K4 | Satu sesi QA per hari per penguji per item, atau sesi dibuka/ditutup manual? | Otomatis per hari, dengan tombol Selesaikan sesi |
| K5 | Perlukah temuan dari halaman langsung melewati tahap Use case (jenis perbaikan kecil)? | Belum; tetap ikut alur standar. Bisa ditinjau setelah F1 dipakai |
