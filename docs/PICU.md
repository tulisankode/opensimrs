# PICU — STD-0044

PICU tersedia sebagai modul tersendiri pada `/picu`, dengan API pada `/api/v3/ranap/picu`. Modul memakai identitas, kunjungan, okupansi, order, dan proses keluar dari sumber yang sudah ada. Tidak ada data pasien, tempat tidur, parameter, dosis, skor, atau ambang alarm yang diisi oleh migrasi.

## Hasil audit kode dan batas integrasi

| Area | Sumber yang diperiksa | Keputusan implementasi |
|---|---|---|
| ICU | `rawat-inap-service/src/repositories/icu-repository.js`, `src/services/icu-service.js`, `src/routes/icu-routes.js` | Tidak memakai skor SOFA, ambang, tabel observasi, atau konfigurasi ICU untuk anak. Kode aplikasi ICU tetap. Migrasi baru menambahkan perlindungan konflik episode ICU–PICU. |
| Identitas dan kunjungan | `packages/model-sdk/models/admisi/patient-model.js`, `birth-detail-model.js`, `models/pelayanan/rawat-inap-model.js` | `patients` dan `rawat_inaps` harus memiliki pasien serta faskes yang sama dan belum dihapus lunak. Tanggal lahir sumber menjadi acuan usia dalam hari saat masuk; tidak menetapkan kelayakan klinis berdasarkan usia. |
| Tempat tidur | `packages/model-sdk/models/admisi/room-monitoring-model.js`, `admisi-service/src/repositories/monitoring-room-repository.js` | Memetakan `room_monitorings` ke PICU. `patient_uuid` dan `status_operasional` tetap otoritatif pada sumber. Status `Tersedia` berarti kosong, `Penuh` berarti terisi; status lain tidak ditawarkan sebagai tersedia. |
| Perpindahan | `rawat-inap-service/src/repositories/perpindahan-repository.js`, metode `ApproveMoveBed` | Penerimaan dan perpindahan PICU menautkan `perpindahans` berstatus `approve` yang penempatan terkininya cocok. Tidak memanggil ulang proses perpindahan, menggandakan okupansi, atau menagih layanan. |
| Pemulangan | `packages/model-sdk/models/pelayanan/rawat-inap-model.js`, `admisi-service/src/repositories/rawat-inap-repository.js` | Penutupan pulang memerlukan `status_ri = 4`, `discharge_date`, dan pelepasan pasien dari tempat tidur sumber. |
| Laboratorium | `packages/model-sdk/models/lab/order-lab-model.js` | Referensi `order_lab` melalui `patient_uuid`, `noreg`, dan faskes yang sama. Memerlukan izin Laboratorium / Order Lab / READ. |
| Radiologi | `penunjang-service/src/radiologi/order.js`, `src/umum/kunjungan.js` | Referensi `rad_order` melalui pasien, `no_reg`, dan faskes. Memerlukan izin Radiologi / Order Radiologi / READ. |
| Farmasi | `packages/model-sdk/models/farmasi/prescription-model.js` | Referensi `prescriptions` melalui pasien, `no_reg`, dan faskes. Memerlukan izin Farmasi / Resep Dokter / READ. |
| Hasil pemeriksaan dan tagihan | Kontrak order sumber di atas | PICU menampilkan UUID/status transaksi, lalu membuka modul sumber. Hasil dan tindakan lanjutan mengikuti izin serta validasi modul sumber; tidak disalin ke PICU. Kegagalan membaca sumber menjadi kegagalan nyata, bukan daftar kosong. |
| Katalog | `docs/MANAJEMEN-MODUL.md`, `database/lib/sinkron-katalog.cjs` | Modul, sembilan fitur, izin, menu, rute, dan dokumentasi katalog didaftarkan bersama. |
| Audit | `packages/model-sdk/umum/audit-sequelize.js` | Kueri SQL PICU tidak memakai hook model; mutasi episode dan dokumentasi mencatat `picu_riwayat` dalam transaksi yang sama. Konfigurasi, pengesahan, pemetaan, dan idempotensi menyimpan aktor/waktu. |

Penerimaan awal hanya melalui rawat inap. Penerimaan langsung dari IGD, kamar operasi, dan rujukan belum ditawarkan karena kontrak alih layanan langsung belum dipastikan. Jalur tersebut dapat masuk melalui proses admisi/perpindahan rawat inap yang berlaku. Integrasi monitor, penilaian klinis, kelompok usia, dan laporan klinis tidak diaktifkan.

## Penyiapan oleh manusia

1. Terapkan migrasi berikut di lingkungan uji berwenang sebelum rilis:
   - `20261021010000-struktur_picu.cjs`: pemetaan tempat tidur, konfigurasi berversi, episode, dokumentasi/revisi, riwayat, dan idempotensi.
   - `20261021010100-katalog_picu.cjs`: sinkronisasi katalog melalui `sinkronKatalog`.
   - `20261020090200-integritas_episode_intensif.cjs`: penguncian bersama dan pemeriksaan konflik episode ICU–PICU pada penerimaan dan perubahan episode aktif.
2. Aktifkan PICU pada Manajemen Modul di faskes yang menyediakan layanan ini. Preset segmen tidak ditambah; sesuai perilaku katalog, faskes tanpa segmen menampilkan semua modul tersedia. Formulir tetap kosong sampai ditetapkan manusia.
3. Berikan izin PICU secara manual kepada peran yang berwenang. Sinkron otomatis admin mengecualikan PICU agar aktivasi modul tidak memberikan kewenangan klinis kepada administrator teknis. Login ulang setelah perubahan izin.
4. Petakan tempat tidur sumber pada halaman Konfigurasi. Pengelolaan kode, lokasi, okupansi, status operasional, dan pemulangan tetap melalui modul sumber.
5. Buat draf formulir dengan jenis, nama/versi, kode parameter unik, tipe angka/teks, satuan, dan penanda wajib. Tidak ada nilai bawaan atau perhitungan medis.
6. Pemegang izin Konfigurasi / VALIDASI memasukkan referensi keputusan pemilik proses klinis dan menetapkan versi untuk digunakan. Sistem merekam aktor dan waktunya. Penetapan isi serta kewenangan profesi merupakan tanggung jawab tata kelola rumah sakit.

Versi yang berlaku tidak dapat ditimpa melalui API. Perubahan formulir dibuat sebagai versi baru; dokumen lama tetap menunjuk definisi historisnya. Untuk mencatat, pengguna memerlukan Episode / READ, Konfigurasi / READ, serta CREATE untuk jenis dokumentasi terkait. READ, FINALISASI, dan KOREKSI dibedakan per jenis: antropometri, observasi, asesmen, perkembangan, keperawatan, tindakan, terapi, dan rencana.

## Alur operasional

1. Buka dasbor dan pilih periode. Kapasitas serta okupansi mencerminkan tempat tidur sumber saat ini; jumlah masuk, transfer keluar, dan pulang mengikuti waktu episode PICU dalam periode terpilih.
2. Selesaikan perpindahan rawat inap ke tempat tidur PICU. Pada Penerimaan, pilih transaksi sumber lalu periksa nama, nomor rekam medis, kunjungan, dan tempat tidur sebelum menyimpan.
3. Buka episode untuk mencatat formulir yang berlaku, tanpa nilai klinis otomatis. Waktu catatan harus berada dalam periode episode dan tidak di masa depan. Finalisasi dan koreksi mengikuti izin per jenis. Koreksi menambah dokumen dengan alasan dan referensi dokumen final sebelumnya; tidak menimpa catatan lama.
4. Muat referensi transaksi laboratorium, radiologi, atau farmasi. PICU hanya membaca transaksi pada kunjungan dan pasien yang sama. Buka modul sumber untuk membaca hasil atau membuat order dengan izin sumber.
5. Untuk pindah, selesaikan perpindahan pada rawat inap, muat ulang episode PICU, pilih hasil perpindahan, dan tinjau identitas serta alasannya. Perpindahan antartempat tidur memerlukan tujuan PICU; transfer keluar memerlukan tujuan di luar pemetaan PICU. Kedua proses mempertahankan histori.
6. Untuk pulang, selesaikan pemulangan sumber sebelum menutup episode. PICU tidak melepas tempat tidur sendiri. Episode yang selesai dapat ditinjau dan dokumen final dapat dikoreksi sesuai izin, tetapi tidak menerima catatan baru.

Jika pasien sudah dipindahkan oleh sumber tetapi penautan PICU belum selesai, episode PICU tetap aktif sampai penautan diselesaikan. Dasbor memakai okupansi sumber dan tidak menyatakan episode selesai sebelum konfirmasi. Petugas harus menyelesaikan penautan; tidak ada proses rekonsiliasi otomatis.

## Kontrak dan perlindungan

- `faskes_uuid` dan aktor selalu dari token; kolom server pada body/query ditolak. Semua akses objek menyertakan pembatasan faskes dan `deleted_at`.
- Mutasi memakai `Idempotency-Key` sepanjang 8–100 karakter. Kunci sama, lingkup sama, pengguna sama, dan isi sama mengembalikan hasil sebelumnya. Isi berbeda ditolak. UI mempertahankan kunci selama percobaan ulang di halaman yang sama; hasil tidak disimpan di browser.
- Satu pasien dan satu tempat tidur tidak boleh memiliki dua episode PICU aktif dalam faskes yang sama. Indeks unik melindungi persaingan penerimaan. Pemicu baru memakai kunci transaksi bersama untuk konflik ICU–PICU; alur ICU tanpa konflik PICU tetap berlaku.
- Perpindahan dan penutupan memerlukan nomor `versi` episode terbaru; konflik menghasilkan HTTP 409. Kegagalan transaksi membatalkan episode, riwayat, dan hasil idempotensi bersama-sama.
- API utama: `GET dashboard`, `GET/POST episode`, `GET episode/:uuid`, `GET/POST episode/:uuid/perpindahan`, `POST episode/:uuid/penutupan`, `POST episode/:uuid/dokumentasi`, `POST episode/:uuid/dokumentasi/:dokumen_uuid/finalisasi`, `GET episode/:uuid/transaksi?sumber=...`, `GET/POST konfigurasi`, `POST konfigurasi/:uuid/pengesahan`, `GET/POST tempat-tidur`, `GET tempat-tidur/sumber`, `GET penerimaan`, dan `GET laporan/operasional`. Semua relatif terhadap prefiks PICU.
- Antropometri, observasi, dan jenis dokumentasi lain memakai endpoint dokumentasi yang sama dengan jenis dari konfigurasi yang berlaku. Revisi memakai `koreksi_uuid` dan `alasan`, serta mempertahankan konfigurasi dokumen asal.
- Daftar episode memakai halaman 25 item. Dokumentasi memakai halaman 50 catatan sesuai izin jenis, termasuk versi historis. Pilihan penerimaan dibatasi 100 transaksi terbaru, tempat tidur sumber 500, dan referensi transaksi 100 per sumber; daftar lengkap transaksi tetap melalui modul sumber. Pencarian/paginasi lanjutan untuk pilihan penerimaan dan tempat tidur perlu diperluas bila volume operasional melampauinya.
- State klinis dibersihkan pada perpindahan halaman/faskes dan pelepasan komponen. Respons lama diabaikan setelah konteks berubah. Tidak ada persistensi data klinis ke penyimpanan browser.
- Respons validasi menggunakan HTTP 422, akses ditolak 401/403, objek tidak tersedia 404, konflik 409, dan gangguan sumber/penyimpanan 503. Rincian isi klinis dan koneksi tidak dicatat oleh penangan PICU.

## Verifikasi dan penerimaan manual

Uji unit menggunakan tiruan koneksi serta identitas sintetis. Tidak diperlukan `.env`, koneksi basis data, atau data pasien. Jalankan:

```powershell
npm --prefix rawat-inap-service test
npm --prefix auth-service test -- --runTestsByPath tests/picu.test.js --runInBand
npm --prefix frontend-service test
npm run docs:katalog
node scripts/cek-integritas.mjs
git diff --check
```

Pada lingkungan yang menolak proses anak runner Node, uji rawat inap dan frontend dapat dijalankan dengan tambahan `-- --experimental-test-isolation=none` pada versi Node yang mendukung opsi tersebut. Jangan menjalankan seluruh suite auth dalam sesi tanpa basis data karena suite lama memiliki uji koneksi dan perubahan skema.

Penerimaan manusia di lingkungan uji harus mencakup:

- Migrasi dua kali, pemeriksaan relasi/indeks/pemicu, serta pemulihan dengan menonaktifkan modul tanpa menghapus riwayat.
- Dua penerimaan bersamaan untuk pasien/tempat tidur yang sama; persaingan penerimaan ICU–PICU; satu transaksi berhasil dan transaksi konflik tidak meninggalkan episode parsial.
- Pemindahan sumber bersamaan dengan penerimaan/penutupan; alur pemulangan gagal, penempatan tidak cocok, tujuan tidak aktif, dan sumber terhapus/lintas faskes harus ditolak.
- Pengguna tanpa autentikasi, tanpa izin tindakan/jenis, izin dicabut, modul/fitur nonaktif, faskes berbeda, dan manipulasi identitas server.
- Formulir belum berlaku, angka tidak berhingga, jenis nilai tidak sesuai, waktu tidak valid, finalisasi, rantai koreksi, dan dokumen historis setelah episode selesai.
- Kehilangan respons setelah penyimpanan, pengulangan kunci, isi berbeda, klik ganda, pergantian faskes saat respons tertunda, dan kegagalan sumber order.
- Peninjauan UI, kegunaan alur penerimaan/perpindahan, izin profesi, definisi formulir/satuan, usia dari sumber, serta laporan oleh pemilik proses rumah sakit.
- Regresi ICU: penerimaan, dasbor, serah terima, observasi, balance cairan, SOFA, transfer, dan laporan. Pemicu lintas episode memerlukan perhatian khusus.

Migrasi dan skenario basis data tersebut belum dijalankan oleh agen. Build frontend biasa memuat konfigurasi lingkungan; pemeriksaan sesi ini memakai pemeriksaan tipe dan kompilasi komponen tanpa menjalankan Vite. Galat tipe/sintaks lama di komponen ikon perlu ditangani sebelum build lengkap dapat menjadi bukti penerimaan.
