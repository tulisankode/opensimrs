# Spesifikasi Hardware OpenSIMRS (On-Premise)

> Kebutuhan perangkat keras untuk memasang OpenSIMRS di server milik faskes, per segmen.
>
> Dokumen terkait: [Petunjuk Instalasi](./INSTALLATION_GUIDE.md) · [Lingkungan](./LINGKUNGAN.md) · [Panduan Implementator](./kontributor/IMPLEMENTATOR.md)

> **Catatan penting.** Angka di bawah adalah **titik awal**, bukan jaminan. Kebutuhan sebenarnya bergantung pada jumlah kunjungan, jumlah pengguna bersamaan, modul yang aktif, lampiran/gambar, dan integrasi. Ukur ulang pemakaian CPU, RAM, disk, dan waktu respons setelah beberapa minggu berjalan, lalu sesuaikan.

---

## 1. Dasar perhitungan

Satu instalasi lengkap OpenSIMRS terdiri dari:

| Komponen | Jumlah | Batas memori di override server (`deploy/server/docker-compose.server.yml`) |
|---|---|---|
| Layanan backend Node.js | 18 kontainer | ±384 MB per layanan inti (15 layanan), ±192 MB untuk layanan integrasi/penunjang (3 layanan) |
| Frontend (Vue, disajikan Node) | 1 kontainer | ±768 MB |
| PostgreSQL 16 | 1 | ±1 GB |
| MongoDB 7 | 1 | ±512 MB |
| Redis 7 | 1 | ±128 MB |
| Gateway nginx | 1 | ±64 MB |

Jumlah batas memori seluruh tumpukan ±9 GB. Batas ini adalah **plafon**; pemakaian rata-rata biasanya lebih rendah, tetapi sisakan ruang untuk sistem operasi, cache disk database, proses build, dan cadangan. Pada faskes besar, PostgreSQL adalah komponen yang paling diuntungkan oleh tambahan RAM dan disk cepat.

Instalasi native (tanpa Docker) membutuhkan sumber daya yang setara: 19 proses Node.js + PostgreSQL + MongoDB + Redis + nginx.

---

## 2. Spesifikasi per segmen

| Segmen | Topologi | CPU | RAM | Penyimpanan |
|---|---|---|---|---|
| **Laptop pengembang** | 1 laptop | 4 core | 16 GB (minimal 8 GB bila hanya menjalankan `npm run dev:core`) | SSD, ruang kosong 30 GB |
| **Dokter praktik mandiri** | 1 server atau mini PC | 4 core | 8–16 GB | SSD 256 GB |
| **Klinik pratama / klinik utama** | 1 server | 4–8 core | 16–32 GB | SSD 500 GB, RAID1 |
| **RS kelas D / C** | 1 server aplikasi; **disarankan server database terpisah** | 8–16 core | 32–64 GB | SSD/NVMe 1 TB, RAID1 atau RAID10 |
| **RS kelas B / A** | Minimal 2 server aplikasi + 1–2 server database (replika) + load balancer | 16–32 core per server | 64–128 GB per server | NVMe RAID10 2 TB+ |

Puskesmas umumnya setara klinik pratama; sesuaikan dengan jumlah kunjungan dan program yang aktif.

Catatan per segmen:

- **Praktik mandiri:** cukup menjalankan `deploy/server/deploy.sh` di satu mesin. Pastikan ada cadangan di luar mesin tersebut.
- **Klinik:** RAID1 melindungi dari kerusakan satu disk, tetapi **bukan pengganti cadangan**.
- **RS kelas D/C:** pisahkan PostgreSQL dan MongoDB ke server database agar beban aplikasi tidak mengganggu database; arahkan `DB_HOST` dan `MONGO_DB_HOST` ke server tersebut.
- **RS kelas B/A:** jalankan beberapa instans layanan di belakang load balancer, replika database untuk ketersediaan, dan pemantauan (CPU, RAM, disk, waktu respons). Konfigurasi multi-server belum disediakan skripnya; rencanakan bersama tim infrastruktur.

---

## 3. Kebutuhan pendukung

### Jaringan

- LAN **gigabit** antara server dan ruang pelayanan.
- Internet stabil untuk SATUSEHAT dan BPJS (PCare/VClaim); keduanya hanya menerima koneksi dari **IP Indonesia**. Sediakan jalur cadangan bila memungkinkan.
- Port database (5432, 27017, 6379) tidak dibuka ke luar server.

### Listrik

- **UPS** untuk server dan perangkat jaringan, cukup untuk mematikan server dengan aman atau bertahan sampai genset menyala.

### Cadangan 3-2-1

- **3** salinan data, di **2** media berbeda, **1** di luar lokasi (offsite) dan **terenkripsi**.
- Cadangan **harian** PostgreSQL dan MongoDB bersamaan ([Petunjuk Instalasi bagian 10.2](./INSTALLATION_GUIDE.md#102-cadangan)); uji pemulihan secara berkala.

### Perangkat lunak server

- Sistem operasi: **Ubuntu Server LTS** atau **Debian** stabil.
- **Docker Engine + Docker Compose v2** (cara Docker), atau PostgreSQL 16, MongoDB 7, Redis 7, Node.js 22 (cara native). Lihat [Petunjuk Instalasi](./INSTALLATION_GUIDE.md#1-pilih-jalur-anda).

### Estimasi pertumbuhan penyimpanan

Perkirakan dengan rumus kasar:

```
pertumbuhan per tahun ≈ kunjungan per hari × hari layanan per tahun × ukuran data per kunjungan
                       + lampiran (hasil scan, gambar radiologi, dokumen)
```

- Data terstruktur + isi RME per kunjungan umumnya puluhan sampai ratusan KB; ukur sendiri dari pertumbuhan database setelah satu bulan berjalan.
- **Lampiran dan gambar radiologi** jauh lebih besar (MB per berkas) dan biasanya mendominasi. Bila nanti memakai PACS/DICOM, simpan citra di penyimpanan terpisah.
- Tambahkan ruang untuk cadangan lokal, log, dan image Docker (build membutuhkan ±10–15 GB ruang kosong).

Contoh: 100 kunjungan/hari × 300 hari × 200 KB ≈ 6 GB/tahun untuk data terstruktur, belum termasuk lampiran.

### Perangkat klien

- Komputer/laptop dengan **browser modern** (Chrome, Edge, Firefox versi terbaru).
- **Printer** biasa untuk dokumen, **printer label/thermal** untuk label spesimen, gelang, dan struk.
- **Layar antrian** (TV + mini PC/stick dengan browser) dan, bila dipakai, anjungan pasien mandiri.
- **Pembaca barcode** untuk label spesimen dan obat.
