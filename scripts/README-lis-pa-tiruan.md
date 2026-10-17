# Sistem PA tiruan untuk pengembangan

`scripts/lis-pa-tiruan.mjs` adalah server sistem patologi anatomi (LIS PA) tiruan tanpa dependensi untuk menguji
Bridging LIS Patologi Anatomi tanpa sistem PA asli (pola sama dengan `scripts/lis-tiruan.mjs` untuk Bridging LIS
Laboratorium).

```bash
node scripts/lis-pa-tiruan.mjs                        # http://localhost:2313, x-api-key: kunci-uji-pa
PORT=2399 PA_LIS_KUNCI=rahasia node scripts/lis-pa-tiruan.mjs
```

Isi koneksi di **Setting › Konfigurasi Integrasi › Konfigurasi LIS PA** (data contoh, bukan data pasien nyata):

| Kolom | Nilai |
| --- | --- |
| URL Registrasi | `http://localhost:2313/adam-pa-lis/registrasi` |
| URL Ambil Hasil | `http://localhost:2313/adam-pa-lis/hasil?no_registrasi={no_registrasi}` |
| API Key | `kunci-uji-pa` |
| Kode RS | bebas, mis. `RSPA01` |

Perilaku yang ditiru:

- **Registrasi kasus** — `POST /adam-pa-lis/registrasi`; pemeriksaan yang tidak dikenal (lihat `pemeriksaan_dikenal`) dibalas `500` "Belum Dimappingkan". Registrasi **idempoten per `no_registrasi`** (kirim ulang tidak membuat kasus baru di `/_uji/hitung`); Nomor PA tiruan dikembalikan langsung pada respons bila `beri_no_pa_langsung` (bawaan: aktif).
- **Ambil hasil** — `GET /adam-pa-lis/hasil?no_registrasi=` → `404` bila belum terdaftar; selain itu laporan tiruan (makroskopis/mikroskopis/diagnosis/ICD-O + dokter verifikator) bila `hasil_siap` (bawaan: aktif).
- **Push hasil/addendum/penolakan ke SIMRS** — `POST /_uji/push` dengan body payload hasil (mis. `{ "no_registrasi": "...", "status": "ditolak", "alasan_tolak": "Jaringan autolisis" }`) diteruskan sebagai `POST` ke `callback_url` (titik masuk bridging SIMRS, mis. `http://localhost:8099/adam-pa-lis/bridging`) dengan header `x-api-key: callback_key` — keduanya diatur lewat `/_uji/atur` terlebih dahulu.
- Simulasi latensi, waktu tunggu habis (`gantung_noreg`/`gantung_ms`), dan galat gateway (`gagal502_noreg`) seperti pada `lis-tiruan.mjs`.

Kendali uji (`POST /_uji/atur`, JSON digabung ke pengaturan):

```json
{ "pemeriksaan_dikenal": ["HP-001", "SIT-001"], "latensi_ms": 200, "gantung_noreg": [], "gantung_ms": 120000,
  "callback_url": "http://localhost:8099/adam-pa-lis/bridging", "callback_key": "<kunci masuk dari Konfigurasi LIS PA>" }
```

```bash
curl -X POST http://localhost:2313/_uji/push -H "Content-Type: application/json" -d '{
  "no_registrasi": "<uuid kasus>", "status": "selesai",
  "makroskopis": "...", "mikroskopis": "...", "diagnosis": "Karsinoma tiruan",
  "dokter_verifikator": { "nama": "dr. Contoh, Sp.PA", "sip": "SIP-0000" }
}'
```

`GET /_uji/hitung` menampilkan berapa kali tiap `no_registrasi` diterima dan berapa kali benar-benar didaftarkan
(`dobel_terdaftar` harus kosong). `POST /_uji/reset` mengosongkan data & hitungan (pengaturan tetap).
