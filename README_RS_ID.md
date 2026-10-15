# OpenSIMRS untuk Pimpinan & Manajemen Faskes

Ringkasan non-teknis untuk direksi, manajemen, dan pengambil keputusan di rumah sakit, klinik, dan puskesmas. Untuk tim IT, baca [README](./README.md) dan [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md).

---

## Apa itu OpenSIMRS?

OpenSIMRS adalah **Sistem Informasi Manajemen Rumah Sakit (SIMRS) sumber terbuka**. Kodenya bisa diunduh, dipasang di server faskes sendiri, dan dikembangkan bersama komunitas tanpa biaya lisensi.

## Mengapa layak dipertimbangkan?

| Kebutuhan faskes | Yang ditawarkan OpenSIMRS |
|---|---|
| Mulai dari kecil, tumbuh bertahap | Modul diaktifkan sesuai jenis faskes: praktik mandiri, klinik, puskesmas, sampai RS kelas A. Menu yang tidak relevan tidak ditampilkan. |
| Kewajiban integrasi nasional | Integrasi SATUSEHAT (Kemenkes) dan BPJS Kesehatan (PCare untuk FKTP, VClaim/SEP untuk FKRTL) sudah tersedia. |
| Biaya jangka panjang terkendali | Tanpa biaya lisensi; faskes bebas memilih tim IT internal atau mitra implementator. |
| Kemandirian data | Data disimpan di server pilihan faskes sendiri. |
| Layanan penunjang lengkap | Laboratorium (dengan bridging LIS), radiologi, fisioterapi, patologi anatomi, mikrobiologi, dan Medical Check Up korporasi. |

## Modul utama

Pendaftaran & antrian · Rekam medis elektronik · Rawat jalan, rawat inap, IGD · Farmasi & gudang · Laboratorium & penunjang · Kasir & tagihan · Laporan & dashboard · Integrasi SATUSEHAT/BPJS/LIS.

## Status & hal yang perlu diperhatikan

- Proyek berstatus **alfa** (rilis publik pertama Oktober 2026). Rencana pengembangan per jenis faskes ada di [Roadmap](./docs/ROADMAP.md).
- Implementasi tetap membutuhkan **tim IT** (internal atau mitra) untuk pemasangan, pengisian data awal, pelatihan, pengamanan server, dan cadangan data.
- Faskes tetap bertanggung jawab atas kepatuhan perlindungan data pribadi dan kerahasiaan rekam medis.
- Disarankan memulai dengan uji coba di lingkungan terpisah dan menjalankan paralel dengan sistem lama sebelum beralih penuh.

## Langkah berikutnya

1. Minta tim IT mencoba OpenSIMRS dengan data demo ([Petunjuk Instalasi, jalur A](./docs/INSTALLATION_GUIDE.md#4-jalur-a--coba-cepat-dengan-data-demo-lokal)).
2. Tinjau kecocokan modul dengan jenis faskes Anda ([Manajemen Modul](./docs/MANAJEMEN-MODUL.md)).
3. Libatkan tenaga klinis untuk menilai alur pelayanan, dan sampaikan kebutuhan lewat issue GitHub agar bisa masuk [Roadmap](./docs/ROADMAP.md).

Lisensi: MIT (lihat [LICENSE](./LICENSE)).
