# BPJS FKTP (PCare)

> Draf disusun AI dari kode aplikasi pada 2026-10-16 — wajib ditinjau petugas admin BPJS/pendaftaran di FKTP (klinik pratama, puskesmas) sebelum dipakai Helpdesk.

**Dipakai oleh:** admin BPJS faskes tingkat pertama, petugas pendaftaran
**Menu:** Setting › Konfigurasi Integrasi (kartu **Konfigurasi BPJS PCare (FKTP)**, **Pemetaan Poli & Dokter ke BPJS PCare**, **Sinkronisasi BPJS PCare**)
**Hak akses yang dibutuhkan:** Setting › Konfigurasi Integrasi › READ (lihat catatan untuk peninjau)

## Untuk apa
Bagi faskes tingkat pertama (FKTP), OpenSIMRS mengirim kunjungan pasien BPJS ke aplikasi PCare BPJS Kesehatan. Prosesnya dua tahap: **pendaftaran** saat pasien didaftarkan (BPJS memberi nomor urut), lalu **kunjungan** setelah pemeriksaan selesai (BPJS memberi nomor kunjungan). Pengiriman berjalan otomatis, jadi petugas tidak perlu mengetik ulang di aplikasi PCare.

## Tugas sehari-hari

### Mengisi konfigurasi PCare (sekali di awal)
1. Klik foto/nama profil di kanan atas › **Setting** › **Konfigurasi Integrasi**.
2. Di kartu **Konfigurasi BPJS PCare (FKTP)**, klik **Edit**.
3. Isi **Cons ID**, **Kode Provider (PPK)**, **Secret Key**, **User Key PCare**, **Username PCare**, **Password PCare**, dan **Kode Aplikasi** (bawaan `095`). Semua data ini diperoleh dari BPJS Kesehatan.
4. Ubah sakelar **Status** menjadi **Aktif**, lalu klik **Simpan**.

**Hasilnya:** muncul pesan **Konfigurasi PCare disimpan** dan label **PCare aktif**. Nilai rahasia tidak ditampilkan utuh. Saat mengedit lagi, biarkan kolom rahasia kosong bila tidak ingin mengubahnya.

### Menguji koneksi dan mengecek peserta JKN
1. Di kartu **Konfigurasi BPJS PCare (FKTP)**, klik **Uji Koneksi**.
2. Untuk mengecek kepesertaan, ketik nomor kartu (13 digit, contoh `0000000000000`) atau NIK (16 digit) di kolom **Cek Peserta JKN**, lalu klik **Cek**.

**Hasilnya:** uji koneksi menampilkan **Koneksi BPJS PCare berhasil** beserta jumlah poli FKTP yang terbaca. Cek peserta menampilkan Nama, No. Kartu, Status (AKTIF/TIDAK AKTIF), Jenis Peserta, Kelas, dan FKTP Terdaftar.

### Memetakan poli dan dokter ke kode PCare
1. Gulir ke kartu **Pemetaan Poli & Dokter ke BPJS PCare**.
2. Di tabel **Poli**, pilih **Kode Poli BPJS** untuk setiap poli OpenSIMRS yang melayani pasien BPJS.
3. Di tabel **Dokter**, pilih **Kode Dokter BPJS** untuk setiap dokter.
4. Klik **Simpan Pemetaan**. Bila daftar kode belum muncul, klik **Muat Ulang**.

**Hasilnya:** muncul pesan **Pemetaan PCare disimpan**. Poli atau dokter yang belum dipetakan tertulis **Belum dipetakan**, dan kunjungannya akan gagal dikirim.

### Mendaftarkan pasien BPJS agar ikut terkirim ke PCare
1. Daftarkan kunjungan pasien di **Admisi › Rawat Jalan** seperti biasa.
2. Pada pilihan cara bayar, pilih **ASURANSI**.
3. Pilih **Nama Penjamin** BPJS, lalu isi **No. Penjamin** dengan nomor kartu BPJS 13 digit.
4. Setelah dokter menyelesaikan pemeriksaan dan mengisi diagnosis ICD-10, kunjungan dikirim otomatis.

**Hasilnya:** kunjungan tampil di kartu **Sinkronisasi BPJS PCare**. Kolom **Pendaftaran** berisi nomor urut, dan kolom **Kunjungan** berisi nomor kunjungan setelah terkirim.

### Memantau dan mengirim ulang kunjungan
1. Di kartu **Sinkronisasi BPJS PCare**, cari dengan nama pasien, No. RM, No. kartu, atau No. pelayanan, lalu klik **Cari**.
2. Untuk melihat yang bermasalah saja, pilih **Status** › **Gagal**.
3. Baca penyebabnya di kolom **Keterangan**, lalu perbaiki datanya (lihat tabel pesan galat).
4. Klik **Kirim Ulang** pada baris tersebut, atau **Kirim** bila belum pernah dikirim.
5. Untuk memproses semua kunjungan yang tertunda sekaligus, klik **Kirim Sekarang**.

**Hasilnya:** muncul pesan berisi jumlah kunjungan yang diproses, berhasil, dan gagal. Status di kolom **Pendaftaran** dan **Kunjungan** berubah menjadi **Terkirim**.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Konfigurasi BPJS PCare belum lengkap (Cons ID, Secret Key, User Key, Username, Password, Kode Provider) | Ada isian konfigurasi yang kosong. | Lengkapi di kartu Konfigurasi BPJS PCare. |
| Data integrasi faskes belum ada; buka Setting › Konfigurasi Integrasi sekali dulu | Data integrasi faskes belum dibuat. | Buka halaman **Konfigurasi Integrasi**, lalu ulangi. |
| Respons BPJS tidak dapat didekripsi (periksa Cons ID / Secret Key) | Cons ID atau Secret Key salah. | Periksa kembali dengan data dari BPJS. |
| Gagal menghubungi BPJS PCare: … | Server BPJS tidak dapat dihubungi. | Coba lagi nanti. |
| Galat BPJS (kode …) | BPJS menolak permintaan; penjelasan dari BPJS tertera setelahnya. | Ikuti keterangan dari BPJS; bila tidak jelas, hubungi admin. |
| Nomor kartu BPJS (13 digit) atau NIK (16 digit) tidak valid | Nomor yang dicek salah panjang. | Periksa nomor kartu/NIK. |
| Peserta tidak ditemukan di BPJS | Nomor tidak terdaftar sebagai peserta JKN. | Periksa nomor, atau minta pasien memastikan kepesertaannya. |
| Kunjungan rawat jalan BPJS tidak ditemukan (pastikan penjamin BPJS) | Kunjungan tidak memakai penjamin BPJS. | Periksa penjamin kunjungan di Admisi. |
| Nomor kartu BPJS pasien tidak valid (…) | No. Penjamin kosong atau bukan 13 digit. | Perbaiki nomor kartu BPJS pasien. |
| Poli … belum dipetakan ke kode poli BPJS | Pemetaan poli belum diisi. | Isi di kartu **Pemetaan Poli & Dokter ke BPJS PCare**. |
| Dokter … belum memiliki kode dokter BPJS | Pemetaan dokter belum diisi. | Isi kode dokter di kartu pemetaan. |
| Diagnosis ICD-10 belum diisi di rekam medis | Diagnosis kosong. | Minta dokter melengkapi diagnosis, lalu **Kirim Ulang**. |
| Layanan integrasi BPJS tidak dapat dihubungi. Hubungi administrator sistem. | Layanan BPJS di server OpenSIMRS tidak berjalan. | Hubungi admin sistem/IT. |

## Pertanyaan yang sering diajukan
**Kapan data dikirim ke PCare?** Pendaftaran dikirim setelah kunjungan didaftarkan. Data kunjungan dikirim setelah pemeriksaan selesai. Pengiriman otomatis berjalan berkala untuk kunjungan beberapa hari terakhir.

**Kenapa kolom Kunjungan masih "Belum" padahal Pendaftaran sudah Terkirim?** Pemeriksaan pasien belum diselesaikan dokter. Data kunjungan baru dikirim setelah pemeriksaan selesai.

**Kunjungan gagal terus dan tidak dicoba otomatis lagi. Kenapa?** Pengiriman otomatis berhenti setelah beberapa kali gagal. Perbaiki datanya, lalu klik **Kirim Ulang**.

**Apa arti "(simulasi)" pada label Lingkungan?** Server memakai mode uji, sehingga data tidak benar-benar dikirim ke BPJS.

**Menu Rawat Jalan › BPJS (Monitoring Kunjungan dan lainnya) dipakai untuk apa?** Lihat catatan untuk peninjau. Untuk saat ini, pantau pengiriman lewat kartu **Sinkronisasi BPJS PCare**.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul BPJS FKTP (PCare)).
- Peran belum punya izin: admin › **Datamaster › Role** (Setting › Konfigurasi Integrasi).
- Kartu menampilkan "Layanan integrasi BPJS tidak dapat dihubungi": hubungi admin sistem.

## Catatan untuk peninjau
- Di daftar izin (`permission-list.js`) tidak ada aksi khusus untuk mengubah konfigurasi PCare (yang ada hanya UPDATE KONFIGURASI VCLAIM/SATUSEHAT/LAINNYA), dan tombol **Edit** kartu PCare tidak diberi pengecekan izin. Mohon tentukan izin yang dimaksud.
- Halaman **Rawat Jalan › BPJS › Monitoring Kunjungan / Monitoring Riwayat Kunjungan / Monitoring Obat Kunjungan** (juga di Rawat Inap dan IGD, izin BPJS-PCARE) tampaknya masih berisi data contoh statis, misalnya total data tetap. Halaman ini sengaja tidak dijadikan tugas.
- Langkah "Mendaftarkan pasien BPJS" disimpulkan dari kode: kunjungan dianggap BPJS bila nama penjamin diawali "BPJS", dan No. Penjamin dipakai sebagai nomor kartu. Mohon dicek dengan alur pendaftaran yang sebenarnya.
- Katalog modul menyebut "rujukan keluar, kapitasi" untuk modul ini, tetapi fitur tersebut tidak ditemukan di layar. Panduan hanya memuat konfigurasi, pemetaan, cek peserta, dan sinkronisasi pendaftaran/kunjungan.
- Kartu PCare berada di halaman Setting yang sama dengan VClaim; belum dicek apakah kartu disembunyikan saat modul BPJS FKTP nonaktif.
