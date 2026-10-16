# Rancangan: SIMRS Studio (mode pengembang berbasis AI)

> Status: **fase 0–5 sudah diimplementasikan** (lihat bagian 0 untuk keputusan & yang belum). Pemilik: Core Maintainer.
> Tujuan dokumen: memecah fitur sampai tingkat tugas agar tidak ada yang terlewat.
> Istilah domain mengikuti [CONTRIBUTING](../../CONTRIBUTING.md); alur rilis mengikuti [ALUR-GIT-RILIS](../kontributor/ALUR-GIT-RILIS.md).
> Di dokumen ini "Studio Pengembang" = **SIMRS Studio** (nama menu), dan modul katalog `studio_pengembang` diwujudkan sebagai sakelar **Mode Pengembang** di Setting › System.

## 0. Status implementasi

Sasaran: tim IT dapat menambah fitur dan modul OpenSIMRS dari dalam aplikasi, memakai langganan Claude yang sama dengan Claude Code di VS Code. Fase 0–5 sudah dibangun dengan keputusan berikut. Panduan pemakaian ada di [docs/SIMRS-STUDIO.md](../SIMRS-STUDIO.md).

| Fase / bagian | Yang dibangun | Keputusan / beda dari rancangan |
|---|---|---|
| **F0-1** helper superadmin | `@opensimrs/authorization-sdk/peran` → `isSuperadmin()` (SDK 1.2.0). Dipakai setting-service, auth-service, dan laporan-service. | Layanan lain dimigrasikan bertahap (cukup ganti impor). |
| **F0-2** `Context` global | `Context` di admisi, rawat-jalan, rawat-inap, igd, dan payment kini per permintaan (AsyncLocalStorage, `app.use(Context.middleware)`). Ada uji Jest untuk permintaan bersamaan. | API `get/set` tidak berubah, jadi ±125 titik baca tidak disentuh. |
| **F0-3** penegakan backend | `studio-service` menegakkan L1–L6 di setiap permintaan, dan runtime ekstensi menegakkan hak modul per ekstensi. | — |
| **F0-4–7** kerangka & aktivasi | Lapis aktivasi: **L1** `.env` `STUDIO_PENGEMBANG=aktif` (mati bawaan) → **L3** Mode Pengembang di Setting › System (superadmin) → **L5** modul izin **SIMRS Studio** per peran → **L4** fitur (coding & ekstensi mati bawaan) → **L6** kill switch. Coding/QA/rilis ditolak bila `LINGKUNGAN=production`. | **L3 berupa sakelar tingkat instalasi, bukan modul katalog per faskes** (keputusan pemilik), karena Studio mengubah kode yang dipakai semua faskes. Modul izin tidak ikut sinkron otomatis ke admin faskes. |
| **Fase 1** permintaan → PRD | Alur tahap & artefak berversi, diskusi per tahap, wawancara AI, pemindai data pribadi (teks & lampiran), lampiran (gambar/PDF/teks), triase (prioritas, jenis, modul terdampak), tunda/lanjutkan, batas biaya per tugas/item/bulan, batas kuota langganan (%), batas tugas per pengguna per jam, basis pengetahuan instalasi, audit, dan metrik §18. | — |
| **§8** gerbang | Gerbang per peran per tahap mengikuti risiko (Product, Pengusul, Reviewer klinis, Programmer, Reviewer kode, QA, Maintainer rilis, superadmin untuk kritis). Persetujuan hanya sah untuk dokumen terbaru. Ada opsi pemisahan tugas. Risiko naik otomatis dari desain/kode yang menyentuh zona kuning/merah dan tidak bisa diturunkan di bawah batas itu. | Pemisahan tugas **mati bawaan** selama maintainer masih satu orang. |
| **§9** aturan prompt | Lapis platform (tetap) → repo (CLAUDE.md) → instalasi → **area** (awalan path/modul) → **tambahan template tahap** → konteks item, ditambah pratinjau prompt efektif per tahap. | — |
| **§10** agen | Adaptor **Claude Code CLI** (langganan). Adaptor **API**: Anthropic, OpenAI, model lokal kompatibel OpenAI (Ollama, vLLM, LM Studio), dengan loop alat sendiri. Konektor & model **per tahap**, kunci API terenkripsi (AES-256-GCM). **Server MCP OpenSIMRS** (`studio-service/src/mcp.js`) menyediakan alat baca repo, skema DB tanpa data, katalog, serta daftar/baca item, kirim dokumen, dan kirim pesan untuk agen eksternal (OpenClaw, Claude Desktop, dll.). | Agen eksternal hanya bisa mengirim **dokumen** (tetap perlu persetujuan manusia). Alat tulis berkas lewat MCP hanya bila `STUDIO_MCP_TULIS=aktif`. |
| **Fase 2** ekstensi tanpa kode | Laporan (SELECT tervalidasi, READ ONLY, `statement_timeout`, wajib `:faskes_uuid`, tabel/kolom rahasia & fungsi sistem diblokir), **template cetak** (PDF dengan kop faskes), **formulir tambahan** (isian per pasien/kunjungan, hak modul per formulir). Dirakit agen AI dengan perbaikan otomatis saat validasi gagal, atau lewat editor JSON. Pratinjau, pasang/copot, menu **Ekstensi**, ekspor Excel. **Paket bertanda tangan Ed25519** → impor di Setting › Ekstensi (produksi, `EKSTENSI_KUNCI_PUBLIK`). | Runtime ada di **laporan-service** (berjalan juga di produksi). Konfigurasi faskes sebagai ekstensi belum dibuat. |
| **Fase 3** desain & coding | Coding di working tree (**mode workspace**, `npm run dev` sebagai pratinjau) atau **mode worktree** per item (isolasi, paralel, `node_modules` ditautkan). Pemeriksa kebijakan. Integrasi **GitHub/Gitea** untuk Draft PR, status PR & CI, dan **revisi dari komentar review**. Klasifikasi risiko otomatis dari berkas. | Sandbox kontainer dengan jaringan dibatasi **belum**: worktree mengisolasi berkas, bukan jaringan. Agen dibatasi lewat daftar alat/perintah & zona. |
| **Rilis lokal** (§16.3, keputusan pemilik) | **Mode rilis lokal (bawaan)**: IT RS tidak wajib push/PR. Branch item digabung ke branch lokal aplikasi RS (dengan migrasi otomatis & pembatalan via revert), dan item baru bercabang dari branch lokal. Mode PR dan keduanya tetap tersedia. **Server & Deploy**: kirim branch lokal ke server RS lain lewat SSH (kunci khusus Studio, sidik jari host disimpan, repo penampung, fast-forward, lalu `deploy.sh`) atau lewat `.bundle`. **Coding manual** (siapkan branch, pindai perubahan) untuk risiko kritis atau untuk melengkapi hasil agen. | Rekomendasi §16.3 (upstream sebagai bawaan) diganti: bawaan = lokal, upstream lewat mode PR. |
| **Fase 4** QA & rilis | Rencana uji menjadi **checklist kasus uji** (lulus/gagal/tidak berlaku + catatan); QA lulus mensyaratkan cek otomatis & checklist. Commit berulang (riwayat commit), push/PR, deteksi **merge & tag rilis**, estimasi biaya coding. | Uji e2e browser (Playwright) & preview environment per item belum dibuat; pratinjau = mode workspace. |
| **Fase 5** ekosistem | Berbagi ekstensi lewat paket bertanda tangan; agen eksternal lewat MCP; model lokal lewat konektor kompatibel OpenAI. | Katalog ekstensi komunitas (repositori bersama) menyusul. |

## Daftar isi

1. [Ringkasan](#1-ringkasan)
2. [Tujuan, non-tujuan, prinsip](#2-tujuan-non-tujuan-prinsip)
3. [Peran dan aktor](#3-peran-dan-aktor)
4. [Aktivasi: hanya oleh superadmin](#4-aktivasi-hanya-oleh-superadmin)
5. [Modul, fitur, dan bagian](#5-modul-fitur-dan-bagian)
6. [Alur kerja dan status](#6-alur-kerja-dan-status)
7. [Rincian tiap tahap](#7-rincian-tiap-tahap)
8. [Tingkat risiko dan gerbang persetujuan](#8-tingkat-risiko-dan-gerbang-persetujuan)
9. [Aturan prompt (guardrail)](#9-aturan-prompt-guardrail)
10. [Integrasi agen AI](#10-integrasi-agen-ai)
11. [Arsitektur](#11-arsitektur)
12. [Model data](#12-model-data)
13. [API](#13-api)
14. [Antarmuka (frontend)](#14-antarmuka-frontend)
15. [Keamanan, privasi, dan kepatuhan](#15-keamanan-privasi-dan-kepatuhan)
16. [Lingkungan, sandbox, dan rilis](#16-lingkungan-sandbox-dan-rilis)
17. [Kebutuhan non-fungsional](#17-kebutuhan-non-fungsional)
18. [Metrik keberhasilan](#18-metrik-keberhasilan)
19. [Risiko dan mitigasi](#19-risiko-dan-mitigasi)
20. [Fase dan breakdown pekerjaan](#20-fase-dan-breakdown-pekerjaan)
21. [Keputusan terbuka](#21-keputusan-terbuka)
22. [Lampiran: template artefak](#22-lampiran-template-artefak)

---

## 1. Ringkasan

**Studio Pengembang** adalah modul OpenSIMRS yang memungkinkan IT RS/klinik — termasuk yang belum mahir pemrograman — mengubah kebutuhan menjadi perubahan aplikasi yang siap rilis, dibantu agen AI, melalui tahapan:

**Permintaan → Use case → PRD → Desain teknis → Coding → QA → Rilis**

Setiap tahap dikerjakan bersama agen AI, tetapi **setiap perpindahan tahap disetujui manusia** sesuai perannya. Agen AI tidak pernah menyentuh lingkungan produksi atau data pasien; hasil akhirnya adalah **Pull Request** yang mengikuti proses review, CI, dan rilis OpenSIMRS yang sudah ada.

Modul ini **tidak tampil di mana pun** sampai **superadmin** mengaktifkannya (lihat [§4](#4-aktivasi-hanya-oleh-superadmin)).

## 2. Tujuan, non-tujuan, prinsip

### 2.1 Tujuan

| Kode | Tujuan |
|---|---|
| T-1 | IT RS dapat menuliskan kebutuhan dan dibantu AI sampai menjadi PRD yang lengkap dan dapat diuji. |
| T-2 | Agen AI dapat mengerjakan perubahan kode di sandbox dan membuka PR yang memenuhi aturan repo. |
| T-3 | QA mendapat rencana uji dan hasil uji otomatis yang terhubung ke kriteria terima PRD. |
| T-4 | Rilis mengikuti alur resmi (tag, CHANGELOG, staging) tanpa jalan pintas. |
| T-5 | Tidak terikat satu penyedia AI: Anthropic (Claude), OpenAI (GPT), model lokal, dan agen lain lewat standar terbuka (MCP). |
| T-6 | Semua tindakan (manusia dan AI) tercatat dan dapat diaudit. |

### 2.2 Non-tujuan (setidaknya sampai Fase 5)

- Mengubah aplikasi produksi secara langsung (hot patch, edit kode di server, eksekusi SQL tulis di produksi).
- Menggantikan review manusia atau persetujuan tenaga medis untuk alur klinis.
- Memberi AI akses ke data pasien nyata, kredensial integrasi, atau kunci server.
- Menjadi IDE umum; Studio fokus pada alur kebutuhan → rilis untuk OpenSIMRS.

### 2.3 Prinsip

1. **AI mengusulkan, manusia memutuskan.** Tidak ada persetujuan otomatis oleh AI, termasuk "AI menyetujui hasil AI lain".
2. **Tidak ada jalan pintas ke produksi.** Semua perubahan kode berakhir sebagai PR → CI → staging → tag rilis.
3. **Data pasien tidak pernah keluar.** Sandbox hanya memakai data demo fiktif.
4. **Aturan tertulis, bukan hafalan.** Aturan prompt berupa berkas berversi yang dibaca setiap agen.
5. **Risiko menentukan gerbang.** Semakin dekat ke alur klinis/keuangan, semakin banyak persetujuan.
6. **Netral vendor.** Penyedia AI dapat diganti tanpa mengubah alur.
7. **Mati secara bawaan.** Tidak aktif di instalasi baru; perlu tindakan sadar superadmin.

## 3. Peran dan aktor

| Peran | Siapa | Tanggung jawab di Studio | Catatan izin |
|---|---|---|---|
| **Superadmin** | Pengelola instalasi/platform (peran `super admin`) | Mengaktifkan/menonaktifkan Studio per faskes, mengatur konektor AI, batas biaya, kill switch, memberi peran Studio | Satu-satunya yang dapat mengaktifkan modul |
| **Pengusul** | IT RS / staf pengusul | Menulis permintaan, menjawab pertanyaan AI, menyetujui use case | Fitur Permintaan |
| **Product** | Product owner / kepala unit pemilik proses | Menetapkan prioritas, menyetujui PRD dan tingkat risiko | Fitur PRD (SETUJUI) |
| **Reviewer klinis** | Dokter/perawat/apoteker sesuai domain | Menyetujui PRD & hasil QA untuk risiko klinis tinggi | Wajib pada tingkat risiko Tinggi/Kritis |
| **Programmer** | Pengembang (internal RS atau komunitas) | Menyetujui desain teknis, mereview diff/PR, memperbaiki bila perlu | Fitur Coding (REVIEW) |
| **QA** | Penguji | Menyetujui rencana uji, menjalankan uji manual, menyatakan lulus/gagal | Fitur QA |
| **Maintainer rilis** | Core Maintainer OpenSIMRS / pengelola fork faskes | Merge PR, tag rilis, pasang di staging | Di luar Studio (GitHub) + fitur Rilis |
| **Agen AI** | Model AI lewat konektor | Menulis artefak, kode di sandbox, rencana uji, catatan rilis | Akun layanan terbatas, tanpa izin persetujuan |

Satu orang boleh memegang beberapa peran, **kecuali**: pembuat suatu artefak tidak boleh menjadi satu-satunya penyetuju artefak itu pada tingkat risiko Sedang ke atas (pemisahan tugas).

## 4. Aktivasi: hanya oleh superadmin

Studio Pengembang dikunci berlapis. Semua lapis harus terbuka agar menu tampil dan API dapat dipakai.

| Lapis | Mekanisme | Siapa | Bawaan |
|---|---|---|---|
| L1. Instalasi | Variabel `STUDIO_PENGEMBANG=aktif` di `.env` layanan `studio-service`; tanpa itu layanan menolak semua permintaan (503) | Pengelola server | Mati |
| L2. Lingkungan | Fitur Coding/QA/Rilis menolak berjalan bila `LINGKUNGAN=production` (lihat [§16](#16-lingkungan-sandbox-dan-rilis)) | Otomatis | — |
| L3. Modul per faskes | Modul `studio_pengembang` di katalog: `inti:false`, **tidak dimasukkan ke preset segmen mana pun** → hanya aktif lewat override Manajemen Modul, yang memang hanya bisa disimpan superadmin | Superadmin | Mati di semua segmen |
| L4. Fitur | Tiap fitur Studio (§5) dapat dimatikan per faskes; fitur berisiko (Coding, Ekstensi) **mati bawaan** walau modul aktif | Superadmin | Lihat §5 |
| L5. Izin peran | Modul izin "Studio Pengembang" tidak diberikan otomatis ke peran apa pun, termasuk admin faskes; superadmin memberikannya per peran | Superadmin | Tidak ada |
| L6. Kill switch | Tombol "Hentikan Studio" di Pengaturan Studio: membatalkan semua tugas agen berjalan, mencabut token agen, membekukan semua item | Superadmin | — |

Perilaku penting:

- **Penegakan di backend wajib.** Saat ini penegakan modul di backend baru sebagian (backlog B-11). `studio-service` **wajib** memeriksa sendiri pada setiap permintaan: L1 aktif, modul `studio_pengembang` aktif untuk `faskesUuid` token, fitur terkait aktif, dan izin pengguna. Menyembunyikan menu saja tidak cukup.
- **Superadmin ditentukan satu helper bersama.** Saat ini pengecekan nama peran `super admin` tersebar di beberapa layanan. Fase 0 menambahkan helper bersama (lihat [§20](#20-fase-dan-breakdown-pekerjaan)).
- **Superadmin tidak otomatis lolos semua gerbang.** Superadmin mengaktifkan dan mengatur, tetapi persetujuan tahap (PRD, QA) tetap mengikuti peran. Superadmin yang ingin menyetujui harus diberi peran tersebut dan tunduk pada pemisahan tugas.
- **Mematikan modul** tidak menghapus data: item Studio dibekukan (hanya-baca) dan tugas agen dibatalkan; mengaktifkan kembali memulihkan akses.
- Setiap aktivasi/nonaktivasi tercatat di `faskes_modul_riwayat` (sudah ada) **dan** `studio_audit` (baru).

## 5. Modul, fitur, dan bagian

### 5.1 Entri katalog modul

Ditambahkan ke `database/data/katalog-modul.json` (lewat migrasi `sinkronKatalog` baru, sesuai checklist [MANAJEMEN-MODUL §4](../MANAJEMEN-MODUL.md)):

```json
{ "kode": "studio_pengembang", "nama": "Studio Pengembang", "kelompok": "Platform", "inti": false, "tersedia": false,
  "deskripsi": "Pengembangan berbasis AI: permintaan, use case, PRD, coding di sandbox, QA, dan rilis. Hanya diaktifkan superadmin.",
  "menu": ["Studio Pengembang"], "rute": ["/studio"], "urutan": 31 }
```

- `tersedia:false` selama Fase 0–1 belum rampung (tampil "Segera" hanya bagi superadmin di Manajemen Modul); diubah `true` saat Fase 1 dirilis.
- **Tidak** ditambahkan ke `preset.segmen_modul` segmen mana pun.

### 5.2 Fitur dan bagian

| Kode fitur | Nama | Isi (bagian/kemampuan) | Wajib bila modul aktif | Bawaan saat modul aktif | Fase |
|---|---|---|---|---|---|
| `studio_beranda` | Beranda Studio | Papan (kanban) item per status; filter peran, risiko, modul terdampak; notifikasi tugas saya | Ya | Aktif | 1 |
| `studio_permintaan` | Permintaan | Formulir terpandu; wawancara AI (pertanyaan klarifikasi); deteksi duplikat terhadap item lain & fitur yang sudah ada di katalog; lampiran (tangkapan layar **wajib disamarkan**, dicek AI); triase (prioritas, modul terdampak) | Ya | Aktif | 1 |
| `studio_usecase` | Use case | Aktor, prasyarat, alur utama, alur alternatif & gagal, dampak ke modul lain; diagram alur (teks/Mermaid) | Ya | Aktif | 1 |
| `studio_prd` | PRD | PRD dari template ([§22](#22-lampiran-template-artefak)); kriteria terima yang dapat diuji; dampak data & migrasi; klasifikasi risiko (usulan AI, ditetapkan Product); versi & perbandingan; persetujuan | Ya | Aktif | 1 |
| `studio_desain` | Desain teknis | Rencana perubahan per layanan/berkas; dampak API, skema, katalog modul, izin; estimasi; ADR singkat; daftar berkas terlarang yang tersentuh | Tidak | Aktif | 3 |
| `studio_coding` | Coding (agen) | Tugas agen di sandbox; log langkah agen; diff; hasil cek kebijakan ([§9.4](#94-pemeriksa-kebijakan-otomatis)); hasil CI lokal; buka PR; revisi dari komentar review | Tidak | **Mati** | 3 |
| `studio_qa` | QA | Rencana uji dari kriteria terima; uji otomatis (unit/API/e2e) di sandbox; checklist uji manual; preview environment; laporan bug kembali ke Coding; keputusan lulus/gagal | Tidak | Aktif | 4 |
| `studio_rilis` | Rilis | Entri CHANGELOG; catatan rilis & langkah pembaruan; usulan versi (SemVer); status PR/merge/tag; pengumuman | Tidak | Aktif | 4 |
| `studio_ekstensi` | Ekstensi tanpa kode | Laporan (kueri baca-saja tervalidasi), template cetak, formulir tambahan, konfigurasi; dipasang lewat paket ekstensi berversi | Tidak | **Mati** | 2 |
| `studio_agen` | Konektor agen AI | Daftar penyedia (Anthropic, OpenAI, model lokal, MCP eksternal); kunci API terenkripsi; pemilihan model per tahap; uji koneksi | Ya | Aktif | 1 |
| `studio_aturan` | Aturan prompt | Berkas aturan berlapis & berversi; zona terlarang; template tahap; pratinjau "prompt efektif" | Ya | Aktif | 1 |
| `studio_pengetahuan` | Basis pengetahuan | Indeks dokumen repo (CONTRIBUTING, katalog, skema DB tanpa data, API); glosarium domain; dipakai agen sebagai konteks | Ya | Aktif | 1 |
| `studio_audit` | Audit & biaya | Jejak semua tindakan; pemakaian token & biaya per item/penyedia/bulan; batas anggaran; ekspor | Ya | Aktif | 1 |
| `studio_pengaturan` | Pengaturan Studio | Kill switch; batas biaya; retensi log prompt; repo target; integrasi Git; notifikasi | Ya (hanya superadmin) | Aktif | 1 |

Semua fitur `wajib:false` kecuali yang ditandai "Ya"; fitur `studio_coding` dan `studio_ekstensi` dimasukkan ke `preset.fitur_mati` semua segmen sehingga **perlu diaktifkan eksplisit** oleh superadmin walau modul sudah aktif.

### 5.3 Modul izin (`auth-service/src/helpers/permission-list.js`)

```js
export const studioPermission = {
  module: "Studio Pengembang",
  subModules: [
    { name: "Permintaan",   allows: ["READ", "CREATE", "UPDATE", "SETUJUI USECASE", "BATAL"] },
    { name: "PRD",          allows: ["READ", "UPDATE", "SETUJUI", "TETAPKAN RISIKO"] },
    { name: "Review Klinis", allows: ["READ", "SETUJUI"] },
    { name: "Desain",       allows: ["READ", "UPDATE", "SETUJUI"] },
    { name: "Coding",       allows: ["READ", "JALANKAN AGEN", "REVIEW", "BUKA PR"] },
    { name: "QA",           allows: ["READ", "UPDATE", "JALANKAN UJI", "LULUS"] },
    { name: "Rilis",        allows: ["READ", "SIAPKAN"] },
    { name: "Ekstensi",     allows: ["READ", "CREATE", "PASANG", "COPOT"] },
    { name: "Audit",        allows: ["READ", "EKSPOR"] },
    { name: "Pengaturan",   allows: ["READ", "UPDATE", "KONEKTOR AI", "KILL SWITCH"] },
  ],
};
```

- Tidak dimasukkan ke izin bawaan peran mana pun; **sinkron-modul tidak menambahkannya otomatis** ke admin faskes (pengecualian perlu ditulis di `permission-controller.js`).
- Sub-modul "Pengaturan" hanya boleh diberikan ke peran `super admin` (divalidasi backend).

## 6. Alur kerja dan status

### 6.1 Status item

```
draf ─► diajukan ─► triase ─► usecase ─► prd ─► prd_disetujui ─► desain ─► coding ─► review_kode ─► qa ─► qa_lulus ─► siap_rilis ─► dirilis
                     │          │          │                       │          │           │            │
                     ▼          ▼          ▼                       ▼          ▼           ▼            ▼
                 ditolak    revisi     revisi                   revisi     revisi      revisi       qa_gagal ─► coding
                 ditunda    (kembali ke tahap sebelumnya, alasan wajib)
                 dibatalkan (dari status mana pun sebelum dirilis; alasan wajib)
                 dibekukan  (modul/fitur dimatikan atau kill switch; kembali ke status sebelumnya saat dibuka)
```

Jalur ekstensi tanpa kode memakai status yang sama, tetapi `desain`/`coding` diganti `rakit_ekstensi` dan `rilis` berarti memasang paket ekstensi ke faskes.

### 6.2 Aturan transisi

| Dari → ke | Pemicu | Syarat (dicek backend) |
|---|---|---|
| draf → diajukan | Pengusul | Isian wajib lengkap; lampiran lolos pemeriksaan data pribadi |
| diajukan → triase | Product | — |
| triase → usecase | Product | Prioritas & modul terdampak terisi; bukan duplikat (atau ditautkan) |
| usecase → prd | Pengusul (SETUJUI USECASE) | Alur utama & alur gagal ada |
| prd → prd_disetujui | Product (SETUJUI) + Reviewer klinis bila risiko ≥ Tinggi | Semua kriteria terima dapat diuji (dicek AI + manusia); risiko ditetapkan; pemisahan tugas |
| prd_disetujui → desain | Programmer | Fitur Desain aktif |
| desain → coding | Programmer (SETUJUI desain) | Fitur Coding aktif; tidak ada berkas terlarang kecuali risiko mengizinkan |
| coding → review_kode | Otomatis setelah agen selesai | Pemeriksa kebijakan lulus; CI sandbox hijau; PR terbuka |
| review_kode → qa | Programmer (REVIEW) | Komentar review terselesaikan |
| qa → qa_lulus | QA (LULUS) + Reviewer klinis bila risiko ≥ Tinggi | Semua kriteria terima punya hasil uji; tidak ada bug P1/P2 terbuka |
| qa_lulus → siap_rilis | Otomatis setelah PR di-merge | PR ber-status merged di repo target |
| siap_rilis → dirilis | Otomatis saat tag rilis memuat commit | Tag ditemukan; CHANGELOG memuat entri |

Semua transisi dicatat di `studio_audit` beserta pelaku, waktu, status sebelum/sesudah, dan alasan.

## 7. Rincian tiap tahap

Setiap tahap mendefinisikan **masukan, peran AI, keluaran (artefak berversi), gerbang, dan definisi selesai**.

### 7.1 Permintaan

- **Masukan:** judul, latar belakang ("apa yang sulit sekarang"), siapa terdampak, frekuensi, contoh (data fiktif), lampiran.
- **AI:** mengajukan maks. 5 pertanyaan klarifikasi per putaran; merangkum; mencari duplikat (item Studio lain, katalog modul/fitur, ROADMAP); menandai bila sebenarnya bisa diselesaikan lewat konfigurasi yang sudah ada.
- **Keluaran:** `ringkasan_permintaan` (markdown) + tautan duplikat.
- **Gerbang:** Product melakukan triase.
- **Selesai bila:** masalah, pengguna terdampak, dan hasil yang diharapkan jelas.

### 7.2 Use case

- **AI:** menyusun aktor, prasyarat, alur utama, alur alternatif, alur gagal, aturan bisnis, dampak ke modul lain (dicek terhadap katalog & basis pengetahuan).
- **Keluaran:** `usecase` (markdown + diagram Mermaid).
- **Gerbang:** Pengusul menyetujui ("ya, ini yang saya maksud").

### 7.3 PRD

- **AI:** mengisi template PRD ([§22.1](#221-template-prd)); setiap kriteria terima harus berbentuk *Diberikan … Ketika … Maka …*; mengusulkan tingkat risiko dengan alasan; mendaftar dampak data (tabel baru/ubah, migrasi), izin baru, entri katalog, integrasi.
- **Pemeriksaan otomatis:** kriteria terima tanpa hasil terukur ditandai; kata "cepat/mudah/user friendly" tanpa ukuran ditandai.
- **Gerbang:** Product (+ Reviewer klinis bila risiko ≥ Tinggi).

### 7.4 Desain teknis

- **AI:** membaca kode lewat MCP (baca-saja); menyusun rencana per layanan/berkas, perubahan skema & migrasi, perubahan API, perubahan katalog & izin, rencana uji teknis; mencantumkan berkas terlarang yang tersentuh.
- **Keluaran:** `desain_teknis` + ADR singkat bila ada keputusan arsitektur.
- **Gerbang:** Programmer.

### 7.5 Coding (agen)

- **AI:** bekerja di **sandbox** ([§16.2](#162-sandbox-agen)) pada branch `<jenis>/STD-<nomor>-<ringkasan>`; menulis kode + test + CHANGELOG + dokumen; menjalankan `node --check`, unit test, `db:migrate` dua kali, `build-only` frontend, pemeriksa kebijakan; membuka **Draft PR** dengan template PR repo; memperbaiki berdasarkan komentar review (maks. N putaran, dapat diatur).
- **Keluaran:** diff, log langkah agen, hasil cek, tautan PR.
- **Gerbang:** Programmer (REVIEW) di Studio **dan** aturan review GitHub yang berlaku (2 persetujuan untuk area sensitif).

### 7.6 QA

- **AI:** menurunkan rencana uji dari kriteria terima (1 kriteria → ≥1 kasus uji); menulis/menjalankan uji otomatis di sandbox; menyusun checklist uji manual per peran & segmen (sesuai CONTRIBUTING §6); mencatat bug sebagai sub-item yang kembali ke Coding.
- **Preview environment:** instalasi sementara berisi data demo untuk diuji manual oleh QA/Pengusul; dihapus otomatis setelah item selesai atau X hari.
- **Gerbang:** QA (+ Reviewer klinis bila risiko ≥ Tinggi).

### 7.7 Rilis

- **AI:** menyusun entri CHANGELOG (kategori Keep a Changelog), catatan rilis, langkah pembaruan & migrasi, usulan kenaikan versi.
- **Batas:** merge dan pembuatan tag tetap dilakukan maintainer di repo target (Studio hanya menampilkan status).

### 7.8 Ekstensi tanpa kode (jalur cepat)

| Jenis | Dibuat AI | Validasi | Dipasang ke |
|---|---|---|---|
| Laporan | Kueri SQL **SELECT saja** + definisi kolom/filter | Parser SQL: hanya SELECT, hanya tabel yang diizinkan, wajib filter `faskes_uuid`, batas baris & waktu | Menu Laporan faskes |
| Template cetak | Template (mis. pdfmake) + pemetaan data | Render uji dengan data demo | Pengaturan Print Out |
| Formulir tambahan | Skema isian JSON | Skema tervalidasi; tidak menyentuh tabel inti | Bagian (katalog) yang ditentukan |
| Konfigurasi | Nilai konfigurasi | Hanya kunci yang diizinkan | Setting faskes |

Ekstensi berversi, dapat dicopot, dan pemasangannya tercatat; ekstensi **tidak** menjalankan kode bebas di server.

## 8. Tingkat risiko dan gerbang persetujuan

| Tingkat | Contoh | Persetujuan PRD | Persetujuan QA | Review kode (GitHub) |
|---|---|---|---|---|
| Rendah | Laporan baru, teks/tampilan, template cetak | Product | QA | 1 persetujuan |
| Sedang | Fitur administrasi baru, perubahan alur non-klinis | Product | QA | 1–2 persetujuan |
| Tinggi | Alur klinis (RME, order, hasil), keuangan/tagihan, integrasi BPJS/SATUSEHAT/LIS | Product + Reviewer klinis/keuangan | QA + Reviewer klinis | 2 persetujuan, ≥1 Core Maintainer, tunggu 48 jam |
| Kritis | Autentikasi/izin, enkripsi, migrasi data massal, perhitungan dosis | Product + Reviewer klinis + Core Maintainer | QA + Reviewer klinis | 2 persetujuan Core Maintainer; **agen tidak boleh menulis kode — hanya PRD/desain** |

Tingkat risiko diusulkan AI berdasarkan berkas/area yang terdampak, **ditetapkan** Product, dan **tidak dapat diturunkan** setelah desain teknis menemukan area yang lebih berisiko (otomatis dinaikkan).

## 9. Aturan prompt (guardrail)

### 9.1 Lapisan aturan

Agen menerima "prompt efektif" yang tersusun dari lapisan berikut (yang lebih bawah tidak boleh melonggarkan yang di atas):

1. **Aturan platform (tetap):** prinsip §2.3, larangan §9.2, format keluaran.
2. **Aturan repo:** `CLAUDE.md`, `CONTRIBUTING.md`, `ALUR-GIT-RILIS.md` (dibaca dari repo target).
3. **Aturan Studio per instalasi** (`studio_aturan`, berversi, diubah superadmin): mis. bahasa, gaya, batas tambahan.
4. **Aturan per area** (mis. `aturan/farmasi.md`, `aturan/rekam-medis.md`): istilah klinis, larangan khusus.
5. **Template tahap:** instruksi khusus Permintaan/Use case/PRD/Desain/Coding/QA/Rilis.
6. **Konteks item:** artefak tahap sebelumnya + kutipan basis pengetahuan.

Teks dari pengguna (permintaan, komentar, lampiran) **selalu diperlakukan sebagai data**, bukan instruksi (pertahanan *prompt injection*).

### 9.2 Larangan tetap (tidak dapat diubah aturan instalasi)

- Membaca/menulis data pasien nyata, `.env`, kunci, kredensial integrasi.
- Mengubah migrasi yang sudah ada; membuat migrasi tidak idempoten.
- Menghapus/melonggarkan pemeriksaan izin, filter `faskes_uuid`, atau soft delete.
- Menulis kode di area tingkat **Kritis** ([§8](#8-tingkat-risiko-dan-gerbang-persetujuan)).
- Menyetujui, me-merge, atau membuat tag rilis.
- Mengakses jaringan selain registry paket & API penyedia AI yang diizinkan (sandbox).

### 9.3 Zona berkas

| Zona | Pola contoh | Perlakuan |
|---|---|---|
| Merah (terlarang) | `packages/authorization-sdk/**`, `packages/permission-sdk/**`, `**/rahasia.js`, `database/migrations/<yang sudah ada>`, `.github/**`, `deploy/**`, `**/.env*` | Agen tidak boleh mengubah; desain yang menyentuh → risiko Kritis |
| Kuning (butuh risiko ≥ Tinggi) | Layanan rekamedis/farmasi/payment/bpjs/satusehat/lab (alur klinis & keuangan) | Boleh bila risiko item ≥ Tinggi dan disetujui |
| Hijau | Laporan, tampilan, dokumen, uji | Bebas sesuai aturan umum |

### 9.4 Pemeriksa kebijakan otomatis

Dijalankan pada setiap diff sebelum PR dibuka:

| Cek | Gagal bila |
|---|---|
| Rahasia | Pola kunci/token/sandi, IP privat, host server faskes |
| Data pribadi | Pola NIK 16 digit yang tidak berawalan `9999`, nomor HP selain `080000000000`, email selain `@contoh.id` |
| Zona berkas | Mengubah zona merah; zona kuning tanpa risiko memadai |
| Migrasi | Nama tidak sesuai pola/urutan; mengubah migrasi lama; tidak idempoten (dijalankan dua kali di sandbox) |
| Konvensi | `faskes_uuid` tidak diambil dari token; tidak ada soft delete; respons bukan `{message,payload}` |
| Katalog | Perubahan katalog tanpa migrasi `sinkronKatalog` & `docs:katalog` |
| Uji | Tidak ada uji baru untuk perubahan logika |
| CHANGELOG | Tidak ada entri di *[Belum dirilis]* |

## 10. Integrasi agen AI

### 10.1 Lapisan adaptor

`studio-service` berbicara ke agen melalui antarmuka tunggal:

```
AdaptorAgen {
  info()                                  → { penyedia, model[], kemampuan: [teks, alat, kode] }
  tulis(tahap, promptEfektif, konteks)    → artefak (streaming)
  jalankanTugas(tugas, alatMCP, batas)    → log langkah + hasil   // untuk coding/QA
  hitungBiaya(pemakaian)                  → { token_masuk, token_keluar, biaya }
}
```

| Penyedia | Cara sambung | Catatan |
|---|---|---|
| Anthropic (Claude) | API resmi; tugas coding lewat Claude Agent SDK | Model dipilih per tahap (mis. model besar untuk desain/coding, model kecil untuk ringkasan) |
| OpenAI (GPT) | API resmi | Sama |
| Model lokal | Endpoint kompatibel (mis. server inferensi di jaringan RS) | Untuk faskes yang tidak boleh mengirim data keluar |
| Agen eksternal (mis. "OpenClaw" atau agen lain) | **MCP** (Model Context Protocol) atau HTTP adaptor | Identitas & kemampuan "OpenClaw" perlu dikonfirmasi ([§21](#21-keputusan-terbuka)) |

### 10.2 MCP server OpenSIMRS (`studio-mcp`)

Alat yang disediakan untuk agen, **semuanya dibatasi ke sandbox item**:

| Alat | Fungsi | Tahap |
|---|---|---|
| `baca_katalog` | Modul/fitur/bagian & status | Semua |
| `baca_skema_db` | Struktur tabel (tanpa data) | Use case, PRD, Desain, Coding |
| `cari_kode` / `baca_berkas` | Telusur repo sandbox (baca) | Desain, Coding, QA |
| `tulis_berkas` / `hapus_berkas` | Ubah berkas di sandbox (zona dicek) | Coding |
| `jalankan_perintah` | Daftar putih: `npm test`, `node --check`, `db:migrate`, `build-only`, `git status/diff` | Coding, QA |
| `jalankan_uji_e2e` | Uji e2e di preview environment | QA |
| `buka_pr` / `perbarui_pr` | Lewat integrasi Git Studio | Coding |
| `baca_komentar_review` | Komentar PR | Coding |

### 10.3 Pemilihan model, kuota, biaya

- Superadmin memilih penyedia & model **per tahap**; dapat berbeda per faskes.
- Batas: token per tugas, biaya per item, biaya per bulan per faskes; mencapai batas → tugas berhenti, notifikasi superadmin.
- Kunci API disimpan terenkripsi (pola `rahasia.js`: AES-256-GCM, kunci dari variabel khusus `STUDIO_KUNCI_RAHASIA`).

## 11. Arsitektur

```
 Browser (menu Studio)                        Penyedia AI (Anthropic / OpenAI / lokal / MCP eksternal)
        │  HTTPS                                          ▲
        ▼                                                 │ adaptor
 Gateway nginx ──► studio-service (:8090, /api/v3/studio) ┤
                     │   ├─ alur & status, persetujuan    │
                     │   ├─ pemeriksa kebijakan           │
                     │   ├─ antrean tugas (Redis)         │
                     │   └─ audit & biaya                 │
                     │                                    │
                     ├──► PostgreSQL (tabel studio_*)      │
                     ├──► studio-mcp (alat agen) ─────────┘
                     ├──► Runner sandbox (kontainer Podman/Docker per tugas, jaringan dibatasi)
                     │        └─ clone repo target, data demo, uji
                     ├──► Preview environment (stack sementara per item, data demo)
                     └──► Integrasi Git (GitHub App / Forgejo) → branch, PR, status CI, tag
```

- `studio-service` mengikuti konvensi layanan ringan (seperti `penunjang-service`: Express + `pg`, `respons.js`, izin, `{message,payload}`), **port 8090** (kosong saat ini).
- Tugas panjang (coding/QA) berjalan **asinkron** di runner; status dikirim ke frontend lewat polling atau SSE.
- Runner **tidak** berjalan di server produksi faskes ([§16](#16-lingkungan-sandbox-dan-rilis)).

## 12. Model data

Semua tabel: `uuid` (uuidv7), `faskes_uuid` (dari token), `created_at`/`updated_at`/`deleted_at` (epoch detik, soft delete).

| Tabel | Kolom penting | Keterangan |
|---|---|---|
| `studio_item` | `nomor` (STD-0001), `jenis` (fitur/perbaikan/laporan/ekstensi), `judul`, `status`, `risiko`, `prioritas`, `modul_terdampak` (jsonb), `pengusul_uuid`, `pr_url`, `tag_rilis` | Satu permintaan |
| `studio_artefak` | `item_uuid`, `tahap`, `versi`, `isi` (markdown/jsonb), `dibuat_oleh` (user/agen), `tugas_uuid` | Berversi; tidak pernah ditimpa |
| `studio_persetujuan` | `item_uuid`, `tahap`, `artefak_uuid`, `peran`, `pengguna_uuid`, `keputusan` (setuju/tolak/revisi), `alasan` | Gerbang |
| `studio_komentar` | `item_uuid`, `artefak_uuid`, `pengguna_uuid`, `isi`, `induk_uuid` | Diskusi |
| `studio_tugas_agen` | `item_uuid`, `tahap`, `penyedia`, `model`, `status` (antri/jalan/selesai/gagal/dibatalkan), `log` (ringkas), `mulai`/`selesai`, `sandbox_ref` | Eksekusi agen |
| `studio_pemakaian` | `tugas_uuid`, `penyedia`, `model`, `token_masuk`, `token_keluar`, `biaya` | Biaya |
| `studio_konektor` | `penyedia`, `nama`, `endpoint`, `kunci_api` (terenkripsi), `model_per_tahap` (jsonb), `aktif` | Konektor AI |
| `studio_aturan` | `lapis`, `area`, `isi`, `versi`, `aktif`, `diubah_oleh` | Aturan prompt |
| `studio_ekstensi` | `jenis`, `nama`, `versi`, `definisi` (jsonb), `status`, `dipasang_pada` | Ekstensi tanpa kode |
| `studio_audit` | `item_uuid?`, `aksi`, `pelaku` (user/agen/sistem), `sebelum`/`sesudah` (jsonb), `ip`, `waktu` | Append-only |
| `studio_pengaturan` | `kill_switch`, `batas_biaya_bulan`, `retensi_log_hari`, `repo_target`, `integrasi_git` | Satu baris per faskes |

Isi prompt & respons AI lengkap disimpan terpisah (dapat dipadatkan) dengan retensi yang diatur `retensi_log_hari`.

## 13. API

Basis `/api/v3/studio`. Semua endpoint: `wajibLogin` → cek L1–L5 ([§4](#4-aktivasi-hanya-oleh-superadmin)) → cek izin.

| Metode & path | Izin | Fungsi |
|---|---|---|
| `GET /status` | Login | Apakah Studio aktif untuk faskes & fitur apa saja (dipakai frontend) |
| `GET/POST /item` · `GET/PUT /item/:uuid` | Permintaan | Daftar, buat, ubah item |
| `POST /item/:uuid/transisi` | Sesuai §6.2 | Pindah status (body: `ke`, `alasan`) |
| `POST /item/:uuid/tahap/:tahap/tulis` | Sesuai tahap | Minta AI menulis/merevisi artefak tahap |
| `GET /item/:uuid/artefak` · `/artefak/:uuid/banding/:uuid2` | READ | Artefak & perbandingan versi |
| `POST /item/:uuid/persetujuan` | SETUJUI tahap | Setuju/tolak/revisi |
| `POST /item/:uuid/coding/mulai` · `/batal` | Coding › JALANKAN AGEN | Tugas agen coding |
| `GET /tugas/:uuid` · `/tugas/:uuid/log` (SSE) | READ | Pantau tugas |
| `POST /item/:uuid/qa/rencana` · `/qa/jalankan` · `/qa/keputusan` | QA | QA |
| `GET/POST /ekstensi` · `POST /ekstensi/:uuid/pasang` · `/copot` | Ekstensi | Ekstensi |
| `GET/PUT /pengaturan` · `POST /pengaturan/kill-switch` | Pengaturan (superadmin) | Pengaturan |
| `GET/POST/PUT /konektor` · `POST /konektor/:uuid/uji` | Pengaturan › KONEKTOR AI | Konektor |
| `GET/POST/PUT /aturan` | Pengaturan | Aturan prompt |
| `GET /audit` · `GET /pemakaian` | Audit | Audit & biaya |

## 14. Antarmuka (frontend)

- **Menu "Studio Pengembang"** muncul hanya bila `GET /studio/status` aktif **dan** pengguna punya izin modul (selain filter modul ∩ izin yang sudah ada di `Header.vue`).
- Halaman:
  1. **Beranda** — kanban status, "tugas saya", ringkasan biaya bulan ini.
  2. **Item** — tab per tahap; panel kiri artefak (markdown, versi, banding), panel kanan percakapan dengan AI & komentar; tombol transisi hanya tampil bila pengguna berhak.
  3. **Coding** — log langkah agen (streaming), diff, hasil pemeriksa kebijakan, tautan PR & status CI.
  4. **QA** — rencana uji ↔ kriteria terima, hasil uji, tautan preview, bug.
  5. **Ekstensi** — katalog ekstensi faskes, pasang/copot.
  6. **Pengaturan** (superadmin) — konektor AI, aturan, batas biaya, kill switch, repo target.
  7. **Audit** — tabel tindakan & biaya, ekspor.
- Penanda jelas pada setiap keluaran AI: "**Dibuat AI — periksa sebelum menyetujui**".
- Mode "pemula": isian berbentuk pertanyaan sederhana; mode "lanjut": editor markdown penuh.

## 15. Keamanan, privasi, dan kepatuhan

| Aspek | Ketentuan |
|---|---|
| Data pasien | Tidak pernah dikirim ke AI. Lampiran dipindai pola data pribadi; ditolak bila terdeteksi. Sandbox & preview hanya data demo. |
| Rahasia | Kunci AI terenkripsi; tidak pernah dikirim ke frontend (disamarkan); runner tidak menerima `.env` produksi. |
| Isolasi | Satu kontainer runner per tugas; tanpa akses jaringan internal RS; egress hanya ke registry paket & API AI terdaftar; batas CPU/RAM/waktu. |
| Akses Git | Token integrasi Git berizin minimal (buat branch & PR saja di repo target); tidak bisa merge/tag. |
| Multi-faskes | Item, artefak, konektor, dan biaya terisolasi per `faskes_uuid`; superadmin berpindah faskes seperti biasa. |
| Audit | `studio_audit` append-only; penghapusan item = soft delete; ekspor untuk akreditasi. |
| Regulasi | UU PDP (tidak memproses data pribadi pasien di AI); penyedia AI di luar negeri dicatat di pengaturan; opsi model lokal. |
| Penyalahgunaan | Rate limit per pengguna; kill switch; batas biaya. |
| Prompt injection | Masukan pengguna sebagai data; aturan platform tidak dapat ditimpa; keluaran agen divalidasi pemeriksa kebijakan sebelum berdampak. |

## 16. Lingkungan, sandbox, dan rilis

### 16.1 Di mana Studio berjalan

| Fitur | Instalasi pengembangan/staging | Instalasi produksi faskes |
|---|---|---|
| Beranda, Permintaan, Use case, PRD, Audit | ✔ | ✔ (boleh — tanpa kode & tanpa data pasien) |
| Desain, Coding, QA, Rilis | ✔ | ✘ ditolak (`LINGKUNGAN=production`) |
| Ekstensi (pasang) | ✔ | ✔ hanya ekstensi yang sudah lulus QA di staging (paket bertanda tangan) |

Dengan begitu IT RS dapat menulis permintaan & PRD di instalasi produksinya, sementara pengerjaan kode terjadi di instalasi pengembangan (mis. Mac mini staging).

### 16.2 Sandbox agen

- Clone repo target pada commit terbaru `main`, branch item.
- Database: PostgreSQL + MongoDB + Redis sementara dengan `schema.sql` + data demo.
- Perintah: daftar putih ([§10.2](#102-mcp-server-opensimrs-studio-mcp)).
- Dihapus setelah tugas selesai; cache paket dipakai ulang.

### 16.3 Repo target dan rilis

| Pilihan | Kelebihan | Kekurangan |
|---|---|---|
| **Upstream** (`tulisankode/opensimrs`) — PR kontribusi | Semua faskes menikmati; satu kode | Waktu review komunitas; standar ketat |
| **Fork faskes** | Cepat untuk kebutuhan lokal | Kode menyimpang; pembaruan upstream makin sulit |

Rekomendasi: **upstream sebagai bawaan**; fork hanya untuk ekstensi tanpa kode (yang tidak menyimpangkan kode inti).

## 17. Kebutuhan non-fungsional

| Kode | Kebutuhan |
|---|---|
| NF-1 | Respons awal AI untuk tahap dokumen ≤ 10 detik (streaming); tugas coding asinkron. |
| NF-2 | Studio mati/gagal tidak memengaruhi modul klinis lain (layanan terpisah, tanpa ketergantungan balik). |
| NF-3 | Semua teks UI & artefak berbahasa Indonesia; istilah domain sesuai glosarium. |
| NF-4 | Dapat dipakai tanpa penyedia AI eksternal (model lokal) dengan penurunan kualitas yang diterima. |
| NF-5 | Biaya dapat diprediksi: estimasi biaya ditampilkan sebelum tugas coding dimulai. |
| NF-6 | Keterlacakan: dari tag rilis dapat ditelusuri ke item, PRD, persetujuan, dan prompt. |

## 18. Metrik keberhasilan

- Waktu dari permintaan ke PRD disetujui (target turun ≥50% dibanding proses manual).
- Persentase PRD yang lolos tanpa revisi besar di desain.
- Persentase PR agen yang di-merge tanpa ditulis ulang manusia.
- Jumlah bug P1/P2 dari fitur Studio dalam 30 hari setelah rilis (target 0 P1).
- Biaya AI per item yang dirilis.
- Jumlah kontribusi upstream dari IT RS non-programmer.

## 19. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kode AI salah pada alur klinis | Keselamatan pasien | Gerbang risiko §8, reviewer klinis, zona berkas, QA wajib, rilis hanya lewat tag |
| Data pasien bocor ke penyedia AI | Pelanggaran UU PDP | Data demo saja, pemindai data pribadi, model lokal, tanpa akses DB produksi |
| Prompt injection lewat permintaan/lampiran | Agen melanggar aturan | Masukan sebagai data, aturan platform tetap, pemeriksa kebijakan, sandbox tanpa rahasia |
| Biaya AI tak terkendali | Anggaran | Batas per tugas/item/bulan, estimasi biaya, kill switch |
| Superadmin lupa mematikan / akun superadmin bocor | Penyalahgunaan | MFA superadmin (rekomendasi), audit, notifikasi aktivasi, mati bawaan |
| Fork faskes menyimpang | Sulit diperbarui | Upstream bawaan; ekstensi tanpa kode untuk kebutuhan lokal |
| Ketergantungan vendor AI | Layanan terhenti | Adaptor netral, MCP, banyak penyedia |
| Penegakan modul backend belum lengkap (B-11) | Akses tanpa izin | Studio menegakkan sendiri L1–L5 (wajib di Fase 0/1) |
| Kualitas PRD buruk dari pengguna awam | Kode salah arah | Wawancara AI, kriteria terima wajib terukur, persetujuan Pengusul & Product |

## 20. Fase dan breakdown pekerjaan

Estimasi kasar dalam hari kerja untuk 1 programmer berpengalaman; perlu dikalibrasi.

### Fase 0 — Fondasi (prasyarat, ±8–10 hari)

| ID | Pekerjaan | Kriteria selesai |
|---|---|---|
| F0-1 | Helper bersama `isSuperadmin` (paket SDK) dan pakai di layanan yang ada | Satu definisi; uji unit |
| F0-2 | Perbaiki `Context` global admisi-service (temuan audit: risiko faskes tertukar) | Konteks per permintaan (AsyncLocalStorage); uji permintaan bersamaan |
| F0-3 | Pola penegakan modul/fitur di backend (B-11) untuk layanan baru | Middleware `wajibModul(kode)` dapat dipakai ulang |
| F0-4 | Tabel `studio_audit` + pustaka pencatat audit | Append-only; uji |
| F0-5 | Kerangka `studio-service` (port 8090), daftar ke gateway, compose, deploy.sh, install.sh, frontend env | Health check lulus di Docker & Podman |
| F0-6 | Entri katalog modul + fitur (`tersedia:false`), migrasi `sinkronKatalog`, `permission-list` (tanpa sinkron otomatis ke admin faskes), `docs:katalog` | Modul tampil "Segera" hanya untuk superadmin; CI lulus |
| F0-7 | Lapis aktivasi L1–L6 + `GET /studio/status` | Uji: setiap lapis mati → menu hilang & API 403/503 |

### Fase 1 — Permintaan sampai PRD (±15–20 hari)

| ID | Pekerjaan |
|---|---|
| F1-1 | Model data `studio_item`, `studio_artefak`, `studio_persetujuan`, `studio_komentar` + migrasi |
| F1-2 | Mesin status & aturan transisi §6.2 (dengan uji unit per transisi) |
| F1-3 | Konektor AI (Anthropic & OpenAI) + enkripsi kunci + uji koneksi |
| F1-4 | Penyusun "prompt efektif" berlapis (§9.1) + template Permintaan/Use case/PRD |
| F1-5 | Basis pengetahuan awal: katalog, skema DB (struktur saja), dokumen kontributor |
| F1-6 | Pemindai data pribadi untuk teks & lampiran |
| F1-7 | Pemakaian token & batas biaya |
| F1-8 | Frontend: Beranda, Item (tab Permintaan/Use case/PRD), Pengaturan, Audit |
| F1-9 | Rencana uji P1 Fase 1 + uji e2e dasar |
| F1-10 | Dokumentasi pengguna (IT RS) & admin (superadmin) |

**Rilis Fase 1** = modul `tersedia:true`, fitur Coding/Ekstensi tetap mati.

### Fase 2 — Ekstensi tanpa kode (±15 hari)

| ID | Pekerjaan |
|---|---|
| F2-1 | Format paket ekstensi berversi + tanda tangan |
| F2-2 | Ekstensi Laporan: validator SQL SELECT-only, batas, filter `faskes_uuid` wajib |
| F2-3 | Ekstensi Template cetak |
| F2-4 | Pasang/copot + audit + uji di staging sebelum produksi |

### Fase 3 — Desain teknis & coding agen (±25–30 hari)

| ID | Pekerjaan |
|---|---|
| F3-1 | `studio-mcp` + alat baca (katalog, skema, kode) |
| F3-2 | Runner sandbox (Podman/Docker) + jaringan dibatasi + data demo |
| F3-3 | Alat tulis berkas + daftar putih perintah |
| F3-4 | Pemeriksa kebijakan §9.4 (rahasia, data pribadi, zona, migrasi, konvensi, katalog, uji, CHANGELOG) |
| F3-5 | Integrasi Git (GitHub App/Forgejo): branch, Draft PR, komentar, status CI |
| F3-6 | Siklus revisi dari komentar review (batas putaran) |
| F3-7 | Frontend tab Desain & Coding (log streaming, diff, hasil cek) |
| F3-8 | Klasifikasi risiko otomatis dari berkas terdampak |

### Fase 4 — QA & rilis (±15–20 hari)

| ID | Pekerjaan |
|---|---|
| F4-1 | Rencana uji dari kriteria terima + checklist manual per peran/segmen |
| F4-2 | Uji otomatis di sandbox (unit/API) + kerangka e2e (mis. Playwright) |
| F4-3 | Preview environment per item (stack sementara, data demo, kedaluwarsa otomatis) |
| F4-4 | Alur bug → kembali ke Coding |
| F4-5 | Tab Rilis: CHANGELOG, catatan rilis, status merge/tag |

### Fase 5 — Ekosistem (±lanjutan)

- Berbagi ekstensi antar-faskes (katalog ekstensi komunitas).
- Agen eksternal lewat MCP (termasuk "OpenClaw" bila cocok).
- Model lokal yang dikurasi untuk faskes tanpa akses internet.

### Pekerjaan lintas fase

- Pembaruan `docs/` (MANAJEMEN-MODUL, INSTALLATION_GUIDE tabel port, LINGKUNGAN, CONTRIBUTING bagian Studio).
- Rencana pengujian P1 per fase di `docs/testing/rencana-testing.md`.
- CHANGELOG tiap PR; RFC di GitHub untuk Fase 3 (arsitektur inti, sesuai GOVERNANCE).

## 21. Keputusan terbuka

| No | Pertanyaan | Usulan |
|---|---|---|
| K-1 | Repo target bawaan: upstream atau fork faskes? | Upstream ([§16.3](#163-repo-target-dan-rilis)) |
| K-2 | Penyedia AI bawaan & siapa menanggung biaya token (faskes / pengelola platform)? | Dikonfigurasi per faskes; faskes menanggung |
| K-3 | "OpenClaw" — produk/framework yang mana? Mendukung MCP? | Perlu tautan/identifikasi |
| K-4 | Apakah Permintaan/PRD boleh diisi dari instalasi produksi faskes? | Ya (tanpa kode, tanpa data pasien) |
| K-5 | Siapa reviewer klinis per domain dan apakah perlu peran khusus di izin? | Sub-modul "Review Klinis" (§5.3) |
| K-6 | Git hosting untuk fork/preview: GitHub atau Forgejo self-hosted? | GitHub untuk upstream; adaptor untuk Forgejo |
| K-7 | Retensi log prompt (hari) | 180 hari, dapat diatur |
| K-8 | MFA untuk superadmin sebelum Studio dapat diaktifkan? | Wajib (backlog terpisah) |
| K-9 | Bahasa kode/komentar yang dihasilkan agen | Mengikuti CLAUDE.md (Indonesia) |

## 22. Lampiran: template artefak

### 22.1 Template PRD

```markdown
# PRD STD-<nomor>: <judul>
## 1. Latar belakang & masalah
## 2. Tujuan (terukur) dan non-tujuan
## 3. Pengguna & peran terdampak (sebut segmen faskes)
## 4. Use case (tautan) & alur utama
## 5. Kebutuhan fungsional (bernomor)
## 6. Kriteria terima (Diberikan … Ketika … Maka …), bernomor & dapat diuji
## 7. Dampak data: tabel/kolom, migrasi (idempoten), data referensi
## 8. Dampak katalog modul/fitur & izin
## 9. Integrasi (BPJS/SATUSEHAT/LIS/dll.)
## 10. Tingkat risiko (usulan AI + alasan; ditetapkan Product)
## 11. Kebutuhan non-fungsional
## 12. Di luar cakupan
## 13. Pertanyaan terbuka
```

### 22.2 Template rencana uji

```markdown
| ID | Kriteria terima | Skenario | Peran & segmen | Data uji (fiktif) | Langkah | Hasil diharapkan | Otomatis? | Hasil |
```

### 22.3 Template catatan rilis

```markdown
## STD-<nomor> <judul>
- Ringkasan untuk pengguna
- Langkah pembaruan & migrasi baru
- Modul/fitur yang perlu diaktifkan
- Risiko & cara rollback
```
