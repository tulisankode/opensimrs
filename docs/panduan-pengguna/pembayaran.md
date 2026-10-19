# Kasir & Pembayaran

> Draf disusun AI dari kode aplikasi pada 2026-10-16, diperbarui 2026-10-19 — wajib ditinjau petugas kasir sebelum dipakai Helpdesk.

**Dipakai oleh:** petugas kasir, petugas keuangan
**Menu:** Pembayaran › Kasir · Transaksi (Pelayanan, APS & OTC) · Closed Bill · Laporan (Pendapatan, Pembayaran Kunjungan, Closing Kasir)
**Hak akses yang dibutuhkan:** Pembayaran › Kasir › READ, BAYAR, CETAK INVOICE, CETAK RINCIAN BIAYA, CLOSE BILL (ditambah OPEN KASIR, CLOSE KASIR, dan CLOSE HARIAN bila shift kasir dipakai); Pembayaran › Transaksi › READ; Pembayaran › Closed Bill › READ, LUNASKAN; Pembayaran › Laporan Pembayaran › READ, CETAK LAPORAN.

## Untuk apa
Tagihan pasien terbentuk otomatis dari tindakan, obat, penunjang, dan kamar. Di modul ini kasir menerima pembayaran tunai atau asuransi, mencetak kuitansi dan rincian tagihan, menutup tagihan (close bill), melunasi piutang, dan menutup kas di akhir shift.

## Tugas sehari-hari

### Membuka kasir di awal shift (bila fitur Shift Kasir aktif)
1. Buka **Pembayaran › Kasir**.
2. Isi **Saldo Awal (kas)** dan pilih shift pada **Pilih Shift** (**Pagi**, **Siang**, atau **Malam**).
3. Klik **Open Kasir**.

**Hasilnya:** tombol berubah menjadi **Close Kasir** dan kasir siap menerima pembayaran. Shift dicatat per akun kasir, jadi setiap kasir membuka shift-nya sendiri.

Bila fitur Shift Kasir tidak aktif, kolom **Saldo Awal (kas)**, **Pilih Shift**, dan tombol **Open Kasir**/**Close Kasir**/**Closing Harian** tidak tampil. Sistem membuka shift secara otomatis (saldo awal 0) saat kasir pertama kali menerima pembayaran.

### Menerima pembayaran pasien
1. Di **Pembayaran › Kasir**, cari pasien lewat **Pencarian Transaksi** (nama, No. Transaksi, atau No. RM), lalu pilih tagihannya.
2. Periksa **List Tagihan Pelayanan** di sebelah kiri. Klik baris tagihan untuk melihat **Detail Tagihan Pelayanan** (kamar, penunjang, tindakan, obat, alkes).
3. Periksa **Total Pembayaran** di sebelah kanan:
   - rincian biaya: **Biaya Administrasi**, **Biaya Tindakan**, **Biaya Penunjang**, **Biaya Obat/Alkes**, **Retur Obat/Alkes**, **Biaya Kamar**;
   - potongan: **Diskon** dan **Voucher**;
   - **PPN** dan **Grand Total**.
4. Bila ada diskon atau voucher (fitur Diskon & Voucher aktif):
   - Untuk diskon, ketik persentase lalu klik **Pakai Diskon**.
   - Untuk voucher, ketik kode di **Masukkan Kode Voucher** lalu klik **Pakai Voucher**.
   - Konfirmasi dengan **Iya, Pakai**.
5. Klik **Bayar**. Di jendela **Pembayaran**:
   - Untuk pasien tunai, isi **Jumlah Bayar** dan pilih **Metode Pembayaran** (**Tunai**, **Transfer**, atau **Debit/Kredit**). **Kembalian** dihitung otomatis.
   - Untuk pasien asuransi, isi nilai **Dijamin**.
   - Isi **Catatan** atau **Keterangan** bila perlu. **Cara Bayar** terisi otomatis sesuai penjamin kunjungan.
6. Klik **Bayar**.

**Hasilnya:** pembayaran tersimpan dengan nomor kuitansi unik (berawalan `KUI/`) dan tombol **Cetak Kuitansi** muncul. Bila jumlah bayar kurang dari Grand Total, aplikasi menampilkan peringatan "Pembayaran kurang dari Grand Total, tetap melanjutkan dengan status piutang?". Bila dilanjutkan, sisanya menjadi piutang.

### Mencetak kuitansi dan rincian tagihan
1. Buka tagihan pasien di **Pembayaran › Kasir**, atau di **Pembayaran › Transaksi › Pelayanan** atau **APS & OTC**.
2. Klik **Cetak Tagihan** untuk mencetak rincian biaya. Tombol ini selalu tersedia.
3. Klik **Cetak Kuitansi** untuk mencetak bukti bayar. Tombol ini hanya muncul setelah ada pembayaran.

**Hasilnya:** dokumen cetak terbuka dan siap dicetak.

### Menutup tagihan (Close Bill)
1. Setelah pasien membayar, buka kembali tagihannya.
2. Klik **Close Bill**, pastikan semua biaya sudah tercantum, lalu klik **Close Bill** di jendela konfirmasi.

**Hasilnya:** tombol berubah menjadi **Bill Telah Ditutup**. Setelah close bill, tagihan tidak dapat diubah atau ditambah.

### Melihat transaksi pelayanan atau APS & OTC
1. Buka **Pembayaran › Transaksi › Pelayanan** (pasien kunjungan) atau **Pembayaran › Transaksi › APS & OTC**. APS adalah pasien atas permintaan sendiri, misalnya pemeriksaan lab tanpa kunjungan. OTC adalah penjualan obat bebas.
2. Saring dengan **Pencarian**, **Tanggal mulai**, **Tanggal selesai**, pelayanan, **TUNAI** atau **ASURANSI**, dan status **Menunggu** atau **Lunas**. Lalu klik **Cari**.
3. Klik baris transaksi untuk membuka detailnya. Dari detail ini kasir juga bisa **Bayar**, **Close Bill**, dan mencetak.

### Melunasi piutang (Closed Bill)
1. Buka **Pembayaran › Closed Bill**.
2. Pilih **Status** **PIUTANG**, atur tanggal, lalu klik **Cari**.
3. Klik baris pasien, lalu klik **Lunaskan**.
4. Klik **Pelunasan**. Isi jumlah bayar, **Metode Pembayaran**, dan **Catatan** atau **Keterangan**, lalu klik **Pelunasan**.

**Hasilnya:** status tagihan menjadi **LUNAS**, dan kuitansi dapat dicetak lewat **Cetak Kuitansi**.

### Menutup kasir di akhir shift (bila fitur Shift Kasir aktif)
1. Di **Pembayaran › Kasir**, klik **Close Kasir**.
2. Di jendela **Closing Kasir**, bandingkan **Pendapatan System** dengan uang di laci. Isi **Pendapatan Aktual** bagian **Tunai**.
3. Klik **Closing Kasir**. Slip tutup shift (rincian **TUNAI**, **DEBIT/KREDIT**, **TRANSFER**, dan **Total Pemasukan**) terbuka dan siap dicetak.

**Hasilnya:** shift ditutup, kolom **Saldo Awal (kas)** dan **Pilih Shift** kosong kembali, dan penutupan tercatat di **Laporan › Closing Kasir**.

### Menutup hari (Closing Harian)
1. Pastikan semua kasir sudah menutup shift-nya. Tombol **Closing Harian** hanya aktif bila shift Anda sudah ditutup.
2. Di **Pembayaran › Kasir**, klik **Closing Harian**.
3. Periksa nama akun dan **Tanggal & Jam Closing**, lalu klik **Closing Harian** pada pertanyaan "Apakah anda yakin ingin melakukan penutupan hari ini?".

**Hasilnya:** penutupan hari tercatat di **Laporan › Closing Kasir**. Bila masih ada shift kasir yang terbuka di faskes, muncul pesan "Harus menutup shift kasir terlebih dahulu".

### Melihat laporan pembayaran
- **Laporan › Pembayaran Kunjungan**: daftar pembayaran per pasien (**Waktu Bayar**, **Cara Bayar**, **Total Bayar**, **Kasir**). Saring berdasarkan **Shift** dan tanggal, lalu klik **Cetak**.
- **Laporan › Closing Kasir**: riwayat open, close, dan close harian per petugas. Klik **Cetak**.
- **Laporan › Pendapatan**: atur tanggal, lalu klik **Export**.

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|
| Shift kasir belum dibuka | Fitur Shift Kasir aktif, tetapi shift akun Anda belum dibuka. | Isi **Saldo Awal (kas)**, pilih shift, lalu klik **Open Kasir**. |
| Shift kasir masih terbuka | Anda mencoba membuka shift, padahal shift Anda masih terbuka. | Lanjutkan memakai shift yang terbuka, atau klik **Close Kasir** dulu. |
| Harus menutup shift kasir terlebih dahulu | **Closing Harian** ditolak karena masih ada shift kasir yang terbuka di faskes. | Minta setiap kasir menutup shift-nya dengan **Close Kasir**, lalu ulangi. |
| Tagihan ini belum ditutup | Pelunasan piutang hanya bisa untuk tagihan yang sudah close bill. | Lakukan **Close Bill** dulu. |
| Tagihan ini sudah tidak memiliki hutang | Piutang sudah lunas. | Tidak perlu pelunasan lagi. |
| Pendapatan Aktual Tunai tidak sesuai. Sistem: …, Aktual: … | Uang yang diisikan berbeda dari catatan sistem. | Hitung ulang kas. Bila memang ada selisih, laporkan ke atasan sebelum menutup kasir. |
| Tagihan sudah lunas / Tagihan ini sudah lunas | Tagihan sudah dibayar penuh. | Tidak perlu dibayar lagi. Cetak kuitansi bila diminta pasien. |
| Tagihan sudah ditutup | Tagihan sudah close bill sehingga tidak dapat diubah. | Bila ada biaya yang tertinggal, hubungi atasan atau admin. |
| Tagihan ini telah digabung. Silakan proses melalui tagihan induknya … | Tagihan ini sudah digabung ke tagihan keluarga. | Cari dan proses tagihan induknya. |
| Tagihan sudah memiliki diskon / … memiliki voucher | Diskon atau voucher hanya bisa dipakai sekali per tagihan. | Tidak perlu memasukkan lagi. |
| Voucher tidak ditemukan / Voucher tidak aktif / Voucher telah habis digunakan / Masa berlaku voucher telah berakhir | Kode voucher tidak bisa dipakai. | Periksa kode dan masa berlaku di **Datamaster › Voucher**. |
| Nilai voucher harus kurang dari total tagihan | Nilai voucher melebihi tagihan. | Gunakan voucher lain atau bayar tanpa voucher. |
| Tagihan ini tidak bisa dibayar menggunakan Asuransi. | Kunjungan pasien tidak memakai penjamin asuransi. | Proses sebagai pembayaran tunai. Bila penjaminnya salah, minta petugas pendaftaran memperbaiki kunjungan. |

## Pertanyaan yang sering diajukan
**Bagaimana membatalkan pembayaran yang salah input?** Tidak ada tombol pembatalan pembayaran di menu Pembayaran. Jangan langsung close bill. Laporkan ke atasan atau admin sistem beserta No. RM dan nomor transaksi.

**Mengapa tombol Cetak Kuitansi tidak muncul?** Kuitansi baru muncul setelah ada pembayaran. Sebelum itu hanya tersedia **Cetak Tagihan**.

**Mengapa biaya obat belum masuk tagihan?** Biaya obat masuk setelah farmasi memverifikasi resep. Hubungi farmasi bila resep belum diverifikasi.

**Mengapa Diskon dan Voucher tidak tampil?** Fitur **Diskon & Voucher** belum diaktifkan untuk faskes.

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul** (modul **Kasir & Pembayaran**; fitur **Shift Kasir**, **Diskon & Voucher**, dan **Transaksi APS & OTC**).
- Peran belum punya izin: admin › **Datamaster › Role** (modul Pembayaran).

## Catatan untuk peninjau
- Rute **Laporan › Pendapatan** memeriksa izin "Laporan Pembayaran › Pendapatan", tetapi fitur itu tidak ada di daftar izin Pembayaran (hanya Kunjungan dan Closing Kasir). Akibatnya, menu ini mungkin tidak tampil untuk peran selain superadmin.
- Tidak ditemukan fitur pembatalan atau void pembayaran di layar. Mohon dikonfirmasi prosedur resmi bila kasir salah input.
- Tagihan di halaman **Kasir** dengan **Pembayaran › Transaksi** menampilkan tombol yang sama (**Bayar**, **Close Bill**, **Cetak**). Mohon dipastikan halaman mana yang dijadikan alur baku.
- Halaman `Cashier2Page.vue` ada di kode tetapi tidak terdaftar di rute, jadi tidak dibahas.
- Pemeriksaan "Pembayaran asuransi tidak boleh melebihi sisa tagihan" dinonaktifkan (dikomentari) di payment-service (`PaymentRepository.js`), sehingga nilai **Dijamin** yang melebihi sisa tagihan tidak ditolak. Mohon dipastikan apakah ini disengaja.
- **Closing Harian** menolak bila masih ada shift terbuka milik kasir mana pun di faskes, tetapi tombolnya di layar hanya mengikuti status shift akun sendiri. Prosedur antarkasir perlu dijelaskan.
- Tombol **Open Kasir**, **Close Kasir**, dan **Closing Harian** tidak tampak memeriksa izin OPEN KASIR/CLOSE KASIR/CLOSE HARIAN di halaman Kasir. Perlu dicek.
