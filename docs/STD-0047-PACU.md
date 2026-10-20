# PACU / Pemulihan Pascaanestesi — STD-0047

PACU merupakan fitur `pacu` dalam modul `kamar_operasi`. Buka melalui menu Kamar Operasi atau tautan pada daftar jadwal. Episode menggunakan kunjungan RJ/RI/IGD dari order operasi, tanpa membuat registrasi baru. Satu jadwal hanya memiliki satu episode yang belum dihapus, termasuk episode yang telah selesai.

## Konfigurasi dan kewenangan

Administrator menetapkan izin PACU per aksi melalui editor peran. Izin jadwal atau laporan anestesi tidak memberikan kewenangan PACU. Migrasi `20261020180200-izin_pacu_superadmin.cjs` hanya menambahkan sembilan submodul `… PACU` ke peran/akun **super admin** (dikenali dari nama peran, hanya menambah); peran lain diatur manual. Izin `Asesmen PACU:VALIDASI` harus dipetakan ke petugas yang memiliki kewenangan klinis; `Serah Terima PACU:TERIMA` dipetakan ke penerima yang berwenang menurut kebijakan faskes.

Pada dialog **Protokol** (halaman PACU), isi nama, kode, interval dalam menit (disimpan dalam detik), parameter pemantauan, kriteria pindah, dan format serah terima. Parameter mendukung angka beserta satuan, teks, pilihan, dan ya/tidak. Tentukan parameter wajib sesuai protokol rumah sakit, termasuk tanda vital, kesadaran, nyeri, jalan napas, serta mual/muntah. Tombol **Isi Contoh** mengisi draf berisi tanda vital, kesadaran, jalan napas, nyeri, mual/muntah, komponen Aldrete, kriteria pindah ya/tidak, dan isi serah terima; draf ini **perlu disahkan komite medik**, tidak memuat ambang angka, dan interval sengaja dikosongkan. Sistem tidak menyediakan ambang atau protokol klinis bawaan yang aktif.

Versi baru disimpan nonaktif, kemudian diaktifkan dengan izin validasi protokol. Episode menyimpan snapshot sehingga perubahan konfigurasi tidak mengubah episode lama. Pembuatan versi dengan kode sama menaikkan nomor versi. Protokol yang sudah aktif tidak diedit melalui API.

Biaya bawaan nonaktif. Bila diaktifkan, tentukan apakah layanan termasuk paket operasi. Layanan terpisah memerlukan referensi layanan, nama, dan tarif yang ditetapkan faskes. Satu komponen layanan pemulihan dibentuk per episode. Dokumentasi obat/BHP/intervensi tidak membentuk tagihan tambahan, resep, order farmasi, atau pengurangan stok.

## Alur operasional

1. Dari **Kamar Operasi › Jadwal OK** klik tombol **PACU** pada baris jadwal (atau **Episode Baru** di `/kamar-operasi/pacu`, pilih tanggal operasi lalu jadwal). Jadwal yang sudah punya episode langsung membuka episodenya. Syarat jadwal: memiliki laporan operasi berisi tindakan yang dilakukan dan laporan anestesi. Jadwal tidak harus selesai agar tidak bergantung melingkar pada pemulihan.
2. Pilih protokol aktif dan buat episode berstatus menunggu masuk.
3. Catat waktu tiba (koreksi waktu tiba ikut memindahkan waktu serah terima masuk), petugas penyerah, dan isi serah terima masuk. Penerima menggunakan identitas akun pencatat; status menjadi berada di PACU.
4. Catat waktu mulai pemantauan. Tambahkan pengukuran berulang dan dokumentasi intervensi dalam rentang episode.
5. Petugas berwenang mencatat asesmen, hasil kriteria, alasan, dan keputusan. Keputusan belum siap mempertahankan pemantauan. Keputusan siap membutuhkan setidaknya satu pengukuran sebelumnya dan unit tujuan yang tersedia. Kesiapan tidak disimpulkan otomatis dari angka.
6. Susun serah terima keluar ke unit yang sama dengan keputusan. Penerima masuk dengan akunnya dan mencatat waktu penerimaan.
7. Selesaikan dengan waktu keluar setelah penerimaan dan seluruh catatan. Keputusan baru membatalkan serah terima keluar sebelumnya sehingga harus disusun dan diterima kembali.

PACU tidak menulis langsung ke laporan anestesi, tidak mengubah syarat penyelesaian jadwal, dan tidak membentuk perpindahan atau penerimaan ICU/rawat inap otomatis. Penerimaan pada modul tujuan tetap mengikuti alur modul tersebut.

## Koreksi, riwayat, dan biaya

Semua mutasi episode mengunci baris dan memerlukan versi terkini. Konflik versi menghasilkan 409; halaman memuat ulang data. Identitas pencatat dan faskes berasal dari token. Riwayat sebelum/sesudah disimpan dalam transaksi yang sama dengan perubahan. Kegagalan audit membatalkan perubahan terkait.

Izin koreksi memungkinkan koreksi waktu episode serta isi pemantauan, asesmen, dan rincian intervensi dengan alasan, termasuk setelah episode selesai. API juga mendukung koreksi waktu catatan pemantauan/intervensi melalui `perubahan.waktu_kejadian`. Waktu keputusan mengikuti asesmen; perubahan keputusan memakai asesmen baru selama episode masih aktif. Koreksi tidak membuka kembali episode atau mengirim ulang biaya. Catatan serah terima yang telah ditandatangani tidak ditimpa melalui koreksi umum.

Penyelesaian klinis menyimpan biaya tertunda pada transaksi yang sama, kemudian mencoba pengiriman. Hasil jaringan yang tidak terkonfirmasi ditandai perlu rekonsiliasi. Pengiriman ulang melalui izin biaya menggunakan kunci yang sama. Penerima mengunci referensi dan menyimpan bukti dalam transaksi pembentukan tagihan, dengan keunikan permanen per faskes/referensi. Bukti tetap diperiksa sesudah tagihan ditutup.

Migrasi `20261020180000-tambah_pacu.cjs` menggunakan tabel `pacu_episode`, `pacu_protokol`, `pacu_catatan`, `pacu_riwayat`, `pacu_biaya`, serta `pacu_tagihan_referensi`. Catatan klinis memakai jenis terstruktur dalam satu tabel agar pengurutan, penguncian, koreksi, dan audit memakai pola yang sama. Bukti penerimaan tagihan bersifat permanen. Migrasi `20261020180100-sinkron_katalog_pacu.cjs` menyinkronkan katalog. Kedua migrasi tidak dijalankan oleh agen.

## Halaman

`/kamar-operasi/pacu` (menu Kamar Operasi › PACU / Recovery Room dan dropdown Perawatan Intensif di menu atas) menampilkan antrean dengan filter tanggal dan status (bawaan: status aktif). `/kamar-operasi/pacu/:uuid` menampilkan ringkasan pasien/operasi/anestesi (termasuk Aldrete dari laporan anestesi), garis waktu tahap, pengingat pemantauan berikutnya menurut interval protokol, tombol aksi sesuai status dan izin, serta tab Pemantauan (kolom mengikuti parameter protokol), Asesmen/Intervensi/Serah Terima, Biaya, dan Riwayat.

## Hasil verifikasi

- Uji integrasi PostgreSQL 16 sementara (schema.sql + seluruh migrasi; migrasi PACU dijalankan ulang untuk idempotensi; data demo fiktif + data uji NIK `9999…`), penunjang-service dan payment-service pada port uji: **61 skenario lulus** — protokol nonaktif/aktif, 401/403 per aksi, izin Kamar Operasi tanpa PACU ditolak, isolasi faskes (404), syarat bukti tindakan, episode ganda & tiga permintaan bersamaan (1 berhasil, 2 × 409), validasi parameter/urutan waktu/versi usang, asesmen belum siap/siap, serah terima & penerimaan, penyelesaian, tagihan terbentuk satu kali walau dikirim ulang paralel, biaya nonaktif, fitur `pacu` dimatikan per faskes (403), koreksi beralasan dengan riwayat, dan migrasi izin super admin.
- `node --test` penunjang-service: 270 lulus; uji izin auth-service PACU lulus; build frontend lulus.
