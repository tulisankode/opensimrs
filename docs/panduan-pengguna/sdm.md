# HR / SDM

> Draf disusun AI dari kode aplikasi pada 2026-10-19 — wajib ditinjau petugas kepegawaian/SDM faskes sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas kepegawaian/SDM, kepala unit, tim kredensial
**Menu:** HR / SDM › Kepegawaian · Kredensial
**Hak akses yang dibutuhkan:**
- HR / SDM › Kepegawaian › READ, CREATE, UPDATE, DELETE, TAUTKAN AKUN
- HR / SDM › Kredensial › READ, CREATE, UPDATE, UNGGAH DOKUMEN, VERIFIKASI, CABUT, DELETE

## Untuk apa
Modul ini mencatat data kepegawaian (status, unit kerja, jabatan, golongan, pendidikan) untuk pegawai yang sudah terdaftar di **Datamaster › Pegawai**, beserta riwayat perubahannya. Modul ini juga mencatat kredensial pegawai seperti STR dan SIP. Data pribadi pegawai (mis. NIK dan tanggal lahir) tetap dikelola di Data Master dan tidak ditampilkan di sini.

Fitur **Kepegawaian** selalu aktif bila modul aktif. **Kredensial Pegawai** dapat diaktifkan terpisah. Jadwal dinas, kehadiran/cuti, pelatihan, dan penggajian masih dalam pengembangan dan belum tampil sebagai menu.

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

**Di mana jadwal dinas, cuti, dan penggajian?** Fitur tersebut masih dalam pengembangan dan belum tersedia.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **HR / SDM**, fitur **Kepegawaian** dan **Kredensial Pegawai**).
- Peran belum punya izin: admin › **Datamaster › Role** (modul izin **HR / SDM**).
- Menu atas penuh: buka tombol **Lainnya** di menu atas.

## Catatan untuk peninjau
- Langkah membuka detail kredensial dan tombol verifikasinya ditulis dari kode (halaman yang sama dengan Mutu › Kredensial Staf) dan perlu dicoba di layar.
- Izin UNGGAH DOKUMEN dan CABUT ada di daftar izin, tetapi langkah unggah berkas dan pencabutan kredensial belum dirinci di panduan ini.
- Peringatan kredensial yang akan kedaluwarsa (90/30 hari, menurut dokumentasi situs) belum diverifikasi tampilannya di layar.
