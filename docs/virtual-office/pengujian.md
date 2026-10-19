# Pengujian Virtual Office

Uji tanpa database ada pada `laporan-service/test/virtual-office.test.js`. Skenario TEST-0001 menggunakan UUIDv7 sintetis tanpa identitas pasien. Jalankan `npm --prefix laporan-service test`; bila lingkungan Windows menolak proses anak dengan EPERM, gunakan `node --test --test-isolation=none laporan-service/test/*.test.js`.

| Kriteria PRD | Bukti saat ini | Pengujian lanjutan |
|---|---|---|
| KT-1 | Snapshot menolak konteks token kosong; middleware autentikasi terpasang | Token tidak valid/kedaluwarsa melalui gateway |
| KT-2 | Uji fasilitas dari token, kueri fasilitas ditolak, agregat terisolasi | Dua sesi fasilitas terpisah melalui HTTP |
| KT-3 | Uji filter izin unit dan jalur | READ ditolak serta pencabutan izin pada middleware nyata |
| KT-4 | Uji daftar field payload tanpa identitas | Inspeksi DOM dan respons jaringan |
| KT-5, KT-6 | Peta, pan/zoom, daftar, avatar dan seleksi tersedia | Penunjuk, sentuh, papan ketik dan pembaca layar |
| KT-7 | Hanya event sintetis | Verifikasi produsen dan proyeksi operasional |
| KT-8 | Uji unit/status asing dan revisi tidak valid | Observabilitas penolakan operasional |
| KT-9, KT-10, KT-11 | Uji duplikat, banyak event, revisi terlambat dan konflik sintetis | Konkurensi, durabilitas dan pengiriman ulang sumber nyata |
| KT-12 | Pemulihan snapshot ketika online dan label tertunda/offline | Uji browser; stream dan cursor operasional belum tersedia |
| KT-13 | Tidak ada tautan detail pada simulasi | Izin sumber, audit dan daftar rute tujuan sebelum implementasi detail |
| KT-14 | Uji waktu tunggu/SLA null | Definisi bisnis sebelum diaktifkan |
| KT-15 | Payload mode simulasi dan banner tetap | Inspeksi banner di peta dan panel |
| KT-16, KT-20 | API hanya GET; uji input event tidak berubah | Audit SQL/transport integrasi nyata |
| KT-17, KT-18 | Uji urutan sintetis order/penerimaan/validasi serta resep/dispensing | Validasi alur aktual bersama pemilik modul |
| KT-19 | Uji fitur/modul nonaktif dan unit tanpa izin | Preset dan override pada fasilitas uji |

Migrasi katalog wajib diuji dua kali oleh manusia pada database pengujian terisolasi; agen tidak menjalankan migrasi atau menyambung database. Uji beban, target latensi, soft delete sumber dan pemulihan pekerja belum berlaku pada prototipe sementara dan wajib diselesaikan sebelum operasional.

## Hasil verifikasi agen

- `npm --prefix laporan-service test`: 24/24 lulus, termasuk tujuh uji Virtual Office. Runner sempat terkena `spawn EPERM`; alternatif tanpa isolasi proses dan pengulangan runner standar sama-sama lulus.
- `node --check`: sepuluh berkas JS/CJS baru atau berubah lulus.
- `npm run docs:katalog`, `node scripts/dokumen-katalog.mjs --cek`, dan `git diff --check`: lulus.
- Kompilasi SFC halaman Virtual Office dengan `@vue/compiler-sfc`: lulus.
- `npm --prefix frontend-service run type-check`: gagal pada TS1005 komponen ikon yang tidak diubah, antara lain AddPrint.vue dan AnnouncementIcon.vue. Pemeriksaan tipe menyeluruh belum lulus; kompilasi SFC bukan pengganti pemeriksaan tipe.
- Uji auth/datamaster tidak dijalankan karena rangkaian uji lama memuat dotenv atau infrastruktur database, yang berada di luar batas pelaksanaan agen. Migrasi tidak dijalankan dan tidak ada koneksi database.
- Interaksi browser, autentikasi HTTP, preset/override pada database terisolasi, serta idempotensi migrasi memerlukan uji manual sesuai tabel di atas.
