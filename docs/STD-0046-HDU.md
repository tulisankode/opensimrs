# STD-0046 — Implementasi HDU

## Status implementasi

Implementasi ini masih sebagian. Fitur `rawat_inap_hdu` berada di induk `rawat_inap` dengan `tersedia: false` (Segera). Pemeriksaan aktivasi di layanan menolak seluruh endpoint HDU selama status tersebut belum diubah melalui pekerjaan lanjutan. Kode yang tersedia mencakup konfigurasi ruangan, kapasitas dari sumber tempat tidur, episode, riwayat kebijakan dan instruksi observasi, serta serah terima tertaut perpindahan.

Pencatatan, pembacaan tren, dan koreksi observasi **belum diimplementasikan**. Model tanda vital rekam medis berada di `rekamedis-service/src/models/mongos/schemas/tanda-vital-schema.js`, tertanam dalam sesi MongoDB. Model tersebut memiliki waktu asesmen dan pencatat, tetapi belum memiliki versi koreksi, audit nilai sebelum/sesudah, atau konteks instruksi HDU. Sesuai desain teknis bagian 2.3, tidak dibuat penyimpanan nilai HDU paralel. Keputusan yang masih diperlukan: memperluas model rekam medis tersebut atau menambahkan seri observasi milik rekam medis. Bagian ini harus diselesaikan sebelum fitur dinyatakan tersedia.

Tidak ada koneksi database, migrasi, perubahan peran pengguna, commit, push, atau perubahan branch yang dijalankan dalam pekerjaan ini.

## Peta perubahan berkas

| Berkas | Perubahan |
|---|---|
| `rawat-inap-service/src/services/hdu-aturan.js` | Skema masukan ketat, pemeriksaan versi/waktu, dan prioritas instruksi |
| `rawat-inap-service/src/services/hdu-izin.js` | Pemeriksaan izin per aksi dan fitur tanpa ketergantungan database |
| `rawat-inap-service/src/services/hdu-service.js` | Koordinasi operasi, validasi permintaan, izin sumber, dan penyaringan respons |
| `rawat-inap-service/src/services/hdu-perpindahan-adapter.js` | Penguncian sumber, validasi referensi, dan pembaruan penempatan |
| `rawat-inap-service/src/repositories/hdu-repository.js` | Konfigurasi, episode, instruksi, serah terima, transaksi, dan idempotensi |
| `rawat-inap-service/src/repositories/perpindahan-repository.js` | Transaksi penerimaan/penolakan dan pencegahan pintasan HDU |
| `rawat-inap-service/src/middlewares/hdu-permission-middleware.js` | Aktivasi katalog dan izin pengguna dalam lingkup fasilitas |
| `rawat-inap-service/src/middlewares/error-middleware.js` | Respons kegagalan domain HDU pada endpoint perpindahan lama |
| `rawat-inap-service/src/routes/hdu-routes.js`, `rawat-inap-service/src/routes/router.js` | Endpoint dan pendaftaran rute layanan |
| `rawat-inap-service/package.json`, `rawat-inap-service/tests/hdu.test.js` | Perintah uji dan pengujian tanpa database |
| `auth-service/src/helpers/permission-list.js`, `auth-service/tests/hdu-katalog.test.js` | Definisi izin HDU dan pengujiannya |
| `database/data/katalog-modul.json` | Fitur HDU pada rawat inap dengan status Segera |
| `database/migrations/20261020120000-hdu_struktur.cjs` | Struktur HDU dan indeks keunikan penempatan sumber |
| `database/migrations/20261020120100-hdu_katalog.cjs` | Sinkronisasi katalog |
| `frontend-service/src/stores/rawatInap/hdu.ts` | Akses API, kunci pengiriman ulang, izin, dan format waktu |
| `frontend-service/src/views/Hdu/HduView.vue` | Wadah halaman dan navigasi HDU |
| `frontend-service/src/views/Hdu/DaftarHduPage.vue` | Daftar episode aktif dan ketersediaan tempat tidur |
| `frontend-service/src/views/Hdu/KonfigurasiHduPage.vue` | Pemetaan ruangan dan riwayat kebijakan observasi |
| `frontend-service/src/views/Hdu/PerawatanHduPage.vue` | Detail episode serta instruksi dan riwayatnya |
| `frontend-service/src/views/Hdu/components/SerahTerimaHduForm.vue` | Form penyiapan dan konfirmasi penerimaan |
| `frontend-service/src/router/index.ts`, `frontend-service/src/utils/permissions.ts` | Rute halaman dan metadata izin |
| `frontend-service/src/views/RawatInap/RawatInapView.vue` | Tautan HDU di navigasi rawat inap |
| `docs/MANAJEMEN-MODUL.md` | Keluaran generator katalog |
| `docs/STD-0046-HDU.md`, `changelog.d/STD-0046.md` | Status, kontrak, batas verifikasi, dan catatan perubahan item |

## Pemetaan struktur dan kewenangan

HDU dipetakan ke ruangan `lokasi` melalui `hdu_konfigurasi.ruangan_uuid`. Struktur jenis layanan dan kategori ruang tetap dikelola Data Master. Kapasitas dihitung dari `room_monitorings`; tempat tidur tersedia harus berstatus `Tersedia`, tanpa penghuni dan tanpa admisi aktif yang masih merujuk tempat tidur itu. Tidak ada kapasitas atau status tempat tidur kedua di tabel HDU.

Izin ditambahkan sebagai submodul **Rawat Inap** sehingga daftar `SEMUA_MODUL` dan nama menu modul induk tidak berubah:

| Submodul | Aksi |
|---|---|
| HDU Episode | READ |
| HDU Konfigurasi | READ, KELOLA |
| HDU Kebijakan Observasi | KELOLA |
| HDU Instruksi Observasi | KELOLA |
| HDU Observasi | READ, CREATE, KOREKSI; disiapkan untuk pekerjaan observasi lanjutan |
| HDU Serah Terima | READ, CREATE, KONFIRMASI |

Tidak ada pemberian izin klinis otomatis. Pengelola perlu meninjau dan menetapkan izin peran melalui editor Role. Penyiapan dan konfirmasi serah terima juga memerlukan **Rawat Inap / Perpindahan Bangsal / SETUJU DAN TERIMA**. Eskalasi memerlukan modul ICU aktif dan **ICU / Serah Terima / KELOLA** pada petugas penerima. Izin serah terima diperiksa lagi saat membaca detail episode; ringkasan serah terima tidak dikirim kepada pengguna yang hanya memiliki izin episode.

Fasilitas dan pelaku berasal dari token (`faskesUuid`, `user_uuid`). Izin pengguna dibaca dengan lingkup fasilitas dan `deleted_at IS NULL`. Masukan menggunakan skema ketat; identitas, fasilitas, dan bidang tambahan dari klien ditolak. Pemeriksaan aktivasi tetap berlaku bagi superadmin.

## Kontrak yang tersedia

Awalan layanan adalah `/api/v3/ranap/hdu`. Respons berhasil menggunakan `{message,payload}`; validasi HDU memakai 422, penolakan izin/aktivasi 403, referensi tidak ditemukan 404, serta konflik versi/status/penempatan 409.

| Metode | Path | Kegunaan |
|---|---|---|
| GET, POST | `/konfigurasi` | Daftar atau buat pemetaan ruangan |
| PATCH | `/konfigurasi/:uuid` | Ubah nama/status dengan versi |
| GET, POST | `/konfigurasi/:uuid/kebijakan-observasi` | Riwayat atau versi kebijakan unit |
| GET | `/tempat-tidur` | Tempat tidur dan status dari sumber penempatan |
| GET | `/episode` | Daftar dengan `halaman`, `batas` (maksimal 100), `status`, `konfigurasi_uuid` |
| GET | `/episode/:uuid` | Episode, konteks interval, riwayat, dan serah terima sesuai izin |
| GET, POST | `/episode/:uuid/instruksi-observasi` | Riwayat atau versi instruksi khusus episode |
| GET, POST | `/serah-terima` | Daftar berhalaman dengan filter arah/status penerimaan atau penyiapan serah terima |
| POST | `/serah-terima/:uuid/konfirmasi` | Konfirmasi penerimaan beserta perpindahan dan episode |

Pembacaan `/serah-terima` menerima `halaman` (mulai 1), `batas` (1–100; bawaan 25), `arah` (`masuk`/`keluar`), serta `status_penerimaan` (`menunggu`/`dikonfirmasi`). Respons berupa `{items,paginasi:{halaman,batas,jumlah}}`. Status penerimaan berasal dari ada/tidaknya petugas penerima, terpisah dari status perpindahan sumber. Daftar dan jumlah memakai filter fasilitas, penghapusan lunak, dan referensi sumber yang sama. Urutan waktu pencatatan menurun lalu UUID menurun menjaga urutan catatan yang memiliki waktu sama. Antarmuka menyediakan filter dan navigasi sehingga dokumen setelah catatan ke-100 tetap dapat dibaca. Setelah konfirmasi mengurangi jumlah halaman, daftar kembali ke halaman terakhir yang tersedia. Respons lama tidak menimpa permintaan yang lebih baru.

Semua penulisan memerlukan header `Idempotency-Key` berupa UUID. Kunci dibatasi fasilitas dan pelaku; operasi, sidik masukan, dan hasil disimpan dalam transaksi yang sama. Pengiriman ulang dengan kunci dan masukan identik mengembalikan hasil sebelumnya. Kunci yang sama dengan operasi atau masukan berbeda ditolak. Store mempertahankan kunci saat respons gagal dan menggunakan kunci baru setelah keberhasilan.

Konfigurasi baru menerima `ruangan_uuid`, `nama`, `aktif`. Pembaruan menerima `nama`, `aktif`, `versi`; pemetaan ruangan tidak dapat diganti. Konfigurasi yang masih memiliki episode aktif tidak dapat dinonaktifkan.

Instruksi menerima `interval_detik`, `berlaku_mulai`, `alasan`, `versi`. Batas teknis interval adalah 1–604800 detik, bukan anjuran klinis. Tidak ada nilai interval bawaan. Instruksi baru harus berlaku sejak waktu pencatatan atau sesudahnya, sehingga formulir dengan ketelitian menit perlu memilih menit mendatang. Setiap perubahan menambah baris riwayat dan menaikkan versi induk. Pada waktu yang ditinjau, instruksi episode memiliki prioritas terhadap kebijakan unit; tanpa keduanya, antarmuka menampilkan “Interval observasi belum ditetapkan”. Riwayat detail tidak dipotong; endpoint riwayat khusus mengembalikan maksimal 100 versi terbaru.

Serah terima menerima `perpindahan_uuid`, `arah` (`masuk`/`keluar`), `waktu_kejadian`, `tujuan_icu`, dan `ringkasan` yang berisi `kondisi`, `terapi_berjalan`, `tindak_lanjut`. Ketiganya wajib diisi petugas; formulir tidak mengisi nilai klinis. Format awal ini perlu ditinjau pemilik klinis sebelum aktivasi. Konfirmasi menerima `waktu_kejadian` dan `versi`. Pengirim dan penerima harus berbeda. Waktu kejadian, waktu penerimaan, dan waktu pencatatan disimpan terpisah dalam epoch detik. Antarmuka memakai zona waktu peramban; konfigurasi zona waktu fasilitas masih perlu dituntaskan sebelum rilis klinis.

## Transaksi penempatan

Tidak ada endpoint bebas untuk membuka atau menutup episode. Permintaan perpindahan dibuat melalui alur rawat inap lama. Asal IGD menggunakan admisi rawat inap valid yang telah ditautkan pada perpindahan tersebut.

Konfirmasi HDU mengambil kunci transaksi per fasilitas, mengunci perpindahan, admisi, serta kedua tempat tidur dalam urutan UUID. Pasien, ruangan, tempat tidur, dan admisi harus berasal dari fasilitas yang sama dan belum dihapus lunak. Perpindahan harus masih `pending`, penempatan asal harus cocok dengan pasien, dan tujuan harus tersedia.

Dalam satu transaksi PostgreSQL: status perpindahan diperbarui, penempatan admisi dan kedua tempat tidur diubah, episode HDU dibuka/ditutup, serta konfirmasi serah terima disimpan. Eskalasi yang secara eksplisit ditandai `tujuan_icu` juga membuka `icu_perawatans` dan mencatat `icu_serah_terimas` pada transaksi yang sama sebelum menutup HDU. Penanda tujuan merupakan keputusan petugas; data master ICU saat ini belum memiliki pemetaan khusus tempat tidur ICU yang dapat dipakai untuk klasifikasi otomatis.

Endpoint penerimaan perpindahan lama menolak perpindahan dari episode HDU aktif atau menuju ruangan yang dipetakan ke HDU. Persetujuan dan penolakan perpindahan lama memakai koneksi, kunci, dan transaksi yang sama dengan alur HDU; pembebasan tempat tidur asal kini berada dalam transaksi tersebut. Episode tetap aktif ketika serah terima belum dikonfirmasi, tujuan terisi, izin tidak cukup, atau perpindahan gagal.

Perpindahan langsung antarunit HDU dan penerimaan dari ICU yang masih memiliki episode aktif ditolak untuk mencegah episode tumpang tindih. Koordinasi serah terima dua unit tersebut masih merupakan pekerjaan lanjutan. Indeks unik sumber penempatan melindungi seluruh rawat inap, termasuk pasien non-HDU; pengujian konkurensi database tetap diperlukan.

## Migrasi baru

- `database/migrations/20261020120000-hdu_struktur.cjs`: indeks unik tempat tidur aktif pada sumber `rawat_inaps`; konfigurasi, episode, riwayat instruksi/kebijakan, serah terima, dan idempotensi HDU. DDL menggunakan `IF NOT EXISTS`. Referensi internal HDU diperkuat dengan FK komposit fasilitas. Referensi tabel lama divalidasi layanan mengikuti pola ICU yang ada.
- `database/migrations/20261020120100-hdu_katalog.cjs`: memanggil `sinkronKatalog` dalam transaksi.

Migrasi lanjutan `database/migrations/20261020190200-hdu_indeks_serah_terima.cjs` menambahkan indeks parsial daftar serah terima per fasilitas, waktu pencatatan, dan UUID melalui `CREATE INDEX IF NOT EXISTS`. Migrasi lama tidak diubah. Seluruh migrasi item memakai awalan Studio `2026102012`; migrasi terakhir di luar item pada pemeriksaan lanjutan adalah `20261020080020-izin_remunerasi.cjs`. Migrasi tidak dijalankan. Indeks unik sumber akan menolak penerapan jika ada penempatan aktif ganda; manusia perlu meninjau konflik tersebut. Tidak ada perbaikan data otomatis. Pembalikan migrasi struktur tidak menghapus riwayat klinis.

## Integrasi dan pekerjaan tersisa

Halaman perawatan menyediakan referensi admisi dan tautan menuju daftar pasien rawat inap. Asesmen, tindakan, terapi, pemberian obat, resep, penunjang, dan tagihan tetap melalui detail pasien rawat inap beserta izin modul pemiliknya. Tautan langsung dengan konteks kunjungan tervalidasi dan penampilan status integrasi dari modul pemilik belum tersedia pada layar HDU. Tidak ada pembuatan order atau biaya otomatis dan tidak ada status transaksi semu.

Sebelum aktivasi: selesaikan sumber observasi, satuan dan validasi klinis, waktu pengukuran, konteks instruksi historis, koreksi beralasan dengan audit, tren, serta uji integrasinya. Perluasan sumber rekam medis memerlukan keputusan lanjutan menurut desain teknis bagian 2.3. Tinjau pula format serah terima, kewenangan klinis, zona waktu fasilitas, alur antarunit HDU/ICU, serta tautan integrasi klinis. Jangan mengubah `tersedia` menjadi `true` sebelum seluruh kebutuhan rilis terselesaikan.

## Verifikasi tanpa database

- `npm --prefix rawat-inap-service test -- --test-isolation=none`: 20 pengujian lulus, mencakup aturan, izin, pengiriman ulang, penempatan, penerimaan/eskalasi, riwayat instruksi, paginasi serah terima, penerusan kegagalan transaksi, dan pemeriksaan statis migrasi. Perintah tanpa opsi isolasi gagal dengan `spawn EPERM`; opsi isolasi dipakai karena lingkungan membatasi pembuatan proses pengujian Node. Tidak ada koneksi database dalam pengujian.
- `npm --prefix auth-service test -- --runInBand --runTestsByPath tests/hdu-katalog.test.js`: pemeriksaan definisi izin HDU. Pengujian auth menyeluruh tidak dijalankan karena pengujian lama memuat koneksi serta sinkronisasi database.
- `node --check` untuk seluruh JS/CJS yang berubah; kompilasi SFC Vue untuk halaman HDU.
- `npm run docs:katalog`, `node scripts/dokumen-katalog.mjs --cek`, dan `git diff --check`.
- `npm --prefix frontend-service run type-check` terhenti pada galat TS1005 pada 47 komponen ikon lama yang tidak berubah; belum menjadi bukti kelulusan tipe proyek menyeluruh.

## Uji manual setelah penyelesaian dan peninjauan manusia

1. Terapkan migrasi pada lingkungan uji oleh pelaksana berwenang; periksa penerapan ulang serta konflik indeks tanpa mengubah data klinis otomatis.
2. Periksa penolakan API langsung saat fitur nonaktif, izin kurang, fasilitas berbeda, atau referensi dihapus lunak. Pengguna baca episode saja tidak boleh menerima ringkasan serah terima.
3. Uji dua penerimaan serentak ke tempat tidur sama, pasien sama, dan persaingan dengan admisi non-HDU. Hanya satu penempatan boleh berhasil.
4. Uji serah terima pengirim/penerima berbeda, versi kedaluwarsa, pengiriman ulang setelah respons hilang, penolakan perpindahan, dan gangguan di tiap langkah transaksi. Penempatan asal harus tetap benar jika transaksi gagal.
5. Uji eskalasi dengan ICU nonaktif, petugas tanpa izin ICU, tujuan tidak tersedia, lalu penerimaan sah yang menghubungkan kedua episode dan serah terima.
6. Uji prioritas interval episode/unit, waktu efektif, riwayat, dan tampilan tanpa interval; lanjutkan uji observasi serta koreksi setelah sumbernya ditetapkan.
7. Buat lebih dari 100 serah terima fiktif, termasuk waktu pencatatan yang sama; uji halaman kelima, kombinasi filter arah/status, dan konfirmasi dokumen terakhir pada halaman terakhir. Simulasikan respons lambat/gagal agar daftar tidak menampilkan hasil permintaan lama.
8. Tinjau UI, zona waktu fasilitas, konteks integrasi, status gagal farmasi/penunjang/tagihan, serta target p95 dua detik untuk 100 episode dan 20 pengguna.

Seluruh data pengujian harus fiktif: email `@contoh.id`, HP `080000000000`, NIK berawalan `9999`.
