### Diperbaiki
- ICU: riwayat Konfigurasi Layanan, daftar dokumentasi klinis, laporan kelengkapan, dan laporan ICU tidak lagi gagal ("Gagal memproses data ICU"). Penyebabnya parameter SQL yang menempel pada operator `<` (`waktu<:sampai`) tidak diganti Sequelize. Tes baru di rawat-inap-service mencegah pola ini muncul lagi.
- SIMRS Studio: kunci API dan batas isi prompt di menu Helpdesk AI kini benar-benar terkirim. Frontend Studio mengirim body dalam snake_case. Pilihan "jangan jalankan deploy" di Server & Deploy juga kini dihormati.
- Tes izin CCU hanya mensyaratkan submodul yang dipakai rute intensif bersama, sehingga submodul khusus ICU (Burn/Neuro) tidak membuatnya gagal.
