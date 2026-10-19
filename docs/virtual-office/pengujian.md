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

Uji geser (seret/sentuh), zoom (roda, cubit, tombol), papan ketik (Tab ke ruang, Enter memilih, panah/plus/minus di peta), panel rincian, Pusatkan, Layar penuh, status Tertunda/Offline (matikan jaringan), dan pergantian faskes.
