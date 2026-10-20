# Rawat Inap

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas rawat inap (perawat ruangan dan dokter DPJP) sebelum dipakai Helpdesk.

**Dipakai oleh:** perawat ruangan/bangsal, dokter DPJP, kepala ruangan
**Menu:** Rawat Inap › Ruang Rawatan, Rawat Inap › Perpindahan Bangsal
**Hak akses yang dibutuhkan:** Rawat Inap › Rawat Inap › READ (melihat pasien), Rawat Inap › Rawat Inap › BATAL DIRAWAT (membatalkan), Rawat Inap › Perpindahan Bangsal › SETUJU DAN TERIMA (menyetujui pindah), Rawat Inap › Detail Pasien › (Rekam Medis, Asesmen, SOAP Dokter, Alkes Dan Penunjang, Perpindahan, FPO, Resume Dan Dishcarge, Cetak Hasil Dan Surat) sesuai tugas

## Untuk apa
Modul ini dipakai untuk melayani pasien yang dirawat di bangsal. Di sini petugas melihat pasien per ruangan, mengisi rekam medis harian, mencatat pemberian obat, mengajukan dan menyetujui pindah bed atau ruangan, lalu memulangkan pasien. Biaya kamar ditagihkan otomatis saat pasien dipulangkan.

## Tugas sehari-hari

### Memahami alur penerimaan pasien
Pasien rawat inap tidak didaftarkan dari menu **Rawat Inap**, melainkan oleh petugas admisi di **Admisi › Rawat Inap**. Ada dua jalur:

**Lewat surat dari dokter (poli atau IGD):**
1. Dokter di poli (rawat jalan) atau IGD membuat **Surat Permohonan Rawat Inap (SPRI)** di rekam medis pasien (lihat tugas berikut).
2. Kunjungan rawat inap dibuat otomatis dengan status **WAITING**, lalu tampil di **Admisi › Rawat Inap**.
3. Petugas admisi membuka pasien itu, memilih ruangan dan bed, lalu menyimpan. Status pasien menjadi **DIRAWAT**.

**Langsung oleh admisi** (misalnya rawat inap terencana tanpa kunjungan poli): petugas admisi klik **Daftar Rawat Inap** di **Admisi › Rawat Inap**, mencari pasien yang sudah terdaftar, lalu memilih dokter, ruangan, bed, dan cara bayar. Status pasien langsung **DIRAWAT**.

Bayi yang lahir saat ibunya dirawat didaftarkan lewat tombol **Bayi Baru Lahir** di **Admisi › Rawat Inap** (bila fitur Registrasi Bayi Baru Lahir aktif).

Ketersediaan bed dapat dilihat di **Admisi › Monitoring Kamar**. Langkah penetapan bed ada di panduan [Pendaftaran Pasien](./pendaftaran.md).

**Hasilnya:** Pasien muncul di **Rawat Inap › Ruang Rawatan** pada ruangan tempat ia dirawat.

### Membuat Surat Permohonan Rawat Inap (dokter poli/IGD)
1. Buka rekam medis pasien rawat jalan atau IGD, lalu buka tab **Cetak Hasil & Surat**.
2. Di bagian **List Surat Keterangan**, klik **Buat Surat**.
3. Di **Cari & Pilih Surat**, pilih **Surat Permohonan Rawat Inap (SPRI)**, lalu klik **Buat**.
4. Isi **Tanggal rencana Rawat Inap**, pilih **Dokter** (DPJP rawat inap) dan **Tujuan Ruangan Rawat Inap**, lalu isi **Keterangan / Catatan** bila perlu. **No. Surat** terisi otomatis.
5. Klik **Simpan**.

**Hasilnya:** muncul pesan "Surat baru berhasil disimpan!", surat tampil di daftar dan bisa dicetak dengan **Cetak**, dan pasien masuk antrean **Admisi › Rawat Inap** untuk ditetapkan bed-nya.

> Untuk pasien BPJS di rumah sakit, SEP rawat inap memerlukan **SPRI BPJS** (surat VClaim) yang dibuat lewat tombol **SPRI BPJS** di tab **Resume & Discharge**. Lihat panduan [BPJS FKRTL](./bpjs-fkrtl.md).

### Melihat pasien per ruangan
1. Buka menu **Rawat Inap**.
2. Di panel kiri, buka **Ruang Rawatan**, lalu pilih **Semua Ruangan** atau nama ruangan.
3. Bila perlu, saring daftar dengan **Cari Pasien**, **Dokter**, **Tanggal mulai**/**Tanggal selesai**, dan **TUNAI**/**ASURANSI**, lalu tekan **Cari**. Tekan **Reset** untuk mengembalikan saringan.
4. Gunakan tombol status: ikon daftar (**Semua status**), **Dirawat**, atau **Discharge**.

**Hasilnya:** Tabel menampilkan data pasien, DPJP, data kunjungan, dan kolom **Status**:
- **WAITING**: menunggu bed;
- **TRANSFER**: sedang dalam proses pindah;
- **DIRAWAT**;
- **DISCHARGE**;
- **DIBATALKAN**.

Di bawah status tampil keterangan bayar (**Lunas** atau **Belum Lunas**).

### Membuka rekam medis dan mencatat pemeriksaan harian (visite)
1. Klik baris pasien di tabel. Jendela **Detail Pasien | Rawat Inap** terbuka.
2. Di kiri atas, pilih tanggal rekam medis. Untuk hari baru, tekan **+** di samping pilihan tanggal agar catatan tanggal hari ini dibuat.
3. Pada tab **Asesmen** atau **S.O.A.P**, pilih sesi (**Sesi 1**, **Sesi 2**, dan seterusnya) atau tekan **+** untuk menambah sesi pemeriksaan baru di hari yang sama.
4. Isi formulir yang diperlukan, misalnya **Tanda Vital**, **Pemeriksaan Fisik**, **Diagnosis Dokter**, **Catatan Perawat**, atau **Instruksi Medis**. Tekan **Simpan** pada setiap formulir.
5. Buka tab **Rekam Medis** untuk melihat ringkasan per sesi, atau pilih **Non-Sesi**.

**Hasilnya:** Pemeriksaan tercatat pada tanggal dan sesi yang dipilih.

### Menulis resep, tindakan, alkes, dan order penunjang
Caranya sama dengan rawat jalan. Lihat [RME Rawat Jalan](./rawat-jalan.md).
1. **Resep**: **S.O.A.P** › **Plan** › **Order Obat** › **Tambah Order**. Pilih **Lokasi Tujuan Order** dan aktifkan **Obat Pulang** bila obat untuk dibawa pulang. Tambahkan obat, lalu tekan **Simpan & Order Resep**.
2. **Tindakan**: bagian **Pemeriksaan dan Tindakan** › **Tambah Tindakan**, lalu tekan **Simpan**.
3. **Alkes/BMHP**: tab **Alkes**.
4. **Penunjang**: tab **Penunjang** › **Order Lab** (atau order lain yang aktif), lalu tekan **Kirim Order Lab**.

**Hasilnya:** Order tampil beserta statusnya di rekam medis pasien.

### Mencatat pemberian obat (FPO)
1. Buka tab **FPO**.
2. Pilih tanggal dengan tombol panah kiri/kanan atau kalender.
3. Pada obat yang diberikan, tekan **Edit**, isi **Jam Pemberian** dan **Catatan**, lalu tekan **Simpan Edit**.

**Hasilnya:** Pemberian obat harian tercatat di **Form Pemberian Obat (FPO)**.

### Mengajukan pindah bed atau ruangan
1. Buka rekam medis pasien, lalu buka tab **Perpindahan**.
2. Periksa **Bed Yang Ditempati Saat Ini**.
3. Pilih **Tipe Perpindahan**:
   - **Bed**: pindah bed di ruangan yang sama.
   - **Ruangan**: pindah ke ruangan lain. Pilih **Kelas**, **Kategori Ruangan**, lalu **Ruangan**.
4. Pada bagian **Pilih Bed**, pilih bed tujuan. Centang **Tambahan** bila ingin memakai bed cadangan.
5. Isi **Keterangan**, lalu tekan **Simpan**. Tekan **Reset** untuk mengulang isian.

**Hasilnya:** Muncul pesan "Permintaan perpindahan bed berhasil dikirim." Status pasien menjadi **TRANSFER** sampai permintaan disetujui atau ditolak.

### Menyetujui atau menolak perpindahan
1. Buka **Rawat Inap › Perpindahan Bangsal**.
2. Klik baris pasien. Kolom **Asal** dan **Tujuan** menunjukkan ruangan dan bed.
3. Periksa **Ruangan Saat Ini**, **Masuk Ke**, dan **Keterangan**.
4. Tekan **Setuju & Terima** untuk menyetujui, atau **Tolak Permintaan** untuk menolak.

**Hasilnya:** Bila disetujui, pasien pindah ke bed tujuan dan statusnya kembali **DIRAWAT**. Bila ditolak, pasien tetap di bed asal.

### Memulangkan pasien (Resume & Discharge)
1. Buka rekam medis pasien, lalu buka tab **Resume & Discharge**.
2. Lengkapi **Edukasi**, **Keadaan Waktu Pulang**, dan **Status Pulang**. Isi juga **Tanggal Discharge**, dan data rujukan bila pasien dirujuk.
3. Tekan **Simpan Resume Medis**, lalu **Discharge**.
4. Bila perlu, tekan **Cetak Resume Medis**.
5. Untuk pasien BPJS yang perlu kontrol setelah pulang, tekan **Rencana Kontrol BPJS** (tampil bila fitur Rencana Kontrol & SPRI aktif). Lihat panduan [BPJS FKRTL](./bpjs-fkrtl.md).

**Hasilnya:** Status pasien menjadi **DISCHARGE**, bed dikosongkan, dan biaya kamar beserta tindakan ditagihkan ke kasir.

### Membatalkan rawat inap
1. Di halaman **Ruang Rawatan**, tekan **Batal Kunjungan** di kiri bawah.
2. Centang pasien yang akan dibatalkan.
3. Isi **Alasan Batal Kunjungan**, lalu tekan **Iya, Batalkan**.

**Hasilnya:** Status menjadi **DIBATALKAN**. Pembatalan hanya bisa dilakukan untuk pasien berstatus **WAITING**.

### Melihat laporan rawat inap
1. Di panel kiri, buka **Laporan**, lalu pilih **Kunjungan Rawat Inap**, **Perpindahan Pasien**, **Pembatalan Dirawat**, atau **Rekap Tindakan Pasien**.
2. Atur saringan, lalu tekan **Cari**.

**Hasilnya:** Data laporan tampil sesuai saringan.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Biaya kamar belum tertagih — Tarif ruangan belum diatur untuk: (nama ruangan) | Pasien sudah di-discharge, tetapi ruangan itu belum punya tarif sehingga biaya kamarnya tidak tertagih. | Minta admin mengatur tarif di **Datamaster › Tarif › Ruangan**, lalu tekan **Discharge** lagi. |
| Tidak dapat membatalkan Rawat Inap yang sedang diproses | Pasien sudah mendapat bed (DIRAWAT/TRANSFER) atau sudah pulang. | Pembatalan hanya untuk status **WAITING**. Untuk pasien yang sudah dirawat, gunakan **Resume & Discharge**. |
| Silakan pilih bed tujuan perpindahan. | Bed tujuan belum dipilih saat mengajukan pindah. | Pilih bed pada bagian **Pilih Bed**. |
| Bed sudah terisi! | Bed tujuan sudah ditempati pasien lain. | Pilih bed lain yang kosong. |
| Bed RI tidak sama dengan bed asal perpindahan | Bed pasien sudah berubah sejak permintaan dibuat. | Tolak permintaan lama, lalu ajukan perpindahan baru. |
| Data lokasi ruangan tidak ditemukan pada pasien ini. | Pasien belum punya ruangan/bed (biasanya masih **WAITING**). | Minta admisi menetapkan bed di **Admisi › Rawat Inap**. |
| Tanggal Sudah Ada | Catatan tanggal hari ini sudah dibuat. | Pilih tanggal hari ini dari daftar tanggal. |
| Penambahan sesi hanya dapat dilakukan untuk tanggal hari ini pada rekam medis terbaru. | Sesi baru hanya bisa ditambahkan pada tanggal hari ini. | Buat atau pilih tanggal hari ini lebih dulu. |
| Sesi sudah memiliki order farmasi. Batalkan order farmasi terlebih dahulu untuk menghapus sesi ini. | Sesi yang akan dihapus sudah memiliki resep. | Batalkan order farmasinya dulu. |
| Pemberian obat gagal. Stok obat tidak mencukupi | Stok di depo tidak cukup. | Hubungi farmasi. |

## Pertanyaan yang sering diajukan
**Mengapa pasien berstatus WAITING dan rekam medisnya gagal dibuka?** Pasien belum mendapat bed, sehingga bisa muncul pesan "Data lokasi ruangan tidak ditemukan pada pasien ini." Minta petugas admisi menetapkan bed di **Admisi › Rawat Inap**.

**Bagaimana mencatat visite dokter?** Tidak ada menu khusus visite. Catat pemeriksaan harian dengan memilih atau menambah tanggal hari ini, lalu menambah sesi baru di tab **Asesmen** atau **S.O.A.P**.

**Apakah biaya kamar perlu diinput manual?** Tidak. Biaya kamar dihitung dan ditagihkan otomatis saat **Discharge**, dengan syarat tarif ruangan sudah diatur di **Datamaster › Tarif › Ruangan**.

**Siapa yang menyetujui perpindahan?** Petugas yang punya izin **Perpindahan Bangsal › SETUJU DAN TERIMA**, lewat menu **Rawat Inap › Perpindahan Bangsal**.

**Mengapa tab Perpindahan atau FPO tidak ada?** Kedua fitur itu bisa dinonaktifkan per faskes di **Setting › Manajemen Modul**.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **Rawat Inap**, fitur **Perpindahan Bed & Bangsal** dan **Form Pemberian Obat (FPO)**).
- Peran belum punya izin: admin › **Datamaster › Role** (modul izin **Rawat Inap**).
- Ruangan tidak tampil di panel kiri: ruangan belum terdaftar. Admin dapat memeriksanya di **Datamaster › Ruangan**.

## Catatan untuk peninjau
- Tidak ditemukan fitur atau menu khusus "visite". Panduan menganjurkan pencatatan per tanggal dan sesi. Mohon dipastikan sesuai praktik di ruangan.
- Alur penerimaan sudah disamakan dengan panduan Pendaftaran Pasien: pasien masuk dari Surat Permohonan Rawat Inap (SPRI) di rekam medis lalu bed ditetapkan di **Admisi › Rawat Inap**, atau didaftarkan langsung lewat **Daftar Rawat Inap** (rawat inap terencana tanpa kunjungan poli).
- Dari kode, permintaan pindah langsung mengubah status menjadi **TRANSFER**. Belum dipastikan siapa (ruangan asal atau tujuan) yang seharusnya menyetujui di lapangan.
- Izin **BATAL TERIMA** ada di daftar izin **Perpindahan Bangsal**, tetapi tombol di layar bertuliskan **Tolak Permintaan**. Mohon pastikan keduanya merujuk ke hal yang sama.
- Alur **FPO** ditulis dari kode dialog edit dan perlu dikonfirmasi petugas.
- Belum dipastikan apakah halaman **Ruang Rawatan** menampilkan pasien **WAITING** (pasien belum punya ruangan) saat memilih **Semua Ruangan**.
