### Ditambahkan
- **Dashboard › Command Center berfungsi penuh** (STD-0037): dasbor operasional agregat per faskes token, diperbarui otomatis tiap 30 detik dengan penanda "diperbarui pukul …" dan status kesegaran (segar/terlambat/kedaluwarsa), serta mode layar besar untuk TV dinding. Tidak ada identitas pasien pada respons maupun tampilan.
  - **Tempat tidur** per ruangan & kelas (total, terisi, kosong, status lain, BOR saat ini) dari Monitoring Kamar; bed cadangan/box bayi dilaporkan terpisah.
  - **IGD**: pasien sedang dirawat, kedatangan & pulang hari ini, rata-rata/terlama lama di IGD, kedatangan per jam, dan pasien IGD menunggu kamar (SPRI tanpa bed) beserta lama tunggu.
  - **Antrean poli & admisi** hari ini: menunggu, dilayani, selesai, rata-rata waktu tunggu, dan tunggu terlama per poli.
  - **Peringatan ambang** yang diatur per faskes (izin ATUR AMBANG; batas peringatan & kritis, operator `>`/`>=`), dibuka dan ditutup otomatis saat polling, dengan tinjauan dan eskalasi beraudit (izin TINJAU PERINGATAN / ESKALASI PERINGATAN) serta riwayat peringatan.
  - API laporan-service: `GET /command-center/ringkasan`, `GET /command-center/peringatan`, `POST /command-center/peringatan/:uuid/tindakan`, `GET|PUT /command-center/ambang`.
  - **Migrasi baru:** `20261019240000-command_center_ambang_peringatan`, `20261019240010-izin_command_center_superadmin`.

### Diubah
- Izin **Dashboard › Command Center** dipisah ke objek `dashboardCommandCenterPermission` (kunci "Dashboard Command Center" di katalog izin); `dashboardPermission` kembali tanpa submodul sehingga peran yang hanya diberi izin Dashboard dasar tidak lagi otomatis mendapat Command Center. Super admin tetap mendapatkannya lewat migrasi; peran lain diberi lewat Setting › Hak Akses.
