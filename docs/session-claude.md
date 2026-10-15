# Catatan Sesi Pengembangan bersama Claude (13–15 Oktober 2026)

> Catatan sejarah percakapan pengembangan OpenSIMRS bersama Claude Code (13–15 Oktober 2026). Isinya mencerminkan keadaan saat itu; untuk keadaan terkini, rujuk [CHANGELOG](../CHANGELOG.md), [ROADMAP](./ROADMAP.md), dan [Petunjuk Instalasi](./INSTALLATION_GUIDE.md).
> Konteks teknis tetap (arsitektur, konvensi, jebakan) ada di [KONTEKS-PENGEMBANGAN.md](./KONTEKS-PENGEMBANGAN.md); arah produk & backlog di [ROADMAP.md](./ROADMAP.md).
> Pada masa sesi ini, semua pekerjaan hanya di-commit lokal dan belum di-deploy (arahan pengguna: "jangan deploy dulu, selesaikan di local").

---

## 1. Aturan kerja yang disepakati

- Balasan dan dokumen dalam **Bahasa Indonesia** yang baik.
- **Jangan deploy** ke staging/produksi sampai diminta. Kerja dan commit di lokal saja.
- Repo akan **open source**: jangan commit `.env`, kredensial, token, data pasien nyata, folder PRD, atau berkas internal (mis. `docs/(PRD) Product Requirement Document/`, `docs/testing/hasil-*.md`, `scripts/seed-qa-accounts.cjs`, `Logo OpenSIMRS Biru Teal.png` yang diubah pengguna, `docs/testing/Laporan Pembayaran Kunjungan.xlsx`, `admisi-service/src/services/mobile-pasien-service.js`).
- `frontend-service/src/views/Pembayaran/Cashier2Page.vue` punya perubahan yang **bukan dari sesi ini** — jangan ikut di-commit sebelum ditanyakan.
- Repo dipindah ke **monorepo baru** (`github.com/tulisankode/opensimrs`). Isi 16 service masuk sebagai snapshot tanpa riwayat lama (riwayat lama memuat `.env` & private key); rahasia di `.env.example` dikosongkan. Pakai `git -c safe.directory=*`, jangan ubah konfigurasi git global.
- Data uji dibersihkan setelah selesai. Data milik pengguna di faskes demo **Praktik dr. Andi Wijaya (PMD)** tidak disentuh (order lab LPK…, RAD-20261014-0001, FIS-20261014-0001, 50 peserta MCU hasil impor pengguna, transaksi demo).

---

## 2. Ringkasan per topik (urut waktu)

### 2.1 Fondasi & UI umum (sebelum modul penunjang)
- SOAP Ringkas & Pendaftaran Ringkas (bawaan praktik mandiri), perbaikan kuitansi/tagihan PDF.
- Reset & seeder **8 faskes demo** satu per segmen (`npm run db:demo:reset -- --ya`, `npm run db:demo:seed`).
- Dokumen ROADMAP & KONTEKS-PENGEMBANGAN.
- Header halaman satu baris (`PageToolbar`), menu modul "Segera", nama faskes di footer, **tema warna & logo faskes** (Setting › Logo & Warna), footer "OpenSIMRS".

### 2.2 penunjang-service + Fisioterapi, Radiologi, MCU
- Layanan baru **`penunjang-service`** (Express, port 8099, `/api/v3/penunjang`, ada di repo root — bukan submodule).
- **Fisioterapi** (mengacu PRD): bed, tindakan, order RME/APS, validasi → tagihan, penjadwalan slot × bed, booking, evaluasi (fase rehab + inform consent), cetak, 4 laporan.
- **Radiologi**: master pemeriksaan, order RME/APS, worklist periksa → expertise, cetak; kemudian dilengkapi **ruang & alat, penjadwalan per ruang, template expertise, petugas, persiapan pasien**, laporan per ruang.
- **MCU**: perusahaan, paket (item lab/radiologi/tindakan + stasiun), peserta perorangan/korporasi, pemeriksaan per stasiun, kesimpulan, sertifikat, invoice korporasi.
- Menu header dirapikan: tombol **"Lainnya"** untuk menu yang tidak muat, grup **Penunjang ▾** (Laboratorium, Patologi Anatomi, Mikrobiologi, Radiologi, Fisioterapi), urutan menu baku.

### 2.3 Data demo
- `npm run db:demo:transaksi` — seeder transaksi via alur API (30 pasien, ±60 kunjungan RJ PMD, resep, kasir, backdating).
- `npm run db:demo:master-penunjang` — runner idempoten datamaster penunjang untuk faskes yang sudah ada (lab 69–95 item + paket, radiologi + paket, fisio + paket, MCU, PA, Mikro).
- Perbaikan layanan yang ikut: penerimaan barang inventory (500), kebocoran koneksi penjualan OTC, rute tutup shift kasir.

### 2.4 Cetak & kasir
- Helper **`bukaPdf`** (`frontend-service/src/utils/pdf/bukaPdf.ts`): PDF dibuat dulu → galat jadi toast, popup diblokir → unduh; validasi gambar dari isi berkas (BMP berlabel PNG pernah menggagalkan cetak radiologi).
- Hasil lab: format berkop logo faskes, dikelompokkan kategori → panel, flag H/L/CH/CL/TN, legenda, validator & dokter PJ dengan QR; tombol Cetak di Hasil Pemeriksaan, Expertise, RME.
- RME › Cetak Hasil & Surat: riwayat Lab, Radiologi, PA, Mikro, Fisioterapi (kunjungan ini di atas).
- Kuitansi & tagihan menampilkan **rincian voucher & diskon** (rumus sama dengan payment-service: voucher dulu, lalu diskon dari sisa).

### 2.5 Bridging LIS (adamLIS)
- Koneksi LIS per faskes (Setting › Konfigurasi Integrasi › LIS): URL registrasi, URL Ambil Hasil (GET), x-api-key, kode RS, kode lab, mode kirim.
- **Mapping LIS dipindah ke Laboratorium › Mapping LIS**: Tindakan (tarif → kode tindakan LIS), Unit/Dokter/Penjamin, Hasil Pemeriksaan (item → kode LIS).
- "Validasi & Kirim ke LIS": **gagal kirim LIS = gagal validasi** (order tetap berstatus order, belum ditagih).
- No. Lab LIS disimpan (`lab_lis_kirim.lis_no_lab`) dan jadi kunci utama pencocokan hasil; tampil di detail Hasil Pemeriksaan.
- Ambil hasil **GET** (`/api/v1/arsip/bridging/read?no_reg_rs={no_registrasi}`) lewat tombol "Ambil Hasil LIS"; pencocokan dibatasi per `kode_tindakan_simrs`.
- Wilayah dikirim Kapital Tiap Kata; edit order lab kini menyinkronkan item hasil.

### 2.6 Patologi Anatomi & Mikrobiologi
- Modul terpisah di katalog (PA: RS C/B/A, Mikro: RS B/A), grup Penunjang, order dari RME (RJ/RI/IGD), tagihan ke kunjungan, hak akses per tombol + penegakan backend (`penunjang-service/src/umum/izin.js`).
- PA: penerimaan jaringan (no. PA/SIT/FS/IHK), makro/mikro/diagnosis ICD-O, verifikasi Sp.PA, arsip blok & slide, template, laporan resmi & label.
- Mikro: pewarnaan, kultur, isolat & AST S/I/R (panel otomatis), laporan sementara/final, antibiogram, master organisme & antibiotik (WHONET).
- Uji E2E 6 kombinasi (RJ/RI/IGD × PA/MK) lulus; bug RME IGD (lokasi IGD per faskes) diperbaiki.

### 2.7 Izin & Manajemen Modul
- Simpan Manajemen Modul kini **menyinkronkan izin** modul aktif ke peran admin faskes (`POST /api/v3/auth/permission/sinkron-modul`), menu langsung diperbarui.
- Editor Role memakai **katalog izin dari server** (`GET /api/v3/auth/permission/katalog`), bukan daftar statis usang.

### 2.8 MCU lanjutan
- **Impor Excel bulk** di menu MCU (format templat adamLIS diterima apa adanya) → langsung menjadi peserta; pasien baru otomatis didaftarkan lewat Admisi, pasien lama dikenali (NIK / No. RM) tanpa ditimpa.
- Integrasi lab PK (order lab MCU otomatis, tanpa tagihan ganda), harga kontrak per perusahaan, pembayaran invoice bertahap, batal ditolak bila sudah dibayar, rekap HRD (PDF/Excel), izin per tombol.
- **Kirim massal ke LIS**: checkbox → Kirim ke LIS, status LIS per peserta, kirim ulang yang gagal, Cek Status untuk status "tidak pasti", klaim atomik anti-dobel, mode bulk sesuai gateway `bridging_mcu` (`POST /adam-lis/api/v1/registrasi_bulk_mcu/create?kode_rs=&kode_lab=`, < 150 item). LIS tiruan: `scripts/lis-tiruan.mjs`.

---

## 3. Status saat sesi berakhir

- Semua perubahan saat itu **sudah di-commit lokal** (root + submodule; kemudian digabung menjadi monorepo). Commit terakhir root: `feat(mcu-lis): kirim massal peserta MCU ke LIS + LIS tiruan untuk pengembangan`.
- Belum di-deploy saat itu. Deploy server perlu env penunjang-service `BASE_URL_API_LAB`, `BASE_URL_API_ADMISI` (lihat `penunjang-service/.env.example`); deploy kini memakai `deploy/server/`.
- Setelan faskes demo yang diubah pengguna: di **PMD** override modul sekarang hanya *Farmasi nonaktif* (Lab/Radiologi/Fisio/MCU/PA/Mikro tidak aktif lagi); 50 peserta MCU impor pengguna ada di PMD (tanggal 15–21 Okt). Pengguna sedang beralih ke **Klinik Pratama Sehat Sentosa (KPS)** untuk integrasi LIS MCU.

### Langkah aktivasi LIS MCU di KPS (belum dilakukan)
1. Superadmin › Setting › Manajemen Modul: aktifkan fitur **Bridging LIS** untuk KPS (mati bawaan segmen klinik pratama).
2. Setting › Konfigurasi Integrasi › LIS: URL registrasi, URL Ambil Hasil, API key, kode RS, mode **Bulk**, URL bulk, **kode lab**, ukuran ≤ 149.
3. Laboratorium › Mapping LIS: kode tindakan untuk semua tarif paket MCU (wajib di mode bulk); Unit "MCU", "Dokter MCU", perusahaan sebagai penjamin.
4. Peran terkait punya izin **MCU › Peserta › KIRIM LIS**, lalu login ulang.

---

## 4. Pertanyaan terbuka untuk tim adamLIS

1. Duplikat `no_rm` dicek di dalam batch saja atau seluruh data LIS? (No. RM OpenSIMRS per pasien → pasien yang pernah dikirim bisa selalu ditolak 409.)
2. Apakah gateway `bridging_mcu` mengulang otomatis job FAILED (retryCount 5)? Apakah LIS idempoten per `no_registrasi`?
3. Format respons GET status/hasil per `no_registrasi` dan respons bila belum terdaftar (untuk "Cek Status").
4. Temuan keamanan & validasi pada gateway/endpoint LIS disampaikan langsung ke tim LIS (tidak dicatat di repo publik).
5. Gateway membuang sebagian field (`ras`, `berat_badan`, `keterangan_klinis`) dan `jenis_identitas` selalu "KTP".
6. Mapping di LIS: baris SGPT pernah memakai `kode_pemeriksaan_lis` "SGOT"; Widal hanya mengirim "S. Paratyphi BH".
7. Nilai `kode_lab` & kode unit/dokter/penjamin korporasi untuk KPS.

---

## 5. Backlog yang muncul di sesi ini

Item di bawah sudah dipindahkan ke [ROADMAP](./ROADMAP.md#6-backlog) (B-41 s.d. B-49, B-01, B-03); status terkini ada di sana.

| Area | Item |
|---|---|
| Umum | 47 galat lama `vue-tsc` (sintaks di `components/icons/*`) membuat typecheck semantik tidak jalan — bersihkan agar typecheck bisa diandalkan |
| RME | Angka "Tagihan" di header RME selalu Rp 0 (belum diimplementasikan) |
| Admisi | Normalisasi nilai titel/bahasa pasien hasil API vs opsi form ("Tn." vs "Tn. (Tuan)") |
| Kasir | Rincian Detail Tagihan (Biaya Tindakan/Obat/Kamar) Rp 0 untuk item kategori penunjang; "Umur: Thn Bln Hr" kosong |
| Lab | `updateBatalOrder` cek status keliru; pembuatan order lab tidak dalam transaksi; batas nilai rujukan hanya integer |
| PA/Mikro | Izin READ di backend; halaman verifikasi publik QR; ekspor WHONET; integrasi alat mikro; notifikasi nilai kritis; data demo belum punya dokter Sp.MK |
| Radiologi | Jam operasional per hari & libur alat, status "tidak hadir", PACS/DICOM, dosis radiasi & BHP, tanda tangan final, layar antrean |
| MCU | Pemeriksaan tambahan berjenis tindakan; pembayaran korporasi belum masuk laporan kasir; uji dropdown templat di Microsoft Excel |
| Fisioterapi | Komponen prototipe lama di `views/Fisioterapi/Layout/**` & `Section/**` tidak terpakai (hapus bila disetujui) |
| Keputusan tertunda | B-01 satu lokasi stok untuk praktik mandiri (+ penerimaan supplier langsung ke depo); B-03 gudang sebagai tujuan order resep |

---

## 6. Alat bantu pengembangan yang dipakai

- Uji UI: Chrome headless (port 9333) + `puppeteer-core`, selalu dalam **konteks browser terisolasi** agar tidak mengganggu sesi lain.
- Verifikasi berkas frontend: `curl http://localhost:5520/src/<path>` harus 200 (karena `vue-tsc` tidak andal), plus uji browser tanpa `pageerror`.
- Git Bash di Windows mengubah argumen berawalan `/` atau `@/` menjadi path Windows — tulis berkas lewat editor/Python, bukan argumen shell.
- LIS tiruan: `node scripts/lis-tiruan.mjs` (lihat `scripts/README-lis-tiruan.md`).
