### Ditambahkan
- **Data demo per modul (`npm run db:demo:modul`, `database/demo/seed-modul.cjs`)** untuk development/staging, supaya laporan setiap modul (dan Ekstensi SIMRS Studio yang dirakit dari laporan itu) punya data.
  - Mengisi riwayat transaksi 60 hari langsung ke PostgreSQL. Setiap faskes demo hanya diisi modul yang aktif di faskes itu.
  - Seeder per modul ada di `database/demo/modul/`. Tahap 1 mencakup modul klinis rumah sakit: Rawat Inap, Kamar Operasi/PACU, ICU, CCU, HDU, NICU, PICU, Hemodialisa, dan Gizi.
  - Skrip ini idempoten, mencatat setiap baris di tabel jejak `demo_jejak_modul` sehingga `--bersihkan` hanya menghapus data buatannya, dan ditolak di lingkungan production.
