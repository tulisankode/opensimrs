### Ditambahkan
- **SIMRS Studio: Asisten Pengembang di setiap halaman (F1).** Superadmin melihat tombol samar di kanan bawah saat Mode Pengembang aktif (`Ctrl+Shift+.`).
  - Tab **Konteks** menampilkan modul dan fitur katalog, izin, komponen, galat API/console yang tertangkap di halaman, serta item Studio untuk modul itu.
  - Tab **Product**, **Engineer**, dan **QA** berisi formulir terarah tanpa AI. QA dilengkapi cek konsistensi tampilan. Hasilnya dikirim sebagai permintaan Studio yang membawa `konteks_asal` dan `modul_terdampak`.
  - Tab **Audit** (opsional, hanya bila diklik) memeriksa kode halaman dan backend yang melayaninya tanpa AI, dalam lima aspek: fungsional, query, relasi, logika, dan keamanan.
    - Contoh temuan: endpoint tidak terlacak atau 404/5xx, isolasi faskes, soft delete, JOIN ke baris terhapus, SQL injection, `catch` kosong, dan `forEach(async)`.
    - Setiap temuan punya bukti `berkas:baris`, dan temuan terpilih bisa langsung dijadikan permintaan.
  - Asisten juga bekerja di atas dialog layar penuh (mis. Rekam Medis). Komponen dialog yang terbuka menjadi konteks, audit, dan cek tampilan.
  - Agen membaca konteks asal dan entri katalog modul terkait di setiap tahap. Formulir Permintaan Baru mendapat pemilih **Modul terkait**.
  - Migrasi baru `20261021090000-studio_item_konteks_asal` menambah kolom `studio_item.konteks_asal`. Jalankan `npm run db:migrate`.
- SIMRS Studio › Ekstensi: tombol **Ekspor Excel** pada hasil pratinjau (maks. 50 baris) untuk mengecek data sebelum ekstensi dipasang.

### Diperbaiki
- SIMRS Studio: usulan risiko dari agen (PRD/desain/QA) tidak lagi diam-diam menimpa risiko yang sudah diturunkan superadmin lewat Triase. Usulan itu kini hanya dicatat di diskusi. Bila risiko memang dinaikkan agen, perubahannya tercatat sebagai pesan dan di log audit.
- SIMRS Studio › Audit cepat mengenali pola bug baru:
  - pemanggilan metode yang argumennya tidak cocok dengan definisinya, dicek lintas berkas: argumen wajib kurang, atau transaksi terkirim ke parameter lain (mis. `editAlkes(req, transaction)`);
  - payload camelCase yang disimpan ke model snake_case;
  - kelamin yang hanya dibandingkan satu bentuk;
  - JOIN wajib ke alamat atau tanggal lahir.
- Sapuan aturan baru menemukan dan memperbaiki bug yang sudah ada sebelumnya:
  - dokumentasi ICU dalam transaksi tidak menemukan episode, karena transaksi terkirim sebagai `unit`;
  - impor kategori pemeriksaan Lab selalu galat, karena `faskes_uuid` tidak diteruskan;
  - log konfigurasi keuangan di payment-service mencatat faskes `undefined`.
