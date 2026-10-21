### Ditambahkan
- **Farmasi › Persetujuan Substitusi: substitusi obat wajib disetujui dokter.** Dialog Substitusi di Resep Dokter kini meminta apoteker memilih salah satu dari dua jalur:
  - **Ajukan ke dokter** (bawaan). Pengajuan berstatus menunggu dan obat pada resep belum diganti. Resep tidak bisa diverifikasi selama masih ada pengajuan menunggu. Item resep diberi penanda "Menunggu persetujuan dokter", dan apoteker bisa membatalkan pengajuannya.
  - **Sudah dikonfirmasi dokter (lisan/telepon).** Apoteker mencatat nama dokter dan cara konfirmasi (telepon, lisan/tatap muka, pesan langsung). Substitusi langsung berlaku, lalu tetap muncul di daftar dokter untuk diverifikasi.
- Halaman baru **Farmasi › Persetujuan Substitusi** untuk dokter menampilkan pasien, obat yang diresepkan dan penggantinya, serta alasan apoteker, dengan filter "Resep saya saja". Dokter bisa:
  - **Setujui**: obat pada resep diganti saat itu. Persetujuan gagal bila resep sudah diverifikasi, obatnya sudah berubah, atau stok pengganti tidak lagi cukup.
  - **Tolak**: alasan wajib diisi, dan obat pada resep tetap obat yang diresepkan.
  - **Verifikasi**: untuk konfirmasi lisan.
- Penanda "Substitusi dari …" dan e-resep hanya memuat substitusi yang sudah diterapkan. Pengajuan yang ditolak atau dibatalkan tetap tercatat di riwayat.
- Izin baru **Farmasi › Persetujuan Substitusi** (READ, SETUJUI, TOLAK) otomatis diberikan ke peran/akun Dokter (nama diawali "dokter") dan Super Admin. Peran lain diatur lewat Setting. Pengguna yang sedang login perlu login ulang. Menu Farmasi mengarah ke halaman ini bila pengguna tidak punya akses Resep Dokter.
- Endpoint baru: `GET /api/v3/farmasi/substitusi-obat/persetujuan`, `PUT /substitusi-obat/:uuid/setujui`, `PUT /substitusi-obat/:uuid/tolak`, dan `PUT /substitusi-obat/:uuid/batal`. Endpoint `PUT /prescriptions/substitution` menerima `mode` (`ajukan` | `konfirmasi_lisan`) dan `cara_konfirmasi`.
- Migrasi baru:
  - `20261021130000-farmasi_substitusi_persetujuan` menambahkan kolom status persetujuan. Substitusi lama ditandai "Konfirmasi lisan/telepon" atau "Tanpa persetujuan (data lama)" dan menunggu verifikasi dokter.
  - `20261021130100-sinkron_katalog_persetujuan_substitusi`.

  Jalankan `npm run db:migrate`.
