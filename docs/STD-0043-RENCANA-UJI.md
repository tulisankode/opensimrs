# STD-0043 — Verifikasi dan uji manual

Semua skenario memakai pasien fiktif `TEST-NICU-001`, ibu `TEST-IBU-001`, dan inkubator `INC-01`. Bila diperlukan, email memakai `@contoh.id`, HP `080000000000`, dan NIK berawalan `9999`. Konfigurasi parameter uji bersifat sintetis dan bukan pedoman klinis.

## Verifikasi tanpa database

- `node --check` untuk seluruh JS/CJS baru dan berubah: 14 berkas lulus.
- `npm --prefix rawat-inap-service test -- --experimental-test-isolation=none`: 15 uji lulus, mencakup aturan, pemeriksa akses, repository dengan adaptor tiruan, idempotensi, faskes, soft delete, status alat, perpindahan, transfer, penyelesaian, konfigurasi dan koreksi. Opsi isolasi dipakai karena pemanggilan proses anak pada pelaksana uji standar ditolak `EPERM` di lingkungan ini.
- `npm --prefix auth-service test -- --runInBand --runTestsByPath tests/nicu-permission.test.js`: 1 uji lulus untuk pemetaan izin NICU dan pemisahan ICU. Rangkaian uji autentikasi lain yang memuat koneksi database tidak dijalankan.
- `npm run docs:katalog` dan pemeriksaan kesesuaian generator.
- Kompilasi SFC dua komponen NICU dengan `@vue/compiler-sfc` yang telah tersedia.
- Pemeriksaan tipe terarah untuk skrip kedua komponen NICU dan store baru melalui TypeScript dengan sumber virtual: lulus. Pemeriksaan ini tidak mencakup seluruh aplikasi atau tipe ekspresi templat.
- `npm --prefix frontend-service run type-check`: belum lulus karena kesalahan sintaks `TS1005` pada 47 komponen ikon lama, misalnya `AddPrint.vue` dan `AnnouncementIcon.vue`. Komponen tersebut bukan bagian perubahan item ini. Kompilasi SFC tidak menggantikan pemeriksaan tipe menyeluruh.
- `git diff --check` dan pemeriksaan daftar berkas terhadap zona terlarang.

Uji konkurensi memakai adaptor transaksi terserialisasi di memori. Hasilnya memverifikasi alur aplikasi, bukan membuktikan perilaku kunci, indeks, pemicu atau rollback PostgreSQL.

## Uji manual pada lingkungan sintetis

| Area | Langkah dan hasil yang diperiksa |
|---|---|
| Migrasi | Pelaksana berwenang menjalankan ketiga migrasi, mengulang `up` pada lingkungan kosong/terisi sintetis, memeriksa indeks parsial dan relasi faskes. Tidak ada pasien atau konfigurasi klinis bawaan. |
| Aktivasi | Uji segmen dengan NICU aktif melalui override dan segmen tanpa aktivasi. Menu/rute serta API harus menolak akses saat modul mati. Matikan tiap fitur dan periksa aksi terkait. |
| Izin | Uji tanpa izin, baca saja, terima, pindah, koreksi, histori, terbitkan dan ekspor secara terpisah melalui HTTP langsung. Izin ICU tidak memberi akses NICU. |
| Faskes | Kirim UUID sumber/tujuan/dokumen faskes lain; tidak boleh terungkap atau berubah. Body faskes/pelaku harus ditolak. |
| Identitas | Uji pasien ibu, bayi berbeda, registrasi ganda, relasi tidak konsisten, bayi kembar dengan rekam masing-masing, dan bayi rujukan tanpa relasi ibu. Verifikasi tidak ada pemilihan berdasarkan kemiripan nama. |
| Penerimaan | Selesaikan perpindahan sumber terlebih dahulu. Kandidat sah dapat diterima; transaksi lama, belum berlaku, batal, dihapus lunak atau tidak sesuai hunian harus ditolak. |
| Konkurensi | Kirim dua penerimaan bersamaan dan pembukaan ICU bersamaan untuk tempat atau rawat inap yang sama. Tepat satu episode boleh memakai tempat. Periksa kunci transaksi dan pemicu pada PostgreSQL. |
| Perpindahan | Proses sumber ke inkubator kedua, catat perpindahan NICU; UUID episode tetap, histori asal/tujuan dan pelaku tersedia. Tujuan rusak/terpakai menolak seluruh penulisan. |
| Alat | Masuk, pindah dan keluar tidak mengubah `status_alat`. Uji perubahan status alat dengan versi lama menghasilkan konflik. Perpindahan melalui alur rawat inap ke tempat NICU yang alatnya belum siap atau masih dipakai bayi lain harus ditolak pemicu sumber. |
| Formulir | Draf tidak dapat dipakai. Terbitkan dengan referensi yang telah diperiksa manusia. Uji satuan/field wajib, field asing, tipe salah dan konfigurasi unit lain. Versi terbit tidak ditimpa. |
| Dokumentasi | Uji waktu di luar episode, koreksi dengan alasan, versi lama, histori sebelum/sesudah, dan penolakan perubahan setelah selesai. |
| Idempotensi | Kirim ulang body dan kunci sama: referensi hasil sama. Kunci sama dengan body atau pelaku berbeda harus konflik. Uji respons terputus setelah transaksi berhasil. |
| Transfer/pulang | Transaksi pasien lain atau pemulangan belum selesai harus mempertahankan episode aktif. Transfer sah dan pemulangan sah menutup penempatan dan episode secara konsisten. Periksa hunian master yang dikelola alur rawat inap. |
| Order/hasil | Buka modul sumber dari konteks bayi, cocokkan rekam bayi dan periksa izin sumber. Tidak ada order, resep, hasil, atau tagihan tambahan yang dibuat oleh NICU. |
| Laporan | Cocokkan kapasitas, hunian saat ini, pergerakan periode, filter unit, paginasi dan ekspor JSON satu halaman. Periksa jejak ekspor dan penolakan tanpa izin. |
| Sesi | Berpindah episode, keluar sesi dan ganti faskes selama permintaan berjalan; data lama tidak boleh muncul kembali atau tersimpan persisten. |
| Regresi ICU | Jalankan penerimaan, dokumentasi, balance cairan, SOFA, serah terima keluar dan laporan ICU yang ada; tambahan pengaman hanya menolak bentrok NICU. |

Field klinis, satuan, rumus usia dan dokumentasi wajib tambahan harus ditetapkan pemilik proses sebelum pemakaian pelayanan. Uji antarmuka menyeluruh dan integrasi database masih perlu dilakukan oleh pelaksana berwenang; agen tidak menjalankannya.
