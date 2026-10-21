### Diperbaiki
- **Rawat Inap › Laporan Pembatalan Dirawat:** pembatalan SPRI yang belum mendapat bed kini tetap tampil (join bed menjadi opsional). Kolom Ruangan dan Kelas membaca ruangan bed, dengan cadangan ruangan tujuan SPRI, sehingga tidak lagi selalu "-".
- **Rawat Inap & Admisi:** pasien tanpa alamat atau tanggal lahir kini tetap muncul di daftar Ruangan, daftar Perpindahan Bangsal, Laporan Kunjungan, Perpindahan, Pembatalan, dan Keperawatan Inap. Kolom yang kosong ditampilkan "-".
- **Admisi › Daftar Ruangan:** pasien yang menunggu persetujuan pindah kamar (status TRANSFER) tidak lagi hilang dari tab Dirawat dan Semua.
- **Rawat Inap › Persetujuan pindah kamar:** riwayat ruangan bed asal kini ditutup, riwayat bed tujuan dicatat, dan ruangan rawat inap (`lokasi_uuid`) ikut diperbarui. Semua perubahan ini berjalan dalam satu transaksi dengan persetujuan.
- **Laporan Rawat Inap, Rawat Jalan, IGD, dan Admisi (tabel & ekspor Excel):** jenis kelamin "Laki-laki"/"Perempuan" kini dikenali, tidak lagi tampil "P" semua. Status pulang "Dirujuk" mengenali kode `other-hfc` yang tersimpan saat ini.
