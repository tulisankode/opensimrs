# Catatan Perubahan (Changelog)

Semua perubahan penting OpenSIMRS dicatat di berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), dengan kategori dalam Bahasa Indonesia:
**Ditambahkan** (fitur baru), **Diubah** (perubahan perilaku/fitur yang ada), **Usang** (akan dihapus), **Dihapus**, **Diperbaiki** (perbaikan bug), dan **Keamanan**.

## Skema versi

OpenSIMRS memakai [Semantic Versioning](https://semver.org/lang/id/) `MAYOR.MINOR.PATCH`:

| Bagian | Naik bila | Contoh |
|---|---|---|
| **MAYOR** | Ada perubahan yang tidak kompatibel: struktur data, kontrak API antar-layanan, atau langkah instalasi yang wajib diubah | `1.x` → `2.0.0` |
| **MINOR** | Ada modul/fitur baru yang kompatibel ke belakang | `1.0.0` → `1.1.0` |
| **PATCH** | Hanya perbaikan bug dan keamanan | `1.1.0` → `1.1.1` |

- Rilis pra-stabil diberi akhiran **`-alpha.N`** (fitur masih bertambah, belum disarankan untuk produksi tanpa uji paralel), **`-beta.N`** (fitur lengkap untuk segmen sasaran, fokus stabilisasi), lalu **`-rc.N`** (kandidat rilis).
- Rilis publik pertama adalah **`1.0.0-alpha.1`**. Versi `0.x` di bawah adalah rekonstruksi tonggak pengembangan sebelum kode dibuka, disusun dari riwayat commit; versi tersebut tidak pernah dirilis sebagai paket.
- Setiap migrasi database baru selalu disebut di catatan rilis. Jalankan `npm run db:migrate` setiap kali memperbarui.

Cara menulis entri baru ada di [CONTRIBUTING.md](./CONTRIBUTING.md#7-changelog).

---

## [Belum dirilis]

### Ditambahkan
- **SIMRS Studio** (mode pengembang berbasis AI, layanan baru `studio-service` port 8090). IT RS menulis permintaan, lalu agen AI menyusun ringkasan, use case, PRD, desain teknis, kode, rencana uji, dan catatan rilis.
  - **Gerbang persetujuan per peran** mengikuti tingkat risiko: Product, Pengusul, Reviewer klinis, Programmer, Reviewer kode, QA, Maintainer rilis, dan superadmin untuk risiko kritis. Risiko naik otomatis bila desain/kode menyentuh layanan klinis/keuangan. Ada opsi pemisahan tugas.
  - **Agen:** Claude Code CLI dengan langganan yang sama seperti di VS Code (login dari aplikasi lewat tombol **Hubungkan akun Claude**: halaman login claude.ai terbuka di tab baru, bisa dengan akun Google, lalu kode ditempel di Studio), **Codex CLI dengan langganan ChatGPT** (tombol **Hubungkan akun ChatGPT** memakai kode perangkat; sandbox hanya-baca untuk dokumen dan folder kerja tanpa jaringan untuk coding; perubahan pada zona terlarang dan commit buatan agen dikembalikan otomatis; `config.toml` pribadi tidak dipakai, dan model dipilih dari daftar model akun). Model per tahap mengikuti agennya: Claude Code hanya model Claude, Codex hanya model OpenAI, konektor API memakai model konektornya. Agen yang belum terhubung tidak bisa dipilih, dan pasangan yang tidak cocok ditolak saat disimpan. **Revisi bisa mundur ke tahap sebelumnya** (mis. dari Coding ke PRD; tahap itu dan sesudahnya disetujui ulang, kode di branch dipakai lagi). Item yang **ditolak/dibatalkan bisa dibuka kembali** superadmin ke tahap pilihan; dialog Tolak menjelaskan bahwa tolak membatalkan item, dan panel Riwayat keputusan menampilkan peristiwa dikembalikan/dibuka kembali/dibatalkan. Konektor API punya **penyedia siap pakai** (DeepSeek, Qwen, Grok, Gemini, Mistral, OpenRouter, Groq, Ollama, selain Anthropic & OpenAI) yang mengisi endpoint dan contoh model, atau konektor Anthropic API, OpenAI API, maupun model lokal yang kompatibel OpenAI. Konektor dan model diatur per tahap; kunci API disimpan terenkripsi.
  - **Server MCP OpenSIMRS** (`studio-service/src/mcp.js`) untuk agen eksternal (mis. OpenClaw, Claude Desktop). Alatnya: membaca repo, skema DB tanpa data, katalog, serta membaca dan mengirim dokumen item.
  - **Coding:** dikerjakan di branch kerja per item, di working tree (workspace) atau di worktree terpisah. Hasilnya dicek pemeriksa kebijakan: zona berkas, rahasia, data pribadi, aturan migrasi, katalog, CHANGELOG, dan uji.
  - **QA:** cek otomatis dan checklist kasus uji.
  - **Rilis:** mode **lokal** (bawaan, tanpa push/PR) menerapkan branch item ke branch lokal aplikasi RS, menjalankan migrasi, dan bisa dibatalkan (revert). Mode **Pull Request** mengirim ke GitHub/Gitea dengan pemantauan status CI, merge, dan tag rilis serta revisi dari komentar review. Ada juga mode **keduanya**. **Server & Deploy** mengirim branch lokal ke server RS lain tanpa GitHub: lewat SSH (kunci khusus Studio yang terenkripsi, sidik jari host disimpan, git push ke repo penampung, server diperbarui hanya fast-forward lalu `deploy.sh` dijalankan, log langsung dan riwayat), atau lewat berkas `.bundle` untuk server tanpa jaringan. Item berisiko kritis dikerjakan programmer lewat **coding manual** (siapkan branch, kerjakan di VS Code, pindai perubahan).
  - **Aktivasi setelah penerapan lokal:** modul/fitur yang baru tersedia di katalog langsung dinyalakan untuk faskes Anda (atau semua faskes). Izin modul baru diberikan ke peran admin faskes dan super admin. Menu diperbarui tanpa login ulang. Otomatis hanya di `LINGKUNGAN=development`; di staging lewat tombol **Aktifkan di aplikasi**. Pembatalan penerapan ikut mengembalikannya. Studio juga memperingatkan bila aplikasi pengembang tidak berjalan di branch lokal, dengan tombol **Pindahkan aplikasi**. Dependensi ikut dipasang otomatis: `npm install` di layanan yang `package.json`-nya berubah dan `npm run sdk:refresh` bila SDK lokal berubah, lalu layanan terdampak dimuat ulang.
  - **Aturan prompt berlapis:** instalasi, area, dan tambahan per tahap, plus pratinjau prompt efektif. Ada juga basis pengetahuan, lampiran (dipindai data pribadi), triase/tunda, batas biaya/kuota/laju, kill switch, audit, dan metrik.
  - **Aktivasi:** menu hanya tampil bila `STUDIO_PENGEMBANG=aktif` (mati bawaan) dan superadmin menyalakan **Mode Pengembang** di Setting › System. Peran lain diberi modul izin baru **SIMRS Studio**, yang tidak ikut sinkron otomatis ke admin faskes. Coding/QA/rilis ditolak pada `LINGKUNGAN=production`.
  - **Migrasi baru:** `20261015100000-simrs_studio`, `20261015120000-simrs_studio_lanjutan`, `20261015120100-izin_simrs_studio_superadmin`, `20261016000000-simrs_studio_rilis_lokal`, `20261016010000-simrs_studio_server`, `20261016100000-simrs_studio_aktivasi`.
  - Panduan: [docs/SIMRS-STUDIO.md](./docs/SIMRS-STUDIO.md); rancangan: [docs/rancangan/STUDIO-PENGEMBANG.md](./docs/rancangan/STUDIO-PENGEMBANG.md).
- **Helpdesk asisten pengguna (tombol Bantuan)**: petugas bertanya cara memakai OpenSIMRS dari dalam aplikasi. Pertanyaan diteruskan setting-service ke agen **OpenClaw** di VM terpisah lewat endpoint kompatibel OpenAI Gateway. Rancangan: [docs/rancangan/HELPDESK-OPENCLAW.md](./docs/rancangan/HELPDESK-OPENCLAW.md).
  - setting-service: `GET /bantuan/status`, `POST /bantuan/chat` (jawaban streaming SSE), `GET /bantuan/ringkasan` (superadmin).
    - NIK, nomor kartu, HP, email, dan nomor RM disamarkan sebelum dikirim.
    - Konteks yang ikut dikirim: peran, segmen, modul aktif/nonaktif, halaman.
    - Ada batas laju per pengguna, dan log `bantuan_log` yang sudah disaring disimpan 90 hari.
    - Token Gateway hanya di `.env` server (`HELPDESK_GATEWAY_URL`, `HELPDESK_GATEWAY_TOKEN`).
  - Fitur katalog baru **Asisten Bantuan (Helpdesk AI)** (`helpdesk_ai`, modul Dashboard). Tombol **Bantuan** berikon headset di header (menggantikan ikon lonceng statis) membuka jendela chat ala chatbot dengan saran pertanyaan per halaman; bila Helpdesk belum aktif, jendela menjelaskan alasannya. Badge merah menghitung balasan yang masuk saat jendela tertutup, dan ikon berdenyut selama asisten masih menyusun jawaban. Ikon toa (panggilan antrian) di header hanya tampil bila modul Antrian aktif.
  - `deploy/helpdesk/`:
    - panduan pemasangan OpenClaw di VM (sandbox, workspace hanya-baca, kanal pesan dimatikan) dan instruksi agen `AGENTS.md`;
    - contoh konfigurasi, skrip sinkron panduan, dan skrip uji Gateway;
    - Gateway tiruan untuk pengembangan lokal;
    - perangkat evaluasi: pertanyaan cara pakai dari panduan + pertanyaan keamanan.
  - **Panduan pengguna** per modul di `docs/panduan-pengguna/`, berupa draf dari kode yang wajib ditinjau petugas modul.
  - **Migrasi baru:** `20261016120000-helpdesk_bantuan`.
- **Ekstensi tanpa kode** (dirakit di SIMRS Studio, runtime di laporan-service sehingga berjalan juga di produksi): laporan (tabel, ekspor Excel, cetak PDF), template cetak (PDF berkop faskes), dan formulir tambahan per pasien/kunjungan.
  - Muncul di menu baru **Ekstensi** sesuai hak modul pengguna.
  - Pengaman kueri: hanya SELECT/WITH, wajib `:faskes_uuid` (faskes selalu dari token), tanpa tabel akun/sesi, kolom rahasia, maupun fungsi sistem. Kueri dijalankan dalam transaksi read-only dengan batas waktu 15 detik.
  - Paket bertanda tangan Ed25519 diimpor di **Setting › Ekstensi**; kunci publik di `EKSTENSI_KUNCI_PUBLIK` (laporan-service).
- `@opensimrs/authorization-sdk` 1.2.0: helper bersama `isSuperadmin` (`@opensimrs/authorization-sdk/peran`), dipakai setting-service, auth-service, dan laporan-service.
- Installer (`install.sh` / `install.cmd`) menawarkan **alat AI SIMRS Studio**: Claude Code CLI dan Codex CLI (`npm install -g`; lewati dengan `--tanpa-ai` / `-TanpaAi`). Opsi `--helpdesk` / `-Helpdesk` memasang **OpenClaw** lewat installer resminya untuk uji coba Helpdesk (produksi tetap di VM terpisah). `--cek` menampilkan status ketiga alat itu.
- `install.sh --podman`: PostgreSQL, MongoDB, dan Redis dijalankan di kontainer Podman (`podman compose`) sementara layanan & frontend tetap native — untuk macOS/Linux tanpa PostgreSQL/MongoDB/Redis lokal. Membuat VM Podman bila perlu, menulis `.env` root sebelum kontainer menyala, memeriksa port & kecocokan sandi volume. Panduan di INSTALLATION_GUIDE bagian 9.
- `deploy/server/deploy.sh` mendukung **Podman** (`CONTAINER_CLI=podman`, mis. macOS tanpa Docker Desktop) dengan docker-compose v2 sebagai provider `podman compose`; bawaan tetap Docker. Panduan di [Petunjuk Instalasi › Server dengan deploy.sh](./docs/INSTALLATION_GUIDE.md#83-server-dengan-deploysh).
- Admisi › Data Pasien: **Aktifkan** massal (pasangan Non-Aktifkan), **Hapus** massal untuk pasien yang belum pernah bertransaksi (dicek di 23 tabel transaksi lintas layanan; yang sudah bertransaksi dilaporkan beserta jenis transaksinya), dan filter status (Semua/Aktif/Non-Aktif). Endpoint baru `PUT /api/v3/admisi/patient/aktifkan` dan `DELETE /api/v3/admisi/patient/hapus`.
- MCU › Peserta: **Batalkan Terpilih** untuk membatalkan banyak peserta sekaligus (centang baris atau semua sesuai filter, maks. 500), mis. sebelum impor ulang file revisi HRD. Aturannya sama dengan pembatalan satuan (status Batal tetap tercatat; peserta selesai/ber-invoice/sudah dibayar ditolak; order lab & radiologi yang belum berisi hasil ikut dibatalkan). Hasil menampilkan peserta yang gagal beserta alasannya dan order yang sudah terkirim ke LIS agar dibatalkan juga di LIS. Endpoint baru `POST /api/v3/penunjang/mcu/peserta/batal-massal`.
- MCU › Peserta: **Hapus Permanen** (soft delete) untuk peserta yang belum diproses, mis. salah impor: belum ada isian stasiun, order lab tanpa hasil dan belum dikirim ke LIS, order radiologi belum diperiksa, belum masuk invoice, tagihan perorangan belum dibayar. Peserta hilang dari daftar dan laporan; order dan tagihan yang masih aktif ikut dibatalkan; pasien di Admisi tidak dihapus. Izin baru **MCU › Peserta › HAPUS** (migrasi `20261015070200-izin_mcu_hapus_peserta` memberikannya kepada peran/pengguna yang punya izin BATAL). Endpoint baru `POST /api/v3/penunjang/mcu/peserta/hapus-massal`.
- Datamaster **Pegawai** dan **Praktisi**: tombol **Import** dan **Download** template Excel seperti halaman datamaster lain. Template berisi contoh fiktif, sheet *Keterangan*, dan kolom NIK berformat teks. Import praktisi (endpoint baru `POST /api/v3/datamaster/practitioner/import`) merujuk pegawai lewat NIK dan poli lewat nama di master Lokasi. Galat import dilaporkan per nomor baris Excel dan tidak ada data yang tersimpan bila masih ada galat.

### Diperbaiki
- Setting › Manajemen Modul: setelah modul diaktifkan, izin baru kini juga berlaku di backend tanpa login ulang. Sebelumnya hanya menu yang diperbarui, sedangkan cache izin token di Redis masih lama. Endpoint baru `POST /api/v3/auth/permission/muat-ulang` membaca ulang izin sesi dari database.
- **Keamanan antar-faskes:** `Context` (author/token JWT) di admisi-, rawat-jalan-, rawat-inap-, igd-, dan payment-service sebelumnya disimpan di field statis untuk seluruh proses. Akibatnya, permintaan yang berjalan bersamaan bisa membaca faskes, pengguna, atau token milik permintaan lain, misalnya pendaftaran tercatat di faskes yang salah. Kini konteks disimpan per permintaan (AsyncLocalStorage) dan disertai uji permintaan bersamaan.
- **Clone/instalasi baru (server, Docker, Podman, `install.sh`) gagal menjalankan sebagian layanan** (`Cannot find package 'sequelize' imported from /packages/model-sdk/…`): berkas `.npmrc` (`install-links=true`, memasang SDK lokal sebagai salinan) diabaikan `.gitignore` tiap layanan sehingga tidak pernah ter-commit. Kini `.npmrc` ikut di repo untuk 15 layanan.
- Gateway server (nginx) tidak lagi menulis mati resolver DNS Docker (`127.0.0.11`): alamat resolver diambil dari `/etc/resolv.conf` kontainer saat start, sehingga gateway juga berfungsi di Podman (sebelumnya semua permintaan API lewat gateway menggantung).
- stok-farmasi-service tidak lagi mewajibkan `PUBLIC_KEY`/`PRIVATE_KEY` (sisa JWT RS256, tidak dipakai); sebelumnya gagal start di server yang `.env`-nya mengikuti `deploy/server/.env.example`.
- No. RM pasien baru kini dibuat dari nomor RM terbesar + 1 (sebelumnya jumlah pasien + 1, sehingga bisa bentrok dengan nomor yang sudah dipakai bila ada data pasien yang dihapus permanen).
- Bridging LIS bulk MCU: `registrasi.username` (wajib di gateway `registrasi_bulk_mcu`) kini selalu dikirim (`-` bila tidak ada petugas); registrasi per order tidak berubah.
- Pasien **non-aktif** tidak lagi terbaca di modul lain: pencarian pasien Admisi kini bawaan hanya pasien aktif (sebelumnya form order Laboratorium dan Rawat Inap ikut menampilkan pasien non-aktif), begitu pula pencarian pasien Radiologi, Fisioterapi, Patologi Anatomi, Mikrobiologi, MCU, dan aplikasi mobile. Pendaftaran lewat cek identitas (APM/kiosk), pendaftaran & impor MCU menolak pasien non-aktif dengan pesan untuk mengaktifkannya dulu.
- Import pegawai: baris kosong tidak lagi membuat import gagal, NIK yang sudah terdaftar ditolak, tanggal lahir dari sel bertipe tanggal Excel diterima, serta tipe dan jenis kelamin tidak membedakan huruf besar/kecil.
- **Keamanan data:** ekspor praktisi kini hanya berisi praktisi faskes pengguna; sebelumnya ikut mengekspor praktisi semua faskes.
- Ekspor praktisi menampilkan nama poli pelayanan (sebelumnya berisi nilai true/false); ekspor pegawai menampilkan jenis kelamin Perempuan dengan benar.
- Tautan Discord di dokumen kini mengarah ke server komunitas OpenSIMRS dengan undangan permanen. Tautan lama adalah undangan grup DM yang kedaluwarsa dalam 24 jam.
- `install.ps1` (Windows): port PostgreSQL kini dibaca dari `postgresql.conf` layanannya (atau variabel `PG_PORT`) dan dipakai untuk `psql` serta `DB_PORT` di `.env`; sebelumnya selalu 5432 sehingga gagal bila PostgreSQL berjalan di port lain.
- `install.ps1`: Redis di bawah versi 5 (mis. port Redis lama untuk Windows v3.0) tidak lagi dianggap cukup; skrip menawarkan Memurai. Layanan berstatus *Disabled* dilewati dengan peringatan, dan kegagalan menyalakan layanan tidak lagi dilaporkan sebagai berhasil.
- `install.ps1` dan `install.sh`: `.env` root lama yang mengarah ke database lain (nama, user, atau port berbeda, mis. database kerja di kontainer Docker) kini dicadangkan lalu dibuat ulang, sehingga `npm run db:migrate` tidak menyasar database yang salah. Pengecekan `.env` layanan juga membandingkan `DB_NAME`, `DB_USERNAME`, dan `DB_PORT`.
- `install.ps1` dan `install.sh`: `npm audit` dimatikan selama `install:all` karena bisa menggantung di jaringan lambat (jalankan `npm audit` terpisah bila perlu).

---

## [1.0.0-alpha.1] - 2026-10-15

Rilis publik pertama sebagai **OpenSIMRS**, sebelumnya dikembangkan secara internal.

### Ditambahkan
- Dokumentasi untuk komunitas: [README](./README.md) baru, [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md) (jalur coba cepat & implementasi faskes), [Manajemen Modul](./docs/MANAJEMEN-MODUL.md) dengan katalog lengkap, [Roadmap & timeline](./docs/ROADMAP.md) dengan label kontributor, [Panduan Kontribusi](./CONTRIBUTING.md), dan berkas changelog ini.
- Aturan [versi, branch, dan merge](./docs/kontributor/ALUR-GIT-RILIS.md) untuk contributor, beserta templat Pull Request (`.github/pull_request_template.md`).
- Skrip `install.sh` (macOS, Ubuntu/Debian) dan `install.cmd`/`install.ps1` (Windows 10/11, winget + Memurai) untuk instalasi lokal tanpa Docker. Skrip ini mengecek dan memasang dependensi, menyiapkan PostgreSQL/MongoDB, membuat semua `.env` dengan kunci acak, lalu menjalankan instalasi, migrasi, dan data demo.
- Skrip `scripts/dokumen-katalog.mjs` yang membuat tabel katalog modul di `docs/MANAJEMEN-MODUL.md` dari `database/data/katalog-modul.json` (opsi `--cek` untuk CI).
- [COMMUNITY.md](./COMMUNITY.md): kanal resmi komunitas (grup Telegram, server Discord, grup WhatsApp) beserta aturan forum dan moderasi.
- Panduan per peran kontributor di [`docs/kontributor/`](./docs/kontributor/README.md): implementator, developer, tester/QA, dan product development.
- [Spesifikasi Hardware](./docs/SPESIFIKASI-HARDWARE.md) on-premise per segmen faskes dan [aturan lingkungan development/staging/production](./docs/LINGKUNGAN.md).
- Petunjuk Instalasi kini memuat dua cara yang setara: **dengan Docker** dan **tanpa Docker** (instal native, termasuk produksi dengan pm2/systemd + nginx).

### Diubah
- Kode dipindah ke **satu monorepo** (frontend, 18 layanan backend, migrasi, skrip, dokumen). Sebelumnya setiap layanan berada di repositori terpisah (git submodule). Satu fitur lintas layanan kini cukup satu commit/PR.
- Riwayat commit lama setiap layanan **tidak** dibawa karena memuat berkas rahasia; kode masuk sebagai snapshot.
- **Rebranding identifier teknis ke `opensimrs`**: paket SDK `@opensimrs/*`, paket root `opensimrs` dan layanan `opensimrs-<layanan>`, database PostgreSQL & MongoDB bawaan `opensimrs`, image `opensimrs/*`, kontainer `opensimrs-db`/`opensimrs-redis`/`opensimrs-frontend`/`opensimrs-gateway`, jaringan Docker `opensimrs`, WORKDIR image `/app`, token warna Tailwind `opensimrs` (`bg-opensimrs-300`, variabel CSS `--opensimrs-*`), dan email akun demo `@demo.opensimrs.local`. Logo dan favicon OpenSIMRS baru di frontend.
- **SDK masuk monorepo** di `packages/model-sdk`, `packages/authorization-sdk`, dan `packages/permission-sdk` (versi 1.1.0, lisensi ISC dengan atribusi penulis asli). Layanan memakai `"@opensimrs/<sdk>": "file:../packages/<sdk>"` dengan `install-links=true` di `.npmrc` tiap layanan, sehingga SDK terpasang sebagai salinan dan sequelize/mongoose tetap satu instans. Dukungan JWT **HS256** kini bagian kode `authorization-sdk` (bukan tambalan). Setelah mengubah SDK, jalankan `npm run sdk:refresh`.
- JWT memakai `SECRET_KEY` bersama (wajib sama di semua layanan); `PRIVATE_KEY`/`PUBLIC_KEY` tidak dipakai lagi.
- **Skrip npm root**: `dev` menjalankan semua layanan + frontend; `dev:<layanan>` untuk tiap layanan (termasuk `dev:frontend`, `dev:penunjang`, `dev:satusehat`, `dev:bpjs`); `dev:core`; `dev:local` (`infra:up` + `dev:core`); `install:all` memasang semua layanan + frontend tanpa langkah tambalan; `sdk:refresh`; `infra:up`/`infra:down` kini **hanya** PostgreSQL, MongoDB, Redis; `stack:up`/`stack:down` untuk seluruh tumpukan Docker; `docs:katalog`.
- **Docker**: layanan ber-SDK dibangun dengan konteks root repo (`context: .`, `dockerfile: <layanan>/Dockerfile`) dan menyalin `packages/` ke image; `.dockerignore` root baru. Root `docker-compose.yml` menjadi satu-satunya berkas compose.
- **Deploy generik** di `deploy/server/` (`deploy.sh`, `docker-compose.server.yml`, `gateway.nginx.conf`, `.env.example`): rahasia server di `~/.opensimrs/.env` (`OPENSIMRS_STATE_DIR`), variabel `SERVER_HOST`, `PUBLIC_API_URL`, `FRONTEND_ALLOWED_HOSTS`; perintah `docker compose -p opensimrs -f docker-compose.yml -f deploy/server/docker-compose.server.yml`.
- **CI** (`ci.yml`): cek sintaks layanan dan `packages/`, uji unit lab-service, muat `schema.sql` lalu migrasi dua kali, `node scripts/dokumen-katalog.mjs --cek`, build frontend.
- **`schema.sql` hanya struktur + data referensi nasional** (wilayah, ICD-10, ICD-9-CM, SNOMED, LOINC, odontogram), ±11 MB, tanpa pernyataan kepemilikan objek. Database baru langsung siap untuk `npm run db:migrate` → `npm run db:demo:seed` tanpa `db:demo:reset`.
- Seeder `db:seed:admin` menyalin hak akses dari akun `superadmin` (bawaan `SEED_ADMIN_TEMPLATE`) yang dibuat `db:demo:seed`.
- MongoDB: layanan memakai akun root dari `.env` (`authSource=admin`); `mongo-init.js` hanya menyiapkan database aplikasi.
- Berkas dipindah: rencana pengujian kini `docs/testing/rencana-testing.md` (tanpa nama produk lama); `COMUNITY_MANIFETO.md` → `COMMUNITY_MANIFESTO.md`.
- Lisensi proyek **MIT** (berkas `LICENSE`); kontak resmi `dev@opensimrs.id`.

### Dihapus
- Mekanisme tambalan SDK: `npm run patch:local-sdks`, `scripts/patch-local-sdks.mjs`, `deploy/staging/sdk-patches`, dan skrip shell tambalan lama (`patch-*.sh`).
- Jalur WSL berbasis skrip: `npm run infra:wsl`, `scripts/start-wsl-infra.ps1`, `setup_wsl.sh`, `setup_mongodb.sh`. Instal native tetap didukung lewat langkah manual di Petunjuk Instalasi.
- Berkas compose per layanan (`*/docker-compose.yml`, `*/prod-compose.yml`) dan `docker-compose-dev.yml`.
- `deploy/staging/` (diganti `deploy/server/`) dan workflow `.github/workflows/deploy-staging.yml`.
- Halaman pratinjau, aset, dan dokumen aplikasi mobile pihak lain yang bukan bagian OpenSIMRS. API booking pasien `/api/v3/admisi/mobile/pasien/*` tetap tersedia untuk aplikasi mobile apa pun.
- `database/init/00-roles.sql`: role database khusus tidak diperlukan lagi.
- `frontend-service/dist/` dari repo (kini di `.gitignore`) dan folder `datamaster-service/.idea`.

### Keamanan
- Nilai rahasia di berkas `.env.example` dikosongkan. Berkas `.env`, kredensial, dan data pasien nyata tidak disertakan di repositori.
- **`schema.sql` tanpa data pribadi**: data faskes, pasien, dan pengguna dari masa pengembangan dihapus; hanya struktur dan data referensi nasional yang tersisa.
- Skrip dengan kredensial tertanam dihapus (skrip WSL/MongoDB dan tambalan server); `mongo-init.js` tidak lagi membuat user dengan sandi tertanam.
- Semua `.env.example` layanan dibersihkan: tanpa alamat IP internal, tanpa kunci terisi, nama database `opensimrs`.
- `.env.example` di root dibersihkan dari alamat IP jaringan internal dan contoh kunci API; diganti nilai `localhost` dan isian kosong.
- Dokumen uji dan audit tidak lagi menyebut alamat server internal.

---

## [0.6.0] - 2026-10-14

Layanan penunjang, segmen praktik mandiri siap pakai, dan data demo.

### Ditambahkan
- **Layanan baru `penunjang-service`** (port 8099, `/api/v3/penunjang`) dengan helper bersama kunjungan, tagihan, penomoran, dan izin per aksi.
- **Fisioterapi**: bed, tindakan & paket terapi, order dari RME dan APS (atas permintaan sendiri), validasi → tagihan, penjadwalan slot × bed, booking, evaluasi (fase rehabilitasi + persetujuan tindakan), cetak, empat laporan.
- **Radiologi**: master pemeriksaan & paket, order RME/APS, worklist → expertise, ruang & alat, penjadwalan per ruang, template expertise, petugas, persiapan pasien, laporan per ruang.
- **Medical Check Up (MCU)**: perusahaan, paket (item lab/radiologi/tindakan + stasiun), peserta perorangan/korporasi, pemeriksaan per stasiun, kesimpulan fit/unfit, sertifikat, invoice korporasi; **impor Excel** peserta (pasien baru otomatis didaftarkan, pasien lama dikenali dari NIK/No. RM); order lab otomatis tanpa tagihan ganda; harga kontrak per perusahaan; pembayaran invoice bertahap; rekap HRD (PDF/Excel).
- **Patologi Anatomi**: penerimaan jaringan (penomoran histopatologi, sitologi, potong beku, imunohistokimia), makroskopis/mikroskopis, diagnosis ICD-O, verifikasi dokter spesialis PA, arsip blok & slide, template, laporan resmi & label.
- **Mikrobiologi**: pewarnaan, kultur, isolat & uji kepekaan antibiotik (S/I/R, panel otomatis), laporan sementara/final, antibiogram, master organisme & antibiotik (kode WHONET).
- **Bridging LIS** lanjutan: mapping tindakan, unit, dokter, penjamin, dan item hasil di menu **Laboratorium › Mapping LIS**; ambil hasil metode GET; No. Lab LIS disimpan dan menjadi kunci pencocokan hasil; **kirim massal peserta MCU** (mode bulk/per order) dengan antrean batch, klaim anti-dobel, status "tidak pasti" + Cek Status, dan kirim ulang yang gagal.
- **LIS tiruan** `scripts/lis-tiruan.mjs` untuk menguji bridging tanpa server LIS asli.
- **SOAP Ringkas** satu layar dan **Pendaftaran Ringkas** sebagai bawaan segmen praktik mandiri.
- **Data demo**: reset & seeder 8 faskes fiktif satu per segmen (`db:demo:reset`, `db:demo:seed`), runner idempoten datamaster penunjang (`db:demo:master-penunjang`), dan seeder transaksi lewat alur API sungguhan (`db:demo:transaksi`).
- **Tampilan**: tema warna & logo per faskes, header halaman satu baris, grup menu **Penunjang ▾**, tombol **Lainnya** untuk menu yang tidak muat, menu modul berstatus "Segera", nama faskes di footer, footer OpenSIMRS.
- **Cetak**: hasil lab berkop logo faskes dengan flag H/L/kritis, legenda, dokter penanggung jawab & QR; RME › Cetak Hasil memuat riwayat Lab, Radiologi, PA, Mikrobiologi, Fisioterapi; kuitansi dan tagihan menampilkan rincian voucher & diskon.
- **Izin**: menyimpan Manajemen Modul menyinkronkan izin modul aktif ke peran admin faskes (`POST /api/v3/auth/permission/sinkron-modul`); editor Role memakai katalog izin dari server (`GET /api/v3/auth/permission/katalog`); izin per tombol untuk PA, Mikrobiologi, MCU, dan Radiologi.
- **Manajemen Modul**: fitur boleh mensyaratkan modul lain (`modul_syarat`); katalog diselaraskan dengan dokumen kebutuhan produk lama.
- Dokumen `docs/ROADMAP.md` dan `docs/KONTEKS-PENGEMBANGAN.md`.
- Migrasi baru untuk katalog modul, tabel penunjang, LIS, MCU, PA/Mikrobiologi, dan izin (`database/migrations/202610*.cjs`).

### Diubah
- Mapping LIS dipindah dari Setting ke modul Laboratorium; Setting hanya menyimpan koneksi & kredensial.
- **Gagal kirim ke LIS = gagal validasi**: order tetap berstatus order dan belum ditagih.
- Nama faskes tidak lagi ditulis tetap di antarmuka; memakai nama faskes aktif.

### Diperbaiki
- Simpan ulang tindakan tidak lagi menagih dua kali.
- Kuitansi & tagihan PDF: No. RM, alamat, No. Registrasi, tanggal kunjungan, tanggal discharge, total tanpa `NaN`.
- Tagihan APS Radiologi, MCU, PA, dan Mikrobiologi masuk daftar APS kasir.
- Rute tutup shift kasir tertangkap rute lain; kebocoran koneksi pada penjualan obat bebas; penerimaan barang inventory galat 500.
- Edit order lab menyinkronkan item hasil; flag hasil H/L/N tidak pernah terisi; paket lab multi-item bisa dipesan.
- Cetak hasil radiologi gagal bila lampiran bukan PNG/JPEG asli (validasi isi berkas di helper `bukaPdf`).
- Rute `/patologi-anatomi` dan `/mikrobiologi` jatuh ke dashboard; lokasi IGD per faskes pada RME IGD.

---

## [0.5.0] - 2026-10-13

Integrasi nasional, Manajemen Modul, dan alur klinik terhubung.

### Ditambahkan
- **Layanan `satusehat-service`**: sinkronisasi kunjungan rawat jalan selesai ke SATUSEHAT (Kemenkes, FHIR) dengan pekerja otomatis dan pemantauan di Konfigurasi Integrasi.
- **Layanan `bpjs-service`**: BPJS **PCare** (FKTP: pendaftaran, kunjungan, pemetaan, sinkron otomatis) dan **VClaim** (peserta, rujukan, SEP; halaman Admisi › SEP).
- **Manajemen Modul berbasis segmen faskes**: 8 segmen, preset modul → fitur → bagian (asesmen & resume RME per segmen dan jenis poli), override khusus superadmin dengan riwayat; menu, sidebar, rute, dan komponen mengikuti modul aktif. Katalog disimpan relasional (`ref_*`, `preset_segmen_*`, `faskes_segmen`, override ber-FK).
- **Antrian poli terintegrasi**: panggil dari tabel rawat jalan, mulai periksa saat RME dibuka, layar TV mode kiosk (tanpa login, kunci per layar) dengan suara panggilan.
- **Bridging LIS** (format adamLIS): registrasi order saat validasi dan penerimaan hasil.
- **Tagihan otomatis**: pemeriksaan lab ditagih saat validasi (dihapus saat batal); biaya kamar rawat inap saat discharge; penggantian item hitung-ulang lewat `replace_ref` dan `replace_category_codes` agar tidak dobel.
- Order lab dan cetak hasil lab dari RME; dashboard dan laporan global memakai data nyata; kasir tanpa shift bila fitur Shift Kasir mati.
- Skrip pemulihan dokumen rekam medis.

### Diperbaiki
- Alur klinik (pendaftaran, asesmen perawat, pemeriksaan dokter, discharge, telaah resep), alur farmasi (stok per item, verifikasi resep, harga obat ke tagihan, penyerahan), dan alur rumah sakit IGD → SPRI → rawat inap → discharge.
- Panggilan antrian poli selaras dengan status kunjungan; antrean farmasi hanya dibuat bila ada resep.
- Galat data SATUSEHAT yang belum lengkap dikembalikan sebagai 422, bukan 500.

---

## [0.4.0] - 2026-10-12

Fondasi operasional: migrasi terpusat dan CI/CD.

### Ditambahkan
- **Migrasi database terpusat** (`sequelize-cli`, `database/migrations`), idempoten, dijalankan dengan `npm run db:migrate`.
- **CI** (cek sintaks semua layanan, uji migrasi ke database kosong dua kali, build frontend) dan contoh **deploy staging**: gateway API satu domain, `APPLICATION_MODULE` per layanan, build hanya layanan yang berubah, rollback otomatis, pengaman ruang disk.
- Tambalan `authorization-sdk` untuk JWT **HS256** dengan `SECRET_KEY` bersama (sejak 1.0.0-alpha.1 menjadi bagian kode SDK di `packages/`).
- Cetak resep farmasi (E-Tiket, E-Resep, Salinan E-Resep).
- Rencana uji kesiapan rilis rumah sakit (100 skenario, `docs/testing/`).

### Diperbaiki
- Integrasi antar-layanan untuk semua layanan; impor peka huruf besar-kecil yang gagal di Linux; modul Stok memanggil layanan yang benar; lokasi stok bawaan di kartu stok & mutasi.

### Dihapus
- Rute uji, alert debug, dan stub BPJS di frontend produksi.

---

## [0.3.0] - 2026-02-09

### Ditambahkan
- Dokumentasi awal: README, panduan instalasi, dokumentasi API semua layanan, kode etik, tata kelola, kebijakan keamanan, dan manifesto komunitas.

---

## [0.2.0] - 2025-12-31

Perluasan layanan sepanjang 2025.

### Ditambahkan
- **Antrian** (`antrian-service`): data antrian admisi, anjungan pasien mandiri (APM), kuota JKN dan non-JKN terpisah, kunci API antar-layanan.
- **Laboratorium** (`lab-service`): kategori & item pemeriksaan, nilai rujukan, spesimen, expertise, laporan kunjungan dan TAT.
- **Laporan** (`laporan-service`): laporan & rekap lintas modul.
- Farmasi lengkap dengan laporan farmasi; datamaster supplier; penyesuaian inventory.
- Monitoring kamar & rawat inap, registrasi rawat inap melalui SPRI (surat perintah rawat inap), cetak resume medis, discharge.
- Fitur pendukung aplikasi mobile pasien: cek pasien & nomor identitas, booking dan pembatalan jadwal, cari praktisi.
- Orkestrasi Docker Compose untuk semua layanan, PostgreSQL, MongoDB, dan Redis; `schema.sql` awal.

---

## [0.1.0] - 2024-12-31

Fondasi sistem.

### Ditambahkan
- Arsitektur microservice Node.js + Express dengan frontend Vue 3 + TypeScript.
- Layanan inti: auth (login & izin), admisi (pasien & registrasi), datamaster, setting, rawat jalan, rekam medis (RME berbasis MongoDB: alergi, tanda vital, asesmen nyeri, catatan perawat, diagnosis ICD-10, OHI-S), IGD, rawat inap (registrasi, ruangan, perpindahan bangsal), pembayaran (laporan pendapatan), farmasi, inventory (penerimaan, retur unit, penyesuaian stok), dan stok farmasi.

[Belum dirilis]: https://github.com/tulisankode/opensimrs/compare/v1.0.0-alpha.1...HEAD
[1.0.0-alpha.1]: https://github.com/tulisankode/opensimrs/releases/tag/v1.0.0-alpha.1
