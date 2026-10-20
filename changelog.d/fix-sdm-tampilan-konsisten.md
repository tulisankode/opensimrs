### Diperbaiki
- HR / SDM: halaman Pelatihan, Jadwal Dinas, Pola Shift, Jadwal Saya, dan Tukar Dinas kini memakai pola tampilan yang sama dengan Kepegawaian. Unsurnya:
  - toolbar halaman dan filter komponen standar;
  - tabel dengan lencana status, formulir di dialog, dan NoData saat kosong;
  - grid jadwal bulanan dengan header tanggal dan kolom pegawai lengket, shift berupa lencana berwarna, serta penanda benturan dan kurang istirahat.

  Logika, API, izin, dan validasi tidak berubah.
- HR / SDM Jadwal Dinas: daftar jadwal dan tukar dinas tidak lagi gagal "Galat internal". Repositori meneruskan klien `null` di luar transaksi, padahal helper `db.js` penunjang-service hanya memperlakukan `undefined` sebagai pool. Log galat jadwal dinas kini memuat metode, path, dan pesan aslinya.
