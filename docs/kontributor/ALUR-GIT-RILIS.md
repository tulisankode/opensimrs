# Versi, Branch, dan Aturan Merge

Aturan ini berlaku untuk semua contributor (developer, implementator, tester/QA, product development) yang mengirim perubahan ke repo [tulisankode/opensimrs](https://github.com/tulisankode/opensimrs), termasuk perubahan dokumen. Ringkasan cepat ada di [bagian 7](#7-ringkasan-cepat).

**Prinsip utama:**

1. **`main` selalu sehat.** Setiap commit di `main` lulus CI dan bisa dipasang di lingkungan development dan staging.
2. **Semua perubahan lewat Pull Request (PR),** termasuk dari maintainer. Tidak ada push langsung ke `main`.
3. **Branch berumur pendek.** Pekerjaan besar dipecah menjadi beberapa PR kecil, bukan ditumpuk di satu branch berbulan-bulan.
4. **Satu versi untuk satu monorepo.** Semua layanan, frontend, SDK, dan migrasi dirilis bersama dengan satu nomor versi.

---

## Daftar isi

1. [Versioning](#1-versioning)
2. [Branch](#2-branch)
3. [Aturan merge](#3-aturan-merge)
4. [Menjaga branch tetap mutakhir & menyelesaikan konflik](#4-menjaga-branch-tetap-mutakhir--menyelesaikan-konflik)
5. [Proses rilis](#5-proses-rilis)
6. [Pengaturan repo GitHub (untuk maintainer)](#6-pengaturan-repo-github-untuk-maintainer)
7. [Ringkasan cepat](#7-ringkasan-cepat)

---

## 1. Versioning

### 1.1 Versi produk

OpenSIMRS memakai [Semantic Versioning](https://semver.org/lang/id/) `MAYOR.MINOR.PATCH` (rincian di [CHANGELOG](../../CHANGELOG.md#skema-versi)).

- **Satu sumber versi:** field `version` di `package.json` root, tag git `vX.Y.Z`, dan judul bagian di `CHANGELOG.md`. Ketiganya selalu sama.
- Field `version` di `package.json` tiap layanan dan frontend **tidak dipakai** untuk rilis dan tidak perlu diubah.
- Versi hanya dinaikkan oleh Core Maintainer saat rilis ([bagian 5](#5-proses-rilis)). Contributor **tidak** mengubah nomor versi di PR biasa.

### 1.2 Tahapan pada fase pengembangan

Selama belum mencapai `1.0.0`, versi bergerak melalui tahap pra-rilis:

| Tahap | Contoh | Arti | Perubahan tidak kompatibel |
|---|---|---|---|
| **alpha** | `1.0.0-alpha.1`, `-alpha.2`, … | Fitur masih bertambah. Belum disarankan untuk produksi tanpa uji paralel. Dirilis kira-kira tiap 2–4 minggu atau tiap tonggak di [Roadmap](../ROADMAP.md). | **Boleh**, asalkan dicatat di CHANGELOG pada kategori *Diubah* dengan awalan **⚠ Tidak kompatibel** dan disertai langkah pembaruan. |
| **beta** | `1.0.0-beta.1` | Fitur untuk segmen sasaran sudah lengkap. Fokus pada stabilisasi dan uji di faskes percontohan. | Hanya bila tidak ada jalan lain, dan harus disetujui Core Maintainer. |
| **rc** | `1.0.0-rc.1` | Kandidat rilis. Hanya perbaikan bug P1/P2 dan keamanan. | Tidak boleh. |
| **stabil** | `1.0.0`, `1.1.0`, `1.1.1` | SemVer penuh. | Hanya di rilis MAYOR (`2.0.0`). |

Perpindahan tahap (alpha ke beta ke rc ke stabil) diputuskan Core Maintainer dan diumumkan di kanal komunitas ([COMMUNITY.md](../../COMMUNITY.md)).

### 1.3 Versi SDK (`packages/*`)

`@opensimrs/model-sdk`, `@opensimrs/authorization-sdk`, dan `@opensimrs/permission-sdk` punya versi SemVer sendiri di `package.json` masing-masing. SDK ini tidak diterbitkan ke npm; layanan memakainya lewat `file:../packages/...`.

- Naikkan versi SDK **di PR yang mengubah SDK**:
  - PATCH untuk perbaikan;
  - MINOR untuk ekspor, model, atau kolom baru;
  - MAYOR bila ada ekspor yang dihapus atau perilakunya berubah.
- Perubahan SDK dicatat di CHANGELOG produk, mis. *"SDK model 1.2.0: model `OrderRadiologi`"*.
- Perubahan MAYOR pada SDK wajib memperbarui **semua** layanan pemakainya di PR yang sama, karena monorepo tidak menyimpan dua versi SDK sekaligus.

### 1.4 Versi API

- Semua layanan memakai awalan `/api/v3`. Awalan ini hanya naik (`/api/v4`) pada rilis MAYOR.
- Endpoint yang dipakai pihak luar (aplikasi mobile `/admisi/mobile/pasien/*`, integrasi, LIS) **tidak boleh diubah secara tidak kompatibel** tanpa masa transisi. Caranya:
  1. tambahkan field atau endpoint baru;
  2. tandai yang lama sebagai *Usang* di CHANGELOG;
  3. hapus paling cepat satu rilis MINOR kemudian, atau satu rilis alpha/beta pada fase pengembangan.
- Kontrak antar-layanan internal boleh berubah, asalkan pemanggil dan penerima diubah dalam PR yang sama.

### 1.5 Migrasi database

- Nama berkas: `database/migrations/YYYYMMDDHHMMSS-deskripsi_singkat.cjs` dengan cap waktu **UTC saat berkas dibuat**.
- Saat PR di-merge, migrasi baru harus berurutan **paling akhir** dibanding semua migrasi di `main`. Bila `main` sudah punya migrasi yang lebih baru, ganti cap waktu berkas Anda sebelum merge.
- **Jangan pernah mengubah migrasi yang sudah ada di `main`.** Faskes mungkin sudah menjalankannya. Perbaikan selalu ditulis sebagai migrasi baru.
- Migrasi wajib **idempoten**. CI menjalankannya dua kali dan kali kedua tidak boleh mengubah apa pun.
- Isi `down()` bila memungkinkan. Bila tidak, tulis alasannya di komentar berkas.
- Perubahan katalog modul (`database/data/katalog-modul.json`) selalu disertai migrasi yang memanggil `sinkronKatalog` dan pembaruan `docs/MANAJEMEN-MODUL.md` (`npm run docs:katalog`). Lihat [Manajemen Modul](../MANAJEMEN-MODUL.md).

---

## 2. Branch

### 2.1 Branch di repo utama

| Branch | Fungsi | Siapa yang menulis |
|---|---|---|
| `main` | Garis pengembangan utama, selalu sehat. Rilis alpha diambil dari sini. | Hanya lewat PR yang lulus syarat merge |
| `release/X.Y` | Stabilisasi satu rilis, mis. `release/1.0`. Dibuat saat masuk tahap **beta**. Setelah stabil, branch ini dipakai untuk rilis PATCH. | Hanya perbaikan, lewat PR ([2.4](#24-release-dan-hotfix)) |

Selama tahap alpha **tidak ada** branch `release/*`: setiap rilis alpha ditandai langsung dari `main`. Branch `develop`, `staging`, atau `production` tidak dipakai, karena lingkungan staging dan production memasang **tag rilis**, bukan branch ([Lingkungan](../LINGKUNGAN.md)).

### 2.2 Branch kerja

- **Contributor** membuat branch kerja di **fork** masing-masing.
- **Maintainer** boleh membuat branch kerja langsung di repo utama dengan aturan nama yang sama. Branch itu dihapus otomatis setelah merge.

**Nama branch:** `<jenis>/<id>-<ringkasan>`. Ditulis huruf kecil, kata dipisah tanda hubung, dan maksimal ±50 karakter.

| Jenis | Untuk | Contoh |
|---|---|---|
| `feat` | Fitur baru | `feat/b-17-program-kia` |
| `fix` | Perbaikan bug | `fix/b-45-batal-order-lab`, `fix/123-kuitansi-diskon` |
| `docs` | Dokumen | `docs/panduan-satusehat` |
| `refactor`, `test`, `perf`, `chore`, `ci` | Sesuai [konvensi commit](../../CONTRIBUTING.md#3-konvensi-commit) | `chore/naikkan-vite` |
| `hotfix` | Perbaikan darurat untuk rilis stabil | `hotfix/1.0.1-login-gagal` |

`<id>` diisi ID backlog (`b-17`) atau nomor issue (`123`). Untuk perubahan kecil tanpa ID, cukup ringkasannya.

### 2.3 Umur branch dan pekerjaan besar

- Usahakan branch kerja **di-merge dalam 2 minggu**. Branch yang lebih lama hampir pasti bentrok dengan `main`.
- Fitur besar dipecah menjadi beberapa PR, masing-masing tetap lulus CI. Bagian yang belum siap dipakai pengguna **disembunyikan dengan Manajemen Modul**: status modul *Segera* (`tersedia: false`), atau fitur dimatikan lewat preset segmen. Jangan menahannya di branch panjang. Lihat [Manajemen Modul](../MANAJEMEN-MODUL.md).
- Pekerjaan yang belum selesai boleh dibuka sebagai **Draft PR** agar arahnya bisa dikomentari lebih awal.
- Klaim pekerjaan mengikuti aturan di [Roadmap](../ROADMAP.md): klaim yang tidak ada kabar selama 14 hari dianggap lepas.

### 2.4 Release dan hotfix

Berlaku mulai tahap beta.

1. **Membuat branch rilis:** saat beta dimulai, Core Maintainer membuat `release/X.Y` dari `main`. Fitur baru tetap masuk `main` untuk versi berikutnya.
2. **Perbaikan untuk rilis yang sedang distabilkan:** PR tetap ke `main` terlebih dahulu. Setelah di-merge, maintainer memindahkannya ke `release/X.Y` dengan `git cherry-pick -x <commit>` lewat PR berlabel `backport`.
3. **Hotfix rilis stabil:** untuk bug P1 atau keamanan di versi yang sudah dipakai faskes.
   1. Buat `hotfix/X.Y.Z-ringkasan` dari `release/X.Y`.
   2. Kirim PR ke `release/X.Y`, lalu rilis PATCH (`vX.Y.Z`).
   3. Di hari yang sama, kirim PR yang sama ke `main` (*forward-port*) agar perbaikannya tidak hilang di versi berikutnya.
4. **Celah keamanan** tidak dikerjakan di PR publik sebelum perbaikannya dirilis. Laporkan secara privat sesuai [SECURITY.md](../../SECURITY.md); maintainer memakai *GitHub Security Advisory* (private fork).

---

## 3. Aturan merge

### 3.1 Syarat umum (semua PR)

- [ ] **CI hijau**: cek sintaks layanan dan `packages/`, uji unit, `schema.sql` + migrasi dua kali, cek katalog, build frontend.
- [ ] **Jumlah persetujuan** sesuai tabel [3.2](#32-siapa-yang-harus-menyetujui). Penulis PR tidak menyetujui PR-nya sendiri.
- [ ] **Semua percakapan review sudah ditandai selesai** (*resolved*).
- [ ] **Branch mutakhir** terhadap target (`main` atau `release/X.Y`) dan tanpa konflik.
- [ ] **Entri CHANGELOG** di bagian *[Belum dirilis]* untuk perubahan yang terasa oleh pengguna atau implementator ([CONTRIBUTING bagian 7](../../CONTRIBUTING.md#7-changelog)).
- [ ] **Dokumen ikut diperbarui** bila perilaku, perintah, `.env`, atau langkah instalasi berubah.
- [ ] **Tanpa rahasia dan data nyata**: tidak ada `.env`, kunci, IP server faskes, atau data atau screenshot pasien asli.
- [ ] **Migrasi baru** (bila ada) berurutan paling akhir dan idempoten ([1.5](#15-migrasi-database)).

### 3.2 Siapa yang harus menyetujui

| Jenis perubahan | Persetujuan minimal |
|---|---|
| Dokumen, salah ketik, terjemahan | 1 Reviewer atau Maintainer |
| Perbaikan bug atau fitur di satu modul | 1 Maintainer bidang terkait |
| Perubahan **lintas layanan**, **SDK `packages/`**, **migrasi database**, **autentikasi/izin**, **integrasi** (SATUSEHAT, BPJS, LIS), **CI/deploy**, **dependensi mayor** | **2 persetujuan**, minimal 1 dari **Core Maintainer** |
| Perubahan **alur atau form klinis** (RME, resep, hasil lab, triase, dll.) | Syarat di atas **ditambah** 1 persetujuan reviewer tenaga medis/klinis (label `butuh tenaga medis/klinis`) |
| Arsitektur inti dan perubahan besar | Lewat **RFC** terlebih dahulu ([GOVERNANCE](../../GOVERNANCE.md#rfc-request-for-comments)) |

- **Masa tunggu:** PR yang butuh 2 persetujuan dibiarkan terbuka minimal **48 jam** sejak siap ditinjau, agar contributor lain sempat membaca. Perbaikan P1 dan keamanan dikecualikan.
- Persetujuan **gugur** bila ada commit baru yang mengubah isi secara berarti setelah persetujuan diberikan. Minta tinjauan ulang.

### 3.3 Cara merge

- **Bawaan: _Squash and merge_.** Satu PR menjadi satu commit di `main`. Judul commit hasil squash mengikuti [konvensi commit](../../CONTRIBUTING.md#3-konvensi-commit) ditambah nomor PR, mis. `fix(lab): B-45 pembuatan order lab dalam satu transaksi (#57)`. Maintainer yang melakukan merge merapikan judul dan isi pesan bila perlu.
- **_Rebase and merge_** hanya bila PR terdiri dari beberapa commit yang rapi dan masing-masing bermakna, mis. migrasi terpisah dari perubahan layanan. Keputusan ada di maintainer.
- **Merge commit tidak dipakai** di `main` dan `release/*`, agar riwayat tetap lurus.
- **Yang menekan tombol merge:** maintainer, bukan penulis PR, kecuali penulisnya maintainer dan PR sudah memenuhi semua syarat.
- Branch kerja dihapus setelah merge.

### 3.4 Masa beku (freeze) sebelum rilis

- **3 hari sebelum rilis alpha/beta** (diumumkan di Telegram/Discord), `main` hanya menerima perbaikan bug, dokumen, dan uji. Fitur yang sudah disetujui menunggu sampai rilis selesai.
- Pada tahap **rc**, freeze berlaku terus-menerus di `release/X.Y`.

### 3.5 Bila `main` rusak

Bila CI di `main` merah atau ada regresi P1 setelah merge, maintainer mana pun **langsung me-revert** commit penyebabnya lewat PR revert (`git revert <commit>`) tanpa menunggu penulisnya. Ini bukan hukuman. Penulis memperbaiki di PR baru.

### 3.6 PR yang tidak aktif

PR tanpa aktivitas 30 hari diberi label `stale`. Bila 14 hari kemudian tetap tidak ada aktivitas, PR ditutup. PR yang ditutup boleh dibuka kembali kapan saja.

---

## 4. Menjaga branch tetap mutakhir & menyelesaikan konflik

```bash
git fetch upstream
git rebase upstream/main          # sebelum review dimulai: rebase, lalu
git push --force-with-lease       # perbarui branch di fork Anda
```

- **Sebelum review dimulai:** rebase ke `upstream/main` agar riwayat bersih. Pakai `--force-with-lease`, jangan `--force`.
- **Setelah review dimulai:** jangan force-push kecuali diminta reviewer. Untuk mengejar `main`, gunakan `git merge upstream/main` di branch Anda. Riwayatnya tetap bersih karena PR akan di-squash.
- **Konflik diselesaikan oleh penulis PR.** Setelah menyelesaikan konflik, jalankan ulang uji yang relevan.
- **Konflik migrasi:** bila PR lain menambah migrasi dengan cap waktu lebih baru, ganti nama berkas migrasi Anda dengan cap waktu terbaru lalu jalankan `npm run db:migrate` di database lokal.
- **Konflik `package-lock.json`:** ambil versi dari `main`, lalu jalankan `npm install` di folder terkait. Jangan menyunting lock file secara manual.

---

## 5. Proses rilis

Dilakukan oleh Core Maintainer.

1. **Persiapan:** umumkan freeze ([3.4](#34-masa-beku-freeze-sebelum-rilis)). Pastikan tidak ada issue P1 terbuka untuk tonggak ini.
2. **PR rilis** `chore(rilis): vX.Y.Z[-tahap.N]`:
   - pindahkan isi *[Belum dirilis]* di CHANGELOG ke bagian versi baru beserta tanggalnya;
   - perbarui tautan perbandingan di bawah CHANGELOG;
   - naikkan `version` di `package.json` root (dan `package-lock.json` root dengan `npm install --package-lock-only`).
3. **Merge** PR rilis dengan aturan biasa.
4. **Tag beranotasi** pada commit hasil merge:
   ```bash
   git tag -a v1.0.0-alpha.2 -m "OpenSIMRS 1.0.0-alpha.2"
   git push upstream v1.0.0-alpha.2
   ```
   Tag tidak pernah dipindah atau dihapus setelah di-push. Bila ada kesalahan, rilis versi berikutnya.
5. **GitHub Release** dari tag tersebut. Isinya bagian CHANGELOG versi itu. Tandai *pre-release* untuk alpha, beta, dan rc.
6. **Staging:** pasang tag di staging, jalankan migrasi, lalu uji skenario P1 di [rencana pengujian](../testing/rencana-testing.md).
7. **Umumkan** di kanal komunitas, termasuk langkah pembaruan dan migrasi baru. Implementator memperbarui production sesuai [Lingkungan](../LINGKUNGAN.md).

---

## 6. Pengaturan repo GitHub (untuk maintainer)

Pengaturan berikut menegakkan aturan di atas secara otomatis. Atur di **Settings → Branches / Rules → Rulesets** untuk `main` dan `release/*`:

- Wajib lewat Pull Request; persetujuan minimal 1, sedangkan aturan 2 persetujuan untuk area tertentu ditegakkan lewat `CODEOWNERS`.
- **Dismiss stale approvals** saat ada commit baru.
- **Require conversation resolution** sebelum merge.
- **Require status checks**: job `services` dan `frontend` dari CI; branch harus mutakhir.
- **Require linear history**; blokir *force push* dan penghapusan branch.
- Termasuk administrator; tidak ada pengecualian.
- Di **Settings → General**: aktifkan hanya *Allow squash merging* (judul default: judul PR) dan *Allow rebase merging*; matikan *Allow merge commits*; aktifkan *Automatically delete head branches*.
- Tambahkan `.github/CODEOWNERS` setelah ada maintainer per bidang, mis. `packages/ @tim-inti`, `database/migrations/ @tim-inti`, `lab-service/ @maintainer-lab`.
- Templat deskripsi PR ada di `.github/pull_request_template.md`.

---

## 7. Ringkasan cepat

| | Aturan |
|---|---|
| **Versi** | SemVer, satu versi untuk seluruh monorepo (root `package.json` = tag `vX.Y.Z` = CHANGELOG). Fase pengembangan: `-alpha.N` → `-beta.N` → `-rc.N` → `1.0.0`. Contributor tidak menaikkan versi produk. |
| **SDK** | Versi sendiri di `packages/*/package.json`, dinaikkan di PR yang mengubah SDK. |
| **Migrasi** | `YYYYMMDDHHMMSS-…cjs` (UTC), paling akhir saat merge, idempoten, migrasi lama tidak pernah diubah. |
| **Branch** | Kerja di fork: `<jenis>/<id>-<ringkasan>` dari `main`, umur ≤ 2 minggu. Repo utama hanya `main` (+ `release/X.Y` mulai beta). |
| **PR** | Satu tujuan per PR, CI hijau, CHANGELOG, tanpa data/rahasia. |
| **Persetujuan** | 1 maintainer; 2 (termasuk Core) untuk SDK, migrasi, auth, integrasi, lintas layanan, CI/deploy; + tenaga medis untuk alur klinis. |
| **Merge** | *Squash and merge* oleh maintainer; tanpa merge commit; branch dihapus. |
| **Darurat** | `main` rusak → revert dulu, perbaiki kemudian. Hotfix rilis stabil → `release/X.Y` lalu forward-port ke `main`. Celah keamanan → jalur privat. |
