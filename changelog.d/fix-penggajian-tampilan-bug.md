### Diperbaiki
- HR / SDM Penggajian: ketujuh halaman (Komponen, Konfigurasi, Periode, Detail Periode, Rekap, Slip) kini memakai pola tampilan OpenSIMRS. Referensi komponen, skala, periode, dan pegawai dipilih menurut nama, bukan UUID. Isian lewat dialog menggantikan `prompt()` peramban, dan kode pilihan diberi label yang terbaca.
- Penggajian: tombol Simpan tidak lagi melewati validasi formulir. Kunci JSON konfigurasi berhuruf besar ditolak, karena diubah diam-diam ke snake_case saat dikirim. Rekap baru dimuat setelah periode dipilih. Versi pembayaran dan ekspor diambil otomatis. Penetapan komponen memaksa memilih nominal tetap atau skala.
- Penggajian (penunjang-service): daftar periode dapat dibaca pemegang izin Rekap/Ekspor. Riwayat periode tidak lagi dibanjiri catatan pembacaan, yang tetap tercatat di audit pusat. Rekap memuat nama unit.

### Ditambahkan
- Penggajian: endpoint `GET /hr/penggajian/referensi/remunerasi` mendaftar periode Remunerasi yang disetujui dan berjurnal sebagai sumber jasa pelayanan. Membuka periode gaji kini tidak memerlukan izin modul Akuntansi, dan sumber yang sudah dipakai periode gaji lain tidak ditawarkan.
- Penggajian: catatan verifikasi rekening dan catatan pengesahan format bank kini disimpan (kolom `catatan_verifikasi` dan `catatan_pengesahan`), ditampilkan di rincian, dan dicatat di riwayat tindakan. Hasil periode membawa `komponen_uuid` per rincian, sehingga koreksi tidak lagi bergantung pada izin baca Komponen.
  - **Migrasi baru:** `20261021080000-penggajian_catatan_pemeriksaan`.
