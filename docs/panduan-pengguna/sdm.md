# HR / SDM

> Draf disusun AI dari kode aplikasi pada 2026-10-19 — wajib ditinjau petugas kepegawaian/SDM faskes sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas kepegawaian/SDM, kepala unit, tim kredensial
**Menu:** HR / SDM › Kepegawaian · Kredensial · Jadwal Dinas · Pola Shift · Jadwal Saya · Tukar Dinas
**Hak akses yang dibutuhkan:**
- HR / SDM › Kepegawaian › READ, CREATE, UPDATE, DELETE, TAUTKAN AKUN
- HR / SDM › Kredensial › READ, CREATE, UPDATE, UNGGAH DOKUMEN, VERIFIKASI, CABUT, DELETE

## Untuk apa
Modul ini mencatat data kepegawaian (status, unit kerja, jabatan, golongan, pendidikan) untuk pegawai yang sudah terdaftar di **Datamaster › Pegawai**, beserta riwayat perubahannya. Modul ini juga mencatat kredensial pegawai seperti STR dan SIP. Data pribadi pegawai (mis. NIK dan tanggal lahir) tetap dikelola di Data Master dan tidak ditampilkan di sini.

Fitur **Kepegawaian** selalu aktif bila modul aktif. **Kredensial Pegawai** dan **Jadwal Dinas** dapat diaktifkan terpisah. Kehadiran/cuti, pelatihan, dan penggajian menyusul.

## Tugas sehari-hari

### Membuka modul
1. Klik menu **HR / SDM** di menu atas. Bila tidak terlihat, klik **Lainnya** lalu cari "SDM".
2. Pilih **Kepegawaian** atau **Kredensial** di panel kiri.

### Mencatat kepegawaian pegawai baru
1. Pastikan pegawai sudah ada dan aktif di **Datamaster › Pegawai**.
2. Buka **HR / SDM › Kepegawaian**, lalu klik **Catat Kepegawaian**.
3. Pilih pegawai di **Pegawai (Data Master, aktif, belum tercatat)**.
4. Pilih **Status Kepegawaian** (**Pegawai Tetap**, **Kontrak**, **Honorer**, **Magang**, atau **Purna Tugas**), lalu isi **Tanggal Mulai Tugas (TMT)**.
5. Pilih **Unit Kerja**, lalu isi **Jabatan**, **Golongan / Pangkat**, **Nomor SK (opsional)**, dan **Catatan** bila perlu.
6. Klik **Simpan**.

**Hasilnya:** pegawai tampil di daftar kepegawaian. Bila semua pegawai aktif sudah tercatat, aplikasi menyarankan menambah pegawai baru di **Data Master › Pegawai**.

### Mencari dan melihat data pegawai
1. Di **HR / SDM › Kepegawaian**, saring dengan **Cari** (nama, jabatan, atau golongan), **Unit Kerja**, **Status**, dan **Keaktifan** (mis. **Masih bekerja**), lalu klik **Cari**.
2. Klik baris pegawai untuk membuka detail: **Data Kepegawaian**, **Riwayat Kepegawaian**, **Pendidikan**, dan **Akun Login Tertaut**.

### Mencatat perubahan status, unit, jabatan, atau golongan
1. Buka detail pegawai, lalu klik **Catat Perubahan**.
2. Ubah **Status Kepegawaian**, **Unit Kerja**, **Jabatan**, atau **Golongan / Pangkat**.
3. Isi **Tanggal Berlaku**, **Nomor SK (opsional)**, dan **Catatan**, lalu klik **Simpan**.

**Hasilnya:** perubahan dicatat sebagai riwayat baru. Riwayat sebelumnya ditutup pada tanggal berlaku dan tetap tersimpan di **Riwayat Kepegawaian**.

### Mengakhiri atau mengaktifkan kembali kepegawaian
1. Buka detail pegawai, lalu klik **Akhiri Kepegawaian**.
2. Isi **Tanggal Berakhir**, lalu klik **Simpan**.
3. Untuk pegawai yang kembali bekerja, buka detailnya lalu klik **Aktifkan Kembali**.

**Hasilnya:** riwayat terakhir ditutup pada tanggal berakhir. Data pegawai di Data Master tidak ikut diubah.

### Mencatat riwayat pendidikan
1. Buka detail pegawai. Di bagian **Pendidikan**, klik **Tambah**.
2. Pilih **Jenjang**, lalu isi **Tahun Lulus**, **Institusi**, dan **Bidang Studi**.
3. Klik **Simpan**. Gunakan **Ubah** atau **Hapus** pada baris pendidikan untuk memperbaikinya.

### Menautkan akun login pegawai
1. Buka detail pegawai. Di bagian **Akun Login Tertaut**, isi **Username akun (faskes ini)**.
2. Klik **Tautkan**. Untuk melepasnya, klik **Lepas**.

**Hasilnya:** akun login tertaut ke data pegawai. Tautan ini disiapkan untuk layanan mandiri pegawai pada tahap berikutnya.

### Mencatat dan memverifikasi kredensial (STR, SIP, sertifikat)
1. Buka **HR / SDM › Kredensial**, atau klik **Lihat Kredensial** di detail pegawai.
2. Klik **Catat Kredensial**, pilih **Pegawai (Datamaster, aktif)** dan **Jenis Kredensial**, lalu isi **Nomor**, **Penerbit**, **Berlaku Mulai / Tanggal Terbit**, **Berlaku Sampai (kosong = tanpa batas)**, dan **Uraian / Rincian Kewenangan**.
3. Klik **Simpan**.
4. Petugas berizin VERIFIKASI membuka kredensial, mengisi **Catatan verifikasi (wajib bila ditolak)**, lalu klik **Terverifikasi** atau **Tolak**.

**Hasilnya:** kredensial tampil dengan **Masa Berlaku** dan status verifikasi. Data kredensial di sini sama dengan **Mutu & Akreditasi › Kredensial Staf**, jadi cukup dicatat sekali. Lihat juga [Mutu & Akreditasi](./mutu.md).

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Kepegawaian sudah berakhir; aktifkan kembali sebelum mencatat perubahan | Pegawai sudah diakhiri kepegawaiannya. | Klik **Aktifkan Kembali** dulu. |
| Tidak ada perubahan yang disimpan | Isian perubahan sama dengan data sebelumnya. | Ubah minimal satu isian. |
| Catat perubahan status/unit/jabatan/golongan dan pengakhiran kepegawaian secara terpisah | Perubahan data dan pengakhiran dikirim bersamaan. | Simpan perubahan dulu, lalu akhiri kepegawaian. |
| Unit kerja tidak ditemukan di faskes ini | Unit kerja yang dipilih tidak valid. | Pilih unit lain, atau minta admin memeriksa **Datamaster › Lokasi**. |
| Akun pengguna tidak ditemukan di faskes ini | Username salah atau bukan akun faskes ini. | Periksa username di **Datamaster › User**. |
| Pegawai ini sudah memiliki akun tertaut; lepas tautan lama terlebih dahulu | Pegawai sudah tertaut ke akun lain. | Klik **Lepas**, lalu tautkan akun baru. |

## Pertanyaan yang sering diajukan
**Pegawai baru tidak muncul di pilihan "Pegawai".** Pilihan hanya berisi pegawai aktif di Data Master yang belum punya catatan kepegawaian. Tambahkan atau aktifkan pegawai di **Datamaster › Pegawai**.

**Apakah riwayat lama hilang saat jabatan berubah?** Tidak. Setiap perubahan dicatat sebagai riwayat baru dengan tanggal berlaku.

**Di mana jadwal dinas, cuti, dan penggajian?** Jadwal dinas tersedia melalui fitur **Jadwal Dinas**, dan penggajian dasar melalui menu HR / SDM sesuai izin dan aktivasi fitur. Kehadiran dan cuti menyusul.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **HR / SDM**, fitur **Kepegawaian** dan **Kredensial Pegawai**).
- Peran belum punya izin: admin › **Datamaster › Role** (modul izin **HR / SDM**).
- Menu atas penuh: buka tombol **Lainnya** di menu atas.

## Catatan untuk peninjau
- Langkah membuka detail kredensial dan tombol verifikasinya ditulis dari kode (halaman yang sama dengan Mutu › Kredensial Staf) dan perlu dicoba di layar.
- Izin UNGGAH DOKUMEN dan CABUT ada di daftar izin, tetapi langkah unggah berkas dan pencabutan kredensial belum dirinci di panduan ini.
- Peringatan kredensial yang akan kedaluwarsa (90/30 hari, menurut dokumentasi situs) belum diverifikasi tampilannya di layar.


## Penggajian dasar

1. Aktifkan fitur Penggajian serta Jurnal dan Remunerasi Akuntansi melalui Manajemen Modul. Berikan izin setiap petugas melalui **Setting › Hak Akses**; admin faskes tidak mendapat izin gaji otomatis.
2. Di **Komponen Penggajian**, catat komponen, skala gaji berdasarkan golongan/masa kerja, dan penetapan pegawai yang sudah tertaut SDM. Isi masa berlaku; akhir berlaku tidak termasuk dalam rentang.
3. Di **Konfigurasi Penggajian**, masukkan aturan dan kasus uji dari keuangan, profil pegawai, serta kebijakan tanggal acuan dan sumber yang belum tersedia. Pengesah wajib berbeda dari pembuat. Tidak tersedia tarif BPJS/PPh 21 bawaan. Lihat [format konfigurasi](../penggajian-teknis.md).
4. Buka **Periode Penggajian** dengan konfigurasi disahkan dan referensi periode Remunerasi final pada bulan yang sama. Seluruh jaspel sumber harus dapat dipetakan ke pegawai SDM. Kehadiran belum digunakan; kebijakan melewatinya wajib disahkan.
5. Jalankan **Hitung ulang** dan tangani semua pengecualian. Ajukan verifikasi. Verifikator berbeda dari penghitung, dan penyetuju berbeda dari keduanya. Pengembalian/penolakan memerlukan alasan.
6. Nominal dikunci setelah persetujuan. Siapkan ekspor bank melalui **Rekap Penggajian** jika format bank telah disahkan dan seluruh rekening terverifikasi. Unduhan berisi data rahasia; proses ini tidak mengirim instruksi transfer bank.
7. Sesudah pembayaran dilakukan sesuai proses faskes, petugas berizin mencatat tanggal dan referensi transfer. Jika jurnal tertahan/gagal, catatan pembayaran tetap ada; lengkapi kesiapan Akuntansi lalu gunakan **Ulangi jurnal**.
8. Pegawai membuka **Slip Penggajian** untuk melihat dan mencetak slipnya sendiri setelah pembayaran dan jurnal berhasil. Jangan menyimpan slip pada perangkat bersama.

Jasa pelayanan yang sudah dicadangkan penggajian tidak dapat dibayar lagi secara mandiri di Remunerasi. Pembatalan draf beralasan melepaskan reservasinya. Koreksi hasil terkunci dicatat di periode bulan berikutnya, dengan referensi hasil asal dan alasan; hasil lama tetap dipertahankan.

Metode yang didukung saat ini adalah periodik dengan tanggal acuan yang disahkan. Kebutuhan prorata, rekonsiliasi pajak tahunan, atau format bank selain CSV belum dapat diproses. Jangan memakai konfigurasi periodik untuk kebutuhan yang belum didukung.

## Jadwal Dinas (STD-0038)

### Persiapan

1. Aktifkan modul **HR / SDM** dan fitur **Jadwal Dinas** melalui Manajemen Modul.
2. Berikan izin **Pola Shift**, **Jadwal Dinas**, **Persetujuan Jadwal**, **Jadwal Saya**, atau **Tukar Dinas** sesuai tugas melalui editor Hak Akses. Tambahan izin otomatis hanya untuk super admin; peran lain diberikan manual.
3. Super admin membuka **Pola Shift**, memilih unit, lalu mengisi **Kewenangan unit** untuk akun dalam faskes aktif: lihat, susun, setujui, terbitkan, dan putuskan tukar. Kewenangan tindakan juga diperlukan oleh super admin. Awal tanggal batas akhir sudah tidak termasuk masa kewenangan.
4. Penyusun membuat pola shift unit, termasuk pola libur. Jam diisi dalam menit sejak 00.00 WIB, misalnya 07.00 = 420. Untuk 22.00–06.00, gunakan 1320 dan 360 serta centang **Lintas tengah malam**. Pola libur menggunakan jam nol dan tidak dihitung sebagai waktu kerja.
5. Isi aturan unit: istirahat minimum, batas menit kerja mingguan, minggu kalender Senin–Senin atau tujuh hari dari jangkar, serta tingkat setiap aturan. Tidak ada batas jam kerja mingguan yang ditetapkan otomatis. Kebutuhan staf dapat diatur per hari atau tanggal khusus; tanggal khusus mengganti aturan hari biasa. Tetapkan pejabat penyetuju sebelum mengajukan jadwal.

Pegawai harus sudah tertaut di Kepegawaian SDM. Kelayakan mengikuti riwayat unit dan status pada tanggal shift, termasuk berakhirnya masa kerja; identitas pegawai baru tidak dibuat di penjadwalan.

### Menyusun dan menerbitkan

1. Buka **Jadwal Dinas**, pilih unit dan bulan, lalu **Buat draf**.
2. Isi tabel pegawai × tanggal, lalu **Simpan perubahan**. Warna latar sel menandai perubahan lokal. Penghapusan sel hanya diperbolehkan pada draf.
3. Untuk salinan bulan lalu atau rotasi, pilih sumber dan gunakan **Pratinjau**. Periksa tanggal, pegawai, atau pola yang dilewati sebelum menerapkan. Offset rotasi dihitung dari tanggal jangkar. Tanggal tambahan bulan tujuan tetap kosong.
4. Periksa hasil validasi. Klik temuan untuk menuju sel terkait. Benturan waktu selalu menolak penyimpanan. Pemblokir lain dapat tersimpan dalam draf, tetapi harus diperbaiki sebelum pengajuan, persetujuan, dan penerbitan. Peringatan tetap dicatat.
5. Pilih **Ajukan** pada versi yang ditinjau. Pejabat unit yang berbeda dari pengaju kemudian memilih **Setujui** atau **Tolak** dengan alasan. Akun berkewenangan terbit menerbitkan versi yang telah disetujui.
6. Bila aturan berubah setelah pengajuan atau persetujuan, kembalikan versi ke draf melalui penolakan beralasan untuk diperiksa dan diajukan ulang.
7. Untuk perubahan jadwal terbit, pilih **Buat revisi** dan isi alasan. Versi lama tetap efektif sampai revisi diterbitkan. Hanya satu versi kerja diperbolehkan dalam satu keluarga jadwal.

Jika muncul konflik versi, muat ulang dan tinjau kembali. Perubahan lokal tidak dikirim ulang secara otomatis. Simpan perubahan sebelum beralih versi atau memuat ulang.

### Jadwal sendiri dan tukar dinas

**Jadwal Saya** menampilkan jadwal terbit melalui tautan akun sendiri, tanpa pilihan identitas pegawai lain. Pilih shift kerja yang belum dimulai, pilih shift pegawai pengganti dalam unit yang sama, isi alasan, lalu kirim permohonan.

Pengajuan merupakan pernyataan kehendak pemohon. Pengganti memberikan tanggapan melalui **Tukar Dinas**. Penolakan wajib beralasan; pemohon dapat membatalkan sebelum keputusan kepala ruangan. Kepala ruangan berwenang yang bukan peserta pertukaran memutuskan permohonan setelah pengganti menyatakan setuju.

Sistem memvalidasi ulang kedua pegawai, termasuk penugasan lintas unit dan bulan. Pertukaran membuat versi terbit pengganti; versi lama dan keputusan tetap tersimpan. Sel libur yang ditempati shift pertukaran dipindahkan kepada pegawai yang menyerahkan shift pada tanggal tersebut. Shift kerja lain pada sel tujuan memblokir pertukaran. Revisi yang sedang berjalan atau perubahan versi aktif mengharuskan permohonan ditinjau kembali.

### Ekspor dan cetak

Pada versi terbit yang efektif, pilih **Siapkan ekspor** atau **Siapkan cetak** sesuai izin. Tinjau keluaran, lalu unduh CSV atau cetak. Keluaran mencantumkan versi dan waktu WIB serta dicatat dalam riwayat. CSV melindungi sel yang dapat dibaca sebagai rumus.

Integrasi awal hanya menyediakan pembacaan jadwal terbit berizin. Presensi, cuti, penggajian, dan alur layanan klinis belum diubah oleh fitur ini.
