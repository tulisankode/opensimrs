### Diperbaiki
- Rute HR/SDM: blok rute Jadwal Dinas (STD-0038) dan Pelatihan (STD-0040) yang tergabung rusak (kurung tidak tertutup, rute ganda) membuat aplikasi gagal dibuka dengan galat Vite `Unexpected "}"`. Rute kini satu blok dan redirect `/sdm` mengenal halaman pelatihan. Tes izin Jadwal Dinas kini menghitung ekspektasi dari definisi izin.
- SIMRS Studio: **Tutup penggabungan** dan penyelesaian konflik otomatis kini juga mengecek sintaks berkas frontend `.ts`/`.vue` (esbuild & `@vue/compiler-sfc`), bukan hanya `.js`. Router yang rusak ditolak sebelum di-commit.
