### Diperbaiki
- **Antrian › Konfigurasi Layar:** perubahan tipe layar, nama, pilihan Admisi/Poli/Farmasi, dan flash text kini benar-benar tersimpan.
  - Sebelumnya payload diubah ke camelCase sebelum disimpan, padahal atribut model `layar_antrian` memakai snake_case. Sequelize mengabaikan atribut yang tidak dikenal, sehingga setelah Simpan hanya judul, media, dan status yang berubah.
- **Layar antrean (TV/kiosk & pratinjau):** kartu panggilan menampilkan panggilan terbaru per poli-dokter. Sebelumnya, bila petugas langsung memanggil nomor berikutnya tanpa Proses/Lewati, nomor lama yang masih berstatus dipanggil tetap tampil karena layar mengurutkan berdasarkan nomor terkecil.
