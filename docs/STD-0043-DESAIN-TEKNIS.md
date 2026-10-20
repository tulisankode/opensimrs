# STD-0043 — Implementasi NICU

NICU menjadi modul katalog tersendiri (`nicu`) di `rawat-inap-service`. Preset segmen tidak diubah: pengaktifan dilakukan melalui Manajemen Modul oleh pengguna yang berwenang. Izin peran lain diatur melalui editor peran; perubahan ini tidak memberikan izin massal.

## Pemetaan berkas

| Berkas | Tanggung jawab |
|---|---|
| `rawat-inap-service/src/routes/nicu-routes.js` | Kontrak HTTP, validasi, adaptor penyimpanan, respons aman |
| `rawat-inap-service/src/middlewares/nicu-permission-middleware.js` | Izin NICU per aksi, aktivasi modul/fitur, faskes token |
| `rawat-inap-service/src/repositories/nicu-repository.js` | Transaksi episode, penempatan, formulir, revisi dan laporan |
| `rawat-inap-service/src/helpers/nicu-aturan.js` | Aturan identitas, status, versi dan idempotensi yang dapat diuji terpisah |
| `rawat-inap-service/src/helpers/nicu-izin.js` | Pemeriksa akses dengan pembaca izin yang dapat diganti untuk pengujian |
| `rawat-inap-service/src/validations/nicu-request.js` | Skema permintaan ketat dan validasi formulir |
| `frontend-service/src/stores/rawatInap/nicu.ts` | Akses API tanpa penyimpanan data klinis persisten |
| `frontend-service/src/views/Nicu/NicuView.vue` | Navigasi menurut izin |
| `frontend-service/src/views/Nicu/NicuPage.vue` | Dasbor, penerimaan, episode, tempat, konfigurasi dan laporan |
| `rawat-inap-service/src/routes/router.js` | Pemasangan rute NICU setelah pemeriksaan sesi |
| `rawat-inap-service/package.json` | Skrip pengujian tanpa database |
| `rawat-inap-service/tests/nicu.test.js` | Pengujian aturan, akses dan transaksi dengan adaptor tiruan |
| `auth-service/src/helpers/permission-list.js` | Modul izin NICU dan pemetaannya |
| `auth-service/src/controllers/permission-controller.js` | Pendaftaran NICU pada katalog editor peran |
| `auth-service/tests/nicu-permission.test.js` | Pengujian katalog izin dan pemisahan ICU |
| `database/data/katalog-modul.json` | Modul NICU dan sepuluh fitur tanpa perubahan preset segmen |
| `frontend-service/src/components/section/Header.vue` | Menu NICU |
| `frontend-service/src/router/index.ts` | Rute induk, dasbor, penerimaan, episode, tempat, konfigurasi dan laporan |
| `frontend-service/src/utils/permissions.ts` | Persyaratan izin per rute NICU |
| `frontend-service/src/utils/apiHandler.ts` | Opsi konfigurasi permintaan untuk pengiriman kunci idempotensi |
| `docs/MANAJEMEN-MODUL.md` | Tabel katalog hasil generator |
| `docs/STD-0043-DESAIN-TEKNIS.md` | Pemetaan implementasi dan kontrak integrasi |
| `docs/STD-0043-RENCANA-UJI.md` | Bukti verifikasi, batas pengujian dan matriks QA manual |
| `changelog.d/STD-0043.md` | Fragmen catatan perubahan item |

Daftar izin ada di `auth-service/src/helpers/permission-list.js` dan `SEMUA_MODUL` pada pengontrol izin. Menu, rute dan aturan rute frontend memuat NICU. Katalog bersumber dari `database/data/katalog-modul.json`; dokumentasi tabel diperbarui melalui `npm run docs:katalog`.

## Data dan transaksi

Tempat NICU memetakan `room_monitorings` dan unit `lokasi`, tanpa inventaris atau master unit kedua. Kapasitas satu tempat adalah satu episode. `status_alat` dikelola eksplisit, terpisah dari `patient_uuid` pada master tempat dan penempatan episode. Semua entitas NICU memakai UUIDv7, epoch detik, faskes token, dan `deleted_at`.

Pembukaan episode memerlukan pasien `patients.is_new_born`, kecocokan pasien dengan rawat inap, konfirmasi identitas dan serah terima. `new_borns` dicari menggunakan nomor rekam medis bayi dalam faskes yang sama. Registrasi yang berulang, referensi kelahiran yang berbeda, atau identitas ibu yang dipakai sebagai identitas bayi ditolak. Registrasi ibu yang belum tersedia tidak direkayasa. NICU tidak menautkan pasien ibu berdasarkan kemiripan nama; pembetulan relasi tetap melalui pendaftaran. Ringkasan relasi hanya dibaca lewat izin Identitas.

Rawat inap adalah sumber kebenaran: `status_ri = 3` untuk perawatan dan `status_ri = 4` beserta `discharge_date` untuk pemulangan. Perpindahan harus berstatus teknis `approve`, milik rawat inap yang sama, paling baru, dan cocok dengan tempat sumber serta tujuan rawat inap saat ini. NICU hanya menautkan perpindahan yang sudah ada. Sumber penerimaan dari unit lain mengikuti alur admisi/perpindahan rawat inap ini.

Setiap penulisan memakai `Idempotency-Key`, hash permintaan, pelaku token, dan transaksi. Penguncian transaksi per faskes mengurutkan penulisan NICU; sumber rawat inap, tempat dan perpindahan juga dikunci saat diperiksa. Indeks unik parsial membatasi episode dan penempatan aktif. Migrasi pengaman ICU memeriksa hunian NICU dengan kunci transaksi yang sama pada penulisan ICU. Alur ICU selain pencegahan bentrok dengan NICU dipertahankan.

Perpindahan mengakhiri penempatan lama dan membuat penempatan baru dalam episode yang sama. Transfer keluar memeriksa hunian tempat tujuan; tujuan yang masih terdaftar NICU harus memakai perpindahan dalam episode. Penyelesaian mengakhiri episode dan penempatan pada waktu yang sama. Pembaruan master hunian rawat inap tetap milik alur sumber. Pembatalan transfer atau pemulangan tidak membuka episode NICU kembali secara otomatis.

## Konfigurasi klinis

Konfigurasi berupa draf formulir per unit dan jenis, dengan field angka atau teks, nama, kode, satuan dan kewajiban pengisian. Penerbitan memerlukan izin khusus, versi yang cocok dan referensi pengesahan. Referensi adalah catatan administratif yang harus diverifikasi manusia; sistem tidak mengesahkan isi klinisnya secara otomatis.

Tidak ada definisi field, rentang klinis, dosis, alarm, skor ICU, rumus usia atau interval observasi bawaan. Usia gestasi, waktu lahir, berat lahir dan antropometri dapat ditetapkan melalui formulir neonatal oleh pemilik proses klinis. Usia pascakelahiran tidak dihitung otomatis sebelum rumus dan sumber waktunya ditetapkan. Parameter yang tidak didefinisikan ditolak. Formulir terbit tidak ditimpa; perubahan memerlukan draf baru. Dokumen mengacu pada versi formulir tetap, dan koreksi menyimpan isi sebelum/sesudah, alasan, waktu dan pelaku. Episode selesai menolak perubahan biasa.

## Migrasi

1. `20261020210000-nicu_skema.cjs`: tabel episode, tempat, penempatan, konfigurasi, dokumen, revisi, dan operasi idempoten.
2. `20261020210100-nicu_sinkron_katalog.cjs`: pemanggilan `sinkronKatalog`.
3. `20261020130200-nicu_konsistensi_icu.cjs`: fungsi dan pemicu pencegahan bentrok ICU dengan NICU serta pemeriksaan alat/hunian ketika alur sumber mengubah pasien pada tempat NICU.

Migrasi baru memakai awalan reservasi Studio dan pemeriksaan keberadaan. Migrasi lama dipertahankan. Pemulihan dilakukan dengan menonaktifkan modul sambil mempertahankan rekaman dan audit. Agen tidak menjalankan migrasi atau koneksi database.

## Kontrak integrasi

API NICU dipasang di prefiks layanan rawat inap yang sama dengan `/icu`. Respons berhasil memakai `{ message, payload }`; kegagalan validasi `422`, izin `403`, objek tidak terlihat `404`, dan konflik versi/hunian/idempotensi `409`. UUID faskes dan pelaku dari body ditolak. Daftar memakai `halaman` mulai 1, maksimal 50 baris per halaman; query dapat memakai `unit_uuid`, `dari`, `sampai` sesuai operasi.

| Metode | Path relatif | Fungsi |
|---|---|---|
| GET | `/nicu/dashboard`, `/nicu/tempat`, `/nicu/sumber-tempat`, `/nicu/unit` | Ringkasan dan sumber administratif |
| POST | `/nicu/tempat` | Pemetaan tempat sumber |
| PATCH | `/nicu/tempat/:uuid` | Status alat dengan versi |
| POST | `/nicu/tempat/:uuid/status-alat` | Operasi status alat yang sama untuk klien frontend |
| GET, POST | `/nicu/konfigurasi` | Daftar dan draf formulir |
| POST | `/nicu/konfigurasi/:uuid/penerbitan` | Penerbitan dengan referensi pengesahan |
| GET | `/nicu/penerimaan` | Kandidat dari perpindahan rawat inap |
| GET, POST | `/nicu/episode` | Daftar dan penerimaan episode |
| GET | `/nicu/episode/:uuid` | Identitas bayi dan episode |
| GET | `/nicu/episode/:uuid/identitas` | Data relasi pada registrasi bayi menurut izin |
| GET | `/nicu/episode/:uuid/perpindahan` | Transaksi sumber yang cocok dengan penempatan |
| GET, POST | `/nicu/episode/:uuid/penempatan` | Riwayat dan perpindahan tempat |
| POST | `/nicu/episode/:uuid/penyelesaian` | Transfer keluar atau pemulangan |
| GET, POST | `/nicu/episode/:uuid/dokumen` | Dokumen formulir tetap |
| POST | `/nicu/dokumen/:uuid/koreksi` | Koreksi dengan versi dan alasan |
| GET | `/nicu/dokumen/:uuid/revisi` | Riwayat koreksi berizin |
| GET | `/nicu/laporan/operasional` | Laporan periode dan unit |
| POST | `/nicu/laporan/ekspor` | Ekspor JSON satu halaman dengan jejak operasi |

`frontend-service/src/router/index.ts` menyediakan `/rawat-inap/perpindahan-bangsal`, `/rawat-inap/ruangan`, `/laboratorium/order-lab`, `/radiologi/order` dan alur farmasi. Halaman NICU menyediakan navigasi sesuai izin dan aktivasi modul. Pengguna memilih rekam bayi yang sama pada modul sumber. Belum ditemukan kontrak konteks episode NICU lintas layanan yang dapat digunakan langsung; NICU tidak menambahkan parameter episode buatan atau menulis order, hasil, resep dan tagihan kedua. Penautan otomatis lintas layanan dan integrasi alat medis memerlukan kontrak tambahan.

Kapasitas, status alat dan hunian laporan menggambarkan kondisi saat dibaca. Angka masuk, pindah, transfer dan pulang memakai periode pilihan. Ekspor mencakup satu halaman, berformat JSON, dan tidak memuat indikator klinis.
