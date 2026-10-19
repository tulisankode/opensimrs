# LIS Mikrobiologi tiruan untuk pengembangan

`scripts/lis-tiruan-mikro.mjs` adalah server LIS Mikrobiologi tiruan tanpa dependensi untuk menguji **Bridging LIS
Mikrobiologi** (STD-0014) tanpa LIS asli. Kontraknya mengikuti payload `penunjang-service/src/mikrobiologi/lis-peta.js`
(`buatRegistrasi` & `petakanIsolat`), **berbeda** dari `scripts/lis-tiruan.mjs` (Bridging LIS laboratorium klinik,
format adamLIS).

```bash
node scripts/lis-tiruan-mikro.mjs
PORT=2612 LIS_KUNCI=kunci-uji-mikro SIMRS_CALLBACK=http://localhost:8099/adam-lis/mikrobiologi/bridging \
  SIMRS_KUNCI_MASUK=<kunci masuk koneksi dari SIMRS> node scripts/lis-tiruan-mikro.mjs
```

> Lewat gateway API (`deploy/server/gateway.nginx.conf` atau `install.sh --domain`) alamat `/adam-…` penunjang-service tidak diteruskan (`/adam-lis/…` justru diteruskan ke lab-service); pakai alias `/api/v3/penunjang/mikrobiologi/lis/hasil` di domain API. Lihat [Petunjuk Instalasi 7.5](../docs/INSTALLATION_GUIDE.md#75-integrasi-eksternal).

Isi koneksi di **Setting › Konfigurasi Integrasi › Konfigurasi LIS Mikrobiologi**:

| Kolom | Nilai |
| --- | --- |
| URL Registrasi | `http://localhost:2612/registrasi` |
| URL Ambil Hasil | `http://localhost:2612/hasil?no_registrasi={no_registrasi}` |
| API Key | `kunci-uji-mikro` |

Setelah koneksi dibuat, salin **Kunci Masuk Baru** yang ditampilkan SIMRS, lalu jalankan ulang skrip ini dengan
`SIMRS_KUNCI_MASUK=<kunci tersebut>` agar `POST /_uji/dorong` dapat mem-push hasil kembali ke SIMRS.

## Alur uji end-to-end

1. Petugas memilih **Validasi & Kirim ke LIS Mikrobiologi** pada sebuah order → LIS tiruan mencatat registrasi
   (idempoten per `no_registrasi`; kirim ulang dengan `no_registrasi` yang sama tidak membuat baris baru — cek
   `GET /_uji/hitung`, `percobaan` bertambah tetapi jumlah baris tetap).
2. Dorong laporan sementara ke SIMRS:
   ```bash
   curl -X POST http://localhost:2612/_uji/dorong -H "Content-Type: application/json" \
     -d '{"no_registrasi":"MIK-...","jenis":"sementara"}'
   ```
   Laporan sementara (Gram negatif batang) harus langsung terlihat di **Pemeriksaan & Hasil** tanpa memuat ulang proses lain.
3. Dorong hasil final satu isolat:
   ```bash
   curl -X POST http://localhost:2612/_uji/dorong -d '{"no_registrasi":"MIK-...","jenis":"final"}'
   ```
4. Dorong isolat jamak (polimikrobial, dua organisme dalam satu spesimen):
   ```bash
   curl -X POST http://localhost:2612/_uji/dorong -d '{"no_registrasi":"MIK-...","jenis":"isolat_ganda"}'
   ```
5. Dorong payload dengan antibiotik yang belum dipetakan (`XX-ASING`) — isolat tetap tersimpan, antibiotik tersebut
   tampil sebagai **Tidak cocok dengan item**:
   ```bash
   curl -X POST http://localhost:2612/_uji/dorong -d '{"no_registrasi":"MIK-...","jenis":"antibiotik_tak_dikenal"}'
   ```
6. Kirim ulang `jenis` yang sama untuk `no_registrasi` yang sama → `identitas_hasil_lis` baru dibuat setiap pemanggilan
   `/_uji/dorong` (mensimulasikan kiriman baru); untuk menguji idempotensi kiriman **identik**, panggil endpoint push
   SIMRS langsung dua kali dengan payload yang sama persis (lihat `respons_simrs` pada balasan `/_uji/dorong`).

`GET /_uji/hitung` menampilkan order yang terdaftar beserta jumlah percobaan registrasi. `POST /_uji/reset`
mengosongkan data tiruan (pengaturan `LIS_KUNCI` dkk. tidak berubah, perlu restart proses untuk mengubahnya).
