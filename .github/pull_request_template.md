<!-- Judul PR mengikuti konvensi commit, mis. "fix(lab): B-45 pembuatan order lab dalam satu transaksi".
     Aturan lengkap: docs/kontributor/ALUR-GIT-RILIS.md -->

## Apa dan mengapa

<!-- Ringkas perubahan dan alasannya. Sebut ID backlog / issue, mis. "B-22", "Menutup #123". -->

## Cara menguji

<!-- Akun demo + segmen/faskes demo, langkah, hasil yang diharapkan. Screenshot hanya dengan data demo. -->

## Dampak

- [ ] Ada migrasi database baru (nama berkas: `…`; berurutan paling akhir & idempoten)
- [ ] Mengubah SDK `packages/*` (versi SDK sudah dinaikkan)
- [ ] Mengubah API yang dipakai pihak luar / integrasi (SATUSEHAT, BPJS, LIS, aplikasi mobile)
- [ ] Mengubah alur/form klinis (perlu reviewer tenaga medis/klinis)
- [ ] Perubahan tidak kompatibel (ditandai **⚠ Tidak kompatibel** di CHANGELOG + langkah pembaruan)

## Checklist

- [ ] CI hijau dan sudah diuji lokal
- [ ] Fragmen CHANGELOG `changelog.d/<nama-branch>.md` (bila terasa oleh pengguna/implementator; jangan edit `CHANGELOG.md` langsung)
- [ ] Dokumen ikut diperbarui (bila perintah, `.env`, atau langkah instalasi berubah)
- [ ] Tidak ada `.env`, kredensial, IP server faskes, atau data/screenshot pasien asli
