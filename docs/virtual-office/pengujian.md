# Pengujian Virtual Office

## Uji unit

Jalankan `npm --prefix laporan-service test`. Di Windows, bila muncul `spawn EPERM`, pakai `node --test --test-isolation=none laporan-service/test/*.test.js`. Berkas `test/virtual-office.test.js` menguji tanpa database:

- rentang "hari ini" (WIB) dan ambang beban;
- faskes hanya dari token (401/400);
- data nyata per unit dan jalur;
- unit tanpa aksi terkunci tanpa angka dan jalur;
- modul atau fitur nonaktif;
- sumber gagal ditandai `galat`;
- mode simulasi hanya dengan flag;
- tembolok dan tata letak tanpa tumpang tindih.

## Uji integrasi (manual, database sementara)

1. Siapkan klaster PostgreSQL sementara, muat `schema.sql`, lalu jalankan semua migrasi dua kali (termasuk setelah mengosongkan `SequelizeMeta`).
2. Isi data **fiktif** untuk dua faskes: antrean admisi, kunjungan RJ (berbagai status, batal, terhapus, kemarin), IGD, ruangan/bed/rawat inap, order lab/radiologi, resep, dan tagihan.
3. Jalankan laporan-service dengan `SECRET_KEY` uji dan Redis uji. Minta snapshot dengan JWT HS256 uji untuk pengguna berizin penuh, berizin sebagian, tanpa READ, dan dari faskes lain.
4. Cocokkan angka per unit, ruang, dan jalur dengan data yang diisi. Pastikan 401 (tanpa token atau tanda tangan salah), 403 (tanpa READ), 400 (parameter faskes), unit terkunci, dan isolasi faskes.

## Uji browser

Uji kedua tampilan (tombol **Kantor / Denah**; pilihan bertahan setelah halaman dimuat ulang):

- geser (seret/sentuh), zoom (roda, cubit, tombol; Kantor hanya 1×/2×/3×), papan ketik (panah/plus/minus/0 di peta; Denah juga Tab ke ruang lalu Enter), Pusatkan, Layar penuh;
- klik ruang/karakter → panel rincian; klik unit di panel samping Kantor → kamera fokus ke ruang;
- status Tertunda/Offline (matikan jaringan) dan pergantian faskes (snapshot, gerakan, dan log dikosongkan);
- unit tanpa izin tampil gelap dengan gembok, tanpa petugas, pasien, atau angka.

Uji gerakan dengan dua snapshot berurutan yang angkanya naik (mis. tambah order lab dari RJ, resep, tagihan). Pasien harus berjalan dari unit asal ke ruang tujuan lalu memudar di kursi tunggu, angka naik dengan count-up, ruang yang berubah berkilat, dan Log Aktivitas bertambah tanpa identitas pasien. Snapshot pertama dan faskes tanpa transaksi tidak boleh menampilkan pasien berjalan; saat semua angka 0 tampil "Belum ada aktivitas hari ini di faskes ini".

Uji juga dengan `prefers-reduced-motion: reduce` (DevTools › Rendering): tidak ada pasien berjalan, goyangan, denyut, maupun kilatan. Saat tab disembunyikan, perulangan animasi harus berhenti (DevTools › Performance).

Untuk uji visual tanpa server, buat harness Vite sementara yang me-mock `apiLaporanGet` dengan snapshot **fiktif** dari `buatSnapshot` (angka naik setiap panggilan). Ambil tangkapan layar Chrome headless beberapa frame setelah tombol Muat ulang, lalu hapus harness.
