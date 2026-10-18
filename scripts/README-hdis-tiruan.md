# HDIS tiruan untuk pengembangan

`scripts/hdis-tiruan.mjs` adalah server HDIS (Hemodialysis Information System) tiruan tanpa dependensi untuk menguji
Bridging HDIS modul Unit Hemodialisa (STD-0033) tanpa HDIS vendor. Kontrak REST yang ditiru bersifat **generik** —
belum ada spesifikasi vendor resmi; adaptasi ke vendor nyata dilakukan di
`penunjang-service/src/hemodialisa/hdis/kirim.js` (jadwal keluar) dan `hdis/terima.js` (parameter masuk).

```bash
node scripts/hdis-tiruan.mjs                       # http://localhost:2416, x-api-key: kunci-uji-hdis
PORT=2499 HDIS_KUNCI=rahasia node scripts/hdis-tiruan.mjs
```

Gunakan hanya data fiktif (pasien uji, NIK berawalan `9999`), jangan data pasien asli.

## Menyiapkan koneksi

1. Aktifkan modul **Unit Hemodialisa** dan fitur **Bridging HDIS** (`hd_bridging_hdis`) untuk faskes di Setting › Manajemen Modul.
2. Di **Setting › Konfigurasi Integrasi › Hemodialisa › HDIS**, tambah koneksi:

   | Kolom | Nilai |
   | --- | --- |
   | Nama | `HDIS Tiruan` |
   | URL Penerima Jadwal | `http://localhost:2416/api/jadwal` |
   | API Key | `kunci-uji-hdis` |

3. SIMRS menampilkan **Kunci Masuk** sekali. Atur HDIS tiruan agar mengirim parameter ke SIMRS memakai kunci itu:

   ```bash
   curl -X POST http://localhost:2416/_uji/atur -H "Content-Type: application/json" \
     -d '{"push_url":"http://localhost:8099/adam-hdis/bridging","push_kunci":"<kunci masuk dari SIMRS>"}'
   ```

4. Petakan mesin di **Hemodialisa › Mapping HDIS** (mis. mesin `M03` → kode HDIS `MSN-03`). Jadwal untuk mesin yang
   belum dipetakan dicatat **gagal** dan dapat dikirim ulang setelah pemetaan dilengkapi.

## Kontrak

### SIMRS → HDIS: `POST <URL Penerima Jadwal>`

Header `x-api-key` (API key koneksi) dan `Idempotency-Key` (= `kunci_idempoten`). Dikirim saat jadwal dibuat,
dipindah, atau dibatalkan. Kunci idempoten `jadwal:<uuid>:v<versi>` (versi naik saat jadwal dipindah/dibatalkan) sama pada setiap percobaan ulang sehingga HDIS
wajib menganggap kunci yang sama sebagai pesan yang sama.

```json
{
  "versi_kontrak": "1",
  "kunci_idempoten": "jadwal:0192…:v1",
  "aksi": "jadwal",
  "jadwal": { "kode_jadwal_simrs": "0192…", "tanggal": "2026-10-19", "shift": { "kode": "PAGI", "nama": "Pagi", "jam_mulai": "07:00", "jam_selesai": "12:00" }, "kode_mesin_hdis": "MSN-03", "status": "terjadwal" },
  "pasien": { "no_rm": "RM-000123", "nama": "Pasien Fiktif", "jenis_kelamin": "P", "tanggal_lahir": "1980-01-01" },
  "registrasi": { "no_reg_hd": "HD-20261018-0001", "jenis": "kronis" }
}
```

Data pasien minimum: tanpa NIK, alamat, telepon, penjamin, atau diagnosis. `aksi: "batal"` untuk pembatalan.

Status pengiriman di SIMRS: **terkirim** (2xx), **gagal** (4xx, koneksi ditolak, mesin belum dipetakan — pasti belum
diproses), **tidak pasti** (waktu habis/5xx — HDIS mungkin sudah memproses). Kirim ulang dari riwayat pengiriman aman
untuk keduanya karena kunci idempoten tidak berubah selama jadwal tidak berubah.

### HDIS → SIMRS: `POST /adam-hdis/bridging`

Kunci masuk di header `x-api-key` (atau `?key=`). Alias lewat gateway: `POST /api/v3/penunjang/hemodialisa/hdis/masuk`.

```json
{
  "kode_jadwal_simrs": "0192…",
  "kunci_idempoten": "hdis-msn03-20261019-0730",
  "waktu_pengukuran": 1760833800,
  "kode_mesin_hdis": "MSN-03",
  "parameter": { "td_sistolik": 130, "td_diastolik": 80, "nadi": 84, "qb_ml_menit": 250, "uf_volume_ml": 600, "tmp_mmhg": 120 }
}
```

- Parameter dan satuannya mengikuti skema `GET /api/v3/penunjang/hemodialisa/referensi` (nilai boleh angka langsung atau
  `{ "nilai": 84, "satuan": "x/menit" }`). Parameter di luar skema, satuan berbeda, atau nilai di luar batas kewajaran
  ditolak (HTTP 400) dan dicatat **ditolak** tanpa mengubah catatan klinis.
- `kunci_idempoten` sama → hasil sebelumnya dikembalikan (`duplikat: true`), tanpa observasi baru.
- Jadwal tidak dikenal (404), kode mesin tidak cocok dengan mesin jadwal (409), atau sesi belum dimulai (409) →
  dikarantina sebagai **ditolak**; pesan yang sama boleh dikirim ulang setelah sesi berjalan.
- Data yang tiba setelah sesi ditutup tetap disimpan dan ditandai **perlu ditinjau** perawat.

## Alur pengujian dasar

1. Buat mesin & shift (Hemodialisa › Mesin dan Shift), registrasi pasien fiktif, lalu jadwal (satu kali atau rutin).
   Jadwal terkirim ke HDIS tiruan — periksa `curl http://localhost:2416/_uji/jadwal`.
2. Buat & sahkan resep HD, buka sesi dari antrean, isi asesmen pra-HD, lalu **Mulai**.
3. Kirim parameter: `curl -X POST http://localhost:2416/_uji/push -H "Content-Type: application/json" -d '{"kunci_idempoten":"uji-001"}'`.
   Ulangi perintah yang sama → SIMRS menjawab "sudah diproses sebelumnya" (idempoten).
4. Seri tiap 30 menit: `curl -X POST http://localhost:2416/_uji/push-seri -H "Content-Type: application/json" -d '{"jumlah":4,"interval_menit":30}'`.
5. Uji status tidak pasti: atur `{"latensi_ms":15000}` lewat `/_uji/atur` (lebih lama dari `HD_HDIS_TIMEOUT_MS`), lalu
   pindahkan jadwal. Uji gagal: matikan HDIS tiruan, lalu buat jadwal — jadwal tetap tersimpan dengan status pengiriman
   **gagal**/**tidak pasti** dan dapat dikirim ulang dari riwayat pengiriman.

## Perilaku yang ditiru

| Pengaturan (`/_uji/atur`) | Efek |
| --- | --- |
| `mesin_dikenal: ["MSN-03"]` | kode mesin lain ditolak 422 (SIMRS: gagal) |
| `latensi_ms: 15000` | jawaban ditunda (SIMRS: tidak pasti bila melewati batas waktu) |
| `gagal_setiap: 2` | setiap jadwal ke-2 dijawab 503 tanpa diproses (SIMRS: tidak pasti) |
