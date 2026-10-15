# Peran Kontributor OpenSIMRS

Di OpenSIMRS, **semua peran adalah Contributor**. Tidak ada kontribusi "kelas dua": memasang OpenSIMRS di puskesmas, menulis skenario uji, memvalidasi alur resep sebagai apoteker, dan menulis kode sama-sama memajukan proyek.

Dokumen terkait: [Panduan Kontribusi](../../CONTRIBUTING.md) · [Tata Kelola](../../GOVERNANCE.md) · [Kode Etik](../../CODE_OF_CONDUCT.md) · [Komunitas](../../COMMUNITY.md) · [Roadmap](../ROADMAP.md)

---

## Empat bidang kontribusi

| Bidang | Siapa | Panduan |
|---|---|---|
| **Implementator** | IT rumah sakit/faskes, mahasiswa, atau mitra yang memasang dan mendampingi OpenSIMRS di faskes | [IMPLEMENTATOR.md](./IMPLEMENTATOR.md) |
| **Developer** | Pengembang backend/frontend, mahasiswa informatika | [DEVELOPER.md](./DEVELOPER.md) |
| **Tester/QA** | Penguji manual/otomatis, mahasiswa, staf faskes yang teliti | [TESTER-QA.md](./TESTER-QA.md) |
| **Product development** | Analis kebutuhan, tenaga medis/klinis (dokter, perawat, apoteker, analis lab, perekam medis), desainer UX | [PRODUCT-DEV.md](./PRODUCT-DEV.md) |

Untuk semua bidang: **[Versi, Branch, dan Aturan Merge](./ALUR-GIT-RILIS.md)** — versioning, nama branch, syarat persetujuan PR, cara merge, dan proses rilis.

Satu orang boleh aktif di lebih dari satu bidang.

---

## Jenjang

| Jenjang | Ciri | Cara mencapai |
|---|---|---|
| **Contributor** | Pernah menyumbang: PR, laporan bug yang lengkap, skenario uji, masukan klinis di issue, dokumentasi, atau laporan implementasi | Kontribusi pertama diterima |
| **Reviewer** (per bidang) | Dipercaya meninjau kontribusi orang lain di bidangnya, mis. reviewer farmasi, reviewer QA, reviewer implementasi | Kontribusi konsisten dan berkualitas di bidang itu; diusulkan maintainer bidang |
| **Maintainer** (per bidang/modul) | Menggabungkan PR, menjaga kualitas dan dokumentasi bidang/modul, membimbing kontributor baru | Aktif sebagai reviewer; ditetapkan Core Maintainer ([GOVERNANCE.md](../../GOVERNANCE.md)) |

Jenjang bersifat **per bidang**: seseorang bisa menjadi Maintainer modul laboratorium sekaligus Contributor di bidang QA.

---

## Cara bergabung

1. Bergabung ke kanal komunitas ([Telegram](https://t.me/+uW2ZQA1V7Dc3OTVl), [Discord](https://discord.gg/qAWhdzGJTW), [WhatsApp](https://chat.whatsapp.com/EULeLrLPMcC6vNKV4AxHQj?mode=gi_t); aturan di [COMMUNITY.md](../../COMMUNITY.md)) dan perkenalkan diri: bidang yang diminati dan latar belakang singkat.
2. Baca panduan bidang Anda (tabel di atas) dan [Kode Etik](../../CODE_OF_CONDUCT.md).
3. Coba OpenSIMRS dengan data demo ([Petunjuk Instalasi, jalur A](../INSTALLATION_GUIDE.md#4-jalur-a--coba-cepat-dengan-data-demo-lokal)).
4. Pilih pekerjaan pertama di [Roadmap](../ROADMAP.md#6-backlog) atau issue berlabel `good first issue`, `butuh tenaga medis/klinis`, `dokumentasi`; klaim sesuai [cara mengklaim](../ROADMAP.md#5-cara-memilih--mengklaim-pekerjaan).

---

## Rekognisi

- **Daftar kontributor**: setiap kontributor yang kontribusinya diterima dicantumkan di catatan rilis ([CHANGELOG](../../CHANGELOG.md)) dan daftar kontributor repositori, termasuk kontribusi non-kode (laporan implementasi, validasi klinis, skenario uji).
- **Label issue/PR** menandai bidang kontribusi (`area:*`, `modul:*`, `butuh tenaga medis/klinis`, `integrasi`, `dokumentasi`), sehingga jejak kontribusi per bidang mudah dilihat.
- **Pengakuan jenjang**: Reviewer dan Maintainer per bidang diumumkan di kanal komunitas.
- **Kegiatan akademik**: untuk kerja praktik, tugas kuliah, atau skripsi, maintainer dapat membantu memilih lingkup dan memberi umpan balik; sebutkan di issue yang Anda klaim.
