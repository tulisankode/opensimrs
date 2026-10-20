# Verifikasi STD-0048 — Burn ICU dan Neuro ICU

Implementasi membatasi layanan khusus pada klasifikasi dan template. Tidak ada isi klinis bawaan, protokol terapi baru, atau penahanan administratif karena kelengkapan. Rumah sakit perlu mengatur izin, akses unit, pemetaan bed, serta menetapkan versi template sebelum mengaktifkan layanan khusus. Pengguna biasa tanpa pemetaan unit tidak memperoleh akses klinis ICU; izin konfigurasi tetap dapat dipakai untuk menyiapkan pemetaan.

Migrasi skema: `database/migrations/20261020200100-icu_layanan_khusus.cjs`. Migrasi katalog: `database/migrations/20261020200200-sinkron_katalog_icu_layanan_khusus.cjs`. Keduanya memakai reservasi Studio dan lebih baru daripada migrasi sebelumnya. Tidak ada perubahan migrasi lama. Pengujian agen tidak menjalankan SQL pada database.

## Kontrak dan penerapan

- Layanan tanpa konfigurasi: ICU Umum mengikuti penggunaan lama, sedangkan Burn ICU dan Neuro ICU nonaktif. Penonaktifan layanan khusus menghentikan admisi baru dan mempertahankan episode berjalan.
- Daftar template untuk pemakaian klinis tersedia di `GET /api/v3/ranap/icu/template/pilihan` dengan izin `Perawatan / READ`; daftar pengelolaan di `/template` memakai izin `Template Klinis / READ`. Isi versi episode juga disertakan pada detail perawatan, termasuk versi yang sudah diarsipkan.
- Nilai dinamis dikirim sebagai daftar `{kode_parameter,nilai}`. Kode parameter merupakan nilai sehingga konversi camelCase/snake_case tidak mengubah identitas parameter.
- Aturan kelengkapan dapat mengacu observasi tambahan atau dokumentasi, dengan cakupan episode, interval sejak masuk, atau penyelesaian. Kelengkapan menampilkan status serta daftar kekurangan, termasuk penanda periode berjalan.
- Koreksi observasi dan dokumentasi memerlukan revisi terakhir dan alasan. Riwayat lokal disimpan bersama perubahan dalam satu transaksi. Tidak tersedia operasi penghapusan riwayat.
- Konfigurasi dan penempatan ICU memakai kunci transaksi per fasilitas; admisi, perpindahan, dan bed turut dikunci pada proses mulai. Indeks unik lama dipertahankan dan perpindahan masuk mendapat indeks unik tambahan.
- Hari ventilator memakai hari UTC dan pasien admisi unik. Rumah sakit perlu menetapkan zona waktu operasional sebelum memakai laporan sebagai indikator resmi. BOR tanpa kapasitas yang memadai bernilai kosong disertai alasan.
- Detail episode mempertahankan referensi pasien, admisi, rekam medis, dan episode ICU. Tidak ada perubahan relasi resep, tindakan, atau tagihan. Modul tujuan tetap memakai izin yang sudah tersedia.
- Audit terpusat dijadwalkan setelah transaksi berhasil. Helper audit existing menangani kegagalan tanpa membatalkan transaksi utama; audit terpusat **tidak atomik** dengan perubahan klinis. Riwayat koreksi dan konfigurasi lokal tetap atomik.

## Hasil pemeriksaan otomatis

- `node --check` untuk seluruh JS yang berubah serta JS/CJS baru: lulus.
- Tujuh berkas uji Rawat Inap: 30 uji lulus tanpa database. Dependensi model, koneksi, dan audit diganti sebelum repository diimpor; pemuatan konfigurasi asli ditolak pemuat uji.
- `npm --prefix auth-service test -- --runInBand --runTestsByPath tests/icu-permission.test.js`: satu uji lulus. Rangkaian Auth penuh tidak dijalankan karena uji existing memuat konfigurasi database dan mencakup sinkronisasi destruktif.
- `npm run docs:katalog` dan `node scripts/dokumen-katalog.mjs --cek`: lulus.
- Kompilasi skrip/template dengan `@vue/compiler-sfc`: 12 komponen ICU lulus.
- `npm --prefix frontend-service run type-check`: gagal pada kesalahan sintaks existing di komponen ikon, termasuk `AddPrint.vue`, `AnnouncementIcon.vue`, dan ikon lain yang tidak diubah item ini. Kelulusan pemeriksaan tipe global belum dapat dinyatakan.
- Pembangunan produksi dengan Vite melalui API, dari direktori frontend, memakai `configFile:false`, `envFile:false`, dan `write:false`: lulus. Pemeriksaan ini mematikan pembacaan `.env`, mempertahankan plugin Vue dan alias aplikasi, serta tidak menulis hasil distribusi. Percobaan awal dari direktori root gagal menemukan kelas Tailwind; pengulangan dari direktori frontend berhasil.
- `git diff --check`: lulus. Tidak ada perubahan pada zona terlarang, operasi perubahan branch/commit/push, pemasangan dependensi, atau koneksi database.

Node test runner bawaan semula gagal membuat subproses (`spawn EPERM`). Pengujian dijalankan per berkas dengan isolasi subproses dimatikan:

```powershell
$tests = @('icu-template','icu-kelengkapan','icu-akses','icu-perawatan','icu-dokumentasi','icu-laporan','icu-migrasi')
foreach ($test in $tests) {
  node --test --test-isolation=none "rawat-inap-service/test/$test.test.mjs"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Skrip `npm test` Rawat Inap masih berupa placeholder existing; tidak dipakai sebagai bukti kelulusan.

Pembangunan tanpa berkas lingkungan dapat diulang dari direktori `frontend-service`:

```javascript
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
await build({
  configFile: false,
  envFile: false,
  plugins: [vue()],
  resolve: { alias: { '@': resolve('src') } },
  build: { write: false, emptyOutDir: false },
});
```

## Pengujian manual pada lingkungan terisolasi berisi data fiktif

1. Jalankan migrasi dua kali dan pastikan indeks/referensi terbentuk. Siapkan kasus perpindahan masuk ganda: migrasi harus berhenti untuk rekonsiliasi manusia, tanpa menghapus catatan.
2. Uji permintaan mulai bersamaan untuk bed, admisi, dan perpindahan yang sama; pastikan satu berhasil dan lainnya berkonflik. Uji benturan dengan perubahan bed/perpindahan melalui Rawat Inap.
3. Uji aktivasi Burn saja, Neuro saja, keduanya, dan penonaktifan ketika episode masih berjalan. Pastikan pemetaan masa depan tidak berlaku lebih awal dan perubahan bed aktif ditolak.
4. Uji akses menurut kombinasi izin tindakan, peran, unit, dan fasilitas, termasuk UUID bertingkat dari fasilitas lain serta riwayat lintas unit. Izin konfigurasi tidak boleh memberi akses klinis.
5. Uji perpindahan ICU Umum → Burn → Neuro → Rawat Inap, kesinambungan referensi pasien/admisi/rekam medis, serta akses obat/tindakan/tagihan melalui modul existing.
6. Uji penetapan dan pengarsipan versi, penggunaan versi baru pada episode baru, kompatibilitas episode lama, serta koreksi/revisi bersamaan. Simulasikan kegagalan penyimpanan riwayat dan pastikan transaksi klinis dibatalkan.
7. Uji antarmuka dengan peran baca/tulis/koreksi terpisah, pengisian angka nol/boolean false, kode parameter berisi garis bawah, pergantian fasilitas saat permintaan masih berjalan, dan halaman konfigurasi/template.
8. Cocokkan BOR, ALOS, kematian, hari ventilator, serta kelengkapan dengan perhitungan manual untuk periode bersebelahan, bed kosong, kapasitas historis kosong, dan filter unit/layanan.
9. Tinjau batas waktu respons dan beban laporan: ringkasan kelengkapan saat ini mengevaluasi seluruh populasi tersaring, sedangkan rincian respons dipaginasi. Target volume/kinerja belum ditetapkan.

Uji tiruan membuktikan validasi, pemakaian transaksi, penjadwalan audit, penyaringan kueri, dan pembentukan SQL. Uji tersebut tidak membuktikan perilaku penguncian, indeks PostgreSQL, pemulihan transaksi sesungguhnya, atau alur peramban secara menyeluruh.
