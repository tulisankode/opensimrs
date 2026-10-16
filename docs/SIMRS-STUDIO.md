# SIMRS Studio — panduan pemakaian

SIMRS Studio adalah ruang kerja pengembangan berbasis AI di dalam OpenSIMRS. Tim IT menuliskan kebutuhan dengan bahasa sehari-hari, lalu agen AI mengerjakan tahap demi tahap: ringkasan permintaan, use case, PRD, desain teknis, kode, rencana uji, dan catatan rilis. **Setiap tahap baru berlanjut setelah pemegang peran yang berwenang menyetujuinya.** Kebutuhan sederhana seperti laporan, template cetak, atau formulir tambahan bisa dibuat sebagai **ekstensi tanpa kode**.

Rancangan lengkap dan status implementasi: [docs/rancangan/STUDIO-PENGEMBANG.md](./rancangan/STUDIO-PENGEMBANG.md).

## 1. Prasyarat (sekali saja)

Studio dijalankan di **mesin pengembang atau staging**, bukan di server produksi. Ekstensi yang sudah jadi tetap bisa dipasang di produksi, lihat bagian 6.

### Perangkat lunak

| Kebutuhan | Versi / catatan |
|---|---|
| Sistem operasi | macOS, Linux (Ubuntu/Debian), atau Windows 10/11 |
| Node.js | 22 LTS disarankan (minimal 20) |
| Git | 2.30 ke atas. Wajib, karena Studio membuat branch, commit, worktree, dan merge sendiri. Di Windows pakai **Git for Windows** (sekaligus menyediakan `bash`, `ssh`, `ssh-keygen`) |
| OpenSIMRS | Sudah terpasang dan berjalan dengan `npm run dev` beserta PostgreSQL, MongoDB, dan Redis (lihat [Petunjuk Instalasi](./INSTALLATION_GUIDE.md)) |
| Claude Code CLI | Versi terbaru, login dengan langganan **Claude Pro/Max**. Atau pakai konektor API, lihat bagian 5 |
| OpenSSH client | Hanya untuk fitur **Server & Deploy** (`ssh`, `ssh-keygen`). Sudah ada di macOS/Linux dan di Git for Windows |
| Peramban | Chrome, Edge, atau Firefox versi terbaru |

### Perangkat keras

- RAM minimal 16 GB. Semua layanan, frontend, dan agen berjalan bersamaan.
- Ruang disk kosong minimal 10 GB. Mode *worktree* membuat salinan repo per item (node_modules ditautkan, bukan disalin).
- Koneksi internet stabil. Agen berkomunikasi dengan layanan AI selama tugas berjalan.

### Akun dan akses

- Akun **superadmin** OpenSIMRS, untuk menyalakan Mode Pengembang dan mengatur peran.
- Langganan Claude Pro/Max **milik pribadi** pengguna yang menjalankan Studio. Sesuai ketentuan Anthropic, satu langganan tidak dipakai bersama banyak orang. Kalau dipakai satu tim, gunakan akun API (konektor) per tim.
- Opsional: token GitHub/GitLab bila memakai mode rilis Pull Request, dan akses SSH ke server RS bila memakai Server & Deploy.

### Langkah persiapan

1. **Claude Code CLI** terpasang dan sudah login dengan langganan Anda:
   ```bash
   npm install -g @anthropic-ai/claude-code   # atau installer resmi Claude Code
   claude auth login                           # membuka peramban, pilih akun Claude Pro/Max
   claude auth status --text                   # pastikan sudah masuk
   ```
   Login juga bisa dilakukan dari aplikasi tanpa terminal: **SIMRS Studio › Pengaturan & Agen › Claude Code › Hubungkan akun Claude**. Halaman login Claude terbuka di tab baru, dan Anda bisa masuk lewat *Continue with Google*. Setelah login, salin kode yang ditampilkan halaman Claude dan tempel di dialog Studio. Tombol **Putuskan** mengeluarkan akun.

   Login harus dilakukan **di pengguna OS yang sama** dengan yang menjalankan `npm run dev`. Studio memakai login yang sama dengan Claude Code di VS Code, dan pemakaiannya dihitung ke kuota langganan itu.
2. Isi `studio-service/.env` (dibuat installer, atau salin dari `.env.example`):
   ```env
   STUDIO_PENGEMBANG=aktif
   LINGKUNGAN=development
   ```
   Samakan `SECRET_KEY` dan pengaturan database dengan layanan lain.
3. Pastikan working tree repo bersih (`git status`), lalu ambil `main` terbaru.
4. Bila memakai mode rilis **lokal**, buat branch rilis lokal sekali saja, misalnya `git branch rs-lokal origin/main`. Isi namanya di Pengaturan Studio.
5. Jalankan `npm run install:all`, `npm run sdk:refresh`, `npm run db:migrate`, lalu `npm run dev` (sudah termasuk `studio-service` di port 8090).
6. Lanjutkan ke bagian 2 untuk mengaktifkan Studio dari aplikasi.

## 2. Mengaktifkan & memberi akses

1. Masuk sebagai **superadmin**, buka **Setting › System → Mode Pengembang → Aktifkan**.
2. Buka **SIMRS Studio › Pengaturan & Agen**:
   - **Fitur Studio**: Coding dan Ekstensi **mati bawaan**. Aktifkan bila sudah siap.
   - **Mode kerja**:
     - *Workspace*: agen bekerja di working tree repo ini, dan `npm run dev` langsung jadi pratinjau.
     - *Worktree*: salinan terpisah per item, sehingga working tree Anda tidak tersentuh.
   - **Batas**: biaya per tugas/item/bulan, berhenti pada persentase kuota langganan, dan jumlah tugas per jam.
3. Beri peran lewat **Datamaster › Role**, modul izin **SIMRS Studio**:

   | Peran | Hak (submodul › aksi) |
   |---|---|
   | Pengusul | Permintaan › CREATE, UPDATE, SETUJUI USECASE |
   | Product | Permintaan › TRIASE, BATAL; PRD › UPDATE, SETUJUI, TETAPKAN RISIKO |
   | Reviewer klinis | Review Klinis › SETUJUI (wajib untuk risiko tinggi/kritis) |
   | Programmer | Desain › SETUJUI; Coding › JALANKAN AGEN, REVIEW, BUKA PR |
   | QA | QA › UPDATE, JALANKAN UJI, LULUS |
   | Maintainer rilis | Rilis › SIAPKAN |

   Modul ini **tidak pernah** diberikan otomatis ke admin faskes. Item berisiko *kritis* juga butuh persetujuan superadmin.

**Hentikan Studio (kill switch)** di Pengaturan membatalkan semua tugas agen dan membuat semua item hanya-baca.

## 3. Alur kerja item

| Tahap | Yang dikerjakan AI | Gerbang persetujuan |
|---|---|---|
| Permintaan | Merangkum, mencari fitur serupa, bertanya, dan mengusulkan risiko | Product (triase: prioritas, jenis, modul, risiko) |
| Use case | Aktor, alur utama/alternatif/gagal, diagram | Pengusul |
| PRD | Kriteria terima *Diberikan… Ketika… Maka…*, dampak data, izin, katalog | Product (+ Reviewer klinis bila risiko tinggi; + superadmin bila kritis) |
| Desain teknis | Membaca kode lalu menyusun rencana per berkas. Risiko **naik otomatis** bila menyentuh layanan klinis/keuangan | Programmer |
| Coding | Membuat branch `feat/STD-…`, menulis kode, migrasi, uji, dan CHANGELOG | Reviewer kode (pemeriksa kebijakan wajib lulus) |
| QA | Menyusun rencana uji dan **checklist kasus uji** | QA (+ Reviewer klinis bila risiko tinggi). Syarat: cek otomatis lulus dan semua kasus uji lulus atau tidak berlaku |
| Rilis | Menyusun CHANGELOG, catatan rilis, dan pesan commit | Maintainer rilis, setelah **Commit → Terapkan ke lokal** (mode lokal) atau **Push & buat PR** (mode PR) |

Tips:
- **Diskusi** di panel kanan menjadi instruksi bagi agen pada tahap aktif. **Sunting** menyimpan dokumen hasil suntingan Anda sebagai versi baru.
- Setiap persetujuan hanya berlaku untuk dokumen terbaru. Jika dokumen direvisi, persetujuan perlu diberikan ulang.
- **Setuju, Revisi, atau Tolak:**
  - **Minta revisi** mengirim alasan Anda ke agen. Pilih **Kembali ke tahap** untuk mundur ke tahap yang sudah dilewati, misalnya dari Coding ke PRD bila PRD kurang lengkap. Tahap itu dan tahap sesudahnya perlu disetujui ulang. Kode di branch item tidak dihapus dan dipakai lagi saat coding diulang.
  - **Tolak** membatalkan item. Branch dan berkas yang belum di-commit tidak dihapus. Superadmin bisa **Buka kembali** item itu ke tahap pilihan; alasannya bisa dipakai sebagai instruksi agen untuk menulis ulang dokumen tahap itu.
  - Semua keputusan (setuju, revisi, tolak, dikembalikan, dibuka kembali, dibatalkan) beserta alasan, peran, dan waktunya tampil di panel **Riwayat keputusan** dan tercatat di **Audit**.
- **Lampiran** (gambar, PDF, teks) harus disamarkan. Lampiran teks dipindai dari data pribadi.
- **Prompt** di kepala halaman menampilkan prompt efektif tahap itu: aturan platform, instalasi, area, tahap, pengetahuan, dan konteks.
- Setelah PR dibuat, **Perbarui status** memantau PR, CI, merge, dan tag rilis. **Revisi dari komentar review** mengirim komentar reviewer GitHub/Gitea ke agen coding.
- Modul atau menu baru dikerjakan agen sesuai [Manajemen Modul](./MANAJEMEN-MODUL.md).
- Jangan menuliskan data pasien asli. Gunakan NIK berawalan `9999`, HP `080000000000`, dan email `@contoh.id`.

### Mode rilis: lokal atau Pull Request

Atur di **Pengaturan & Agen › Rilis**:

| Mode | Untuk siapa | Yang terjadi di tahap Rilis |
|---|---|---|
| **Lokal saja** (bawaan) | IT RS yang mengustomisasi instalasinya sendiri. Tidak perlu akun GitHub, push, maupun PR | **Terapkan ke lokal** menggabungkan branch item ke **branch lokal** yang dipakai aplikasi RS, lalu menjalankan `db:migrate` bila ada migrasi baru. Penerapan bisa **dibatalkan** (git revert). Item berikutnya bercabang dari branch lokal, sehingga kustomisasi saling menumpuk |
| **Pull Request** | Kontributor upstream OpenSIMRS | Push branch dan buat PR ke GitHub/Gitea, lalu pantau CI, merge, dan tag |
| **Keduanya** | RS yang memakai kustomisasinya sendiri sekaligus menyumbangkannya ke upstream | Terapkan ke lokal, lalu push & PR |

Hal yang perlu diperhatikan:
- **Branch lokal** sebaiknya diisi eksplisit, misalnya `rs-lokal`. Bila kosong, Studio memakai branch yang sedang aktif di repo.
- **Aplikasi pengembang harus memakai branch lokal.** `npm run dev` menjalankan kode dari branch yang sedang aktif di repo utama. Bila repo utama masih di branch lain (misalnya `main`), hasil penerapan tidak terlihat. Studio menampilkan peringatan dan tombol **Pindahkan aplikasi ke `<branch lokal>`** di halaman item dan di Pengaturan.
- Layanan dalam mode dev (nodemon) dan frontend (Vite) memuat ulang perubahan secara otomatis. Di server, jalankan ulang layanan yang berubah.
- **Dependensi ikut dipasang.** Bila item mengubah `package.json`/`package-lock.json` suatu layanan, Studio menjalankan `npm install` di layanan itu. Bila item mengubah SDK lokal (`packages/*`), Studio menjalankan `npm run sdk:refresh`. Layanan nodemon yang terdampak lalu dimuat ulang. `studio-service` dan frontend tidak dimuat ulang otomatis: bila keduanya terdampak, pesan sistem meminta Anda menjalankannya ulang.

#### Aktivasi otomatis setelah diterapkan

Bila **Nyalakan modul/fitur baru setelah diterapkan** dicentang (bawaan), Studio melakukan langkah berikut setelah penggabungan dan migrasi:

1. Membandingkan `database/data/katalog-modul.json` sebelum dan sesudah item, lalu mencari modul/fitur yang baru menjadi *tersedia*.
2. Menyalakannya untuk faskes yang sedang Anda pakai, atau semua faskes sesuai pengaturan, seperti di **Setting › Manajemen Modul**. Fitur hanya dinyalakan di faskes yang modul induknya aktif. Perubahan tercatat di riwayat Manajemen Modul.
3. Memberi izin modul baru ke peran admin faskes dan super admin, beserta penggunanya. Izin peran lain tetap diatur di **Datamaster › Role**.
4. Memuat ulang konfigurasi modul dan izin sesi Anda, sehingga menu baru langsung muncul tanpa login ulang. Pengguna lain mendapat menu baru saat login berikutnya.

Aktivasi otomatis hanya berjalan bila `LINGKUNGAN=development`. Di staging, klik **Aktifkan di aplikasi** di tahap Rilis. **Batalkan penerapan** juga mengembalikan toggle dan izin yang dinyalakan Studio.
- Bila server produksi berbeda dari mesin Studio, server produksi mengambil branch lokal itu, misalnya lewat Git internal RS (Gitea) atau salinan repo. Studio tetap tidak menulis langsung ke server produksi.
- Untuk memperbarui OpenSIMRS dari upstream, gabungkan rilis baru ke branch lokal. Konflik bisa muncul pada berkas yang dikustomisasi, jadi selesaikan di VS Code. Kustomisasi lewat **ekstensi tanpa kode** tidak menimbulkan konflik seperti ini.

### Kirim ke server RS tanpa GitHub (Server & Deploy)

Bila server aplikasi RS berbeda dari device tempat SIMRS Studio berjalan, buka **SIMRS Studio › Server & Deploy** (superadmin, atau peran dengan hak **Rilis › DEPLOY**).

**Persiapan, sekali saja:**
1. **Tambah server**: isi nama, jenis (produksi/staging), **IP/host**, **port SSH**, **pengguna SSH**, folder aplikasi di server (bawaan `~/opensimrs`), dan perintah deploy (bawaan `./deploy/server/deploy.sh`; untuk Podman: `CONTAINER_CLI=podman ./deploy/server/deploy.sh`).
2. **Buat kunci SSH**. Studio membuat kunci khusus: kunci privat disimpan terenkripsi, dan kunci publik ditampilkan beserta perintah untuk menempelkannya di `~/.ssh/authorized_keys` server. Login memakai kunci, bukan sandi.
3. **Uji koneksi**: sidik jari server dicatat pada koneksi pertama. Bila sidik jari itu kemudian berubah, koneksi ditolak.
4. **Siapkan server**: Studio membuat repo penampung `~/opensimrs-rs.git` di server.

**Setiap rilis:** **Kirim & deploy**. Studio mengirim branch lokal lewat SSH ke repo penampung, lalu server memperbarui folder aplikasinya (hanya *fast-forward*) dan menjalankan perintah deploy. `deploy.sh` menjalankan build, migrasi, health check, dan rollback otomatis bila gagal. Log tampil langsung dan riwayat pengiriman tersimpan. Untuk server **produksi**, nama server harus diketik sebagai konfirmasi.

Pengamannya:
- Bila folder aplikasi di server punya perubahan yang disunting langsung, pengiriman **dihentikan** supaya perubahan itu tidak tertimpa.
- Push ditolak bila branch di server sudah menyimpang dari Studio.
- Kunci privat tidak pernah keluar dari Studio dan hanya ditulis sementara saat dipakai.

**Server tanpa jaringan:** klik **Unduh paket rilis (.bundle)**, salin berkasnya ke server lewat USB, lalu jalankan:
```bash
cd ~/opensimrs && git pull /path/ke/berkas.bundle rs-lokal && ./deploy/server/deploy.sh
```

## 4. Aturan & pengetahuan

Buka **SIMRS Studio › Aturan & Pengetahuan** (yang mengubah: superadmin).
- **Aturan area**: berlaku bila item menyentuh awalan path atau modul tertentu. Contoh: `farmasi-service/` dengan aturan "perhitungan dosis = risiko kritis".
- **Tambahan template tahap**: instruksi tambahan untuk tahap tertentu. Contoh: PRD wajib memuat bagian SLA.
- **Basis pengetahuan**: catatan yang ikut ke setiap tugas agen, seperti istilah lokal, kebiasaan RS, dan keputusan arsitektur.
- Aturan instalasi umum diatur di Pengaturan & Agen.

## 5. Agen selain Claude Code

- **Codex (langganan ChatGPT Plus/Pro/Team)**, agen CLI dari OpenAI:
  1. Pasang di mesin Studio: `npm install -g @openai/codex`. Bisa juga isi `STUDIO_CODEX_BIN` di `studio-service/.env`.
  2. Di **Pengaturan & Agen › Codex**, klik **Hubungkan akun ChatGPT**. Studio menampilkan kode sekali pakai dan membuka `auth.openai.com/codex/device` di tab baru.
  3. Masuk dengan akun ChatGPT, misalnya lewat *Continue with Google*, lalu masukkan kodenya. Dialog tertutup sendiri setelah berhasil.
  4. Pilih **Codex (langganan ChatGPT)** di tabel konektor per tahap, misalnya hanya untuk tahap Coding.

  Batasannya:
  - Codex berjalan dengan sandbox-nya sendiri: tahap dokumen **hanya-baca**, coding hanya di folder kerja dan tanpa jaringan.
  - Codex tidak punya daftar larangan per berkas seperti Claude Code. Karena itu, setelah tugas coding Studio otomatis:
    - mengembalikan perubahan pada `.env*`, `studio-service/`, SDK izin, `rahasia.js`, `.github/`, `deploy/`, dan `CLAUDE.md`;
    - membatalkan commit buatan agen (perubahannya tetap ada, belum di-commit).

    Pemeriksa kebijakan dan gerbang persetujuan tetap berlaku.
  - Studio **tidak memakai** `~/.codex/config.toml` pribadi Anda (`--ignore-user-config`), sehingga model, plugin, memori, dan MCP pribadi tidak ikut ke agen Studio. Login tetap memakai akun yang sama. Pilihan model per tahap diambil dari daftar model akun Anda (`models_cache.json` milik Codex). Tanpa pilihan, Codex memakai model bawaan akun.
  - Biaya per tugas tidak tersedia dalam US$, karena langganan tidak melaporkannya; Studio hanya mencatat token.
  - Diskusi revisi coding dengan Codex selalu memulai sesi baru. Konteksnya diambil dari dokumen item.
- **Konektor API** (Pengaturan & Agen › Tambah konektor). Dibayar per pemakaian API, bukan langganan. Kunci API disimpan terenkripsi. Konektor dipilih **per tahap** dan memakai model yang diatur di konektornya.
  - Pilih **Penyedia siap pakai** agar endpoint dan contoh model terisi otomatis, beserta tautan untuk membuat kunci API:

    | Penyedia | Endpoint |
    |---|---|
    | Anthropic (Claude) | bawaan |
    | OpenAI (GPT) | bawaan |
    | DeepSeek | `https://api.deepseek.com/v1` |
    | Qwen (Alibaba Model Studio) | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
    | Grok (xAI) | `https://api.x.ai/v1` |
    | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
    | Mistral | `https://api.mistral.ai/v1` |
    | OpenRouter (banyak model) | `https://openrouter.ai/api/v1` |
    | Groq | `https://api.groq.com/openai/v1` |
    | Ollama (model lokal, tanpa kunci) | `http://localhost:11434/v1` |

  - Penyedia lain yang kompatibel OpenAI (vLLM, LM Studio, dan lainnya) bisa diisi manual. Model lokal cocok untuk faskes yang tidak boleh mengirim data keluar.
  - Nama model di preset hanya contoh dan bisa berubah; cek nama terbaru di situs penyedia.
  - Kemampuan memakai alat (membaca/menyunting berkas) berbeda tiap model. Klik **Uji** dan coba di tahap dokumen dulu sebelum dipakai untuk Coding.
- **Agen eksternal lewat MCP** (mis. OpenClaw, Claude Desktop): daftarkan server MCP OpenSIMRS:
  ```json
  { "mcpServers": { "opensimrs": { "command": "node", "args": ["<repo>/studio-service/src/mcp.js"] } } }
  ```
  - **Alat baca**: `baca_berkas`, `cari`, `daftar_berkas`, `baca_skema_db` (struktur tanpa data), `baca_katalog`.
  - **Alat Studio**: `daftar_item`, `baca_item`, `kirim_artefak` (dokumen versi baru, tetap perlu persetujuan), `kirim_pesan`.
  - Alat tulis berkas hanya aktif bila `STUDIO_MCP_TULIS=aktif`.

## 6. Ekstensi tanpa kode

Ekstensi dibuat di **SIMRS Studio › Ekstensi** (fitur Ekstensi harus aktif). Ada tiga jenis:
- **Laporan**: kueri SELECT dengan parameter, ditampilkan sebagai tabel dengan ekspor Excel dan cetak PDF.
- **Template cetak**: kueri ditambah tata letak dokumen (teks `{{kolom}}`, tabel, tanda tangan) dengan kop faskes.
- **Formulir tambahan**: isian per pasien atau kunjungan. Hak akses mengikuti modul yang ditentukan, mis. Rekam Medis.

Langkahnya:
1. Tulis kebutuhan, lalu klik **Rakit ekstensi baru**. Agen memakai skema DB asli (tanpa data) dan diperbaiki otomatis bila validasi gagal. Cara lain: **Sunting JSON**.
2. **Pratinjau**: kueri dijalankan pada faskes aktif, maksimal 50 baris.
3. **Pasang**: ekstensi muncul di menu **Ekstensi** untuk pengguna yang punya hak modulnya.

Pengamannya:
- Kueri hanya boleh SELECT/WITH dan wajib memakai `:faskes_uuid`. Faskes selalu diambil dari token.
- Kueri tidak boleh menyentuh tabel akun/sesi, kolom rahasia (sandi, token, secret), atau fungsi sistem.
- Kueri dijalankan dalam transaksi **read-only** dengan batas waktu 15 detik.

**Ke produksi:**
1. Di Studio: **Ekspor paket** (berkas `.json` bertanda tangan Ed25519).
2. Salin **kunci publik** (Pengaturan & Agen › Penanda tangan paket ekstensi) ke `laporan-service/.env` produksi sebagai `EKSTENSI_KUNCI_PUBLIK`, lalu jalankan ulang laporan-service.
3. Di produksi: **Setting › Ekstensi → Impor paket → Pasang**. Paket yang diubah atau ditandatangani kunci lain akan ditolak.

## 7. Pengaman

- Agen **tidak menyambung ke database** (kecuali membaca struktur skema tanpa data), **tidak membaca `.env`**, dan tidak bisa commit, push, berpindah branch, atau `npm install`.
- **Zona merah** tidak bisa diubah agen: `.env*`, `studio-service/**`, SDK autentikasi/izin, `rahasia.js`, `.github/**`, `deploy/**`, `CLAUDE.md`, dan migrasi lama.
- **Zona kuning** (layanan klinis/keuangan) menaikkan risiko menjadi tinggi sehingga reviewer klinis wajib menyetujui. Item berisiko kritis tidak dikodekan agen.
- **Pemeriksa kebijakan** mengecek rahasia, IP privat, data pribadi, aturan migrasi, katalog, CHANGELOG, dan uji.
- Studio hanya men-commit **berkas yang diubah agen untuk item itu**. Semua tindakan tercatat di **Audit & Metrik**.

## 8. Kendala umum

| Gejala | Penyebab / solusi |
|---|---|
| Kartu Mode Pengembang: "studio-service belum berjalan" | Jalankan `npm run dev:studio` dan cek port 8090 |
| "Claude Code CLI tidak ditemukan" / agen gagal login | Pasang Claude Code, lalu jalankan `claude auth login` di pengguna OS yang sama dengan layanan. Cek dengan `claude auth status --text`. Bila perlu, isi `STUDIO_CLAUDE_BIN` |
| "Fitur Coding belum diaktifkan" | Pengaturan & Agen › Fitur Studio |
| "Gagal berpindah ke branch …" (mode workspace) | Ada perubahan yang bentrok. Commit/stash dulu, atau pakai mode worktree |
| "Kuota langganan Claude sudah …%" | Tunggu reset, naikkan batas kuota, atau pilih model Haiku untuk tahap dokumen |
| Perubahan kode `studio-service` belum berlaku | `npm run dev:studio` sengaja tidak memakai mode watch agar tugas agen yang panjang tidak terputus oleh restart. Jalankan ulang layanan secara manual |
| Impor paket ditolak "tanda tangan tidak sah" | `EKSTENSI_KUNCI_PUBLIK` produksi tidak sama dengan kunci Studio, atau paket diubah |
