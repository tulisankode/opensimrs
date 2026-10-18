# Fragmen CHANGELOG

Setiap PR menulis catatan perubahannya di **berkas sendiri** di folder ini, bukan langsung di `CHANGELOG.md`. Dengan begitu, PR yang dikerjakan bersamaan tidak saling konflik di bagian *[Belum dirilis]*.

## Nama berkas

| Asal perubahan | Nama berkas | Contoh |
|---|---|---|
| Item SIMRS Studio | `STD-<nomor 4 digit>.md` | `changelog.d/STD-0031.md` |
| PR kontributor | nama branch, `/` diganti `-` | `changelog.d/feat-123-filter-ruangan.md` |

Nama berkas hanya boleh berisi huruf, angka, titik, minus, dan garis bawah.

## Isi

Isinya sama dengan bagian *[Belum dirilis]* di `CHANGELOG.md`, tetapi tanpa judul versi. Gunakan judul `### <Kategori>` dengan salah satu kategori berikut: **Ditambahkan**, **Diubah**, **Usang**, **Dihapus**, **Diperbaiki**, **Keamanan**. Setiap kategori berisi butir daftar (`- …`), boleh dengan sub-butir.

```markdown
### Ditambahkan
- **Gizi: daftar diet pasien rawat inap** (B-52): filter ruangan dan cetak label diet.
  - **Migrasi baru:** `20261019090000-gizi_label_diet`.

### Diperbaiki
- Kasir: total tagihan tidak lagi menghitung ulang diskon dua kali.
```

## Pemeriksaan & penggabungan

- `node scripts/cek-integritas.mjs` (juga dijalankan CI) memeriksa nama berkas dan format setiap fragmen.
- `node scripts/gabung-changelog.mjs --cek` hanya memeriksa format.
- Saat rilis, maintainer menjalankan `node scripts/gabung-changelog.mjs`. Skrip ini memindahkan semua fragmen ke `CHANGELOG.md` bagian *[Belum dirilis]* per kategori (urut nomor STD, lalu nama berkas), lalu menghapus fragmennya.
