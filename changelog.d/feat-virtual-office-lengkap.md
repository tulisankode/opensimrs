### Ditambahkan
- Virtual Office (STD-0042) kini memakai data nyata. Peta isometrik 2.5D (SVG) per faskes menampilkan lantai berpetak, zona poli/ruangan rawat inap, ruang berdinding rendah berwarna beban (Lancar/Ramai/Padat), avatar beban kerja (menunggu/dilayani), dan jalur transaksi lintas unit beranimasi. Peta mendukung geser, zoom roda mouse/cubit, panel rincian per unit/ruang/jalur, tombol Pusatkan dan Layar penuh, serta polling 30 detik dengan status Live/Tertunda/Offline.
- Snapshot `GET /laporan/virtual-office/snapshot` menghitung transaksi hari ini per unit, yaitu Pendaftaran/Admisi, Poli Rawat Jalan per poli, IGD, Rawat Inap per ruangan (bed & BOR), Laboratorium, Radiologi, Farmasi, dan Kasir. Data hanya mencakup faskes pada JWT dan modul aktif. Unit tanpa aksi izin tampil terkunci tanpa angka.
- Aksi izin Dashboard › Virtual Office: IGD, RAWAT INAP, RADIOLOGI, KASIR, beserta migrasi `20261019250010-izin_virtual_office_unit.cjs` untuk super admin dan `20261019250000-katalog_virtual_office_operasional.cjs` untuk deskripsi fitur katalog.

### Diubah
- Data simulasi hanya muncul bila `VIRTUAL_OFFICE_SIMULASI=aktif` di laporan-service. Label "Simulasi" tidak tampil pada data nyata.

### Diperbaiki
- Halaman Virtual Office tidak lagi menampilkan "Offline — snapshot tidak tersedia" walau respons 200, karena respons sudah dibaca dalam camelCase. Tanda "—" tidak lagi rusak menjadi "?".
- Tautan Virtual Office di Dashboard kini bergaya sama dan sejajar dengan tombol Dashboard Eksekutif.
