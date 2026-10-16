# SIMRS Studio — panduan pemakaian

SIMRS Studio adalah ruang kerja pengembangan berbasis AI di dalam OpenSIMRS. Tim IT menuliskan kebutuhan dengan bahasa sehari-hari, lalu agen AI mengerjakan tahap demi tahap: ringkasan permintaan, use case, PRD, desain teknis, kode, rencana uji, dan catatan rilis. **Setiap tahap baru berlanjut setelah pemegang peran yang berwenang menyetujuinya.** Kebutuhan sederhana seperti laporan, template cetak, atau formulir tambahan bisa dibuat sebagai **ekstensi tanpa kode**.

Rancangan lengkap dan status implementasi: [docs/rancangan/STUDIO-PENGEMBANG.md](./rancangan/STUDIO-PENGEMBANG.md).

## 1. Prasyarat (sekali saja)

Studio dijalankan di **mesin pengembang atau staging**, bukan di server produksi. Ekstensi yang sudah jadi tetap bisa dipasang di produksi, lihat bagian 6.

1. Repo OpenSIMRS sudah berjalan dengan `npm run dev` (lihat [Petunjuk Instalasi](./INSTALLATION_GUIDE.md)).
2. **Claude Code CLI** terpasang dan sudah login dengan langganan Anda:
   ```bash
   npm install -g @anthropic-ai/claude-code   # atau installer resmi Claude Code
   claude                                      # lalu /login, pilih akun Claude Pro/Max
   ```
   Studio memakai login yang sama dengan Claude Code di VS Code, dan pemakaiannya dihitung ke kuota langganan itu. Agen lain juga bisa dipakai, lihat bagian 5.
3. Isi `studio-service/.env` (dibuat installer, atau salin dari `.env.example`):
   ```env
   STUDIO_PENGEMBANG=aktif
   LINGKUNGAN=development
   ```
4. Jalankan `npm run db:migrate`, lalu `npm run dev` (sudah termasuk `studio-service` di port 8090).

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
- Layanan dalam mode dev memuat ulang perubahan secara otomatis. Di server, jalankan ulang layanan yang berubah.
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

- **Konektor API** (Pengaturan & Agen): Anthropic API, OpenAI API, atau **model lokal** yang kompatibel OpenAI (Ollama, vLLM, LM Studio), untuk faskes yang tidak boleh mengirim data keluar. Pilih konektor dan model **per tahap**. Kunci API disimpan terenkripsi.
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
| "Claude Code CLI tidak ditemukan" / agen gagal login | Pasang Claude Code, lalu jalankan `claude` → `/login` di pengguna OS yang sama dengan layanan. Bila perlu, isi `STUDIO_CLAUDE_BIN` |
| "Fitur Coding belum diaktifkan" | Pengaturan & Agen › Fitur Studio |
| "Gagal berpindah ke branch …" (mode workspace) | Ada perubahan yang bentrok. Commit/stash dulu, atau pakai mode worktree |
| "Kuota langganan Claude sudah …%" | Tunggu reset, naikkan batas kuota, atau pilih model Haiku untuk tahap dokumen |
| Perubahan kode `studio-service` belum berlaku | `npm run dev:studio` sengaja tidak memakai mode watch agar tugas agen yang panjang tidak terputus oleh restart. Jalankan ulang layanan secara manual |
| Impor paket ditolak "tanda tangan tidak sah" | `EKSTENSI_KUNCI_PUBLIK` produksi tidak sama dengan kunci Studio, atau paket diubah |
