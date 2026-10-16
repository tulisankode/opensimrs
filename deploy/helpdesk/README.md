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
   - `gateway.bind`: alamat privat atau VPN VM;
   - `gateway.auth.token`: hasil `openssl rand -hex 32`. Simpan juga di `setting-service/.env` server SIMRS sebagai `HELPDESK_GATEWAY_TOKEN`.
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

Di server SIMRS, `setting-service/.env`:

```env
HELPDESK_GATEWAY_URL=http://<alamat-privat-vm>:18789
HELPDESK_GATEWAY_TOKEN=<token dari langkah 3>
# HELPDESK_AGEN=helpdesk-opensimrs
# HELPDESK_BATAS_PER_JAM=20
```

Langkah berikutnya:
1. Jalankan ulang setting-service, lalu uji dari server SIMRS: `HELPDESK_GATEWAY_URL=… HELPDESK_GATEWAY_TOKEN=… ./deploy/helpdesk/uji-gateway.sh`.
2. Di OpenSIMRS, fitur **Asisten Bantuan (Helpdesk AI)** (modul Dashboard) aktif bawaan untuk semua segmen. Superadmin bisa mematikannya per faskes di **Setting › Manajemen Modul**.
3. Tombol **Bantuan** (ikon headset, di tempat ikon lonceng) aktif di header, dengan titik hijau bila asisten siap. Pertanyaan dan jawaban (sudah disaring) tersimpan 90 hari di tabel `bantuan_log`. Ringkasannya untuk superadmin tersedia di `GET /api/v3/setting/bantuan/ringkasan`.

## 6. Pengembangan lokal tanpa VM

```bash
node deploy/helpdesk/gateway-tiruan.mjs     # port 18789, token "token-uji"
# setting-service/.env: HELPDESK_GATEWAY_URL=http://localhost:18789  HELPDESK_GATEWAY_TOKEN=token-uji
```

Gateway tiruan membalas dengan jawaban kalengan. Gunakan hanya untuk menguji tombol, panel, aliran jawaban, penyaring, dan batas laju.

## 7. Pemeliharaan

- **Naik versi OpenClaw:** proyek ini rilis sangat sering. Baca catatan rilis, naikkan di VM uji dulu, ulangi `openclaw sandbox explain`, lalu jalankan `evaluasi/` sebelum dipakai petugas.
- **Rotasi token:** ganti `gateway.auth.token` dan `HELPDESK_GATEWAY_TOKEN` bersamaan, lalu jalankan ulang keduanya.
- **Mutu jawaban:** pantau ringkasan bantuan (pertanyaan gagal atau "belum tahu"), lalu perbaiki panduan modul terkait.
