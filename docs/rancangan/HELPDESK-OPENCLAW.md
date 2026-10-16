# Rancangan: Helpdesk Asisten Pengguna (OpenClaw)

> Status (2026-10-16):
> - Fase 0 berupa **draf** panduan per modul, menunggu tinjauan.
> - Fase 1: paket pemasangan di `deploy/helpdesk/` siap, tetapi VM belum dipasang.
> - Fase 2 **sudah diimplementasikan** dan diuji dengan Gateway tiruan.
> - Fase 3: perangkat evaluasi siap, menunggu Gateway sungguhan.
> - Fase 4 belum dikerjakan.
> Keputusan pemilik: asisten **cara pakai** OpenSIMRS, diakses lewat **chat di dalam aplikasi**, dengan OpenClaw di **VM/server terpisah**.

## 1. Tujuan dan batas

Petugas RS (pendaftaran, perawat, dokter, kasir, petugas lab, dan lainnya) bisa bertanya cara memakai OpenSIMRS dari dalam aplikasi, misalnya "bagaimana membatalkan order lab?" atau "kenapa menu Rawat Inap tidak muncul?". Asisten menjawab berdasarkan **panduan pengguna** dan konteks layar yang sedang dibuka.

**Termasuk:**
- menjawab cara pakai per modul dan fitur;
- menjelaskan arti pesan galat;
- menunjukkan menu dan langkah;
- menjelaskan kenapa menu tidak tampil (modul belum aktif atau izin peran).

**Tidak termasuk:**
- membaca atau mengubah data pasien, transaksi, maupun database;
- menjalankan aksi atas nama pengguna;
- memberi saran klinis (diagnosis, dosis, dan sejenisnya);
- menerima laporan masalah ke tim IT. Ini direncanakan di fase 4, dengan kemungkinan diteruskan ke SIMRS Studio.

## 2. Arsitektur

```
Peramban (tombol Bantuan)
   │  POST /api/v3/setting/bantuan/chat  (JWT pengguna, seperti API lain)
   ▼
setting-service ── saring data pribadi, tambah konteks (modul aktif, peran, halaman), batas laju
   │  POST <gateway>/v1/chat/completions  (Bearer token Gateway, hanya di server)
   │  model: "openclaw/helpdesk-opensimrs", user: hash(faskes_uuid + username), stream: true
   ▼
VM Helpdesk ── OpenClaw Gateway (port 18789, jaringan privat/VPN saja)
   └─ agen "helpdesk-opensimrs": sandbox, alat dibatasi, pengetahuan = salinan docs/panduan-pengguna (hanya-baca)
         │
         ▼
      penyedia model (API: DeepSeek/Qwen/Claude/dll., atau Ollama lokal)
```

Alasan desain:
- **Endpoint kompatibel OpenAI di Gateway** (`POST /v1/chat/completions`) membuat OpenSIMRS cukup memanggil satu API HTTP biasa, tanpa protokol WebSocket. Endpoint ini **mati bawaan** dan dinyalakan dengan `gateway.http.endpoints.chatCompletions.enabled: true`.
- **Token Gateway memberi akses operator penuh.** Menurut dokumentasi OpenClaw, pemegang token mendapat seluruh lingkup operator, termasuk `operator.admin`. Karena itu token hanya disimpan di `setting-service/.env` dan tidak pernah dikirim ke peramban. Gateway juga tidak boleh terbuka ke internet.
- **Sesi per pengguna.** Field `user` diisi hash `faskes_uuid + username`, sehingga Gateway menjaga satu utas percakapan per pengguna tanpa menerima nama aslinya.
- **setting-service** dipilih karena sudah mengetahui modul dan fitur aktif faskes (Manajemen Modul), sehingga jawaban bisa disesuaikan, misalnya "menu Rawat Inap belum aktif untuk faskes Anda".
- **VM terpisah:** OpenClaw tidak berjalan di server SIMRS dan tidak bisa menjangkau database maupun repo.

## 3. Pengetahuan asisten

| Sumber | Isi | Cara sampai ke VM |
|---|---|---|
| `docs/panduan-pengguna/*.md` (baru) | Panduan cara pakai per modul: tujuan, siapa pemakainya, langkah per tugas, pesan galat umum, FAQ | Disalin ke workspace agen (hanya-baca) setiap rilis, mis. `git archive` folder itu saja |
| Konteks per pertanyaan (dari setting-service) | Segmen faskes, modul & fitur aktif, peran pengguna, rute halaman saat ini | Disisipkan sebagai pesan sistem pada setiap permintaan |
| Katalog modul (`database/data/katalog-modul.json`) | Nama modul/fitur, menu, rute | Ikut disalin bersama panduan |

Panduan pengguna adalah prasyarat (fase 0). Drafnya dibuat agen dari kode (menu, rute, form, pesan galat), lalu **wajib ditinjau** petugas yang memakai modul itu, sebab asisten hanya sebaik bahan bacaannya.

## 4. Keamanan dan privasi

1. **Penyaringan data pribadi sebelum dikirim.** setting-service menyamarkan NIK (16 digit), nomor HP, email, dan nomor rekam medis di pertanyaan, memakai pola yang sama dengan pemeriksa kebijakan SIMRS Studio. Pengguna diberi peringatan "jangan menulis data pasien".
2. **Pertanyaan tentang pasien tertentu ditolak.** Aturan ini ada di instruksi agen ("saya tidak bisa melihat data pasien; hubungi tim IT"), dan asisten memang tidak punya akses data.
3. **Agen dibatasi:**
   - semua sesi berjalan di sandbox, dengan akses workspace **hanya-baca** ke folder pengetahuan;
   - alat `exec`, tulis berkas, peramban, `tools.elevated`, dan plugin yang tidak perlu ditolak lewat kebijakan alat per agen;
   - **kanal pesan langsung** (WhatsApp, Telegram, dan lainnya) tidak dinyalakan, sehingga satu-satunya pintu masuk adalah endpoint HTTP dari setting-service.
4. **Jaringan:**
   - Gateway `bind` ke alamat privat atau VPN (Tailscale/WireGuard) yang hanya bisa dijangkau server SIMRS;
   - lalu lintas keluar VM dibatasi ke penyedia model saja;
   - token panjang acak (`openssl rand -hex 32`).
5. **Batas laju:** misalnya 20 pertanyaan per pengguna per jam, dan panjang pertanyaan maksimal 2.000 karakter.
6. **Jejak:**
   - setiap pertanyaan dan jawaban dicatat (hash pengguna, faskes, waktu, modul halaman; teks sudah disaring) dengan retensi 90 hari, untuk evaluasi mutu;
   - superadmin bisa melihat ringkasannya, misalnya pertanyaan yang paling sering atau yang tidak terjawab.
7. **Model:**
   - Untuk tim, gunakan **kunci API**, bukan login langganan pribadi, karena ketentuan langganan tidak mengizinkan pemakaian bersama.
   - Faskes yang tidak boleh mengirim data keluar bisa memakai Ollama di VM yang sama atau di jaringan RS.

## 5. Antarmuka di OpenSIMRS

- **Tombol Bantuan** (ikon headset) di header, menggantikan ikon lonceng statis, membuka jendela chat ala chatbot di kanan atas. Jendela tetap terbuka saat berpindah halaman. Bila Helpdesk belum aktif, tombol tetap tampil dan jendela menjelaskan alasannya.
- Isi panel:
  - jawaban streaming;
  - saran pertanyaan sesuai halaman, misalnya di Order Lab: "cara membatalkan order";
  - tombol "Mulai percakapan baru";
  - penanda "Dijawab AI — periksa kembali".
- Pesan pembuka mengingatkan pengguna untuk tidak menulis data pasien.

## 6. Aktivasi dan konfigurasi

| Lapis | Pengaturan |
|---|---|
| `.env` setting-service | `HELPDESK_GATEWAY_URL`, `HELPDESK_GATEWAY_TOKEN`, `HELPDESK_AGEN=helpdesk-opensimrs` (kosong = Helpdesk mati) |
| Katalog modul | Fitur baru `helpdesk_ai` (Setting), dinyalakan per faskes oleh superadmin |
| Izin | Semua peran yang login boleh bertanya; ringkasan log hanya untuk superadmin |

## 7. Pemasangan OpenClaw di VM (ringkas)

Versi saat rancangan ditulis: **2026.10.4** (`latest`). Jalur `extended-stable` **2026.9.33** lebih cocok untuk produksi yang jarang diperbarui. Syarat: **Node 24.16+ atau 26.1+**; installer resmi menyiapkan Node sendiri.

```bash
# VM Linux (Ubuntu/Debian) khusus helpdesk
curl -fsSL https://openclaw.ai/install.sh | bash        # atau: npm install -g openclaw@2026.9.33 --allow-scripts=openclaw
openclaw onboard --install-daemon                      # pilih penyedia model (kunci API), buat workspace
```

Garis besar konfigurasi (json5). **Nama kunci per agen wajib diverifikasi** terhadap referensi konfigurasi versi yang dipasang, karena dokumentasi menyebut `agents.entries.<id>`. Setelahnya, periksa hasilnya dengan `openclaw sandbox explain --agent helpdesk-opensimrs`.

```json5
{
  gateway: {
    bind: "<alamat privat/VPN>",
    auth: { token: "<openssl rand -hex 32>" },
    http: { endpoints: { chatCompletions: { enabled: true } } },
  },
  agents: {
    entries: {
      "helpdesk-opensimrs": {
        // workspace berisi salinan docs/panduan-pengguna + katalog modul + instruksi agen (AGENTS.md)
        // nilai mode yang tersedia diverifikasi saat pemasangan (contoh dokumentasi memakai "non-main"; helpdesk butuh semua sesi tersandbox)
        sandbox: { mode: "all", scope: "session", workspaceAccess: "ro" },
        tools: { deny: ["exec", "write", "edit", "browser"] }, // + plugin lain yang tidak perlu
      },
    },
  },
}
```

Uji setelah pemasangan, dari server SIMRS:

```bash
curl -s http://<gateway>:18789/v1/chat/completions -H "Authorization: Bearer $HELPDESK_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openclaw/helpdesk-opensimrs","user":"uji","messages":[{"role":"user","content":"Bagaimana cara mendaftarkan pasien baru?"}]}'
```

Panduan langkah demi langkah dan skrip pemasangan disusun pada fase 1.

## 8. Tahapan

| Fase | Isi | Hasil |
|---|---|---|
| **0. Panduan pengguna** | Struktur `docs/panduan-pengguna/`, draf per modul dibuat agen lalu ditinjau pengguna modul | Bahan pengetahuan asisten (juga berguna tanpa AI) |
| **1. VM OpenClaw** | Panduan + skrip pasang, konfigurasi agen terbatas, sinkronisasi panduan, uji `curl` | Gateway helpdesk berjalan di jaringan privat |
| **2. Integrasi OpenSIMRS** | Endpoint `bantuan/chat` di setting-service (penyaring, konteks, batas laju, log), fitur katalog `helpdesk_ai`, panel chat di frontend | Petugas bisa bertanya dari aplikasi |
| **3. Evaluasi** | 50+ pertanyaan uji per modul (jawaban harapan), uji penolakan data pasien/saran klinis, ringkasan log untuk superadmin | Ukuran mutu sebelum dibuka ke semua petugas |
| **4. Laporan ke IT** (opsional) | Tombol "Laporkan masalah" → ringkasan percakapan menjadi permintaan SIMRS Studio | Masalah nyata langsung masuk alur pengembangan |

## 9. Risiko dan pertanyaan terbuka

- **Halusinasi:** asisten bisa mengarang langkah. Mitigasinya: instruksi "hanya jawab dari panduan; bila tidak ada, katakan tidak tahu dan arahkan ke tim IT", rujukan bagian panduan di setiap jawaban, dan evaluasi fase 3.
- **Biaya model:** dihitung per pemakaian API. Perlu batas laju dan pemantauan pemakaian di dasbor penyedia.
- **Pemutakhiran OpenClaw:** proyek ini rilis sangat sering (versi berbasis tanggal). Gunakan `extended-stable` dan uji ulang konfigurasi sandbox setiap kali naik versi.
- **Belum diputuskan:**
  - penyedia model yang dipakai;
  - lokasi VM (on-premise RS atau cloud);
  - siapa peninjau panduan per modul.
