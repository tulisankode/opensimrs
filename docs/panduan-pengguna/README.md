# Panduan Pengguna OpenSIMRS

Panduan cara memakai OpenSIMRS untuk petugas fasilitas kesehatan, dikelompokkan per modul. Panduan ini juga menjadi bahan pengetahuan **asisten Helpdesk** (lihat [rancangan](../rancangan/HELPDESK-OPENCLAW.md)), jadi tulislah sejelas mungkin. Asisten hanya bisa menjawab apa yang tertulis di sini.

> Status: **draf** untuk semua modul (2026-10-16, diperbarui 2026-10-19), disusun AI dari kode aplikasi. Setiap berkas punya bagian *Catatan untuk peninjau* berisi hal yang perlu dipastikan. Setiap draf wajib ditinjau petugas yang memakai modul itu sebelum dipakai asisten.

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
| Mutu & Akreditasi | Mutu & Akreditasi | `mutu.md` | draf |
| HR / SDM | HR / SDM | `sdm.md` | draf |

Dashboard Eksekutif dibahas di `dashboard.md`. Rencana Kontrol & SPRI BPJS dibahas di `bpjs-fkrtl.md`. Audit Trail, Konfigurasi Integrasi, dan Mode Pengembang dibahas di `setting.md`.

## Modul lain (belum punya panduan di sini)

Modul berikut sudah tersedia di aplikasi, tetapi belum punya panduan pengguna di folder ini. Untuk sementara, rujuk dokumentasi resmi:

| Modul | Menu | Dokumentasi resmi |
|---|---|---|
| ICU / Intensif | ICU | https://docs.opensimrs.com/modul/penunjang-medis#icu-intensif |
| Kamar Operasi | Kamar Operasi | https://docs.opensimrs.com/modul/penunjang-medis#kamar-operasi |
| Unit Hemodialisa | Hemodialisa | https://docs.opensimrs.com/modul/penunjang-medis#unit-hemodialisa |
| Gizi | Gizi | https://docs.opensimrs.com/modul/penunjang-medis#gizi |
| Koding & Rekam Medis | Koding Rekam Medis | https://docs.opensimrs.com/modul/penunjang-medis#koding-rekam-medis |
| CSSD | CSSD | https://docs.opensimrs.com/modul/penunjang-medis#cssd |
| Bank Darah RS (BDRS) | Bank Darah RS (BDRS) | https://docs.opensimrs.com/modul/penunjang-medis#bank-darah-rs-bdrs |
| UTD / UPTD Produksi Darah | UTD | https://docs.opensimrs.com/modul/penunjang-medis#utd-uptd-produksi-darah |
| Program Puskesmas | Program Puskesmas | https://docs.opensimrs.com/modul/penunjang-medis#program-puskesmas |
| Laundry & Linen | Laundry | https://docs.opensimrs.com/modul/penunjang-umum#laundry-linen |
| Sarana dan Prasarana (IPSRS) | Sarana dan Prasarana (IPSRS) | https://docs.opensimrs.com/modul/penunjang-umum#sarana-dan-prasarana-ipsrs |
| Manajemen Ambulans | Manajemen Ambulans | https://docs.opensimrs.com/modul/penunjang-umum#manajemen-ambulans |
| Kelas Training | Training | https://docs.opensimrs.com/modul/penunjang-umum#kelas-training |

Peta seluruh modul, preset per segmen faskes, dan cara mengaktifkannya ada di https://docs.opensimrs.com/modul/. Modul **Akuntansi & Remunerasi** masih dalam pengembangan dan tampil di menu **Segera**.

> Menu yang tidak muat di baris menu atas dipindah ke tombol **Lainnya** (ada kotak cari). Modul penunjang dikelompokkan dalam menu **Penunjang**.

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
