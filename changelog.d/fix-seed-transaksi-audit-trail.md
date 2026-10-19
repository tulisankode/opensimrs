### Diperbaiki
- **Seeder transaksi demo (`npm run db:demo:transaksi`) kembali berjalan.**
  - `audit_trail` dikecualikan dari penggeseran waktu, karena tabel itu append-only (STD-0029); sebelumnya seeder gagal di episode pertama.
  - Farmasi memakai akun apoteker dan pembayaran memakai akun kasir faskes (opsi baru `--apoteker`, `--kasir`), karena akun pendaftaran tidak punya izin Farmasi/Pembayaran.
  - Shift kasir dibuka lewat API saat fitur `bayar_shift_kasir` aktif, lalu ditutup setiap akhir hari seperti sebelumnya.
