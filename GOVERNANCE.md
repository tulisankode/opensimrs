# Tata Kelola Komunitas OpenSIMRS

Dokumen ini menjelaskan peran dan cara pengambilan keputusan di proyek **OpenSIMRS**.

---

## Filosofi

- Transparan: keputusan penting dibahas dan diumumkan secara terbuka.
- Terbuka: siapa pun boleh berkontribusi.
- Berorientasi jangka panjang.
- Melindungi kepentingan pasien, fasilitas kesehatan, dan komunitas.

---

## Peran

Semua orang yang berkontribusi adalah **Contributor**, apa pun bidangnya (implementator, developer, tester/QA, product development). Jenjang dan cara bergabung dijelaskan di [docs/kontributor/](./docs/kontributor/README.md).

| Peran | Tanggung jawab | Ditetapkan oleh |
|---|---|---|
| **Contributor** | Menyumbang kode, dokumentasi, pengujian, laporan lapangan, atau masukan klinis; mengikuti [CONTRIBUTING.md](./CONTRIBUTING.md) dan [Kode Etik](./CODE_OF_CONDUCT.md). | – |
| **Reviewer** (per bidang) | Meninjau PR, laporan bug, atau usulan fitur di bidangnya (mis. farmasi, laboratorium, QA, implementasi). | Maintainer bidang terkait |
| **Maintainer** (per bidang/modul) | Menjaga kualitas modul/bidang tertentu, menggabungkan PR, memelihara dokumentasi bidangnya. | Core Maintainer |
| **Core Maintainer** | Arsitektur inti, roadmap teknis, rilis, keamanan & kepatuhan, penetapan maintainer. | Kesepakatan Core Maintainer |
| **Moderator kanal** | Menjaga ketertiban grup Telegram, Discord, dan WhatsApp sesuai [COMMUNITY.md](./COMMUNITY.md). | Core Maintainer |

Pengguna (rumah sakit, klinik, puskesmas, akademisi, implementator) adalah bagian komunitas meskipun belum berkontribusi kode.

---

## Pengambilan keputusan

| Jenis keputusan | Mekanisme |
|---|---|
| Perbaikan bug | PR + persetujuan satu maintainer |
| Fitur kecil | PR + review |
| Perubahan besar (struktur data, kontrak API, alur klinis) | RFC + diskusi terbuka |
| Arsitektur inti dan rilis | Core Maintainer |

---

## RFC (Request for Comments)

Untuk perubahan besar:

1. Buat issue GitHub berlabel `RFC`.
2. Jelaskan tujuan, alternatif, dan dampaknya (termasuk ke data lama dan alur klinis).
3. Diskusi minimal 7 hari. Kanal komunitas boleh dipakai untuk mengundang masukan, tetapi keputusan dan ringkasannya dicatat di issue.
4. Keputusan diumumkan terbuka dan, bila menyangkut desain, dicatat di [ROADMAP](./docs/ROADMAP.md#7-keputusan-desain-yang-sudah-diambil).

---

## Lisensi dan pemakaian komersial

OpenSIMRS dirilis di bawah [Lisensi MIT](./LICENSE). Siapa pun, termasuk mitra implementator komersial, boleh memakai, memasang, dan menawarkan jasa di atas OpenSIMRS sesuai lisensi. Perbaikan dan fitur yang berguna bagi faskes lain sangat dianjurkan untuk dikontribusikan kembali ke repositori ini.

---

## Kontak

- Umum, keamanan, dan kode etik: **dev@opensimrs.id**
- Website resmi: [OpenSIMRS.my.id](https://opensimrs.my.id)
- Kanal komunitas: [Telegram](https://t.me/+uW2ZQA1V7Dc3OTVl) · [Discord](https://discord.gg/VNpKKgWw) · [WhatsApp](https://chat.whatsapp.com/EULeLrLPMcC6vNKV4AxHQj?mode=gi_t) (aturan di [COMMUNITY.md](./COMMUNITY.md))
- Pelacakan pekerjaan teknis: GitHub Issues & Pull Request di `github.com/tulisankode/opensimrs`
