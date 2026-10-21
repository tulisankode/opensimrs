# Rancangan: Asisten Pengembang Kontekstual (Product, Engineer, QA)

Status: **rancangan, belum dibangun** (2026-10-20). Terkait: [SIMRS Studio](../SIMRS-STUDIO.md), [rancangan Studio](./STUDIO-PENGEMBANG.md).

## 1. Masalah

Permintaan ke SIMRS Studio saat ini ditulis dari halaman Studio. Pengusul harus menjelaskan sendiri "halaman mana, modul apa, berkas apa", sementara agen di setiap tahap harus menebak konteksnya. Akibatnya terlihat pada item STD-0038 sampai STD-0048:

- `modul_terdampak` hampir selalu kosong, karena form Permintaan Baru tidak mengirimnya. Aturan per area (`studio_aturan` lapis `area`) jadi jarang terpakai.
- Prompt agen tidak memuat katalog modul, halaman asal, maupun berkas terkait. Agen harus menelusuri sendiri dan sering melenceng: HTML polos, rute tanpa sidebar, isian UUID.
- QA tidak punya pegangan per modul, misalnya halaman apa saja yang ada, uji apa yang sudah ada, dan panduan mana yang harus ikut diperbarui.

## 2. Tujuan

Di setiap halaman OpenSIMRS ada **tombol mengambang samar** yang membuka **Asisten Pengembang** dengan tiga peran: **Product**, **Engineer**, dan **QA**. Konteks halaman (modul, fitur, izin, berkas, item Studio terkait, galat terakhir) ditangkap otomatis dan diteruskan ke permintaan Studio serta ke setiap tahap agen. Dengan begitu, penambahan fitur per modul punya konteks yang tepat sejak awal.

Batasan:
- Hanya **superadmin**, hanya saat **Mode Pengembang aktif** (`studioAktif()`), dan tidak pernah di lingkungan produksi (`pastikanBukanProduksi`).
- Asisten **tidak mengubah kode**. Semua perubahan tetap lewat alur Studio (permintaan → … → rilis) beserta gerbang persetujuan per peran.
- Asisten tidak membaca data pasien dan tidak mengambil tangkapan layar. Konteks yang dikirim disaring dari data pribadi.

## 3. Pengalaman pengguna

### 3.1 Tombol mengambang

- Bulatan 40 px di **kanan bawah** (keputusan pemilik), di atas footer. Panel terbuka ke atas dari tombol, jadi tombol simpan halaman tetap bisa dijangkau dengan menutup panel. Ikon `PhFlask`, warna opensimrs. **Opasitas 35%** saat diam dan 100% saat disorot atau difokus.
- Muncul di semua halaman aplikasi, termasuk APM dan layar antrean, kecuali halaman SIMRS Studio sendiri dan login. Perangkat kiosk/TV memakai akun non-superadmin sehingga pasien tidak melihatnya.
- Tooltip menampilkan modul halaman, misalnya *"Asisten pengembang · Rawat Inap › HDU"*.
- Titik kecil berwarna bila ada item Studio aktif untuk modul halaman ini, atau bila tercatat galat API di halaman ini.
- Bisa disembunyikan untuk sesi itu (ikon mata di header panel, *Sembunyikan sampai login ulang*). Pintasan keyboard: `Ctrl+Shift+.`.

### 3.2 Panel

Panel samping kiri (pola sama dengan panel Bantuan: `Teleport`, `fixed`, `rounded-2xl`), dengan tiga tab:

| Tab | Untuk | Isi |
|---|---|---|
| **Konteks** | semua | Modul, fitur, dan izin halaman ini. Berkas frontend/backend terkait. Panduan pengguna modul. Item Studio aktif dan riwayat STD untuk modul ini. Galat API/console terakhir di halaman ini. |
| **Product** | ide fitur | Mengubah gagasan menjadi permintaan: masalah, siapa, harapan, contoh, dengan modul dan halaman terisi otomatis. Asisten bertanya balik bila kebutuhan kabur, memeriksa apakah kebutuhan sudah dicakup fitur atau item lain, lalu **Jadikan permintaan**. |
| **Engineer** | pengembang | Penjelasan cara halaman ini bekerja: komponen, store, endpoint, tabel, dan izin. Dampak perubahan: modul lain yang memakai berkas yang sama, migrasi, dan konvensi yang berlaku. Bisa juga **Jadikan permintaan** berjenis perbaikan atau fitur. |
| **QA** | penguji | Kasus uji untuk halaman ini, termasuk tes otomatis yang sudah ada dan celahnya. **Laporkan masalah** membuat permintaan perbaikan berisi langkah reproduksi dan galat yang tertangkap. **Cek konsistensi tampilan** memeriksa halaman terhadap konvensi: Card + PageToolbar, tanpa `prompt()`, tanpa isian UUID. |

"Jadikan permintaan" selalu menampilkan pratinjau yang bisa disunting sebelum dikirim. Hasilnya sama dengan item yang dibuat dari halaman Studio, ditambah konteks asal.

## 4. Konteks halaman

Ditangkap di frontend dari keadaan yang sudah ada, tanpa membaca isi data:

| Unsur | Sumber |
|---|---|
| path & nama rute | `useRoute()` (parameter UUID diganti `:uuid`) |
| modul katalog | `modulUntukPath(path, katalog)` (`stores/modulFaskes.ts`) |
| fitur katalog | `fiturUntukPath` (diekspor) |
| izin halaman | `resolveRoutePermission(path)` (`utils/permissions.ts`) |
| komponen halaman | nama komponen `route.matched[*]` & `meta.page` |
| status modul/fitur faskes | `modulFaskes` (aktif, segera, override) |
| galat API terakhir | penampung bergilir di interceptor axios: metode, path tanpa query, status, `message` respons. **Tanpa body maupun nilai parameter.** Maksimal 10 kejadian dan hanya untuk halaman ini. |
| galat console | `window.onerror` / `unhandledrejection`: pesan + berkas:baris, maksimal 5 |

Semua teks melewati penyaring data pribadi (`temukanDataPribadi` di studio-service dan `samarkanDataPribadi` di setting-service) sebelum dikirim.

## 5. Peta modul (sumber konteks backend)

Asisten dan agen butuh peta **modul → berkas** yang dapat dipercaya. Untuk itu ditambahkan:

- **`scripts/peta-modul.mjs`**: membangkitkan `database/data/peta-modul.json` dari sumber yang sudah ada:
  - katalog (kode, rute, menu, fitur);
  - router frontend (rute → komponen halaman);
  - impor store di halaman tersebut, lalu pemanggilan API → awalan endpoint → berkas rute backend;
  - folder `test/`;
  - panduan pengguna, lewat **field baru `panduan` di katalog** sebagai pengganti tebakan nama berkas;
  - `docs/fitur/STD-*.md`.
- Dijalankan `npm run docs:peta`. CI memeriksa keselarasan (`--cek`) seperti `dokumen-katalog.mjs`.

Contoh entri:

```json
{ "kode": "hdu", "rute": ["/rawat-inap/hdu"], "frontend": ["frontend-service/src/views/Hdu/"],
  "store": ["frontend-service/src/stores/rawatInap/hdu.ts"], "endpoint": ["/api/v3/ranap/hdu"],
  "backend": ["rawat-inap-service/src/routes/hdu-routes.js", "rawat-inap-service/src/services/hdu-service.js"],
  "uji": ["rawat-inap-service/tests/hdu.test.js"], "panduan": "docs/panduan-pengguna/rawat-inap.md",
  "riwayat": ["STD-0046"] }
```

## 6. Integrasi dengan alur Studio

1. **Item baru** menyimpan `konteks_asal JSONB` (kolom baru di `studio_item`), berisi path, modul, fitur, izin, komponen, dan galat yang dilampirkan. `modul_terdampak` terisi otomatis dari modul halaman.
2. **Form Permintaan Baru** di Studio juga mendapat pemilih modul dari katalog, supaya permintaan dari luar halaman pun bermodul.
3. **Prompt setiap tahap** (`konteksTambahan` → `susunPromptDokumen`/`susunPromptCoding`) mendapat dua bagian baru:
   - *Konteks asal*: halaman, modul, fitur, izin, dan galat.
   - *Peta modul terdampak*: berkas frontend/backend/uji/panduan dari `peta-modul.json`. Agen langsung tahu berkas dan pola acuan modul itu, sehingga tidak perlu menebak.
4. **Aturan area** dicocokkan juga dengan kode modul dari peta, sehingga aturan per modul otomatis terpakai.
5. **QA:** rencana uji memakai daftar halaman dan uji modul dari peta. Item hasil "Laporkan masalah" membawa langkah reproduksi dan galat asli.
6. **Pemeriksa kebijakan:** item yang mengubah halaman modul tetapi tidak memperbarui `panduan` modul diberi peringatan (bukan blokir).

## 6a. Audit cepat halaman (opsional)

Audit hanya berjalan bila superadmin menekan **Jalankan audit** di tab Audit. Audit tidak wajib untuk jenis permintaan apa pun dan tidak menghalangi pengiriman permintaan. Pemeriksaannya statis dan tanpa AI, jadi tidak memakai kuota konektor.

**Cakupan berkas**
- Komponen Vue halaman, ditambah impor lokalnya (`views/`, `components/` non-Base, `stores/`) sampai dua tingkat.
- Berkas backend yang melayani endpoint halaman. Endpoint dibaca dari dua sumber:
  - kode, meliputi helper `apiXxxGet`, instance axios, dan pembungkus lokal seperti `apiJadwal`, `bacaGaji`, dan method store Pinia;
  - panggilan yang teramati di peramban selama sesi, dicatat sebagai metode, path tersamarkan, dan status.
- Endpoint dilacak ke layanan lewat prefix `/api/v3/<layanan>` atau nama helper, lalu ke berkas rute lewat kecocokan string rute, folder, dan nama berkas. Impor relatif berkas rute ikut diperiksa satu tingkat.
- Skema tabel dibaca dari `schema.sql`, migrasi (termasuk tabel dinamis `hr_gaji_${nama}`), dan model SDK.

**Lima aspek**

| Aspek | Contoh pemeriksaan |
|---|---|
| Fungsional | Kelamin hanya dibandingkan satu bentuk ('Female'/'Male' tanpa 'Perempuan'/'Laki-laki'); endpoint tidak terlacak di backend; status 404/405/5xx/403 yang teramati; halaman belum terpetakan ke katalog; halaman tanpa entri izin rute; modul izin tidak sesuai menu katalog; isian UUID; `prompt()`/`confirm()`/`alert()`; import `@/main`; Card + PageToolbar; TODO/FIXME; cek tampilan DOM |
| Query | Parameter menempel `<:`; soft delete tidak disaring; `SELECT *`; daftar berurutan tanpa `LIMIT` |
| Relasi | Tabel tidak dikenal skema; JOIN/include wajib ke alamat atau tanggal lahir (pasien tidak lengkap hilang dari daftar); JOIN ke tabel ber-`deleted_at` tanpa syarat alias; LEFT JOIN yang berubah menjadi INNER karena syarat di WHERE |
| Logika | **Pemanggilan metode tidak cocok dengan definisinya** (lintas berkas: argumen wajib kurang, transaksi terkirim ke parameter lain, argumen berlebih); payload camelCase sebelum disimpan ke model snake_case; `catch {}` kosong; `forEach(async …)`; UPDATE/DELETE tanpa WHERE; beberapa penulisan tanpa transaksi; waktu milidetik; UUID tertanam; galat JavaScript halaman |
| Keamanan | `faskes_uuid` dari body/query; query tanpa isolasi faskes; masukan `req` disisipkan ke SQL; sisipan `${…}` lain di SQL; `v-html`; rahasia tertanam; `eval`; log body permintaan; stack trace ke klien; rute tanpa middleware izin |

**Hasil dan tindak lanjut**
- Setiap temuan punya tingkat (tinggi/sedang/rendah), rincian, dan bukti `berkas:baris`.
- Pemeriksaan heuristik bertanda *perlu dicek*. Untuk menekan positif palsu:
  - fragmen dinamis (`WHERE ${kondisi}`) tidak dinilai isolasi faskes atau soft delete-nya;
  - `${n}`, konstanta `NAMA(...)`, dan sisipan bersyarat berisi literal dianggap aman;
  - `MAX()` untuk penomoran diturunkan ke tingkat rendah.
- Temuan yang dipilih bisa dijadikan permintaan. Formulir Engineer (atau QA bila semuanya fungsional) terisi otomatis, dan temuan ikut ke `konteks_asal.audit`, lalu dibaca agen di setiap tahap dengan catatan "verifikasi di kode sebelum diubah".
- Endpoint: `POST /api/v3/studio/asisten/audit-cepat` (superadmin). Endpoint ini hanya membaca repo dan dicatat di `studio_audit`.
- Audit mendalam berbasis AI menyusul di F2: penelusuran logika bisnis dan ambiguitas aturan yang tidak tertangkap pemeriksaan statis.

## 7. Asisten percakapan (Product/Engineer/QA)

- Endpoint `POST /api/v3/studio/asisten/tanya` dengan body `{ peran, konteks, pesan, sesi }` dan jawaban streaming.
- Dijalankan lewat rantai konektor Studio yang sudah ada (Claude Code/API/Codex, kuota & batas biaya berlaku) dalam **mode baca saja**: tanpa Edit/Write/exec, mirip tahap dokumen.
- Prompt dasar: `ATURAN_PLATFORM` + persona peran + konteks halaman + peta modul + aturan area modul + item aktif modul. Ditambah larangan: tidak menyatakan sesuatu sudah disetujui, dan tidak menjanjikan perubahan tanpa permintaan Studio.
- Riwayat percakapan disimpan per sesi (tabel `studio_asisten_sesi`, 30 hari) dan bisa dilampirkan ke permintaan yang dibuat dari sesi itu.

## 8. Keamanan & batasan

- Tombol, panel, dan endpoint diperiksa di dua sisi: frontend (`isSuperadmin() && studioAktif()`) dan studio-service (`wajibSuperadmin` + Mode Pengembang aktif + kill switch + bukan produksi).
- Tidak ada tangkapan layar dan tidak ada isi respons API. Data pribadi disaring sebelum disimpan maupun dikirim ke model.
- Agen asisten tidak punya alat tulis. Perubahan hanya lewat item Studio dan gerbangnya.
- Audit: setiap "Jadikan permintaan" dan setiap sesi asisten dicatat di `studio_audit`.

## 9. Tahapan pembangunan

| Fase | Isi | Hasil yang bisa dirasakan |
|---|---|---|
| **F1 — Konteks & permintaan dari halaman** | Tombol mengambang + tab Konteks, penangkap galat, `konteks_asal`, pemilih modul di Permintaan Baru, konteks asal di prompt. Tab Product/Engineer/QA berupa **form terarah tanpa AI**. | Setiap permintaan baru bermodul dan membawa halaman asal, sehingga agen tahu tempatnya. |
| **F1b — Audit cepat (opsional)** | Tab Audit: pemeriksaan statis lima aspek (fungsional, query, relasi, logika, keamanan) atas berkas halaman + backend-nya, pencatat endpoint halaman, temuan → permintaan. | Celah dan logika yang terlewat di modul/halaman terlihat sebelum permintaan dibuat. |
| **F2 — Peta modul** | `peta-modul.mjs`, field `panduan` di katalog, peta di prompt, aturan area per modul, cek CI. | Agen coding langsung memakai pola dan berkas modul yang benar. |
| **F3 — Asisten percakapan** | `/asisten/tanya` baca saja + sesi + "Jadikan permintaan" dari percakapan. | Diskusi ide dan penjelasan kode langsung di halaman. |
| **F4 — QA lanjutan** | Cek konsistensi tampilan dari halaman, rencana uji dari peta, **Uji di aplikasi** (pratinjau branch item di mode worktree). | Masalah tampilan dan bug ketahuan sebelum Rilis. |

## 10. Keputusan

Sudah disepakati (2026-10-20):
1. Tombol di **kanan bawah**.
2. Asisten percakapan (F3) memakai **rantai konektor dan kuota yang sama** dengan agen pengembangan: batas biaya, henti di kuota, dan antrean *Menunggu kuota* berlaku sama.
3. Pembangunan dimulai dari **F1**.
4. Audit bersifat **opsional**: hanya bila diklik, tanpa kewajiban untuk jenis permintaan apa pun. Aspek audit dibagi menjadi fungsional, query, relasi, logika, dan keamanan.

Masih terbuka:
1. Apakah peran selain superadmin yang punya izin modul SIMRS Studio (mis. QA, Product) boleh memakai asisten di kemudian hari. Usulan: tidak di F1–F2, ditinjau di F3.
