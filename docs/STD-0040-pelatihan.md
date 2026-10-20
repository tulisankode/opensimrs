# Pelatihan SDM — STD-0040

Fitur tersedia di **HR / SDM › Pelatihan** (`/sdm/pelatihan`). API dipasang di
`/api/v3/penunjang/hr/pelatihan`. Aktivasi mengikuti katalog modul faskes dan tetap
memerlukan Kepegawaian aktif. Tidak ada perubahan aktivasi paksa untuk seluruh faskes.

## Penggunaan

1. Atur izin **Pelatihan** di Hak Akses. Aksi baca, katalog, kegiatan, peserta, hasil,
   verifikasi, sertifikat, kebijakan, rekap, dan ekspor terpisah. Ekspor memerlukan
   **BACA REKAP** sekaligus **EKSPOR**. Verifikasi yang sekaligus membuat/menautkan
   sertifikat juga memerlukan **KELOLA SERTIFIKAT**.
2. Pada **Pengaturan**, pilih tahun, zona waktu, dasar jam hadir/lulus, perlakuan
   kehadiran sebagian, hari peringatan, syarat sertifikat aktif, kebijakan ekspor
   kosong, aturan target, dan dasar cakupan historis. Isi target sesuai keputusan
   faskes; tidak ada target otomatis 20 jam. Menyimpan formulir menetapkan satu
   versi kebijakan baru, tanpa menimpa versi yang dipakai kegiatan sebelumnya.
3. Buat katalog dengan kode, nama, kategori internal/eksternal, jam, masa berlaku,
   dan cakupan bertanggal bila wajib. Akhir cakupan bersifat eksklusif. Cakupan
   semua pegawai tidak boleh bertumpang tindih dengan cakupan khusus.
4. Buat kegiatan menggunakan katalog dan kebijakan tahun selesai kegiatan.
   Tetapkan jadwal, lalu mulai kegiatan untuk mencatat hasil. Jadwal di formulir
   mengikuti zona waktu perangkat; tahun pengakuan mengikuti zona kebijakan.
5. Daftarkan pegawai aktif yang sudah tertaut di Kepegawaian. Pilihan peserta
   merujuk `hr_kepegawaian.uuid`; identitas Data Master tidak dibuat ulang.
   Pendaftaran kelompok bersifat atomik dan kapasitas diperiksa setelah kegiatan dikunci.
6. Catat kehadiran dan hasil, kemudian verifikasi. Jam sementara selalu nol.
   Kegiatan hanya dapat diselesaikan setelah waktunya berakhir dan seluruh peserta
   aktif memiliki hasil terverifikasi. Jam masuk rekap setelah kegiatan selesai.
7. Catat sertifikat baru atau pilih sertifikat pegawai yang sudah ada. Bukti
   disimpan hanya pada `mutu_kredensial` dengan jenis mesin `sertifikat`.
   Sertifikat baru berstatus **Belum diverifikasi**; verifikasi keaslian tetap
   dilakukan melalui Kredensial Pegawai/Kredensial Staf dengan izin masing-masing.
8. Buka rekap tahun, kewajiban, atau peringatan sertifikat. Pilih Excel atau PDF
   secara eksplisit sebelum mengekspor. Ekspor peserta tersedia pada detail kegiatan.

## Aturan dan batasan

- Kebijakan dan target memerlukan pilihan manusia pada formulir. Aturan target
  dapat berupa satu target seluruh pegawai atau prioritas pegawai → unit → jenis
  pegawai → semua. Cakupan laporan historis yang tersedia saat ini memakai unit dan
  jenis pegawai **saat laporan dibuat**, bukan rekonstruksi keadaan tahun lampau.
- Repo belum memiliki referensi profesi tersendiri. Cakupan `jenis_pegawai`
  menggunakan `pegawai.tipe`: `1` tenaga kesehatan, `2` tenaga nonkesehatan.
  Kewajiban profesi khusus dapat dicatat melalui unit atau daftar pegawai;
  pengelompokan otomatis per profesi belum tersedia.
- Jam menggunakan dua desimal. Peserta hadir penuh harus memiliki jam hadir sama
  dengan jam kegiatan; sebagian harus di antara nol dan jam kegiatan. Peserta
  tidak hadir tidak dapat dinyatakan lulus. Perubahan katalog tidak mengubah
  salinan nama, kategori, jam, dan masa berlaku pada kegiatan lama.
- Rekap jam menggunakan hasil terverifikasi pada kegiatan selesai. Target kosong
  menghasilkan **Belum ditetapkan**; pegawai nol jam tetap ditampilkan. Versi
  kebijakan terbaru menjadi sumber target tahun tersebut; dasar pengakuan jam
  kegiatan lama tetap mengikuti versi kebijakannya sendiri.
- Pemenuhan wajib menggunakan katalog dan cakupan aktif yang berlaku pada waktu
  penilaian, hasil lulus, masa berlaku salinan kegiatan, serta kebijakan syarat
  sertifikat. Bila disyaratkan, sertifikat harus aktif, terverifikasi, sudah mulai
  berlaku dan belum berakhir. Pencabutan/penghapusan dari Mutu langsung tercermin.
  Tanggal kredensial mengikuti sumber bersama: awal hari WIB, berlaku sampai akhir
  hari terakhir. Peringatan membaca tanggal aktual, termasuk yang sudah kedaluwarsa.
- Kegiatan selesai dibuka kembali dengan izin verifikasi dan alasan; seluruh hasil
  dikembalikan menjadi belum diverifikasi dan jam diakui nol. Hasil individual
  terverifikasi harus dibuka melalui koreksi sebelum diubah. Sertifikat yang sudah
  tertaut dipertahankan; koreksi/pencabutannya melalui kredensial bersama.
- Penghapusan menggunakan `deleted_at`, versi, alasan, transaksi dan audit.
  Penghapusan katalog yang masih dipakai, serta kegiatan/peserta dengan hasil
  terverifikasi atau sertifikat ditolak. Konflik versi meminta pemuatan ulang.
- Semua pencarian dan relasi memakai faskes token. Faskes, pelaku, verifikator, dan
  jam diakui tidak diterima sebagai nilai yang ditetapkan klien.
- Data ekspor disiapkan server melalui kueri rekap yang sama dan diaudit. Berkas
  Excel/PDF dibuat di peramban memakai pustaka yang sudah tersedia. Batas ekspor
  10.000 baris; hasil kosong mengikuti kebijakan. Isi sertifikat tidak diekspor.
  Nilai teks yang menyerupai rumus spreadsheet dinetralkan. Laporan dibaca dalam
  transaksi snapshot hanya baca; audit dicatat pada transaksi baru agar rantai hash
  audit pusat membaca ujung rantai terbaru setelah penguncian.
- Daftar biasa berhalaman (`page`, `limit`). Pemilih pegawai menampilkan maksimal
  200 hasil pencarian. Rekap dibatasi 10.000 pegawai dan 50.000 sumber kegiatan;
  volume yang lebih besar ditolak, tanpa pemotongan laporan secara diam-diam.
- Unggah massal sertifikat dan portal mandiri pegawai berada di luar implementasi ini.

## Migrasi

Urutan berkas baru:

1. `20261021040000-std_0040_pelatihan_sdm.cjs`: enam tabel pelatihan, kunci asing,
   batasan nilai, serta indeks aktif/unik.
2. `20261021040100-std_0040_katalog_pelatihan.cjs`: `sinkronKatalog` dari JSON.
3. `20261021040200-std_0040_izin_pelatihan.cjs`: menambahkan aksi Pelatihan secara
   idempoten hanya ke daftar izin super admin yang sudah terisi. Daftar kosong
   tetap mengikuti mekanisme super admin tanpa batas; peran lain dikelola manusia.

Migrasi tidak dijalankan pada sesi pengembangan ini. Migrasi skema memakai
`IF NOT EXISTS`; migrasi izin menggabungkan aksi dalam JSON tanpa menggandakan
submodul. Pembatalan tidak menghapus bukti pelatihan atau mencabut izin yang sudah
diatur manusia; koreksi dilakukan dengan migrasi baru/Hak Akses.

## Verifikasi tanpa database

Uji unit menggunakan data fiktif dan pengganti transaksi. Pramuat
`penunjang-service/test/support/tanpa-database.cjs` menonaktifkan pemuatan `.env`
dan menolak seluruh koneksi PostgreSQL:

```powershell
$opsiNodeLama = $env:NODE_OPTIONS
try {
  $env:NODE_OPTIONS = '--require=' + (Join-Path $PWD 'penunjang-service/test/support/tanpa-database.cjs')
  npm --prefix penunjang-service test
  npm --prefix auth-service test -- --runInBand --runTestsByPath tests/sdm-pelatihan.test.js
} finally {
  $env:NODE_OPTIONS = $opsiNodeLama
}
npm run docs:katalog
git diff --check
```

Suite auth menyeluruh tidak digunakan karena memuat uji yang menyambung database
dan menyinkronkan skema. `npm --prefix frontend-service run type-check` masih
terhalang galat sintaks komponen ikon lama di luar item ini. Komponen Pelatihan
dikompilasi secara terpisah; pemeriksaan tipe terarah dapat mengecualikan aplikasi
utama, dengan `noImplicitAny: false` untuk galat lama pada `CustomButton.vue`.

## Uji manual oleh penguji berwenang

Gunakan lingkungan pengujian terpisah dan data sintetis, tanpa data pasien nyata.

1. Periksa migrasi baru dua kali untuk membuktikan idempotensi PostgreSQL,
   integritas relasi, serta pemberian izin hanya kepada super admin.
2. Uji faskes A/B, modul/fitur nonaktif, setiap izin aksi, dan pemanggilan API langsung.
3. Jadwalkan pelatihan PPI fiktif untuk 30 pegawai tertaut; uji kapasitas melalui
   dua sesi bersamaan serta penolakan satu pegawai yang tidak aktif/lintas faskes.
4. Uji hadir penuh, sebagian, tidak hadir, lulus/tidak lulus; cocokkan hasil dan
   target tahun dengan rincian sumber serta pegawai nol jam.
5. Uji batas tahun Jakarta/Makassar/Jayapura dan perubahan katalog/kebijakan setelah
   kegiatan lama diverifikasi; sejarah jam kegiatan lama harus tetap.
6. Uji sertifikat baru dan yang sudah ada, unduh bukti dari kredensial bersama,
   verifikasi/pencabutan/penghapusan di Mutu, lalu periksa rekap Pelatihan kembali.
7. Simulasikan kegagalan penulisan kredensial dalam transaksi PostgreSQL sungguhan;
   hasil, relasi sertifikat dan audit keberhasilan tidak boleh tersimpan sebagian.
8. Uji pembukaan kembali, koreksi, konflik versi, penghapusan lunak, dan rantai audit pusat.
9. Bandingkan hasil ekspor Excel/PDF dengan filter tampilan, laporan kosong,
   batas baris, teks menyerupai rumus, dan penolakan tanpa izin ekspor.
10. Uji pergantian faskes saat permintaan berjalan, dialog, tampilan tabel,
    keterbacaan PDF, serta unggahan PDF/JPG/PNG dari peramban.
