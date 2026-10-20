# Helpdesk asisten pengguna: pemasangan OpenClaw di VM

Panduan ini memasang **Gateway OpenClaw** untuk tombol **Bantuan** di OpenSIMRS. Rancangan lengkap ada di [docs/rancangan/HELPDESK-OPENCLAW.md](../../docs/rancangan/HELPDESK-OPENCLAW.md).

```
OpenSIMRS (setting-service) ──VPN/jaringan privat──► VM Helpdesk: OpenClaw Gateway :18789 ──► penyedia model AI
```

| Berkas | Fungsi |
|---|---|
| `AGENTS.md` | Instruksi agen `helpdesk-opensimrs`: sumber jawaban, batasan, gaya |
| `openclaw.json5.contoh` | Contoh konfigurasi Gateway & agen terbatas (wajib diverifikasi terhadap versi yang dipasang) |
| `sinkron-panduan.sh` | Menyalin panduan pengguna + katalog modul + `AGENTS.md` dari repo ke workspace agen |
| `uji-gateway.sh` | Uji endpoint `/v1/chat/completions` dari server SIMRS |
| `gateway-tiruan.mjs` | Gateway tiruan untuk pengembangan lokal tanpa VM (bukan untuk produksi) |
| `evaluasi/` | Daftar pertanyaan uji & skrip evaluasi mutu jawaban (fase 3) |

## 1. Siapkan VM

- **Mesin terpisah** dari server SIMRS dan database. Jangan pasang OpenClaw di laptop pengembang atau server produksi SIMRS.
- Spesifikasi: Ubuntu 24.04 LTS atau Debian 12, 2 vCPU, 4 GB RAM, dan disk 20 GB. Bila memakai model lokal (Ollama), sesuaikan dengan modelnya; umumnya butuh GPU atau RAM 16 GB ke atas.
- Jaringan:
  - Gateway hanya bisa dijangkau server SIMRS lewat jaringan privat RS atau VPN (Tailscale/WireGuard);
  - tutup port 18789 dari internet;
  - batasi lalu lintas keluar ke penyedia model saja.
- Buat pengguna khusus, misalnya `helpdesk`. Jangan menjalankan Gateway sebagai root.

## 2. Pasang OpenClaw

Versi saat panduan ditulis (2026-10-16): `latest` **2026.10.4**, `extended-stable` **2026.9.33**. Untuk produksi disarankan *extended-stable*. Syaratnya Node **24.16+** atau **26.1+**; installer resmi menyiapkan Node sendiri.

```bash
# sebagai pengguna helpdesk di VM
curl -fsSL https://openclaw.ai/install.sh | bash
#   atau, bila Node sudah sesuai:
#   npm install -g openclaw@2026.9.33 --allow-scripts=openclaw   (npm 11.16+; npm lama: tanpa --allow-scripts)
openclaw --version
openclaw onboard --install-daemon
```

Saat `onboard`:
- **Penyedia model:** pakai **kunci API** milik RS, misalnya DeepSeek, Qwen, Claude, atau GPT. Jangan memakai login langganan pribadi, karena helpdesk dipakai bersama banyak petugas. Untuk data yang tidak boleh keluar RS, pakai Ollama di jaringan RS.
- **Kanal pesan** (WhatsApp, Telegram, dan lainnya): **lewati**. Helpdesk hanya diakses lewat endpoint HTTP dari OpenSIMRS.

## 3. Konfigurasi Gateway & agen terbatas

1. Salin `openclaw.json5.contoh` ke berkas konfigurasi OpenClaw (lokasinya ditampilkan `openclaw gateway status`, atau lihat dokumentasi *Configuration*), lalu sesuaikan:
   - `gateway.bind`: **nama mode**, bukan alamat IP. Gunakan `tailnet` bila server SIMRS dan VM berada di satu Tailscale, atau `custom` dengan `gateway.customBindHost` berisi IPv4 privat VM. Hindari `lan` (0.0.0.0) di mesin yang punya IP publik;
   - `gateway.auth`: `mode: "token"` dan token Gateway. Lihat [Membuat & mengganti token Gateway](#membuat--mengganti-token-gateway). Token yang sama nanti diisi di OpenSIMRS pada langkah 5.
2. **Verifikasi nama kunci per agen** terhadap referensi konfigurasi versi yang dipasang. Dokumentasi OpenClaw menyebut `agents.entries.<id>`, dan nilai `sandbox.mode` juga perlu dicek. Lalu periksa hasilnya:
   ```bash
   openclaw sandbox explain --agent helpdesk-opensimrs   # sandbox aktif, workspace hanya-baca, exec/tulis/peramban ditolak
   openclaw sandbox recreate --agent helpdesk-opensimrs  # setelah konfigurasi berubah
   ```
   Jangan lanjut ke langkah 5 sebelum `sandbox explain` menunjukkan: semua sesi tersandbox, workspace **ro**, dan alat `exec`/tulis berkas/peramban **tidak tersedia**.
3. Mulai ulang Gateway: `openclaw gateway restart`, atau lewat layanan systemd hasil `--install-daemon`.

## 4. Isi pengetahuan agen

Dari salinan repo OpenSIMRS di mana saja (cukup git, tidak perlu menjalankan aplikasi):

```bash
WORKSPACE=/home/helpdesk/.openclaw/workspaces/helpdesk-opensimrs \
  ./deploy/helpdesk/sinkron-panduan.sh            # salin lokal (bila repo ada di VM)
TUJUAN=helpdesk@vm-helpdesk:/home/helpdesk/.openclaw/workspaces/helpdesk-opensimrs \
  ./deploy/helpdesk/sinkron-panduan.sh            # atau kirim lewat rsync/SSH
```

Jalankan ulang setiap kali panduan pengguna diperbarui, misalnya setelah rilis. Hanya panduan yang sudah **ditinjau** yang sebaiknya dipakai di produksi.

## 5. Hubungkan OpenSIMRS

Login sebagai **superadmin**, buka **Setting › Konfigurasi Integrasi › Helpdesk AI (OpenClaw) › Atur**, lalu:
1. Isi **URL Gateway** (`http://<alamat-privat-vm>:18789`), **Token Gateway** (dari langkah 3), dan **ID agen** (`helpdesk-opensimrs`). Atur juga batas pertanyaan per jam dan batas waktu jawaban.
2. Klik **Uji koneksi**. OpenSIMRS memeriksa token dan memastikan agen terdaftar lewat `/v1/models`, tanpa memakai kuota model.
3. Klik **Simpan**. Perubahan langsung berlaku tanpa menjalankan ulang layanan.

Token disimpan **terenkripsi** di database (`enc:v1`, kunci dari `HELPDESK_KUNCI_RAHASIA` atau `SECRET_KEY`) dan tidak pernah ditampilkan utuh. Switch **Helpdesk** di dialog itu mematikan tombol Bantuan untuk seluruh instalasi.

Alternatif tanpa antarmuka, misalnya untuk otomasi deploy, adalah `setting-service/.env`. Nilai ini hanya dipakai selama pengaturan di halaman belum disimpan:

```env
HELPDESK_GATEWAY_URL=http://<alamat-privat-vm>:18789
HELPDESK_GATEWAY_TOKEN=<token dari langkah 3>
# HELPDESK_AGEN=helpdesk-opensimrs
# HELPDESK_BATAS_PER_JAM=20
```

Langkah berikutnya:
1. Untuk menguji langsung dari server SIMRS tanpa OpenSIMRS: `HELPDESK_GATEWAY_URL=… HELPDESK_GATEWAY_TOKEN=… ./deploy/helpdesk/uji-gateway.sh`.
2. Di OpenSIMRS, fitur **Asisten Bantuan (Helpdesk AI)** (modul Dashboard) aktif bawaan untuk semua segmen. Superadmin bisa mematikannya per faskes di **Setting › Manajemen Modul**.
3. Tombol **Bantuan** (ikon headset, di tempat ikon lonceng) aktif di header, dengan titik hijau bila asisten siap. Pertanyaan dan jawaban (sudah disaring) tersimpan 90 hari di tabel `bantuan_log`. Ringkasannya untuk superadmin tersedia di `GET /api/v3/setting/bantuan/ringkasan`.

## Membuat & mengganti token Gateway

Token Gateway adalah kunci bersama antara OpenSIMRS (setting-service) dan Gateway OpenClaw. **Pemegang token mendapat akses operator penuh ke Gateway**, jadi perlakukan seperti sandi root.

**A. Token dari wizard (paling mudah).** Wizard `openclaw onboard` membuat token secara otomatis. Lihat nilainya di VM:

```bash
openclaw config get gateway.auth.token
# atau lihat langsung: grep -A3 '"auth"' ~/.openclaw/openclaw.json
```

**B. Token buatan sendiri.** Disarankan, karena Anda mengontrol panjang dan waktu penggantiannya. Buat 32 byte acak, yaitu 64 karakter heks:

```bash
openssl rand -hex 32                                   # macOS/Linux
```
```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | ForEach-Object { '{0:x2}' -f $_ })   # Windows PowerShell
```

Cara termudah adalah tombol **Buat token acak** di OpenSIMRS (**Setting › Konfigurasi Integrasi › Helpdesk AI › Atur**). Token dibuat di peramban dengan generator acak kriptografis, lalu perintah untuk VM ditampilkan dan siap disalin.

Pasang token di VM:

```bash
openclaw config set gateway.auth.mode token
openclaw config set gateway.auth.token "<token>"
# atau sunting ~/.openclaw/openclaw.json:  gateway: { auth: { mode: "token", token: "<token>" } }
```

Gateway memuat ulang perubahan berkas konfigurasi secara otomatis. Bila koneksi lama masih memakai token lama, jalankan `openclaw gateway restart`.

**Periksa** dari server SIMRS. Hasil 200 berarti token benar, sedangkan 401 berarti salah:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://<vm>:18789/v1/models -H "Authorization: Bearer <token>"
```

Lalu tempel token yang sama di OpenSIMRS: **Setting › Konfigurasi Integrasi › Helpdesk AI › Atur › Token Gateway** → **Uji koneksi** → **Simpan**.

**Mengganti (rotasi) token.** Lakukan bila token pernah terlihat orang lain, petugas IT berganti, atau secara berkala (misalnya tiap 6 bulan):
1. Buat token baru (cara B).
2. Pasang di VM dengan `openclaw config set gateway.auth.token`. Sejak saat itu token lama langsung ditolak.
3. Segera tempel token baru di OpenSIMRS lalu klik **Simpan**. Di antara langkah 2 dan 3, tombol Bantuan akan menampilkan galat.

**Jangan:**
- mengirim token lewat chat atau email tanpa enkripsi;
- menaruhnya di repo atau tangkapan layar;
- memakai token yang sama untuk Gateway lain.

OpenSIMRS menyimpannya terenkripsi dan hanya menampilkan 4 karakter terakhir. Untuk penyimpanan di VM yang lebih ketat, OpenClaw mendukung *SecretRef* untuk `gateway.auth.token` (lihat dokumentasi OpenClaw *Configuration › secrets*).

## 6. Pengembangan lokal tanpa VM

Untuk mencoba OpenClaw sungguhan di mesin pengembang (bukan produksi), installer OpenSIMRS menawarkannya di langkah alat AI: `./install.sh` (Windows: `install.cmd`); jawab ya saat ditanya OpenClaw, atau lewati semua alat AI dengan `--tanpa-ai`. Setelah itu ikuti langkah 3–5 di atas dengan `gateway.bind` dibiarkan `loopback` (bawaan), sehingga Gateway hanya bisa diakses dari mesin itu sendiri.

Bila SIMRS Studio aktif, langkah 3–5 bisa dilakukan tanpa terminal di **SIMRS Studio › Helpdesk AI** (superadmin): menyalakan endpoint HTTP, membuat agen terbatas, memilih model (Ollama lokal atau penyedia API + kunci), sinkron panduan, membuat token dan menyelaraskannya ke pengaturan OpenSIMRS, menjalankan gateway, dan uji tanya. Lihat [SIMRS Studio §5a](../../docs/SIMRS-STUDIO.md#5a-helpdesk-ai-openclaw-lokal).

Catatan mesin pengembang Windows (paket OpenClaw dari Microsoft Store):
- OpenClaw berjalan di sesi terisolasi dengan akun Windows sendiri. Workspace agen ditaruh di `C:\Users\Public\openclaw-helpdesk\<agen>` agar bisa dibaca.
- `openclaw gateway restart` menghentikan gateway tanpa menyalakannya kembali. Jalankan ulang dengan `openclaw gateway --force` atau tombol di Studio.
- Sandbox Docker butuh Docker yang terjangkau dari sesi itu. Bila tidak ada, matikan sandbox agen (`sandbox.mode: "off"`) dan andalkan `tools.deny`. Di VM produksi sandbox tetap wajib.
- Model lokal yang lebih besar dari memori GPU sangat lambat (prompt agen 7–10 ribu token) dan cenderung mengarang jawaban. Untuk uji mutu jawaban, pakai model API.

Tanpa OpenClaw sama sekali, pakai Gateway tiruan:

```bash
node deploy/helpdesk/gateway-tiruan.mjs     # port 18789, token "token-uji"
# setting-service/.env: HELPDESK_GATEWAY_URL=http://localhost:18789  HELPDESK_GATEWAY_TOKEN=token-uji
```

Gateway tiruan membalas dengan jawaban kalengan. Gunakan hanya untuk menguji tombol, panel, aliran jawaban, penyaring, dan batas laju.

## 7. Pemeliharaan

- **Naik versi OpenClaw:** proyek ini rilis sangat sering. Baca catatan rilis, naikkan di VM uji dulu, ulangi `openclaw sandbox explain`, lalu jalankan `evaluasi/` sebelum dipakai petugas.
- **Rotasi token:** ganti `gateway.auth.token` dan `HELPDESK_GATEWAY_TOKEN` bersamaan, lalu jalankan ulang keduanya.
- **Mutu jawaban:** pantau ringkasan bantuan (pertanyaan gagal atau "belum tahu"), lalu perbaiki panduan modul terkait.
