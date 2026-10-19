### Ditambahkan
- **Virtual Office: peta Denah 2.5D lebih hidup** tanpa data karangan:
  - pasien berjalan di koridor untuk setiap perpindahan nyata (selisih antar-snapshot per jalur, mis. Rawat Jalan → Laboratorium/Farmasi, IGD → Rawat Inap; tagihan baru di Kasir masuk lewat pintu), jumlah sebanding selisih dan dibatasi 60 avatar;
  - antrean bergoyang pelan, pasien dilayani beranimasi ringan, ruang Padat berdenyut, angka berubah dengan count-up dan kilatan singkat;
  - jam waktu nyata dan hitung mundur "pembaruan berikutnya"; garis jalur hanya beranimasi bila ada arus baru; keterangan "Belum ada aktivitas hari ini di faskes ini" saat semua angka 0;
  - menghormati `prefers-reduced-motion`; animasi memakai `requestAnimationFrame` dan berhenti saat tab tersembunyi.
- Virtual Office: jalur baru **Pendaftaran → IGD** (pasien IGD terdaftar hari ini); versi konfigurasi 3.
