# UTD tiruan untuk pengembangan

`scripts/utd-tiruan.mjs` adalah server UTD tiruan tanpa dependensi untuk menguji Bridging Bank Darah RS (BDRS) ke
UTD/BDRS eksternal (STD-0017) tanpa sistem UTD asli. Kontrak REST yang ditiru bersifat **generik** — belum ada
spesifikasi mitra resmi; adaptasi ke mitra nyata dilakukan lewat `penunjang-service/src/bank-darah/utd/adapter-generik.js`.

```bash
node scripts/utd-tiruan.mjs                       # http://localhost:2413, x-api-key: kunci-uji-utd
PORT=2499 UTD_KUNCI=rahasia node scripts/utd-tiruan.mjs
```

Isi koneksi di **Setting › Konfigurasi Integrasi › Konfigurasi Bank Darah/UTD** (data fiktif — jangan memakai data pasien asli):

| Kolom | Nilai |
| --- | --- |
| Nama | `UTD Tiruan` |
| Kode RS | bebas, mis. `DEMO` |
| URL Kirim Permintaan | `http://localhost:2413/adam-utd/permintaan` |
| URL Status | `http://localhost:2413/adam-utd/status/{no_registrasi}` |
| URL Cek Stok (opsional) | `http://localhost:2413/adam-utd/stok` |
| API Key | `kunci-uji-utd` |

Setelah koneksi dibuat, SIMRS akan menampilkan **Kunci Masuk** sekali. Aktifkan fitur **Bridging Bank Darah (UTD)**
(`bdrs_bridging`) untuk faskes di Setting › Manajemen Modul sebelum mencoba mengirim permintaan. Atur UTD tiruan agar
mengirim hasil (push) ke SIMRS memakai kunci tersebut:

```bash
curl -X POST http://localhost:2413/_uji/atur -H "Content-Type: application/json" \
  -d '{"push_url":"http://localhost:8099/adam-utd/bridging","push_kunci":"<kunci masuk dari SIMRS>"}'
```

## Alur pengujian dasar

1. Buat permintaan darah di Bank Darah RS, lengkapi pemetaan komponen (Bank Darah › Mapping UTD) untuk koneksi UTD Tiruan.
2. **Proses & Kirim ke UTD** — SIMRS memanggil `POST /adam-utd/permintaan`. No. Registrasi SIMRS dipakai ulang bila dikirim berulang (idempotensi, lihat KT-3/KT-4).
3. Picu hasil lewat `POST /_uji/push` (push) atau tombol **Ambil Status UTD**/**Cek Status** di SIMRS (tarik via `GET /adam-utd/status/:no_registrasi`).
4. Buka Bank Darah RS › Permintaan Darah untuk melihat kantong bridging, status validasi, dan alasan penolakan (bila ada).
5. Petugas berizin **Stok & Penerimaan › TERIMA KANTONG** memilih kantong `menunggu` yang valid untuk diteruskan ke stok.

## Perilaku yang ditiru

- **Kirim permintaan** (`POST /adam-utd/permintaan`) — idempoten per `no_registrasi`: pengiriman ulang menambah hitungan "diterima" tapi tidak menggandakan registrasi ("terdaftar" tetap 1). Body `{ uji: true }` (tombol **Uji Koneksi**) dibalas sukses tanpa registrasi.
- **Komponen tak dikenal** (KT-19) — bila `komponen_dikenal` diatur (array), permintaan dengan `komponen.kode_utd` di luar daftar dibalas `422` dan dihitung sebagai "ditolak".
- **Status & kantong** (`GET /adam-utd/status/:no_registrasi`) — `404` bila belum terdaftar; selain itu status permintaan dan daftar kantong (`no_kantong`, `kode_komponen`, golongan/rhesus, tanggal, `imltd`, `crossmatch` informasional).
- **Cek stok** (`GET /adam-utd/stok?golongan_abo=&rhesus=&kode_komponen=`) — selalu membalas satu baris contoh; dipakai menguji KF-13 (informasi, bukan jaminan pemenuhan).
- **Push hasil ke SIMRS** — manual lewat `POST /_uji/push` (`{ no_registrasi, status?, kantong? }`; `kantong` memakai satu kantong contoh non-reaktif bila tidak diisi) atau otomatis `push_otomatis_ms` milidetik setelah registrasi terdaftar (status `siap`). Memakai `push_url` & `push_kunci` dari `/_uji/atur`.
- **Variasi IMLTD** — kirim `kantong` sendiri ke `/_uji/push` dengan `imltd` berisi `"reaktif"`, `"belum_diperiksa"`, nilai asing, atau variasi spasi/huruf besar-kecil untuk menguji normalisasi (KT-11) dan penolakan (KT-10).
- **Pemenuhan sebagian** — kirim beberapa entri `kantong` sekaligus, sebagian dengan `imltd: "reaktif"` dan sebagian `"non_reaktif"`, untuk menguji status `diterima_sebagian` (KT-12).
- Semua permintaan terautentikasi (`/adam-utd/*`) wajib header `x-api-key` sesuai `UTD_KUNCI`; selain itu dibalas `401`.

## Kendali uji

`POST /_uji/atur` (JSON digabung ke pengaturan):

```json
{
  "komponen_dikenal": ["PRC", "FFP", "TC"],
  "latensi_ms": 200,
  "gagal_setiap": 0,
  "gagal502_registrasi": [],
  "gantung_registrasi": [],
  "gantung_ms": 120000,
  "imltd_bawaan": "non_reaktif",
  "push_url": "http://localhost:8099/adam-utd/bridging",
  "push_kunci": "kunci-masuk-dari-simrs",
  "push_otomatis_ms": 0
}
```

`GET /_uji/hitung` menampilkan berapa kali tiap `no_registrasi` diterima, didaftarkan (`terdaftar`), dan ditolak.
`POST /_uji/reset` mengosongkan data & hitungan (pengaturan tetap).

## Data fiktif

Contoh data pasien untuk pengujian: email `pasien@contoh.id`, HP `080000000000`, NIK `9999000000000001`. Payload
bridging tidak pernah memuat NIK/alamat/telepon (lihat kontrak di `adapter-generik.js`), jadi data ini hanya relevan
untuk mengisi data pasien & permintaan di SIMRS sebelum dikirim ke UTD tiruan.
