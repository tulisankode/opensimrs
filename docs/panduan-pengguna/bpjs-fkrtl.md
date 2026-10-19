# BPJS FKRTL (VClaim/SEP)

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas admisi/BPJS rumah sakit sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas admisi/pendaftaran rumah sakit, petugas BPJS center, admin sistem (untuk konfigurasi)
**Menu:** Admisi › SEP › Rawat Jalan / Rawat Inap / IGD; Admisi › Rencana Kontrol & SPRI › Rencana Kontrol / SPRI; tombol **Rencana Kontrol BPJS** dan **SPRI BPJS** di rekam medis; Setting › Konfigurasi Integrasi › BPJS › BPJS VClaim (kartu **Konfigurasi BPJS VClaim (Rumah Sakit)** dan **Pemetaan Poli ke BPJS VClaim**)
**Hak akses yang dibutuhkan:** Admisi › SEP › READ, CREATE SEP, DELETE; Admisi › Rencana Kontrol & SPRI › READ, CREATE/UPDATE/DELETE RENCANA KONTROL, CREATE/UPDATE/DELETE SPRI, PILIH SURAT SEP; Setting › Konfigurasi Integrasi › READ, UPDATE KONFIGURASI VCLAIM

## Untuk apa
Bagi rumah sakit (FKRTL), setiap pelayanan pasien BPJS memerlukan Surat Eligibilitas Peserta (SEP). Modul ini menerbitkan SEP langsung ke VClaim BPJS Kesehatan dari OpenSIMRS. Petugas memilih peserta, rujukan, poli, dokter DPJP, dan diagnosis awal. SEP yang diterbitkan tersimpan di daftar dan bisa dihapus bila belum dipakai klaim. Bila fitur **Rencana Kontrol & SPRI** aktif, surat rencana kontrol dan SPRI (Surat Perintah Rawat Inap) BPJS juga dibuat dari OpenSIMRS lewat VClaim, lalu dipilih saat membuat SEP.

## Tugas sehari-hari

### Mengisi konfigurasi VClaim (sekali di awal)
1. Klik foto/nama profil di kanan atas › **Setting** › **Konfigurasi Integrasi** › **BPJS** › **BPJS VClaim**.
2. Di kartu **Konfigurasi BPJS VClaim (Rumah Sakit)**, klik **Edit**.
3. Isi **Cons ID**, **Kode PPK Rumah Sakit**, **Secret Key**, dan **User Key VClaim** sesuai data dari BPJS Kesehatan.
4. Ubah sakelar **Status** menjadi **Aktif**, lalu klik **Simpan**.
5. Klik **Uji Koneksi**.

**Hasilnya:** muncul pesan **Konfigurasi VClaim disimpan**, lalu **Koneksi BPJS VClaim berhasil** dengan kode PPK dan lingkungannya. Nilai rahasia tidak ditampilkan utuh. Saat mengedit lagi, biarkan kolom rahasia kosong bila tidak ingin mengubahnya.

### Memetakan poli ke kode poli VClaim
1. Di halaman yang sama, gulir ke kartu **Pemetaan Poli ke BPJS VClaim**.
2. Untuk setiap poli OpenSIMRS, pilih **Kode Poli VClaim** yang sesuai.
3. Klik **Simpan Pemetaan**. Bila daftar kode belum muncul, klik **Muat Ulang**.

**Hasilnya:** muncul pesan **Pemetaan poli VClaim disimpan**. Saat membuat SEP dari kunjungan pasien, poli tujuan terisi otomatis sesuai pemetaan.

### Membuat SEP rawat jalan
1. Buka **Admisi › SEP › Rawat Jalan**, lalu klik **Buat SEP**.
2. Di bagian **1. Peserta BPJS**, isi **Tanggal SEP** dan **No. Kartu / NIK** (contoh kartu `0000000000000`), lalu klik **Cari Peserta**.
3. Periksa data peserta: Nama, Status, Hak Kelas, Jenis Peserta, dan FKTP. Bila tertulis "Peserta tidak aktif", SEP tidak dapat dibuat.
4. Di bagian **2. Rujukan**, pilih satu rujukan aktif dari daftar (asal FKTP atau rumah sakit).
5. Di bagian **3. Data Pelayanan**:
   - Pilih **Pasien OpenSIMRS** dan, bila ada, **Kunjungan (30 hari terakhir)** supaya SEP terkait ke kunjungan.
   - Pilih **Poli Tujuan** dan **Dokter DPJP**.
   - Ketik kode atau nama diagnosis di **Cari Diagnosis (ICD-10)** (minimal 3 karakter), klik **Cari**, lalu pilih **Diagnosis Awal**.
   - Isi **No. Telepon** (contoh `080000000000`) dan **Catatan** bila perlu.
6. Klik **Buat SEP**.

**Hasilnya:** muncul pesan **SEP berhasil dibuat** dan jendela **Surat Eligibilitas Peserta** berisi No. SEP. SEP baru tampil di daftar.

### Membuat SEP IGD
1. Buka **Admisi › SEP › IGD**, lalu klik **Buat SEP**.
2. Cari peserta seperti pada SEP rawat jalan.
3. Di **2. Data Pelayanan**, **Poli Tujuan** sudah terisi otomatis "IGD – Instalasi Gawat Darurat" dan rujukan tidak diperlukan.
4. Pilih **Dokter DPJP** dan **Diagnosis Awal**, lalu klik **Buat SEP**.

**Hasilnya:** SEP IGD terbit dan tampil di daftar SEP BPJS · IGD.

### Membuat SEP rawat inap
1. Buka **Admisi › SEP › Rawat Inap**, lalu klik **Buat SEP**.
2. Cari peserta seperti pada SEP rawat jalan, lalu pilih **Pasien OpenSIMRS**.
3. Di **2. Data Pelayanan**:
   - Bila fitur **Rencana Kontrol & SPRI** aktif, pilih surat di kolom **SPRI**. Daftarnya berisi SPRI aktif milik pasien; bila hanya ada satu, surat itu terpilih otomatis. Bila belum ada, buat SPRI lebih dulu (lihat tugas berikut).
   - Bila fitur itu tidak aktif, ketik nomor surat di kolom **No. SPRI** (wajib).
   - Pilih **Spesialis DPJP**, **Dokter DPJP**, dan **Diagnosis Awal**.
4. Klik **Buat SEP**.

**Hasilnya:** SEP rawat inap terbit dan tampil di daftar SEP BPJS · Rawat Inap. SPRI yang dipakai berstatus **Sudah dipakai SEP**.

> Pada SEP rawat jalan, kolom **Rencana Kontrol (opsional)** muncul bila fitur **Rencana Kontrol & SPRI** aktif. Pilih surat rencana kontrol bila pasien datang untuk kontrol ulang.

### Membuat Rencana Kontrol atau SPRI BPJS dari rekam medis (dokter/perawat)
Tombolnya tampil bila modul BPJS FKRTL dan fitur **Rencana Kontrol & SPRI** aktif, serta pengguna punya izin CREATE RENCANA KONTROL atau CREATE SPRI.
1. Buka rekam medis pasien, lalu buka tab **Resume & Discharge**.
2. Klik **Rencana Kontrol BPJS** (rawat jalan dan rawat inap) atau **SPRI BPJS** (rawat jalan dan IGD).
3. Nomor kartu BPJS terisi dari data penjamin pasien dan peserta dicari otomatis. Bila belum, isi **No. Kartu BPJS** (13 digit), lalu klik **Cari Peserta**.
4. Periksa **Pasien OpenSIMRS**, **Asal Pelayanan**, dan **Kunjungan Asal**.
5. Isi **Tanggal Rencana Kontrol** atau **Tanggal Rencana Rawat Inap** (tidak boleh sebelum hari ini). Pilih **Poli Tujuan** atau **Spesialis/Poli DPJP**, lalu **Dokter DPJP (jadwal BPJS)**. Hanya dokter yang berjadwal BPJS pada tanggal itu yang bisa dipilih.
6. Untuk rencana kontrol, pilih **SEP Kunjungan Asal** bila ada.
7. Klik **Buat Rencana Kontrol** atau **Buat SPRI**.

**Hasilnya:** surat terbit di VClaim dan nomornya tampil di pesan berhasil. Surat tercatat di **Admisi › Rencana Kontrol & SPRI**.

### Mengelola Rencana Kontrol dan SPRI (petugas admisi)
1. Buka **Admisi › Rencana Kontrol & SPRI**, lalu pilih **Rencana Kontrol** atau **SPRI**.
2. Saring dengan **Cari** (no. surat, kartu, RM, atau nama pasien), **Status**, **Rencana dari**, dan **Sampai**, lalu klik **Cari**.
3. Untuk membuat surat baru, klik **Buat Rencana Kontrol** atau **Buat SPRI**, lalu isi formulirnya seperti pada tugas sebelumnya.
4. Pada baris surat tersedia tombol berikut:
   - **Cetak**: mencetak surat yang sudah bernomor;
   - **Ubah**: mengubah tanggal rencana, poli, atau DPJP pada surat berstatus **Aktif** atau **Jatuh tempo**, lalu klik **Simpan Perubahan**;
   - **Hapus**: menghapus surat di VClaim. Surat yang sudah dipakai SEP tidak dapat dihapus;
   - **Cek status di VClaim**: muncul bila hasil pengiriman surat tidak pasti. Bila VClaim mencatat beberapa surat yang cocok, pilih nomor yang benar di jendela **Pilih surat yang cocok di VClaim**.

**Hasilnya:** kolom **Dipakai SEP** menunjukkan apakah surat sudah dipakai SEP. Status surat: **Aktif**, **Jatuh tempo**, **Sudah dipakai SEP**, **Diajukan**, **Gagal**, **Tidak pasti**, atau **Dihapus**.

### Mencari dan melihat detail SEP
1. Buka **Admisi › SEP**, lalu pilih jenis pelayanan (**Rawat Jalan**, **Rawat Inap**, atau **IGD**).
2. Ketik No. SEP, No. kartu, No. RM, atau nama pasien di kolom **Cari**. Pilih **Status**: **Aktif**, **Dihapus**, atau **Semua**. Klik **Cari**.
3. Klik **Detail** pada baris SEP.

**Hasilnya:** tampil jendela **Surat Eligibilitas Peserta** berisi No. SEP, tanggal, jenis pelayanan, peserta, hak kelas, poli, diagnosis, rujukan, dan catatan.

### Menghapus SEP
1. Di daftar SEP, klik **Hapus** pada baris SEP berstatus aktif.
2. Baca konfirmasinya, lalu klik **Hapus SEP**.

**Hasilnya:** muncul pesan **SEP dihapus** dan SEP diberi label **Dihapus**. SEP yang sudah dipakai untuk klaim tidak dapat dihapus, dan BPJS akan menolaknya.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Lengkapi Cons ID, Secret Key, User Key dan Kode PPK di Setting › Konfigurasi Integrasi › BPJS VClaim sebelum membuat SEP. | Konfigurasi VClaim belum lengkap, sehingga tombol **Buat SEP** nonaktif. | Minta admin melengkapi konfigurasi. |
| Konfigurasi BPJS VClaim belum lengkap (Cons ID, Secret Key, User Key, Kode PPK) | Sama seperti di atas. | Lengkapi konfigurasi VClaim. |
| Data integrasi faskes belum ada; buka Setting › Konfigurasi Integrasi sekali dulu | Data integrasi faskes belum dibuat. | Buka halaman **Konfigurasi Integrasi**, lalu ulangi. |
| Nomor kartu BPJS (13 digit) atau NIK (16 digit) tidak valid | Nomor yang dicari salah panjang. | Periksa nomor kartu/NIK. |
| Peserta tidak ditemukan di BPJS | Nomor tidak terdaftar. | Periksa nomor atau minta pasien memastikan kepesertaannya. |
| Peserta tidak aktif. BPJS akan menolak penerbitan SEP. | Kepesertaan JKN tidak aktif. | Arahkan pasien ke BPJS Kesehatan atau proses sebagai pasien umum sesuai kebijakan RS. |
| Tidak ada rujukan aktif untuk peserta ini. | Peserta tidak punya rujukan yang masih berlaku. | Minta pasien membawa rujukan dari FKTP atau rumah sakit perujuk. |
| Nomor rujukan wajib dipilih untuk rawat jalan | Rujukan belum dipilih. | Pilih rujukan di bagian **2. Rujukan**. |
| Poli tujuan wajib diisi untuk rawat jalan | Poli belum dipilih. | Pilih **Poli Tujuan**. |
| Nomor SPRI wajib diisi untuk rawat inap | No. SPRI kosong. | Isi **No. SPRI**, atau pilih surat di kolom **SPRI**. |
| Belum ada SPRI aktif untuk pasien ini. Buat SPRI di Admisi › Rencana Kontrol & SPRI atau dari rekam medis rawat jalan/IGD. | Pasien belum punya SPRI BPJS yang aktif. | Minta dokter membuat SPRI dari rekam medis, atau buat di **Admisi › Rencana Kontrol & SPRI**. |
| Lengkapi Cons ID, Secret Key, User Key dan Kode PPK di Setting › Konfigurasi Integrasi › BPJS VClaim sebelum membuat surat. | Konfigurasi VClaim belum lengkap, sehingga tombol buat surat nonaktif. | Minta admin melengkapi konfigurasi. |
| Nomor kartu BPJS harus 13 digit | Nomor kartu untuk surat tidak 13 digit. | Periksa nomor kartu. |
| Tanggal rencana tidak boleh sebelum hari ini. | Tanggal rencana kontrol atau rawat inap sudah lewat. | Pilih tanggal hari ini atau sesudahnya. |
| Surat sudah dipakai pada SEP …; tidak dapat … | Surat sudah dipakai untuk SEP. | Surat tidak bisa diubah atau dihapus lagi. |
| Fitur Rencana Kontrol & SPRI belum diaktifkan untuk faskes ini | Fitur belum aktif. | Minta superadmin mengaktifkannya di **Setting › Manajemen Modul**. |
| Dokter DPJP wajib dipilih | DPJP belum dipilih. | Pilih **Dokter DPJP**. |
| Diagnosis awal wajib diisi | Diagnosis awal kosong. | Cari dan pilih **Diagnosis Awal**. |
| Ketik minimal 3 karakter kode atau nama diagnosis | Kata kunci diagnosis terlalu pendek. | Ketik minimal 3 karakter. |
| Galat BPJS VClaim (kode …) | BPJS menolak permintaan; penjelasan dari BPJS tertera setelahnya. | Ikuti keterangan dari BPJS. |
| Gagal menghubungi BPJS VClaim: … | Server BPJS tidak dapat dihubungi. | Coba lagi nanti. |
| Layanan integrasi BPJS tidak dapat dihubungi. Hubungi administrator sistem. | Layanan BPJS di server OpenSIMRS tidak berjalan. | Hubungi admin sistem/IT. |

## Pertanyaan yang sering diajukan
**Pilihan "Pasien OpenSIMRS" kosong ("Tidak ada pasien dengan kartu ini"). Kenapa?** Belum ada pasien di OpenSIMRS yang memiliki penjamin BPJS dengan nomor kartu tersebut. Periksa data penjamin pasien di Admisi. SEP tetap bisa dibuat, tetapi tidak terkait ke pasien.

**Apakah SEP harus dikaitkan ke kunjungan?** Tidak wajib. Pilihan **Kunjungan (30 hari terakhir)** bersifat opsional. Bila dipilih, poli dan dokter DPJP terisi otomatis dari kunjungan tersebut.

**SEP yang terhapus masih tampil di daftar?** Ya, bila **Status** diatur ke **Dihapus** atau **Semua**. Daftar bawaan hanya menampilkan SEP aktif.

**Daftar SEP kosong padahal pasien sudah punya SEP.** Daftar hanya memuat SEP yang dibuat dari OpenSIMRS. SEP yang dibuat langsung di aplikasi VClaim tidak tampil.

**Apa arti label "VClaim development" atau "(simulasi)"?** Server terhubung ke lingkungan uji BPJS atau mode simulasi. SEP yang terbit bukan SEP resmi. Hubungi admin bila ini terjadi di server produksi.

**Bisakah membuat surat kontrol atau SPRI dari OpenSIMRS?** Bisa, bila fitur **Rencana Kontrol & SPRI** aktif. Dokter membuatnya dari tab **Resume & Discharge** di rekam medis, atau petugas membuatnya di **Admisi › Rencana Kontrol & SPRI**.

**Apa beda SPRI BPJS dengan Surat Permohonan Rawat Inap di tab Cetak Hasil & Surat?** **SPRI BPJS** adalah surat VClaim untuk menerbitkan SEP rawat inap. **Surat Permohonan Rawat Inap (SPRI)** di tab **Cetak Hasil & Surat** adalah surat internal yang membuat kunjungan rawat inap di OpenSIMRS (lihat panduan [Rawat Inap](./rawat-inap.md)). Pasien BPJS yang dirawat umumnya memerlukan keduanya.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul BPJS FKRTL (VClaim/SEP)).
- Peran belum punya izin: admin › **Datamaster › Role** (Admisi › SEP, dan Setting › Konfigurasi Integrasi untuk konfigurasi).
- Tombol **Buat SEP** abu-abu: konfigurasi VClaim belum lengkap (lihat pesan kuning di atas daftar).
- Menu **Rencana Kontrol & SPRI** atau tombol **Rencana Kontrol BPJS**/**SPRI BPJS** tidak ada: fitur **Rencana Kontrol & SPRI** di modul BPJS FKRTL belum aktif, atau peran belum punya izin **Admisi › Rencana Kontrol & SPRI**.

## Catatan untuk peninjau
- Rute `/admisi/sep/*` tidak memeriksa izin per aksi di sisi tampilan. Tombol **Buat SEP** dan **Hapus** tampil tanpa pengecekan izin CREATE SEP/DELETE. Izin "CREATE SEP MANUAL" dan "SIMPAN SEP MANUAL" ada di daftar izin, tetapi fitur SEP manual tidak ditemukan di layar.
- Cetak SEP tidak ditemukan di halaman SEP, yang hanya punya jendela Detail. Mohon dipastikan bagaimana petugas mencetak SEP. Cetak hanya tersedia untuk Rencana Kontrol dan SPRI.
- Surat internal "Surat Permohonan Rawat Inap (SPRI)" dan "SPRI BPJS" (Surat Perintah Rawat Inap) memakai singkatan yang sama dengan arti berbeda. Mohon dipastikan petugas tidak bingung.
- Di halaman **Rencana Kontrol & SPRI** tombol mengikuti izin, tetapi pengguna tanpa daftar izin (superadmin) melihat semua tombol. bpjs-service tetap memeriksa izin.
- Klaim INA-CBG dan rujukan masuk disebut di deskripsi katalog modul, tetapi tidak ditemukan di layar.
- Halaman **Rawat Jalan/Rawat Inap/IGD › BPJS › Monitoring …** tampaknya masih berisi data contoh statis, sehingga tidak dijadikan tugas.
- Pilihan **Dokter DPJP** diambil dari referensi VClaim berdasarkan poli/spesialis. Kode DPJP dari kunjungan memakai kode dokter BPJS di data praktisi, yang diisi lewat pemetaan dokter PCare. Mohon dicek apakah RS perlu mengisi pemetaan dokter tersebut.
