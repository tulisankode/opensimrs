# Komunitas OpenSIMRS

Halaman ini adalah **sumber utama** daftar kanal resmi komunitas OpenSIMRS dan aturan mainnya. Bila tautan undangan berubah, perbarui berkas ini terlebih dahulu (lalu bagian kontak di README).

Website resmi: [OpenSIMRS.my.id](https://opensimrs.my.id)

---

## Kanal resmi

Kanal komunitas resmi **hanya tiga**. Kanal lain yang mengatasnamakan OpenSIMRS bukan kanal resmi.

| Kanal | Tujuan | Tautan |
|---|---|---|
| **Grup Telegram** | Pengumuman dan diskusi umum | [Gabung grup Telegram](https://t.me/+uW2ZQA1V7Dc3OTVl) |
| **Server Discord** | Diskusi teknis per kanal: `#pengembangan`, `#implementasi`, `#qa`, `#produk`, `#bantuan-instalasi` | [Gabung server Discord](https://discord.gg/VNpKKgWw) |
| **Grup WhatsApp** | Koordinasi cepat implementator/faskes dan pengumuman penting | [Gabung grup WhatsApp](https://chat.whatsapp.com/EULeLrLPMcC6vNKV4AxHQj?mode=gi_t) |

Pindai kode QR berikut dari ponsel untuk bergabung:

<table>
  <tr>
    <td align="center"><img src="./docs/assets/komunitas/qr-telegram.jpeg" alt="QR grup Telegram OpenSIMRS" width="200"/><br/><b>Telegram</b></td>
    <td align="center"><img src="./docs/assets/komunitas/qr-whatsapp.jpeg" alt="QR grup WhatsApp OpenSIMRS" width="200"/><br/><b>WhatsApp</b></td>
  </tr>
</table>

Selain kanal di atas:

- **GitHub Issues & Pull Request** di [github.com/tulisankode/opensimrs](https://github.com/tulisankode/opensimrs) dipakai untuk **pelacakan pekerjaan teknis** (bug, backlog, RFC, review kode), bukan sebagai forum diskusi.
- **Email `dev@opensimrs.id`** untuk pertanyaan umum, laporan keamanan, dan laporan pelanggaran kode etik.

---

## Aturan main forum

Berlaku di ketiga kanal, sebagai pelengkap [Kode Etik](./CODE_OF_CONDUCT.md).

1. **Sopan dan berbahasa Indonesia** yang baik. Istilah teknis dalam bahasa Inggris boleh dipakai seperlunya.
2. **Dilarang membagikan**:
   - data pasien atau rekam medis dalam bentuk apa pun;
   - tangkapan layar yang memuat identitas pasien (nama, NIK, No. RM, nomor BPJS, alamat, foto);
   - kredensial (kata sandi, token, API key, *client secret*) dan isi berkas `.env`;
   - alamat IP atau host server faskes.

   Gunakan data demo (`npm run db:demo:seed`) untuk contoh dan tangkapan layar. Bila terlanjur terkirim, segera hapus pesannya dan rotasi kredensial yang bocor.
3. **Celah keamanan dilaporkan secara privat** ke `dev@opensimrs.id` sesuai [SECURITY.md](./SECURITY.md), **bukan** di grup.
4. **Pertanyaan teknis yang berulang** atau laporan bug diarahkan ke **GitHub Issue** agar jawabannya terdokumentasi dan bisa dicari orang lain. Moderator dapat meminta penanya membuat issue dan menautkannya di kanal.
5. **Tanpa spam dan promosi.** Promosi produk/jasa, lowongan, atau tautan berbayar hanya dengan izin moderator.
6. **Tetap pada topik kanal.** Di Discord, pilih kanal yang sesuai; di WhatsApp, utamakan koordinasi dan pengumuman, bukan diskusi panjang.
7. Hormati waktu relawan: maintainer dan anggota menjawab secara sukarela.

---

## Moderasi dan sanksi

Pelanggaran ditangani bertahap:

| Tahap | Tindakan |
|---|---|
| 1 | **Peringatan** (pesan dihapus bila perlu, pengirim diingatkan) |
| 2 | **Mute**/pembatasan sementara |
| 3 | **Dikeluarkan** dari kanal |

Pelanggaran berat (menyebarkan data pasien, pelecehan, penipuan) dapat langsung dikenai tahap 3 dan dilaporkan ke maintainer. Keberatan atas tindakan moderasi dikirim ke `dev@opensimrs.id`.

---

## Peran admin dan moderator

| Peran | Tugas |
|---|---|
| **Admin kanal** | Mengelola pengaturan grup/server, tautan undangan, dan menunjuk moderator. Dipegang Core Maintainer ([GOVERNANCE.md](./GOVERNANCE.md)). |
| **Moderator** | Menegakkan aturan forum, menyambut anggota baru, mengarahkan pertanyaan ke kanal/issue yang tepat, dan menghapus konten yang melanggar. Ditunjuk dari Contributor aktif. |

Admin dan moderator tetap tunduk pada aturan yang sama dan wajib menjaga kerahasiaan laporan yang mereka terima.

---

## Mulai berkontribusi

- Kenali peran Anda: [docs/kontributor/](./docs/kontributor/README.md) (implementator, developer, tester/QA, product development).
- Pasang dan coba: [Petunjuk Instalasi](./docs/INSTALLATION_GUIDE.md).
- Pilih pekerjaan: [Roadmap & Backlog](./docs/ROADMAP.md).
