# Panduan Product Development

Untuk **analis kebutuhan**, **tenaga medis/klinis** (dokter, perawat, bidan, apoteker, analis laboratorium, radiografer, perekam medis), dan **desainer UX**. Anda tidak harus bisa menulis kode untuk berkontribusi.

Dokumen terkait: [Roadmap](../ROADMAP.md) · [Manajemen Modul](../MANAJEMEN-MODUL.md) · [Tata Kelola](../../GOVERNANCE.md) · [Peran kontributor](./README.md)

---

## 1. Mengusulkan fitur

- **Usulan kecil** (perbaikan alur, istilah, kolom form): buka GitHub Issue dengan label `butuh tenaga medis/klinis` atau `area:frontend`, berisi:
  - siapa penggunanya (peran) dan di jenis faskes apa (segmen);
  - alur saat ini dan masalahnya;
  - alur yang diharapkan, contoh formulir/laporan (dengan data fiktif);
  - acuan regulasi bila ada.
- **Usulan besar** (modul baru, perubahan struktur data, alur klinis lintas modul): ajukan **RFC** (issue berlabel `RFC`), didiskusikan minimal 7 hari ([GOVERNANCE.md](../../GOVERNANCE.md#rfc-request-for-comments)).
- Jelaskan **kebutuhan**, bukan hanya solusi teknisnya. Developer akan membantu merumuskan solusinya.

## 2. Riset kebutuhan faskes

- Observasi alur nyata (pendaftaran sampai kasir) dan wawancarai pengguna per peran; catat hambatan dan pekerjaan manual yang berulang.
- Bedakan kebutuhan **per segmen**: praktik mandiri tidak butuh menu rumah sakit. Hasil riset bisa berupa usulan preset segmen di [katalog Manajemen Modul](../MANAJEMEN-MODUL.md#5-katalog-lengkap).
- Jangan membawa data pasien dari faskes; gunakan contoh fiktif atau formulir kosong.
- Bagikan temuan di kanal `#produk` Discord ([COMMUNITY.md](../../COMMUNITY.md)) lalu rangkum di issue.

## 3. Acuan regulasi

Usulan sebaiknya merujuk ketentuan yang berlaku, antara lain:

- **SATUSEHAT** (Kemenkes): standar FHIR, resource dan kode terminologi (ICD-10, ICD-9-CM, LOINC, SNOMED).
- **BPJS Kesehatan**: PCare (FKTP), VClaim/SEP (FKRTL), Antrean Online.
- **Rekam medis**: Permenkes Nomor 24 Tahun 2022 tentang Rekam Medis; pelindungan data pribadi (UU Nomor 27 Tahun 2022).
- **Standar akreditasi** faskes dan rumah sakit yang berlaku, serta standar profesi terkait (mis. pelayanan kefarmasian, laboratorium).

Sebutkan pasal/bagian yang dirujuk agar mudah diverifikasi. Panduan ini bukan nasihat hukum.

## 4. Prioritas roadmap

- Pengembangan mengikuti urutan segmen di [Roadmap](../ROADMAP.md#urutan-prioritas-segmen): praktik mandiri lebih dulu, lalu klinik, puskesmas, dan rumah sakit.
- Prioritas P1–P3 ditentukan dari dampak ke keselamatan pasien, kewajiban regulasi, dan jumlah faskes yang terdampak.
- Product development membantu menyusun kriteria selesai dan memvalidasi hasil (uji alur bersama [Tester/QA](./TESTER-QA.md)).

## 5. Desain UI yang konsisten

- Komponen memakai **PrimeVue**; jangan membuat komponen baru bila PrimeVue sudah menyediakannya.
- Warna memakai **token Tailwind `opensimrs`** (mis. `bg-opensimrs-300`, `text-opensimrs-600`; variabel CSS `--opensimrs-*`), bukan kode warna tetap, karena tema dan logo bisa diatur per faskes.
- Ikuti pola yang sudah ada: header halaman satu baris, grup menu Penunjang, tombol **Lainnya** untuk menu yang tidak muat, status modul "Segera".
- Istilah memakai Bahasa Indonesia yang dipakai tenaga kesehatan; konsisten antar layar, cetakan, dan laporan.
- Rancangan (wireframe/mockup) dilampirkan di issue memakai data fiktif.
