# Pemetaan status sintetis

Seluruh istilah event berikut adalah skenario prototipe di `laporan-service/src/virtual-office/konfigurasi.json`, bukan nama event aktual OpenSIMRS. Belum ada pemetaan operasional yang dinyatakan terverifikasi.

| Event sintetis | Status | Kelompok ringkasan |
|---|---|---|
| order, resep | antre | antre |
| penerimaan | diproses | aktif |
| menunggu_dependensi | menunggu_dependensi | tertunda |
| menunggu_validasi | menunggu_validasi | tertunda |
| hambatan | terhambat | tertunda |
| perhatian | perlu_perhatian | perlu perhatian |
| validasi, dispensing | selesai | selesai |
| tidak dikenal | belum_dipetakan | belum dipetakan |

Kelompok saling lepas. Perlu perhatian tidak ditambahkan kembali sebagai pekerjaan lain. SLA dan waktu tunggu selalu null. Tidak ada inferensi hambatan berdasarkan umur transaksi. Jalur ilustrasi Rawat Jalan?Laboratorium dan Rawat Jalan?Farmasi disaring berdasarkan unit yang terlihat.

Sebelum integrasi nyata, catat bukti kode produsen, transaksi berhasil, revisi, pemetaan status/transisi, relasi kunjungan/order/resep, penghapusan lunak, dan penanggung jawab verifikasi untuk tiap unit MVP. Jangan menyalin nama skenario ini menjadi asumsi kontrak sumber.
