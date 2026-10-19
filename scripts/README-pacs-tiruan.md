# PACS/RIS tiruan untuk pengembangan

`scripts/pacs-tiruan.mjs` adalah server PACS/RIS tiruan tanpa dependensi untuk menguji Bridging PACS/RIS Radiologi tanpa PACS asli.

```bash
node scripts/pacs-tiruan.mjs                       # http://localhost:2412, x-api-key: kunci-uji-pacs
PORT=2499 PACS_KUNCI=rahasia node scripts/pacs-tiruan.mjs
```

Isi koneksi di **Setting › Konfigurasi Integrasi › Konfigurasi PACS** (data fiktif):

| Kolom | Nilai |
| --- | --- |
| Nama | `PACS Tiruan` |
| URL Kirim Order | `http://localhost:2412/adam-pacs/order` |
| URL Ambil Hasil | `http://localhost:2412/adam-pacs/hasil?accession_number={accession_number}` |
| URL Viewer | `http://localhost:2412/viewer?acc={accession_number}` |
| API Key | `kunci-uji-pacs` |
| Kode RS | bebas, mis. `DEMO` |

Setelah koneksi dibuat, SIMRS akan menampilkan **Kunci Masuk** sekali. Atur PACS tiruan agar mengirim hasil (push) ke SIMRS memakai kunci tersebut:

```bash
curl -X POST http://localhost:2412/_uji/atur -H "Content-Type: application/json" \
  -d '{"push_url":"http://localhost:8099/adam-pacs/bridging","push_kunci":"<kunci masuk dari SIMRS>"}'
```

> Lewat gateway API (`deploy/server/gateway.nginx.conf` atau `install.sh --domain`) alamat `/adam-…` penunjang-service tidak diteruskan; pakai alias `/api/v3/penunjang/radiologi/pacs/hasil` di domain API. Lihat [Petunjuk Instalasi 7.5](../docs/INSTALLATION_GUIDE.md#75-integrasi-eksternal).

Perilaku yang ditiru:

- **Kirim order** (`POST /adam-pacs/order`) — idempoten per `accession_number`: pengiriman ulang menambah hitungan "diterima" tapi tidak menggandakan studi ("terdaftar" tetap 1). Body `{ uji: true }` (dipakai tombol **Uji koneksi**) dibalas sukses tanpa registrasi.
- **Kode prosedur tak dikenal** — bila `kode_prosedur_dikenal` diatur (array), order dengan `pemeriksaan.kode_prosedur_pacs` di luar daftar dibalas `422` dan dihitung sebagai "ditolak", bukan "diterima".
- **Ambil hasil / Cek Status** (`GET /adam-pacs/hasil?accession_number=`) — `404` bila belum terdaftar, selain itu status studi (`terdaftar`/`selesai`), hasil, kesan, dan URL viewer.
- **Push hasil ke SIMRS** — manual lewat `POST /_uji/push` (`{ accession_number, status?, hasil?, kesan? }`) atau otomatis `push_otomatis_ms` milidetik setelah studi terdaftar. Memakai `push_url` & `push_kunci` dari `/_uji/atur`.
- Semua permintaan terautentikasi (`/adam-pacs/*`) wajib header `x-api-key` sesuai `PACS_KUNCI`; selain itu dibalas `401`.

Kendali uji (`POST /_uji/atur`, JSON digabung ke pengaturan):

```json
{
  "kode_prosedur_dikenal": ["CR-THX", "CT-KEPALA"],
  "latensi_ms": 200,
  "gagal_setiap": 0,
  "gagal502_accession": [],
  "gantung_accession": [],
  "gantung_ms": 120000,
  "push_url": "http://localhost:8099/adam-pacs/bridging",
  "push_kunci": "kunci-masuk-dari-simrs",
  "push_otomatis_ms": 0
}
```

`GET /_uji/hitung` menampilkan berapa kali tiap `accession_number` diterima, benar-benar didaftarkan (`terdaftar`, harus tetap 1 — lihat `dobel_terdaftar`), dan ditolak. `POST /_uji/reset` mengosongkan data & hitungan.
