# Pemetaan status sumber Virtual Office

Semua hitungan dibatasi `faskes_uuid` dari JWT dan `deleted_at IS NULL`, tanpa transaksi batal. "Hari ini" adalah rentang tanggal lokal faskes (`REPORT_TZ_OFFSET`, bawaan `+07:00`) dalam epoch detik. Kueri ada di `laporan-service/src/virtual-office/sumber.js`.

| Unit (modul katalog, aksi izin) | Sumber | Menunggu | Dilayani | Selesai | Metrik tambahan |
|---|---|---|---|---|---|
| Pendaftaran / Admisi (`pendaftaran`, PENDAFTARAN) | `antrian` pelayanan `admisi`, `created_at` hari ini | `status_panggilan` 0/NULL | 1 (dipanggil), 3 (diproses) | 4 | terlewat (2); kunjungan terdaftar RJ + IGD + RI hari ini |
| Pendaftaran bila belum ada antrean admisi hari ini | `rawat_jalans`, `instalasi_gawat_darurats`, `rawat_inaps` (`tanggal_daftar` hari ini) | RJ `status_rj` 1–2 | 0 | kunjungan terdaftar lainnya | |
| Poli Rawat Jalan per poli (`rawat_jalan`, RAWAT JALAN) | `rawat_jalans` dengan `tanggal_daftar` hari ini, dikelompokkan per `lokasi_uuid` (poli = `lokasi.is_poli`) | `status_rj` 1, 2, 3 | 4 (diperiksa) | 5 (pulang) | rata-rata menit daftar/check-in sampai diperiksa (0–1440 menit) |
| IGD (`igd`, IGD) | `instalasi_gawat_darurats` aktif, didaftarkan ≤ 48 jam lalu | `status_igd` 1 tanpa `rekam_medis_uuid` | 1 dengan rekam medis | 2 dengan `discharge_date` hari ini | pasien masuk hari ini |
| Rawat Inap per ruangan (`rawat_inap`, RAWAT INAP) | `rawat_inaps`, `room_monitorings` (bed), `ruangan` | `status_ri` 1 (SPRI belum mendapat bed) | 2 (pindah), 3 (dirawat) | 4 dengan `discharge_date` hari ini | bed terisi/total (tipe `Bed`), BOR, masuk hari ini |
| Laboratorium (`laboratorium`, LABORATORIUM) | `order_lab` dengan `created_at` hari ini | `order_status` 1 | 2 | 3 | order cito belum selesai |
| Radiologi (`radiologi`, RADIOLOGI) | `rad_order` dengan `created_at` hari ini | `status` order, valid | diperiksa | selesai | order cito belum selesai |
| Farmasi (`farmasi`, FARMASI) | `prescriptions` dengan `created_at` hari ini | `order_status` 1 | 2 (telaah), 3 (penyiapan), 4 (siap diserahkan) | 5 (diserahkan), 6 (retur setelah diserahkan) | siap diserahkan |
| Kasir (`pembayaran`, KASIR) | `bills` induk (`merge_with IS NULL`) dengan `created_at` hari ini | ditutup (`close_bill`) tetapi belum lunas | tagihan berjalan (`close_bill` false) | `status` true (lunas) | transaksi `payment_history` hari ini |

## Jalur lintas unit

Jumlah pada jalur adalah transaksi hari ini di unit tujuan yang berasal dari unit asal.

| Jalur | Sumber |
|---|---|
| Pendaftaran → Poli Rawat Jalan | kunjungan RJ yang terdaftar hari ini |
| Pendaftaran → IGD | pasien IGD yang terdaftar hari ini (`instalasi_gawat_darurats.tanggal_daftar`) |
| Rawat Jalan / IGD → Laboratorium | `order_lab.pelayanan` `rajal` / `igd` |
| Rawat Jalan / IGD → Radiologi | `rad_order.pelayanan` `rajal` / `igd` |
| Rawat Jalan / IGD → Farmasi | `prescriptions.jenis_pelayanan` `rj` / `igd` |
| Rawat Jalan / IGD → Rawat Inap | `rawat_inaps.encounter` `RJ` / `IGD` (`tanggal_daftar` hari ini) |

Kasir tidak memiliki jalur masuk karena tagihan (`bills`) tidak menyimpan unit asal. Tagihan baru di Kasir dianimasikan sebagai kedatangan dari pintu masuk/koridor, bukan dari unit tertentu.

## Beban

Beban `hijau` (Lancar) berlaku di bawah ambang kuning, `kuning` (Ramai) mulai ambang kuning, dan `merah` (Padat) mulai ambang merah. Ambang diatur per unit di `konfigurasi.json`. Rawat Inap memakai BOR (kuning ≥ 80 %, merah ≥ 95 %). Beban unit berzona adalah beban terberat di antara ruangnya. Status selalu disertai label teks, tidak hanya warna.
