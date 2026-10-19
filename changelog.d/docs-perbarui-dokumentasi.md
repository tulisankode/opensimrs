### Diubah
- **Dokumentasi diselaraskan dengan kode** dan diberi tautan ke dokumentasi resmi https://docs.opensimrs.com.
  - `docs/API_DOCUMENTATION.md` ditulis ulang dari rute nyata: respons login/refresh (`payload.token`, `refresh_token`), paginasi (`properties`/`pagination`), batas laju 100/5 menit (payment & rawat inap), alias bridging lewat gateway, dan referensi endpoint per layanan.
  - Panduan instalasi, lingkungan, konteks pengembangan, dan SIMRS Studio: 20 layanan (port 8090 = Studio), variabel `VITE_BASE_STUDIO`/`VITE_BASE_PROGRAM_PUSKESMAS`/`VITE_KEEP_API_HOST`/`ALLOWED_HOSTS`, opsi installer `--podman`/`--domain`/`--api`, pengaman uninstall, SATUSEHAT (ID dicari otomatis lewat NIK), dan catatan gateway (alias bridging, batas laju per IP).
  - README, CONTRIBUTING (rincian CI sebenarnya, data fiktif seragam), ROADMAP (status modul terbaru), spesifikasi hardware, panduan kontributor, README SDK & frontend.
  - Panduan pengguna diperbarui: BPJS FKRTL (Rencana Kontrol & SPRI), alur rawat inap lewat SPRI, kasir (shift, closing harian, kuitansi), dashboard baru & Dashboard Eksekutif, Setting (Manajemen Modul, Konfigurasi Integrasi, Audit Trail, Mode Pengembang), Antrean Online BPJS, Marketplace, MCU PCare; panduan baru **Mutu & Akreditasi** dan **HR / SDM**.
  - `.env.example`: variabel frontend yang hilang ditambahkan.
