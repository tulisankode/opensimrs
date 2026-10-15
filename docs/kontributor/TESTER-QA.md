# Panduan Tester/QA

Untuk penguji manual maupun otomatis. Pengujian yang baik mencegah bug sampai ke faskes dan pasien.

Dokumen terkait: [Rencana Pengujian](../testing/rencana-testing.md) · [Audit Menu](../audit/README.md) · [Petunjuk Instalasi](../INSTALLATION_GUIDE.md) · [Peran kontributor](./README.md)

---

## 1. Menguji dengan akun demo per segmen

Pasang OpenSIMRS dengan data demo ([jalur A](../INSTALLATION_GUIDE.md#4-jalur-a--coba-cepat-dengan-data-demo-lokal)). `npm run db:demo:seed` membuat 8 faskes fiktif, satu per segmen:

| Segmen | Awalan akun | Contoh akun |
|---|---|---|
| Dokter praktik mandiri | `pm` | `pm.dr.andi`, `pm.asisten` |
| Klinik pratama | `kp` | `kp.pendaftaran`, `kp.kasir` |
| Klinik utama | `ku` | `ku.perawat` |
| Puskesmas | `pkm` | `pkm.apoteker` |
| RS kelas D / C / B / A | `rsd` / `rsc` / `rsb` / `rsa` | `rsd.kasir`, `rsa.lab` |

- Kata sandi: nilai `DEMO_PASSWORD`, bawaan `Demo@2026`. Pola lengkap: [akun demo](../INSTALLATION_GUIDE.md#akun-demo).
- Uji dengan **akun peran yang sesuai**, bukan hanya `superadmin`, agar masalah izin ikut terlihat.
- Untuk fitur yang bergantung segmen, uji di **satu segmen yang mengaktifkan** dan **satu yang mematikannya**.
- Data transaksi realistis: `npm run db:demo:transaksi`.

## 2. Skenario uji

- Skenario baku (fungsional, negatif, integrasi, regresi) ada di [rencana-testing.md](../testing/rencana-testing.md), dengan prioritas per skenario.
- Temuan per menu ada di [audit menu](../audit/README.md).
- Setiap bug yang diperbaiki mendapat **baris regresi** baru di rencana pengujian.

## 3. Format laporan bug

Buka GitHub Issue dengan isi:

```
Judul: [modul] ringkasan singkat masalah

Segmen/faskes demo : mis. Klinik pratama (KPS), akun kp.kasir
Versi/commit       : mis. 1.0.0-alpha.1 / a1b2c3d
Instalasi          : Docker / native, OS, browser

Langkah:
1. ...
2. ...

Hasil yang diharapkan:
...

Hasil yang terjadi:
...

Severity: P1 / P2 / P3
Lampiran: tangkapan layar / log (TANPA data pasien asli, kata sandi, token)
```

Tangkapan layar **wajib** dari data demo atau data fiktif; jangan pernah memakai data pasien asli. Hapus kata sandi, token, dan alamat server dari log.

## 4. Severity

| Severity | Arti | Contoh |
|---|---|---|
| **P1** | Menghalangi pemakaian nyata, berisiko ke keselamatan pasien, kehilangan/kebocoran data, atau tagihan salah | Resep tertukar pasien, tagihan ganda, data faskes lain terlihat |
| **P2** | Fungsi penting terganggu tetapi ada jalan keluar | Cetak kuitansi tidak menampilkan diskon |
| **P3** | Minor/kosmetik | Salah ketik label, tata letak bergeser |

Celah keamanan **tidak** dilaporkan di issue publik; kirim ke `dev@opensimrs.id` ([SECURITY.md](../../SECURITY.md)).

## 5. Regresi

- Sebelum rilis, jalankan semua skenario **P1** di rencana pengujian; semuanya harus lulus.
- Setelah perbaikan besar di suatu modul, ulangi skenario modul itu dan alur end-to-end yang melewatinya (daftar → periksa → resep → farmasi → kasir).
- Uji migrasi: `npm run db:migrate` dua kali pada database baru (dilakukan otomatis oleh CI).

## 6. Verifikasi perbaikan

1. Ambil branch PR atau `main` setelah digabung; jalankan `npm run db:migrate` bila ada migrasi baru.
2. Ulangi langkah reproduksi di laporan dengan segmen dan akun yang sama.
3. Uji juga segmen pembanding dan alur terkait (tidak ada efek samping).
4. Komentari di issue/PR: **terverifikasi** atau **belum** (dengan langkah dan hasil). Issue ditutup setelah terverifikasi.
