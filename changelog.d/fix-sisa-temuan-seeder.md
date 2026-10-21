### Diperbaiki
- **Kelamin pasien** di daftar Rawat Jalan (semua pasien, pelayanan, discharge), Pasien IGD, Data Pasien Admisi, dan kop cetak kini mengenali `Laki-laki`/`Perempuan` selain `Male`/`Female`. Sebelumnya pasien "Perempuan" tampil sebagai laki-laki.
- **Laporan Kunjungan Rawat Inap** (tabel & ekspor Excel): label kolom "Kondisi Keluar" dan "Status Keluar Pasien" tidak lagi tertukar dengan isinya. Cetak resume juga mengenali kode rujukan `other-hfc`.
- **HDU dapat dipakai:**
  - Fitur `rawat_inap_hdu` ditandai tersedia di katalog modul. Migrasi `20261021110000-sinkron_katalog_hdu_tersedia` menyinkronkannya ke database, jadi jalankan `npm run db:migrate`.
  - Superadmin yang berganti faskes tidak lagi ditolak "Izin tindakan HDU tidak tersedia".
- **Uji admisi-service** kembali berjalan (`npm --prefix admisi-service test`, node:test). Uji lama bergaya Jest tidak pernah dijalankan dan memuat impor yang rusak.
- **Admisi › Daftar Rawat Inap pasien lama** tidak lagi galat 500 ("WHERE parameter uuid undefined"). `patient_data.patient_uuid` dari frontend kini terbaca.
