# SATUSEHAT

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas admin sistem/IT faskes dan petugas rekam medis sebelum dipakai Helpdesk.

**Dipakai oleh:** admin sistem faskes, petugas rekam medis yang memantau pengiriman data
**Menu:** Setting › Konfigurasi Integrasi › SATUSEHAT (kartu **Konfigurasi SATUSEHAT** dan **Sinkronisasi SATUSEHAT**)
**Hak akses yang dibutuhkan:** Setting › Konfigurasi Integrasi › READ (melihat), UPDATE KONFIGURASI SATUSEHAT (mengubah)

## Untuk apa
OpenSIMRS mengirim data kunjungan rawat jalan yang sudah selesai ke platform SATUSEHAT Kementerian Kesehatan. Data yang dikirim meliputi kunjungan, diagnosis ICD-10, dan tanda vital. Pengiriman berjalan otomatis di latar belakang. Petugas cukup memasang kredensial faskes sekali, lalu memantau kunjungan yang gagal terkirim dan memperbaiki datanya.

## Tugas sehari-hari

### Membuka halaman SATUSEHAT
1. Klik foto/nama profil di kanan atas, lalu klik **Setting**.
2. Di menu samping, buka **Konfigurasi Integrasi**, lalu pilih **SATUSEHAT**.
3. Halaman **Konfigurasi Integrasi › SATUSEHAT** menampilkan kartu **Konfigurasi SATUSEHAT** dan **Sinkronisasi SATUSEHAT**.

**Hasilnya:** tampil Organization ID dan Client ID faskes. Client Secret hanya tampil sebagian (empat karakter terakhir), disertai ringkasan pengiriman.

### Mengisi atau mengubah pengaturan koneksi
1. Di kartu **Konfigurasi SATUSEHAT**, klik **Edit**.
2. Nyalakan sakelar **Status**. Kolom isian hanya bisa diisi bila Status menyala.
3. Isi **Organization ID**, **Client ID**, dan **Client Secret** sesuai data dari portal SATUSEHAT milik faskes Anda.
4. Klik **Simpan**. Untuk mengembalikan isian ke kondisi awal, klik **Reset**. Untuk keluar tanpa menyimpan, klik **Batal Edit**.

**Hasilnya:** di kartu **Sinkronisasi SATUSEHAT** muncul label **Integrasi aktif**. Bila salah satu kolom kosong, muncul label **Kredensial belum lengkap**.

> Kredensial bersifat rahasia. Jangan mengirimkannya lewat chat, email, atau tangkapan layar. Bila kredensial bocor, minta yang baru di portal SATUSEHAT lalu perbarui di sini.

### Menguji koneksi
1. Di kartu **Sinkronisasi SATUSEHAT**, klik **Uji Koneksi**.

**Hasilnya:** muncul pesan **Koneksi SATUSEHAT berhasil** beserta nama dan ID organisasi serta lingkungan (mis. development atau production). Bila gagal, muncul **Uji koneksi gagal** dengan keterangan penyebabnya.

### Memantau status pengiriman kunjungan
1. Di kartu **Sinkronisasi SATUSEHAT**, lihat ringkasan: **Terkirim**, **Gagal**, **Belum dikirim**, dan keterangan jadwal pengiriman otomatis.
2. Untuk mencari kunjungan tertentu, ketik nama pasien, No. RM, atau No. Pelayanan di kolom **Cari**, lalu klik **Cari**.
3. Untuk melihat kunjungan yang bermasalah saja, pilih **Status** › **Gagal**.

**Hasilnya:** tabel menampilkan kunjungan rawat jalan yang sudah selesai.
- **Terkirim**: kolom **Keterangan** berisi nomor Encounter dan waktu kirim.
- **Gagal**: kolom **Keterangan** berisi penyebab kegagalan dan jumlah percobaan.
- **Belum dikirim**: kunjungan belum diproses.

### Mengirim ulang kunjungan yang gagal
1. Baca penyebab di kolom **Keterangan**, lalu perbaiki datanya terlebih dahulu (lihat tabel pesan galat di bawah).
2. Klik **Kirim Ulang** pada baris kunjungan tersebut. Untuk kunjungan berstatus Belum dikirim, tombolnya bernama **Kirim**.

**Hasilnya:** status berubah menjadi **Terkirim**, atau tetap **Gagal** dengan keterangan baru.

### Mengirim semua kunjungan yang tertunda sekarang
1. Di kartu **Sinkronisasi SATUSEHAT**, klik **Kirim Sekarang**. Tombol ini hanya aktif bila integrasi aktif.

**Hasilnya:** muncul pesan **Sinkronisasi selesai** berisi jumlah kunjungan yang diproses, terkirim, dan gagal.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Konfigurasi SATUSEHAT (Client ID, Client Secret, Organization ID) belum lengkap | Ada kredensial yang kosong. | Lengkapi di kartu **Konfigurasi SATUSEHAT**. |
| Client ID / Client Secret SATUSEHAT ditolak | Kredensial salah atau sudah diganti. | Cocokkan dengan portal SATUSEHAT, lalu simpan ulang. |
| Gagal mengambil token SATUSEHAT: … | Server SATUSEHAT tidak dapat dihubungi. | Coba lagi nanti; bila berulang, hubungi admin sistem. |
| Kunjungan belum selesai (discharge) | Pemeriksaan pasien belum diselesaikan dokter. | Selesaikan kunjungan di Rawat Jalan. |
| Diagnosis ICD-10 belum diisi di rekam medis | Diagnosis belum diisi. | Minta dokter melengkapi diagnosis di rekam medis, lalu **Kirim Ulang**. |
| Pasien … tidak memiliki NIK 16 digit | Identitas pasien bukan KTP atau NIK tidak 16 digit. | Perbaiki identitas pasien di **Admisi › Data Pasien**. |
| NIK pasien … belum terdaftar di SATUSEHAT | NIK tidak ditemukan di SATUSEHAT. | Periksa kebenaran NIK. Bila sudah benar, pasien belum terdaftar di SATUSEHAT. |
| Dokter … belum memiliki NIK 16 digit di data pegawai | NIK dokter kosong atau salah. | Lengkapi NIK di **Datamaster › Pegawai**. |
| NIK dokter … belum terdaftar sebagai Practitioner di SATUSEHAT | Dokter belum terdaftar sebagai tenaga kesehatan di SATUSEHAT. | Periksa NIK dokter dan pendaftarannya di SATUSEHAT. |
| Lokasi (poli) kunjungan tidak ditemukan | Data poli kunjungan tidak ada. | Periksa data poli di **Datamaster › Lokasi**. |
| Layanan integrasi SATUSEHAT tidak dapat dihubungi. Hubungi administrator sistem. | Layanan SATUSEHAT di server OpenSIMRS tidak berjalan. | Hubungi admin sistem/IT. |

## Pertanyaan yang sering diajukan
**Apakah petugas harus menekan tombol kirim setiap hari?** Tidak. Bila integrasi aktif, kunjungan dikirim otomatis secara berkala. Jadwalnya tertera di ringkasan, misalnya "Pengiriman otomatis tiap 15 menit (7 hari terakhir)". Tombol **Kirim Sekarang** hanya untuk mempercepat.

**Kunjungan apa saja yang dikirim?** Saat ini hanya kunjungan rawat jalan yang sudah selesai.

**Kenapa kunjungan yang gagal tidak lagi dicoba otomatis?** Pengiriman otomatis berhenti setelah beberapa kali gagal dan hanya menjangkau kunjungan beberapa hari terakhir. Perbaiki datanya, lalu klik **Kirim Ulang** secara manual.

**Apakah kunjungan yang sudah terkirim bisa dikirim ulang?** Tidak. Kunjungan berstatus Terkirim tidak dikirim ulang agar tidak terjadi data ganda di SATUSEHAT.

**Apa arti label "(simulasi)" atau "mode simulasi"?** Server OpenSIMRS sedang memakai mode uji, sehingga data tidak benar-benar dikirim ke SATUSEHAT. Hubungi admin sistem bila ini terjadi di server produksi.

**Di mana melihat ID SATUSEHAT pasien, dokter, atau poli?** Di **Admisi › Data Pasien** (ID SATUSEHAT), **Datamaster › Praktisi**, dan **Datamaster › Lokasi** (ID SATUSEHAT dan Status SATUSEHAT). ID terisi otomatis setelah kunjungan pertama berhasil dikirim.

## Bila menu tidak muncul
- SATUSEHAT adalah modul inti dan selalu aktif. Bila kartu SATUSEHAT tidak tampil, periksa izin peran.
- Peran belum punya izin: admin › **Datamaster › Role** (Setting › Konfigurasi Integrasi).
- Tombol **Setting** tidak ada di menu profil: hubungi admin untuk memeriksa peran Anda.

## Catatan untuk peninjau
- Belum dipastikan apakah tombol **Edit** pada kartu Konfigurasi SATUSEHAT disembunyikan bagi peran tanpa izin UPDATE KONFIGURASI SATUSEHAT. Di kode kartu, tombol itu tidak diberi pengecekan izin.
- Nilai jadwal otomatis (15 menit, 7 hari terakhir, maksimal 5 percobaan) adalah nilai bawaan dan bisa diubah admin server. Panduan sengaja merujuk ke teks ringkasan di layar.
- Isi data yang dikirim (Encounter, diagnosis, tanda vital) disimpulkan dari kode `satusehat-service`. Mohon dikonfirmasi apakah perlu dijelaskan lebih rinci kepada petugas.
- Kartu Sinkronisasi hanya menampilkan kunjungan rawat jalan. Pengiriman IGD/rawat inap belum terlihat di kode.
