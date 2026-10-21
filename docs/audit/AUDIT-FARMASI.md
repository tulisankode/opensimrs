# Audit Farmasi — alur transaksi dari awal sampai akhir

Tanggal audit: 21 Oktober 2026. Cakupan: Resep Dokter, Farmasi Ruangan (order alkes/BMHP), Retur Obat & Material, Penjualan Obat Bebas, Riwayat Transaksi, Laporan Farmasi, serta Stok Farmasi & Harga. Setiap alur dijalankan sungguhan lewat API pada faskes demo dengan data fiktif; bug yang ditemukan langsung diperbaiki dan diverifikasi ulang.

**Ringkasan:** 86 temuan, 75 diperbaiki, 11 belum — sebagian besar menunggu keputusan produk (bagian 4). Temuan terberat sebelum perbaikan:

- Fitur **Permintaan antar-depo dan Pengeluaran Unit** di modul Stok tidak pernah berhasil (alamat layanan salah).
- **Status resep dan order alkes bisa dilompati** — obat/alkes bisa "diserahkan" langsung dari Order Masuk tanpa potong stok dan tanpa tagihan; verifikasi ulang memotong stok dua kali.
- **Batal setelah verifikasi** tidak mengembalikan stok dan tidak menarik tagihan.
- **Order alkes dari RME tidak pernah ditagihkan**; obat bebas dijual seharga harga beli tanpa margin dan tidak pernah bisa berstatus Lunas.
- **Retur** alkes selalu galat; retur obat mengembalikan seluruh isi batch, bukan jumlah yang diretur; tagihan tidak dikoreksi.
- Banyak aksi bisa membaca/mengubah **data faskes lain** cukup dengan mengetahui UUID-nya.
- Laporan memakai tanggal UTC (resep 00.00–06.59 WIB tercatat hari sebelumnya) dan ekspor Excel hanya berisi halaman yang tampil.

---

## 1. Peta alur

```
Pengadaan (Inventory) ─► Gudang ─► Permintaan/Pengeluaran Unit (Stok) ─► Depo Farmasi (RJ/RI/IGD)
                                                                              │
          ┌────────────────────────────┬──────────────────────────┬──────────┴──────────────┐
          ▼                            ▼                          ▼                         ▼
   Resep Dokter (RME)        Farmasi Ruangan (alkes)     Penjualan Obat Bebas        Retur Unit
          │                            │                          │
          ▼                            ▼                          ▼
   Tagihan kunjungan (Kasir)   Tagihan kunjungan (Kasir)   Bayar di apotek
          │                            │
          └──────────► Retur Obat & Material (stok kembali + tagihan dikoreksi)
```

Prinsip yang berlaku di semua alur:

- **Stok baru berkurang saat verifikasi** (bukan saat order dibuat), dari depo order, mengikuti metode Konfigurasi Harga (FEFO/FIFO/LIFO), dan tercatat di kartu stok.
- **Harga jual = HPP × (1 + margin)**. HPP diambil sesuai metode di Konfigurasi Harga: rata-rata (`average`) atau harga beli terakhir (`last`). Kolom PPN di Konfigurasi Harga belum dipakai.
- **Faskes selalu diambil dari login**, bukan dari isian; data faskes lain ditolak (404).
- Waktu disimpan dalam epoch detik; petugas diambil dari akun yang login.

## 2. Alur per menu

### 2.1 Resep Dokter

| Status | Arti | Siapa / di mana | Efek |
|---|---|---|---|
| 1 | Resep Masuk | Dokter membuat resep di RME (RJ/IGD/RI; obat biasa & racikan) | Belum ada efek stok/tagihan. Boleh ubah obat, pindah depo, batal. |
| 2 | Sudah Ditelaah | Apoteker: Farmasi › Resep Dokter › pilih jenis stok, centang telaah administratif/farmasetik/klinis | Masih boleh ubah obat, pindah depo, batal. |
| 3 | Obat Disiapkan (terverifikasi) | Apoteker: Verifikasi | **Stok dipotong**, harga ditetapkan, **tagihan obat dikirim ke kunjungan** (racikan satu paket + biaya racik/embalase). |
| 4 | Siap Diserahkan | Apoteker: Siap Diserahkan | Tombol Batal mengembalikan ke status 3. |
| 5 | Diserahkan | Apoteker: Serahkan Obat (penerima, HP, edukasi) | **Pasien tunai RJ/IGD: tagihan harus sudah dibayar di kasir** (lunas atau ditutup kasir sebagai piutang); rawat inap & penjamin dikecualikan. Selesai; pengembalian hanya lewat Retur. |
| 6 | Diretur (sebagian/seluruh) | Farmasi › Retur Obat & Material | Stok kembali, tagihan dikoreksi baris negatif. |
| 0 | Dibatalkan | Batal di status 1–3 | Di status 3: stok kembali & tagihan ditarik (ditolak bila tagihan sudah ditutup di kasir). Status 4 harus "batal siap" dulu; status 5 tidak bisa dibatalkan. |

Urutan status kini dipaksa persis 1 → 2 → 3 → 4 → 5; lompatan ditolak dengan pesan yang jelas.

### 2.2 Farmasi Ruangan (order alkes/BMHP)

| Status | Arti | Efek |
|---|---|---|
| 1 | Order Masuk — dibuat dari RME (tab Alkes & Penunjang), Kamar Operasi (Pemakaian BHP), atau Hemodialisa | Harga masih perkiraan (HPP di depo tujuan). Boleh pilih jenis stok, ubah/hapus item, pindah depo, batal. |
| 2 | Sedang Disiapkan (terverifikasi) | **Stok dipotong**, harga ditetapkan, **tagihan Alkes dikirim ke kunjungan** (HPP + margin). Order dari Kamar Operasi/Hemodialisa tidak ditagih ulang karena sudah ditagihkan modulnya. |
| 3 | Siap Diserahkan | Batal siap → kembali ke 2. |
| 4 | Diserahkan | Aturan bayar sama dengan resep (BHP Kamar Operasi/Hemodialisa juga dikecualikan). Selesai; pengembalian lewat Retur. |
| 5 | Diretur | Stok kembali, tagihan dikoreksi. |
| 0 | Dibatalkan | Di status 2–3: stok kembali & tagihan ditarik. Status 4 tidak bisa dibatalkan. |

### 2.3 Retur Obat & Material

1. Daftar berisi resep berstatus 5–6 dan order alkes berstatus 4–5.
2. Detail menampilkan **sisa yang dapat diretur** (jumlah diambil dari stok − retur sebelumnya). Retur boleh bertahap sampai habis; racikan tidak dapat diretur.
3. Simpan retur: stok dikembalikan ke batch asal, resep → 6 / alkes → 5, dan tagihan kunjungan yang masih terbuka mendapat baris "Retur …" bernilai negatif **senilai HPP** (sama dengan `retur.total`). Bila tagihan sudah ditutup, pengembalian dana dilakukan manual di kasir (respons memberi tanda `tagihan_tertutup`).

### 2.4 Penjualan Obat Bebas

1. **Beli** → nomor `OTC…`, pilih depo, dokter (opsional), nama & HP pembeli.
2. Pilih item dan jenis stok; harga = HPP × (1 + margin); diskon rupiah **per baris**.
3. **Simpan** (status *belum lunas*): server menghitung ulang harga dan **memotong stok** depo.
4. Detail transaksi: **Terima Pembayaran** → *lunas* (baru masuk Laporan Pendapatan), atau **Batal Penjualan** (alasan wajib) → stok kembali, status *cancel*. Penjualan lunas tidak bisa dibatalkan.
5. Daftar: tab Belum Bayar / Lunas / Dibatalkan, filter tanggal & depo.

### 2.5 Riwayat Transaksi dan Laporan

| Menu | Yang dihitung |
|---|---|
| Riwayat › Resep | Resep status 5, alkes status 4 |
| Riwayat › Retur | Resep status 6, alkes status 5 |
| Riwayat › Batal | Status 0 |
| Laporan Pendapatan – Resep | Resep status 5–6, nilai bersih setelah retur; Grand Total seluruh periode |
| Laporan Pendapatan – Penjualan Obat | Penjualan bebas berstatus *lunas* |
| Laporan Waktu Tunggu | Resep 5–6; waktu = diserahkan − diverifikasi |
| Rekap Pendapatan per Apotik | Resep 5–6 per tanggal WIB × depo × metode bayar |

Semua laporan memakai hari WIB (atur `REPORT_TZ_OFFSET` bila server di zona lain); ekspor Excel memuat seluruh baris yang tersaring.

### 2.6 Stok dan harga

1. **Pengadaan (Inventory):** PO ke supplier (satuan beli) → penerimaan → stok dalam satuan terkecil per batch (item × jenis stok × lokasi × ED × harga); harga item (HPP, harga terakhir, rata-rata) diperbarui.
2. **Permintaan Unit (Stok):** depo peminta membuat permintaan; pemasok memverifikasi (alokasi batch FEFO/FIFO/LIFO; sisa yang belum disetujui menjadi permintaan baru); **Kirim** memindahkan stok. Permintaan ke gudang diverifikasi di Inventory › Pengiriman Unit; ke depo di Stok › Verifikasi & Pengiriman. Batal hanya sebelum dikirim.
3. **Pengeluaran Unit:** pemakaian unit, pengeluaran tanpa permintaan (pindah lokasi), atau pemusnahan.
4. **Retur Unit:** pengembalian antar-lokasi (rusak/kedaluwarsa/salah/sisa), stok langsung pindah.
5. **Kartu stok** menampilkan arah masuk/keluar berdasarkan jenis mutasi (sebelumnya retur & resep tampil sebagai masuk).

## 3. Temuan yang diperbaiki (ringkas per area)

| Area | Diperbaiki | Contoh paling berdampak |
|---|---|---|
| Resep Dokter | 15 dari 18 | Lompatan status; batal tanpa pengembalian stok/tagihan; akses lintas faskes; isian klien diteruskan utuh ke database; stok racikan hanya mencatat komponen terakhir; biaya racik paket kelebihan; verifikasi ganda; `total_harga` ≠ tagihan |
| Farmasi Ruangan & Retur | 20 dari 22 | Galat "circular structure" & aksi siap/serah/batal gagal; verifikasi ulang memotong stok dua kali; order RME tidak ditagihkan; harga BHP Kamar Operasi/HD selalu 0; retur alkes selalu 500; retur obat mengembalikan seluruh batch; tagihan tidak dikoreksi |
| Penjualan, Riwayat, Laporan | 17 dari 20 | Tidak bisa Lunas; jual tanpa margin; diskon tidak konsisten; laporan bergeser UTC; ekspor hanya halaman aktif; racikan di riwayat salah; riwayat lintas faskes |
| Stok & Harga | 23 dari 26 | Permintaan/pengeluaran unit selalu 500; alokasi batch berulang; HPP rata-rata salah (relasi stok); konversi satuan item lain terpakai; kartu stok arah terbalik; banyak endpoint datamaster/inventory tanpa filter faskes; lokasi berisi stok bisa dihapus |

Rincian per temuan (berkas & baris) ada di fragmen changelog: `changelog.d/fix-farmasi-resep-dokter.md`, `fix-farmasi-ruangan-retur.md`, `fix-farmasi-penjualan-laporan.md`, `fix-farmasi-stok-harga.md`.

Pencegahan: Audit cepat SIMRS Studio kini mendeteksi pola bug serupa (pemanggilan fungsi dengan argumen tidak cocok definisinya, transaksi terkirim ke parameter lain, dsb.).

## 4. Perlu keputusan produk

**Diputuskan pemilik (21 Oktober 2026):**

- **Obat dan alkes dibayar dulu, baru boleh diserahkan** — kecuali pasien rawat inap.
- **Basis nilai retur adalah HPP** — termasuk koreksi tagihan retur.
- **Fitur substitusi obat dibuat.**
- **PPN** sudah punya pengaturan per fitur yang belum diaktifkan; tidak diubah.
- Stok demo yang terpotong saat uji audit dengan kode lama sudah dikoreksi (kartu stok: `KOREKSI-UJI-AUDIT-*`).

Sisa yang masih terbuka:

| No | Topik | Pilihan |
|---|---|---|
| 1 | Pembayaran obat bebas | (a) tetap bayar di apotek, tambah metode bayar/petugas/waktu bayar; atau (b) masuk Kasir (payment-service perlu tagihan tanpa pasien terdaftar). |
| 2 | Obat pasien tunai | **Diterapkan:** dibayar dulu baru diserahkan (lihat 2.1/2.2 dan `changelog.d/feat-farmasi-bayar-sebelum-serah.md`). Masih terbuka: iur biaya pasien penjamin (selisih yang tidak ditanggung) dan pasien IGD yang dirawat inap. |
| 3 | Nilai retur | **Diterapkan:** HPP untuk `retur.total`, tampilan, dan koreksi tagihan; laporan pendapatan = harga jual tertagih − HPP retur. |
| 4 | Retur setelah tagihan ditutup | Perlu dokumen refund resmi (saat ini manual di kasir). |
| 5 | BHP Kamar Operasi/Hemodialisa | Ditagih HPP tanpa margin (beda dengan alkes RME). |
| 6 | Substitusi obat | **Selesai (2026-10-21):** tabel `prescription_item_substitutions`, izin SUBSTITUSI, dan tombol Substitusi di detail Resep Dokter (status 1–2, non-racikan). Yang masih perlu dikonfirmasi: apakah persetujuan dokter wajib untuk kategori alasan tertentu. |
| 7 | Antrian farmasi | Belum terhubung otomatis ke resep. |
| 8 | PPN | PPN pembelian di-hardcode 11%; kolom PPN Konfigurasi Harga belum dipakai; tentukan apakah HPP termasuk PPN. |
| 9 | Penomoran & satuan | Nomor transaksi acak 4 karakter (risiko ganda); jumlah obat pecahan; waktu tunggu dihitung dari verifikasi (standar mutu biasanya sejak resep diterima). |

Data lama: resep/alkes yang diverifikasi sebelum perbaikan tidak membawa penanda tagihan; bila dibatalkan, tagihannya perlu dihapus manual di kasir, dan order alkes RME lama memang belum pernah ditagihkan.
