# Aktivasi prototipe dan prasyarat operasional

1. Tinjau perubahan dan jalankan verifikasi kode tanpa data nyata.
2. Pada lingkungan uji terisolasi, pengelola menjalankan migrasi baru `20261019180000-katalog_virtual_office.cjs` melalui proses migrasi proyek. Migrasi hanya memanggil sinkronKatalog yang menggunakan upsert idempoten. Uji ulang sinkronisasi tanpa perubahan hasil. Agen tidak menjalankan langkah database ini.
3. Pastikan layanan laporan dan frontend memuat versi kode yang sama. Tidak ada dependensi npm baru atau variabel kredensial baru.
4. Aktifkan fitur Dashboard ? Virtual Office melalui Manajemen Modul sesuai kebutuhan. Berikan izin READ serta izin unit yang diperlukan melalui editor peran; login ulang setelah perubahan izin. Izin ini tidak memberikan detail modul sumber.
5. Buka Dashboard ? Virtual Office. Pastikan banner Simulasi, unit sesuai modul/izin, kontrol peta, snapshot, dan indikator tertunda/offline bekerja. Angka dan jalur selalu sintetis.
6. Untuk menonaktifkan, matikan fitur katalog atau cabut izinnya. Tidak ada transaksi klinis maupun tabel proyeksi yang perlu dikembalikan.

Integrasi operasional memerlukan pekerjaan lanjutan: produsen event andal, kontrak/revisi dan pemetaan terverifikasi, proyeksi tahan gangguan, penyaringan soft delete sumber, audit detail, transport live berautentikasi, retensi, pengujian beban/keamanan, serta keputusan manusia. Prototipe tidak boleh ditafsirkan sebagai pemantauan operasional. Tidak ada perubahan pada deploy, konfigurasi rahasia, atau alur produksi.
