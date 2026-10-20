# STD-0039 — Kehadiran, Cuti & Izin

Implementasi berada di `penunjang-service/src/hr/kehadiran-cuti/`, menggunakan `hr_kepegawaian`, `hr_akun_pegawai`, pegawai Data Master, serta unit `lokasi`. Tidak dibuat identitas pegawai baru.

## Penyiapan oleh pengelola

1. Jalankan migrasi melalui lingkungan rilis yang berwenang: `20261021070000-kehadiran_cuti.cjs`, `20261021070100-katalog_kehadiran_cuti.cjs`, dan `20261021070200-izin_kehadiran_cuti_superadmin.cjs`. Agen tidak menjalankan migrasi atau menyambung database.
2. Aktifkan modul SDM dan fitur `sdm_kehadiran` melalui Manajemen Modul. Jadwal Dinas dan Penggajian tetap berstatus Segera.
3. Berikan izin submodul **HR / SDM › Kehadiran, Cuti & Izin** melalui pengelolaan Hak Akses. Migrasi hanya menambah izin kepada super admin; izin peran lain tetap ditetapkan pengelola.
4. Tautkan akun pegawai melalui Kepegawaian. Pegawai harus aktif, belum purna tugas, belum berakhir, serta mempunyai unit aktif bila unit diisi.
5. Pada Pengaturan Cuti, buat lima jenis awal dari pilihan rancangan: tahunan, sakit, melahirkan, alasan penting, dan dinas luar. Tentukan sendiri pemotongan saldo dan kewajiban lampiran untuk masing-masing jenis. Pilihan rancangan tidak membuat konfigurasi secara otomatis.
6. Simpan kebijakan untuk setiap tahun yang dipakai. Hak tahunan tidak mempunyai nilai universal 12 hari. Hitungan awal menggunakan hari kalender utuh, tanpa prorata atau pengajuan setengah hari. Carry-over memerlukan batas hari dan bulan terakhir berlakunya. Pilih aturan pembatalan secara eksplisit. Batas sesi absen diatur 1–48 jam.
7. Tetapkan atasan langsung. Pergantian atasan berlaku bagi pengajuan baru; pengajuan yang sudah dibuat mempertahankan tujuan atasannya sebagai potret historis.
8. Tetapkan cakupan unit untuk setiap akun dan aksi: `impor`, `koreksi`, `sahkan_sdm`, `lihat_rekap`, `ekspor_rekap`, atau `sesuaikan_saldo`. Izin aksi tidak otomatis memberi akses ke semua unit, termasuk bagi super admin.

## Antarmuka

| Rute | Fungsi |
|---|---|
| `/sdm/kehadiran/saya` | Absen masuk/pulang, lokasi opsional, riwayat bulan berjalan |
| `/sdm/kehadiran/impor` | Unggah CSV/XLSX, pemetaan, pratinjau, proses/lanjutkan dan ringkasan |
| `/sdm/cuti/pengajuan` | Saldo, pengajuan, lampiran, detail, riwayat dan pembatalan |
| `/sdm/cuti/persetujuan` | Detail dan keputusan atasan/SDM serta pembatalan sah |
| `/sdm/cuti/pengaturan` | Jenis, kebijakan berversi, atasan, cakupan dan penyesuaian saldo |
| `/sdm/kehadiran/rekap` | Rekap bulanan, koreksi, catatan manual dan ekspor CSV |

Data halaman disimpan dalam memori komponen dan dibersihkan saat halaman ditinggalkan atau faskes berubah. Lokasi dan lampiran tidak disimpan dalam penyimpanan browser persisten.

## Kontrak API

Basis: `/api/v3/penunjang/hr/kehadiran-cuti`. Seluruh rute melewati autentikasi layanan, aktivasi fitur SDM, dan pemeriksaan izin. `faskes_uuid` selalu berasal dari token; nilai faskes pada masukan tidak dipakai.

Respons aplikasi menggunakan `{message,payload}`. Daftar pengajuan dan rekap menggunakan `{items,pagination:{page,limit,total}}`, 25 data per halaman. Rute unduhan mengirim biner dengan `Cache-Control: no-store` serta pemeriksaan ulang akses, tanpa URL publik.

| Metode dan path relatif | Masukan utama / keterangan |
|---|---|
| `GET /saya` | `tanggal_mulai`, `tanggal_selesai` opsional; maksimal 500 catatan |
| `POST /absen` | `jenis`, `catatan_lokasi?`, `kunci_idempotensi`; waktu berasal dari server |
| `GET /pegawai` | `aksi`; pegawai aktif dalam cakupan unit |
| `GET /kehadiran` | `pegawai_uuid`, tanggal mulai/selesai; izin koreksi, maksimal 1.000 catatan |
| `POST /kehadiran/manual` | `pegawai_uuid`, epoch `waktu`, `jenis`, `alasan` |
| `PATCH /kehadiran/:uuid/koreksi` | `versi`, `perubahan:{waktu?,jenis?,catatan_lokasi?}`, `alasan` |
| `POST /impor/pratinjau` | `nama`, `base64`, `pemetaan`, `format_waktu`, `kode_mesin` |
| `POST /impor/:uuid/proses` | `kunci_idempotensi`; identitas impor dan status baris menjadi batas pengulangan |
| `GET /impor/:uuid` | `page` untuk 100 kesalahan per halaman; hanya pemilik impor |
| `GET/POST /jenis-cuti` | Daftar / `kode`, `nama`, `memotong_saldo`, `lampiran_wajib`, `aktif` |
| `PATCH /jenis-cuti/:uuid` | Field perubahan dan `versi` |
| `DELETE /jenis-cuti/:uuid` | `alasan`; hapus lunak, riwayat tetap disimpan |
| `GET/PUT /kebijakan` | Daftar / kebijakan lengkap; penyimpanan selalu membuat versi baru |
| `GET/PUT /cakupan` | Referensi penugasan / pasangan pegawai–atasan atau akun–unit–aksi, `alasan` |
| `POST /lampiran` | `tipe`, `base64`; PDF/PNG/JPEG, maksimal 5 MB |
| `GET /lampiran/:uuid` | Unduhan biner terautentikasi; pemohon, atasan tujuan berizin atau SDM dalam cakupan |
| `POST /pengajuan` | `jenis_uuid`, tanggal mulai/selesai, `alasan`, `lampiran_uuid:[]`, `kunci_idempotensi` |
| `GET /pengajuan` | `page`; milik sendiri, atasan tujuan, atau cakupan SDM |
| `GET /pengajuan/:uuid` | Detail, metadata lampiran dan keputusan |
| `POST /pengajuan/:uuid/keputusan` | `versi`, `aksi:setujui\|sahkan\|tolak`, `catatan?` |
| `POST /pengajuan/:uuid/pembatalan` | `versi`, `alasan`, `kunci_idempotensi` |
| `POST /pengajuan/:uuid/keputusan-pembatalan` | `versi`, `aksi:setujui\|tolak`, `catatan?` |
| `GET /saldo` | `tahun?`, `pegawai_uuid?`; pegawai lain memerlukan izin dan cakupan penyesuaian saldo |
| `POST /saldo/penyesuaian` | `pegawai_uuid`, `tahun`, jumlah hari utuh bertanda, `alasan`, `kunci_idempotensi` |
| `GET /rekap` | `bulan:YYYY-MM`, unit/pegawai opsional, `page` |
| `POST /rekap/ekspor` | Filter sama, `format:csv`; identitas ekspor berlaku lima menit |
| `GET /rekap/ekspor/:uuid` | Unduh CSV, cakupan dan izin dihitung ulang pada saat unduh |

Unggahan memakai JSON base64 mengikuti fasilitas berkas layanan penunjang yang sudah ada, bukan multipart. Lampiran disimpan sebagai BYTEA privat, dengan nama unduhan generik dan validasi tanda tangan dasar. Tidak ada fasilitas pemindaian antivirus atau tiket penyimpanan objek eksternal yang diasumsikan tersedia. Lampiran sementara hanya dapat dipakai pemiliknya selama 24 jam; setelah ditautkan akses mengikuti pengajuan. Pembersihan fisik lampiran sementara kedaluwarsa belum disertakan.

Kebijakan lengkap: `tahun`, `hak_tahunan`, `dasar_hari:"kalender"`, `batas_carry_over`, `bulan_kedaluwarsa`, `batal_sebelum_sah`, `batal_setelah_sah`, `batal_saat_berjalan`, `maks_sesi_jam`. Kebijakan wajib tersedia juga untuk absen web dan pengajuan tanpa pemotongan saldo agar batas sesi/pembatalan tidak ditebak.

## Impor dan waktu

Format awal menerima CSV UTF-8 dengan pemisah koma atau XLSX lembar pertama. Batas 5 MB, 5.000 baris data, 100 kolom dan 2.000 karakter per sel. XLSX dibatasi 200 entri arsip, 8 MB per entri dan 16 MB total hasil ekspansi. Formula, makro, enkripsi, tautan eksternal serta deklarasi entitas XML ditolak. Tanggal serial Excel tidak dikonversi secara otomatis: gunakan teks waktu atau epoch detik secara eksplisit.

Pemetaan wajib menunjuk nama header `pegawai`, `waktu`, `jenis`; `kejadian` opsional. Kolom pegawai berisi **UUID pegawai Data Master**, yang dicocokkan tepat dengan pegawai aktif tertaut dalam cakupan impor. Nama, NIK, dan kemiripan teks tidak digunakan untuk menebak identitas. Pemetaan kode mesin khusus per pegawai belum disertakan; siapkan UUID tersebut pada berkas sumber.

Contoh CSV fiktif:

```csv
pegawai_uuid,waktu,jenis,kejadian
019a0000-0000-7000-8000-000000000001,2026-10-20 08:00:00,masuk,mesin-fiktif-001
019a0000-0000-7000-8000-000000000001,2026-10-20 16:00:00,pulang,mesin-fiktif-002
```

`format_waktu` adalah `wib` (teks `YYYY-MM-DD HH:mm[:ss]`) atau `epoch` (detik). Jenis wajib `masuk` atau `pulang`. Waktu masa depan ditolak. ID kejadian mesin yang stabil didahulukan untuk deduplikasi; bila kosong, hash memakai faskes, mesin, pegawai tertaut, waktu, dan jenis. Indeks deduplikasi mencakup data hapus lunak agar impor ulang tidak menghidupkan kembali catatan tersebut.

Pratinjau disimpan di server selama 24 jam. Konfirmasi memproses data server, bukan salinan hasil pratinjau dari klien. Catatan, hasil baris dan audit berada dalam transaksi yang sama per baris. Proses yang terputus dapat dilanjutkan dengan identitas impor yang sama. Normalisasi baris dibuang setelah diterima/diabaikan. Pesan kegagalan tidak menyalin identitas mentah. Nomor baris mengacu urutan record setelah header; CSV berkutip dapat memuat baris teks tambahan di dalam satu record.

Absen web menggunakan penguncian transaksi per pegawai dan kunci idempotensi. Sesi lintas tengah malam dapat dipasangkan sampai batas jam kebijakan. Sesi masuk terbuka tidak ditutup atau ditebak secara otomatis; SDM melakukan koreksi jika urutannya keliru.

## Saldo, keputusan dan audit

Pengajuan 1–366 hari kalender dipecah per tahun, tidak boleh dimulai sebelum hari ini, dan tidak boleh bertumpang tindih dengan pengajuan tertunda/sah. Hak dan saldo tahun baru dibuat ketika diperlukan dari kebijakan yang berlaku saat saldo terbentuk; kebijakan itu tidak diganti oleh versi selanjutnya. Tahun sebelum awal kepegawaian ditolak. Penyesuaian saldo merupakan mutasi baru beralasan, hanya untuk tahun berjalan atau sesudahnya.

Reservasi mengurangi ketersediaan, bukan saldo sah. Pengesahan mengonversi reservasi menjadi pemakaian. Carry-over diambil dari sisa hak tahun sebelumnya yang sudah terbentuk, setelah memperhitungkan reservasi, dibatasi kebijakan, dan tidak membawa carry-over lama lagi. Pemindahan baru dilakukan setelah tahun tujuan dimulai. Hak tahun sebelumnya tidak dibuat secara spekulatif untuk membentuk carry-over. Untuk pengajuan masa depan, carry-over yang akan kedaluwarsa sebelum akhir rentang tahun terkait tidak dihitung sebagai saldo tersedia.

Atasan tujuan harus memutuskan lebih dahulu. SDM tidak dapat mengesahkan sebelum tahap atasan selesai. Pemohon tidak dapat memutuskan pengajuannya sendiri. Penolakan wajib beralasan. Versi usang menghasilkan 409 dan pengguna perlu memuat ulang detail.

Pembatalan sebelum sah dapat langsung berstatus batal bila kebijakan membolehkan. Pengajuan sah tetap sah sampai permintaan pembatalannya disahkan SDM. Pengembalian saldo hanya ditulis sekali, merujuk pemakaian asal, dan mempertahankan kedaluwarsa carry-over. Kegagalan audit pusat membatalkan perubahan bisnis dalam transaksi yang sama.

## Rekap dan batas integrasi

Rekap menghitung hari bercatatan, pasangan tidak lengkap, serta cuti/izin sah. Tampilan dan ekspor memakai pembangun rekap dan aturan unit yang sama, dengan penugasan aksi terpisah. CSV menetralkan formula dan tidak memuat lokasi, alasan pribadi atau isi lampiran. Pasangan di tepi bulan dapat memerlukan pemeriksaan untuk sesi yang melintasi periode.

Jadwal Dinas belum tersedia pada repo ini. Hasil menyatakan `fitur_tidak_aktif` dengan nilai klasifikasi `null`, tanpa angka nol yang menyiratkan telah diperiksa. Pencocokan dengan jadwal nyata, sesi berdasarkan tanggal mulai dinas, toleransi dan lembur memerlukan integrasi lanjutan ketika sumber Jadwal Dinas tersedia. Notifikasi perubahan status disajikan melalui daftar dan riwayat; tidak dikirim melalui kanal eksternal.

## Verifikasi dan uji manual

Uji otomatis mencakup waktu WIB, parser CSV/XLSX dan batas ekspansi, deduplikasi, urutan absen, konfigurasi kebijakan, persetujuan, saldo, reservasi, kedaluwarsa, pembatalan, isolasi faskes/cakupan, hapus lunak dan pembatalan transaksi saat audit gagal. Dependensi handler diganti dengan penyimpanan dalam memori; uji tersebut tidak menggantikan uji integrasi PostgreSQL.

Uji manual pada lingkungan uji berwenang:

- Terapkan ketiga migrasi pada database uji, ulangi pemanggilan migrasinya untuk memeriksa idempotensi, dan periksa indeks serta penolakan bentuk skema yang tidak sesuai.
- Uji satu segmen dengan fitur aktif dan satu dengan fitur mati, super admin dan peran tanpa izin, serta dua faskes berbeda.
- Buat lima jenis, kebijakan, atasan, cakupan unit dan tautan akun fiktif. Pastikan tanpa penugasan unit tidak ada akses menyeluruh.
- Impor CSV/XLSX valid, sebagian salah, berulang, tumpang tindih, proses terputus, dan dua proses bersamaan.
- Kirim dua absen masuk bersamaan; uji pergantian tanggal WIB dan sesi lintas tengah malam.
- Uji pengajuan tiga hari dengan hak fiktif 12 hari: sebelum sah saldo tetap 12 dengan reservasi 3; sesudah sah sisa 9. Uji dua pengesahan bersamaan, dua tahun, penolakan, carry-over kedaluwarsa dan pembatalan berulang.
- Uji koreksi, catatan manual, serta kegagalan SQL/audit: status, mutasi dan riwayat harus konsisten.
- Uji lampiran milik akun/faskes lain, lampiran sementara kedaluwarsa, unduhan setelah pergantian peran, dan ekspor sesudah cakupan dicabut.
- Periksa UI, pergantian faskes, pengosongan data sementara dan unduhan CSV/lampiran melalui peramban.
