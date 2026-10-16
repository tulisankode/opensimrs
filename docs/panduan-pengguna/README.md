# Panduan Pengguna OpenSIMRS

Panduan cara memakai OpenSIMRS untuk petugas fasilitas kesehatan, dikelompokkan per modul. Panduan ini juga menjadi bahan pengetahuan **asisten Helpdesk** (lihat [rancangan](../rancangan/HELPDESK-OPENCLAW.md)), jadi tulislah sejelas mungkin. Asisten hanya bisa menjawab apa yang tertulis di sini.

> Status: **draf** untuk semua modul (2026-10-16), disusun AI dari kode aplikasi. Setiap berkas punya bagian *Catatan untuk peninjau* berisi hal yang perlu dipastikan. Setiap draf wajib ditinjau petugas yang memakai modul itu sebelum dipakai asisten.

## Daftar modul

| Modul | Menu | Berkas | Status (belum / draf / ditinjau) |
|---|---|---|---|
| Dashboard | Dashboard | `dashboard.md` | draf |
| Pendaftaran Pasien | Admisi | `pendaftaran.md` | draf |
| RME Rawat Jalan | Rawat Jalan | `rawat-jalan.md` | draf |
| Kasir & Pembayaran | Pembayaran | `pembayaran.md` | draf |
| Data Master | Datamaster | `datamaster.md` | draf |
| Laporan | Laporan | `laporan.md` | draf |
| SATUSEHAT | (Setting) | `satusehat.md` | draf |
| Antrian & Layar Panggil | Antrian | `antrian.md` | draf |
| Farmasi | Farmasi | `farmasi.md` | draf |
| Gudang & Pengadaan | Inventory | `inventory.md` | draf |
| Laboratorium | Laboratorium | `laboratorium.md` | draf |
| Fisioterapi / Rehabilitasi Medik | Fisioterapi | `fisioterapi.md` | draf |
| Radiologi | Radiologi | `radiologi.md` | draf |
| Rawat Inap | Rawat Inap | `rawat-inap.md` | draf |
| IGD | IGD | `igd.md` | draf |
| BPJS FKTP (PCare) | (Setting & layanan) | `bpjs-fktp.md` | draf |
| BPJS FKRTL (VClaim/SEP) | (Admisi & layanan) | `bpjs-fkrtl.md` | draf |
| Medical Check Up (MCU) | MCU | `mcu.md` | draf |
| Patologi Anatomi | Patologi Anatomi | `patologi-anatomi.md` | draf |
| Mikrobiologi | Mikrobiologi | `mikrobiologi.md` | draf |
| Akun, peran & pengaturan | Setting | `setting.md` | draf |

## Templat per modul

Salin templat ini untuk setiap berkas modul:

```markdown
# <Nama modul>

**Dipakai oleh:** <peran, mis. petugas pendaftaran>
**Menu:** <Menu › Submenu>
**Hak akses yang dibutuhkan:** <modul izin › submodul › aksi>

## Untuk apa
<1–3 kalimat: masalah yang diselesaikan modul ini>

## Tugas sehari-hari
### <Tugas, mis. Mendaftarkan pasien baru>
1. Buka **Menu › Submenu**.
2. …
**Hasilnya:** <yang terlihat setelah berhasil>

## Pesan galat yang sering muncul
| Pesan | Arti | Yang perlu dilakukan |
|---|---|---|

## Pertanyaan yang sering diajukan
**<Pertanyaan>?** <Jawaban singkat>

## Bila menu tidak muncul
- Modul belum aktif untuk faskes: superadmin › **Setting › Manajemen Modul**.
- Peran belum punya izin: admin › **Datamaster › Role**.
```

## Aturan penulisan

- Gunakan Bahasa Indonesia sehari-hari yang jelas, dengan nama menu dan tombol persis seperti di layar (huruf tebal).
- Contoh data harus fiktif: NIK berawalan `9999`, HP `080000000000`, email `@contoh.id`. Jangan pakai screenshot berisi data pasien asli.
- Jangan menulis saran klinis (dosis, diagnosis). Panduan hanya menjelaskan cara memakai aplikasi.
