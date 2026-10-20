# Penggajian dasar STD-0041

API berada di `/api/v3/penunjang/hr/penggajian`; halaman di `/sdm/penggajian`. Seluruh akses memakai faskes token, izin per tindakan, respons tanpa tembolok, dan riwayat tindakan dalam transaksi. Penggajian tidak membaca sumber tagihan atau identitas pasien dari Remunerasi.

## Persiapan oleh manusia

1. Uji tiga migrasi `20261021020000`, `20261021020100`, dan `20261021020200` pada database terisolasi dengan data fiktif. Panggil isi `up` dua kali untuk menguji idempotensi SQL. Agen tidak menjalankan migrasi.
2. Aktifkan SDM/Penggajian serta fitur Jurnal dan Remunerasi Akuntansi. Berikan izin penggajian melalui Setting › Hak Akses. Sinkron modul tidak memberikan izin gaji kepada admin faskes secara otomatis.
3. Tautkan pegawai SDM dan akun layanan mandiri. Lengkapi riwayat, komponen gaji pokok, profil penghitungan, serta rekening yang diperlukan.
4. Keuangan menetapkan aturan, kasus uji, bukti pengesahan, tanggal acuan, dan kebijakan operasional. Pembuat versi dan pengesah harus berbeda.
5. Siapkan pemetaan event `penggajian` di Akuntansi. Tidak ada akun atau tarif yang dibuat otomatis. Satu periode Remunerasi final dengan jurnal beban disalurkan utuh melalui satu periode gaji pada bulan yang sama; semua penerima harus tertaut secara tunggal ke pegawai SDM.

## Konfigurasi aturan

Nilai uang API berupa string desimal dengan maksimal dua desimal; parameter rumus maksimal enam desimal. Pecahan perantara menggunakan pembilang/penyebut `BigInt`, sehingga pembagian tidak dibulatkan sebelum titik pembulatan akhir. Nominal disimpan sebagai `NUMERIC(18,2)`, kemudian dibatasi lagi ke rentang sen aman saat masuk Akuntansi.

Objek `aturan` memuat:

- `metode: "periodik"` dan `rekonsiliasi: "tidak_diperlukan"`. Metode tahunan, masa akhir, dan prorata belum didukung; kebutuhan tersebut tidak boleh dialihkan ke konfigurasi periodik.
- `parameter_wajib`: daftar nama parameter yang harus tersedia dari profil atau hasil penghitungan.
- `definisi`: kamus ekspresi bernama untuk perantara.
- `pembulatan`: `{ "metode": "setengah_ke_atas" | "ke_bawah" | "ke_atas", "satuan": "<nominal positif>" }`. Ke bawah/atas mengikuti arah matematis; setengah ke atas memakai arah menjauhi nol pada nilai tepat setengah.
- `potongan`: daftar `{ kode, kategori, rumus, dasar_aturan }`, termasuk kode eksplisit `bpjs_kesehatan`, `bpjs_ketenagakerjaan`, dan `pph21`.
- `iuran_pemberi_kerja`: daftar aturan terpisah dengan bentuk yang sama. Kode seluruh aturan harus unik. Kategori `bpjs`, `pph21`, atau `potongan_lain` menentukan kewajiban jurnal; iuran pemberi kerja dasar hanya mendukung kategori `bpjs`.

Tidak ada contoh tarif produksi. Kasus fiktif evaluator ada di `penunjang-service/test/penggajian.test.js`. Bagian keuangan menyertakan `kasus_uji` berupa daftar `{ parameter, ekspektasi }`; `ekspektasi` memetakan setiap kode aturan ke hasil nominal dua desimal. Seluruh kasus wajib lulus saat penyimpanan dan pengesahan konfigurasi.

Ekspresi yang didukung:

| Operasi | Bentuk |
|---|---|
| Konstanta | `{ "op": "konstanta", "nilai": "<desimal>" }` |
| Parameter/definisi | `{ "op": "variabel", "nama": "<nama>" }` |
| Aritmetika | `{ "op": "tambah/kurang/kali/bagi/minimum/maksimum", "argumen": [<ekspresi>, <ekspresi>] }`; pilih satu operasi |
| Kondisi | `{ "op": "kondisi", "kiri": <ekspresi>, "kanan": <ekspresi>, "perbandingan": "lt/lte/eq/gte/gt", "jika": <ekspresi>, "selain": <ekspresi> }`; pilih satu perbandingan |
| Rentang | `{ "op": "rentang", "dasar": <ekspresi>, "rentang": [{ "mulai": "<desimal>", "sampai": null, "hasil": <ekspresi> }] }` |

Rentang diurutkan, awal inklusif dan akhir eksklusif. Rentang ganda, pembagian nol, siklus, parameter hilang, angka berlebih, serta ekspresi terlalu kompleks ditolak. Skrip bebas tidak dijalankan.

Parameter bawaan hasil hitung adalah `bruto`, `kena_pajak`, `gaji_pokok`, dan `jaspel`; profil tidak boleh menimpanya. Perlakuan pajak tiap komponen dan jaspel harus ditetapkan keuangan. Profil berisi parameter desimal yang diperlukan; `saldo_awal_tahun` wajib objek kosong untuk metode yang didukung saat ini.

Objek `kebijakan` wajib menetapkan:

| Kolom | Nilai yang didukung |
|---|---|
| `tanggal_acuan` | `awal_bulan` atau `akhir_bulan` |
| `perubahan_tengah_bulan` | `tanggal_acuan` |
| `kehadiran_tidak_digunakan` | `true`, berdasarkan kebijakan keuangan yang disahkan |
| `perlakuan_pajak_jaspel` | `kena_pajak` atau `bukan_objek` |
| `penyaluran_jaspel` | `utuh` |
| `waktu_jurnal` | `pembayaran` |
| `penerbitan_slip` | `pembayaran_dan_jurnal` |
| `pemisahan_tugas` | `wajib` |

Tidak ada nilai bawaan bagi keputusan tersebut. Kehadiran belum tersedia; jika kemudian tersedia, penghitungan ditolak sampai adaptor resminya tersedia. Penghitungan tidak mengarang lembur atau potongan kehadiran.

## Masa berlaku dan koreksi

Masa berlaku memakai epoch detik, awal inklusif dan akhir eksklusif. Skala mengikuti golongan riwayat pada tanggal acuan dan masa kerja dalam bulan penuh. Konfigurasi harus berlaku sepanjang bulan. Komponen/profil dipilih pada tanggal acuan. Data masukan yang menyentuh periode dalam verifikasi atau terkunci tidak dapat diubah melalui penggajian.

Alur: `draf → verifikasi → menunggu_persetujuan → disetujui → dibayar`. Verifikator berbeda dari penghitung; penyetuju berbeda dari keduanya. Pengembalian atau penolakan memerlukan alasan dan menghapus verifikasi sebelumnya. Pada pengajuan, verifikasi, dan persetujuan, hash sumber diperiksa kembali. Nominal terkunci sejak persetujuan. Koreksi ditambahkan pada bulan berikutnya yang masih draf, merujuk hasil terkunci yang digunakan periode asal.

Versi penghitungan lama dipertahankan. Periode memakai `versi` optimistis; muat ulang setelah menerima konflik versi. Draf dapat dibatalkan melalui penghapusan lunak disertai alasan dan pelepasan reservasi jaspel.

## Pembayaran, jurnal, dan ekspor

Pembayaran mencatat transfer yang sudah dilakukan sesuai proses faskes. Tidak ada instruksi transfer bank. Status dan reservasi pembayaran disimpan sebelum percobaan jurnal; kegagalan Akuntansi ditangani melalui savepoint sehingga pembayaran tetap tercatat. Pengulangan memakai kunci tetap `penggajian:<uuid_periode>` dan hash tetap. Jaspel didebit ke utang jaspel; bebannya tidak diakui ulang. Iuran pemberi kerja didebit sebagai beban dan dikredit sebagai kewajiban.

Slip pribadi mengambil pegawai dari akun token melalui tautan SDM. Slip baru terbit setelah pembayaran dan jurnal berhasil. Hanya endpoint slip administratif dengan izin terpisah yang menerima referensi pegawai.

Format bank dibatasi CSV. `spesifikasi` berisi `jenis: "csv"`, `pemisah` (koma, titik koma, atau tab), `header` (boolean), `desimal` (`titik` atau `koma`), dan `kolom` dari `kode_bank`, `nomor_rekening`, `nama_pemilik`, `bersih`, `referensi`. Kolom rekening dan bersih wajib. Format memerlukan bukti spesifikasi dan pengesahan terpisah; rekening memerlukan verifikasi terpisah. Hasil ekspor terenkode base64, diunduh tanpa penyimpanan browser; metadata audit hanya menyimpan referensi, jumlah, serta hash.

## Verifikasi manual yang masih diperlukan

- Sintaks SQL, kendala relasi, pemicu penguncian, dan idempotensi migrasi dua kali pada PostgreSQL.
- Dua koneksi nyata yang membayar Remunerasi dan penggajian secara bersamaan; satu jalur pembayaran dan satu jurnal harus bertahan.
- Kegagalan jurnal/tutup buku/pemetaan, pengulangan jurnal, kegagalan audit wajib, serta pembatalan reservasi.
- Kasus keuangan yang disahkan, batas tarif, pembulatan, tanggal acuan, masa kerja, dan kesesuaian metode periodik bagi faskes.
- Seluruh halaman, izin terpisah, slip antarpegawai, isolasi antar-faskes, cetak slip, dan kecocokan CSV dengan spesifikasi bank.
- Penghitungan menyeluruh 120 pegawai pada lingkungan representatif dengan p95 ≤ 60 detik. Pengukuran fungsi murni tidak membuktikan kinerja transaksi database.

Perintah uji tanpa database untuk perubahan ini:

```powershell
npm --prefix penunjang-service test -- --import=./test/dukungan/tanpa-runtime.mjs
node --test --test-isolation=none penunjang-service/test/penggajian.test.js
node --test --test-isolation=none penunjang-service/test/penggajian-api.test.js
npm --prefix auth-service test -- --runInBand --runTestsByPath tests/penggajian-katalog.test.js
node --test --test-isolation=none frontend-service/test/penggajian-izin.test.mjs
npm --prefix frontend-service run build-only -- --config test/vite-tanpa-env.config.mjs
```

Pemuat `test/dukungan/tanpa-runtime.mjs` menolak akses database dan mengganti konfigurasi runtime selama verifikasi keseluruhan Penunjang. Uji API mengganti akses data, izin, pemeriksaan fitur, dan pemanggil jurnal dengan pengganti dalam memori; tidak mengimpor konfigurasi runtime. Uji Auth keseluruhan tidak aman dijalankan oleh agen karena memuat konfigurasi lingkungan dan uji koneksi/sinkronisasi database.
