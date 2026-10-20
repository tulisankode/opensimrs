# Aktivasi Virtual Office

1. Jalankan migrasi (`npm run db:migrate`), yaitu `20261019250000-katalog_virtual_office_operasional.cjs` (sinkron katalog) dan `20261019250010-izin_virtual_office_unit.cjs` (aksi unit baru untuk peran super admin). Keduanya idempoten.
2. Muat ulang laporan-service dan frontend dengan versi kode yang sama. Tidak ada dependensi npm atau variabel rahasia baru. Variabel opsional: `REPORT_TZ_OFFSET` (bawaan `+07:00`) menentukan batas "hari ini", dan `VIRTUAL_OFFICE_SIMULASI=aktif` hanya untuk demo atau QA.
3. Bila perlu, aktifkan fitur Dashboard › Virtual Office lewat Manajemen Modul. Berikan izin Dashboard › Virtual Office › READ dan aksi unit yang diperlukan lewat Setting › Hak Akses. Pengguna perlu login ulang setelah izin berubah (cache izin laporan-service 60 detik).
4. Buka Dashboard, lalu tombol **Virtual Office**. Periksa bahwa unit sesuai modul aktif, angka sesuai transaksi hari ini, unit tanpa izin terkunci, dan status Live/Tertunda/Offline tampil.
5. Untuk menonaktifkan, matikan fitur katalog atau cabut izinnya. Tidak ada data yang perlu dikembalikan.
