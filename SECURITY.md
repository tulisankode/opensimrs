# Kebijakan Keamanan OpenSIMRS

OpenSIMRS mengelola data kesehatan. Keamanan data pasien adalah prioritas utama proyek ini.

---

## Versi yang didukung

| Versi | Didukung |
|---|---|
| Rilis terbaru (`1.0.0-alpha.x`) dan branch `main` | Ya |
| Versi sebelumnya | Tidak |

Selama status alfa, perbaikan keamanan hanya dirilis untuk versi terbaru. Perbarui instalasi Anda secara berkala ([Petunjuk Instalasi bagian 10](./docs/INSTALLATION_GUIDE.md#10-pemeliharaan-pembaruan--cadangan)).

---

## Melaporkan kerentanan

**Jangan** melaporkan kerentanan lewat GitHub Issues, Pull Request publik, atau kanal komunitas (grup Telegram, Discord, WhatsApp; lihat [COMMUNITY.md](./COMMUNITY.md)). Website resmi proyek: [OpenSIMRS.my.id](https://opensimrs.my.id).

Kirim laporan secara privat ke **dev@opensimrs.id** dengan isi:

- deskripsi singkat kerentanan;
- langkah reproduksi (memakai data demo, **bukan** data pasien nyata);
- versi/commit OpenSIMRS dan cara instalasi;
- potensi dampak;
- bukti pendukung bila ada (tanpa kredensial dan data pasien).

---

## Waktu tanggapan

- Tanda terima: paling lambat 48 jam.
- Penilaian awal: paling lambat 5 hari kerja.
- Perbaikan/mitigasi: sesuai tingkat keparahan; pelapor dikabari perkembangannya.

Setelah perbaikan dirilis, kerentanan dicatat di [CHANGELOG](./CHANGELOG.md) bagian **Keamanan**.

---

## Praktik keamanan untuk kontributor dan implementator

- Jangan menyimpan atau memakai data pasien nyata untuk pengujian; gunakan data demo.
- Simpan kredensial hanya di `.env` (tidak pernah di-commit) atau secret manager. Aturan per lingkungan ada di [Lingkungan](./docs/LINGKUNGAN.md).
- `SECRET_KEY` dan kunci API internal dibuat acak (`openssl rand -hex 32`), berbeda di setiap lingkungan, dan dirotasi bila bocor.
- Pakai HTTPS; jangan membuka port database (5432, 27017, 6379) ke luar server.
- Periksa dependensi secara berkala dan perbarui bila ada kerentanan yang diketahui.
- Bila terlanjur meng-commit rahasia, **rotasi** rahasia tersebut segera lalu kabari maintainer secara privat.

---

## Kepatuhan

OpenSIMRS dirancang untuk membantu faskes memenuhi ketentuan Kementerian Kesehatan (termasuk ketentuan rekam medis dan SATUSEHAT), BPJS Kesehatan, dan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Kepatuhan di setiap faskes tetap menjadi tanggung jawab penyelenggara faskes.

---

## Pengungkapan bertanggung jawab

Kami menghargai pelapor keamanan dan akan mencantumkan kredit di catatan rilis bila pelapor mengizinkan. Mohon beri kami waktu memperbaiki sebelum kerentanan diungkapkan ke publik.
