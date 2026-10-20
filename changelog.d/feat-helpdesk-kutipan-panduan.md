### Diubah
- **Helpdesk: jawaban berdasar kutipan panduan.** Sebelum meneruskan pertanyaan ke Gateway OpenClaw, setting-service mencari 2–3 bagian `docs/panduan-pengguna` yang paling relevan (kata kunci per judul bagian, ditambah petunjuk dari halaman yang sedang dibuka) dan menyertakannya di pesan sistem. Agen tidak lagi bergantung pada pemanggilan alat baca berkas, sehingga model kecil tidak mengarang menu atau tombol. Image Docker setting-service kini memuat `docs/panduan-pengguna`. Lokasi lain bisa diatur dengan `HELPDESK_PANDUAN_DIR`.

### Diperbaiki
- Panduan Pendaftaran Pasien dan Rawat Inap: menambahkan jalur **Daftar Rawat Inap** (pendaftaran langsung pasien terdaftar oleh admisi). Sebelumnya panduan menyatakan Admisi › Rawat Inap tidak punya tombol Daftar.
