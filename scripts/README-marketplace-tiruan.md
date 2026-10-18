# Marketplace mitra tiruan untuk pengembangan

`scripts/marketplace-tiruan.mjs` adalah server marketplace tiruan tanpa dependensi untuk menguji Pembelian BMHP
via Marketplace (STD-0019) tanpa mitra marketplace asli. Kontrak REST yang ditiru bersifat **generik** — belum
ada mitra resmi yang ditentukan; adaptasi ke mitra nyata dilakukan lewat
`inventory-service/src/services/marketplace-adapter-service.js`.

```bash
node scripts/marketplace-tiruan.mjs                             # http://localhost:2414, x-api-key: kunci-uji-marketplace
PORT=2499 MARKETPLACE_KUNCI=rahasia node scripts/marketplace-tiruan.mjs
```

Isi koneksi lewat tombol **Konfigurasi Koneksi** di **Inventory › Pembelian via Marketplace › Pencarian & Penawaran** (butuh izin Pembelian Marketplace › KONFIGURASI KONEKSI) (data fiktif — jangan
memakai data pasien/faskes asli):

| Kolom | Nilai |
| --- | --- |
| Kode mitra | bebas, mis. `MITRA-DEMO` |
| Nama mitra | `Marketplace Tiruan` |
| URL mitra | `http://localhost:2414` |
| API Key | `kunci-uji-marketplace` |
| Mode mock | aktif |

Setelah koneksi disimpan, SIMRS akan menampilkan **Kunci Masuk** sekali (dipakai mitra untuk mengirim webhook).
Aktifkan fitur **Pembelian via Marketplace** (`inv_marketplace`) untuk faskes di Setting › Manajemen Modul
sebelum mencoba mencari/checkout. Atur marketplace tiruan agar mengirim status (push) ke SIMRS memakai kunci
tersebut:

```bash
curl -X POST http://localhost:2414/_uji/atur -H "Content-Type: application/json" \
  -d '{"push_url":"http://localhost:8086/api/v3/inventory/marketplace/webhook/<koneksi_uuid>","push_kunci":"<kunci masuk dari SIMRS>"}'
```

Port `8086` mengikuti port `inventory-service` pada instalasi lokal (lihat
[docs/INSTALLATION_GUIDE.md](../docs/INSTALLATION_GUIDE.md#3-gambaran-sistem--port)); `<koneksi_uuid>` adalah UUID
koneksi yang tersimpan (terlihat di respons `GET` konfigurasi).

## Alur pengujian dasar

1. Cari penawaran (mis. "Spuit") di Pembelian via Marketplace — SIMRS memanggil `GET /produk`.
2. Petakan produk mitra ke master barang (Pemetaan Produk) sebelum dapat dimasukkan ke keranjang (KT-5).
3. Ajukan permintaan, minta pejabat berwenang menyetujui, lalu **Checkout** — SIMRS memanggil `POST /pesanan`
   dengan header `Idempotency-Key` berisi nomor internal pesanan (idempoten, lihat KT-8).
4. Picu perubahan status lewat `POST /_uji/push` (webhook) atau tombol **Sinkron Status** di SIMRS
   (tarik via `GET /pesanan/:nomor_pesanan_mitra`).
5. Saat status menunjukkan barang terkirim, buka **Penerimaan Pembelian** (alur PO yang sama) untuk pesanan yang
   ditautkan, lalu catat jumlah aktual, batch, dan tanggal kedaluwarsa.

## Perilaku yang ditiru

- **Cari penawaran** (`GET /produk?q=&limit=`) — menyaring katalog contoh BMHP (spuit, kasa, infus set, sarung
  tangan, APD) berdasarkan nama; `stok_habis` dapat memaksa stok produk tertentu menjadi 0 untuk menguji G5.
- **Checkout** (`POST /pesanan`) — idempoten per header `Idempotency-Key`: permintaan ulang dengan kunci yang sama
  membalas pesanan yang sama tanpa membuat nomor pesanan mitra baru (KT-8). Menolak jumlah melebihi stok (`409`).
- **Hasil tidak pasti** (G7/KT-8) — bila `gagal_setiap` diatur (>0), setiap percobaan checkout ke-N dengan
  `Idempotency-Key` yang sama dibalas `500` generik; SIMRS harus menahan status `menunggu_konfirmasi` dan boleh
  mengulang dengan kunci yang sama tanpa membuat pesanan ganda.
- **Status & tagihan** (`GET /pesanan/:nomor_pesanan_mitra`) — `404` bila nomor tidak dikenal; selain itu status
  pesanan terkini dan info tagihan (`referensi_tagihan`, `nilai`, `tanggal`, `status_dikonfirmasi`).
- **Push status ke SIMRS** — manual lewat `POST /_uji/push` (`{ nomor_pesanan_mitra, status }`; status mengikuti
  istilah lokal SIMRS: `dibayar`, `dikemas`, `dikirim`, `diterima_sebagian`, `diterima`, `dibatalkan`). Memakai
  `push_url` & `push_kunci` dari `/_uji/atur`. Webhook mengirim `peristiwa_id` unik agar pengiriman ulang
  terdeteksi sebagai duplikat oleh SIMRS (G8/KT-9).
- Semua permintaan terautentikasi (`/produk`, `/pesanan*`) wajib header `x-api-key` sesuai `MARKETPLACE_KUNCI`;
  selain itu dibalas `401`.

## Kendali uji

`POST /_uji/atur` (JSON digabung ke pengaturan):

```json
{
  "latensi_ms": 200,
  "gagal_setiap": 0,
  "stok_habis": [],
  "status_checkout": "dibayar",
  "push_url": "http://localhost:8086/api/v3/inventory/marketplace/webhook/<koneksi_uuid>",
  "push_kunci": "kunci-masuk-dari-simrs"
}
```

`GET /_uji/hitung` menampilkan jumlah pesanan tersimpan dan berapa kali tiap `Idempotency-Key` dicoba checkout.
`POST /_uji/reset` mengembalikan katalog ke data awal dan mengosongkan pesanan/hitungan (pengaturan tetap).

## Data fiktif

Katalog contoh (spuit, kasa, infus set, sarung tangan, APD) adalah data fiktif untuk pengujian, bukan katalog
mitra nyata. Payload checkout/webhook tidak memuat data pasien; jangan memasukkan NIK, HP, atau identitas nyata
ke dalam `catatan` pesanan saat menguji.
