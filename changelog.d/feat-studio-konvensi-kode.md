### Ditambahkan
- **SIMRS Studio: cek "Konvensi kode" di pemeriksa kebijakan, ditambah aturan platform untuk agen.** Pola yang pernah lolos lalu rusak setelah diterapkan (STD-0043/0044/0048) kini ditolak sebelum kode disetujui:
  - parameter SQL yang menempel pada `<`;
  - rute modul dengan `layout: DefaultLayout`, yang membuat halaman tampil tanpa header dan sidebar;
  - halaman baru tanpa `PageToolbar`.

  Aturan prompt agen juga meminta pola halaman Card + PageToolbar + komponen `Custom*` serta pilihan data berdasarkan nama, bukan isian UUID.
- Cek "Konvensi kode" diperketat setelah halaman Penggajian (STD-0041) lolos. Halaman baru kini wajib memuat `Card` dan `PageToolbar`. Pemakaian `prompt()`/`confirm()`/`alert()` peramban dan isian berlabel UUID juga ditolak.
