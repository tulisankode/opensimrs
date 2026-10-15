# Panduan Implementator

Untuk **IT rumah sakit/faskes**, **mahasiswa**, atau **mitra** yang memasang OpenSIMRS di faskes dan mendampingi penggunanya. Implementator adalah Contributor: pengalaman lapangan Anda adalah masukan paling berharga bagi proyek ini.

Dokumen terkait: [Petunjuk Instalasi](../INSTALLATION_GUIDE.md) · [Spesifikasi Hardware](../SPESIFIKASI-HARDWARE.md) · [Lingkungan](../LINGKUNGAN.md) · [Manajemen Modul](../MANAJEMEN-MODUL.md) · [Peran kontributor](./README.md)

---

## 1. Alur implementasi

| Tahap | Kegiatan | Keluaran |
|---|---|---|
| **1. Asesmen** | Kenali jenis faskes (segmen), jumlah poli/bed, kunjungan per hari, layanan penunjang, penjamin (umum/BPJS/asuransi), integrasi wajib (SATUSEHAT, PCare/VClaim, LIS), sistem lama, dan kesiapan jaringan. Cocokkan dengan [katalog modul](../MANAJEMEN-MODUL.md#5-katalog-lengkap). | Daftar modul yang dipakai, kebutuhan server ([Spesifikasi Hardware](../SPESIFIKASI-HARDWARE.md)), rencana jadwal |
| **2. Instalasi** | Siapkan lingkungan **staging** dan **production** terpisah ([Lingkungan](../LINGKUNGAN.md)); pasang dengan Docker atau native ([Petunjuk Instalasi](../INSTALLATION_GUIDE.md#7-jalur-b--implementasi-di-faskes)); HTTPS, firewall, cadangan otomatis. | Server berjalan, cadangan teruji |
| **3. Konfigurasi master** | Faskes & segmen, Manajemen Modul, profil faskes, lokasi, pegawai & praktisi, jadwal, peran & izin, penjamin, tarif, farmasi, datamaster penunjang ([langkah 7.4](../INSTALLATION_GUIDE.md#74-menyiapkan-faskes)). | Data master lengkap dan diverifikasi pengguna kunci |
| **4. Migrasi data** | Bila ada sistem lama: tentukan data yang dibawa (minimal master pasien dan No. RM; riwayat kunjungan sesuai kebutuhan), petakan kolom, uji impor di staging, validasi sampel bersama perekam medis. | Data hasil migrasi tervalidasi |
| **5. Pelatihan** | Latih per peran (pendaftaran, perawat, dokter, apoteker, lab, kasir, gudang, admin) memakai **data demo/staging**, bukan data pasien nyata. | Pengguna lulus uji alur per peran |
| **6. Go-live** | Jalankan paralel dengan sistem lama selama masa transisi; daftar periksa [sebelum go-live](../INSTALLATION_GUIDE.md#76-sebelum-go-live); siapkan jalur eskalasi masalah. | Faskes melayani pasien dengan OpenSIMRS |
| **7. Pendampingan** | Pantau minggu-minggu awal, kumpulkan masalah, lakukan pembaruan versi secara terjadwal (backup → migrasi), evaluasi berkala. | Laporan pendampingan, issue untuk masalah yang ditemukan |

---

## 2. Kewajiban privasi

Data kesehatan adalah **data pribadi yang bersifat spesifik** menurut **Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**, dan rekam medis wajib dijaga kerahasiaan, keamanan, dan keutuhannya menurut **Peraturan Menteri Kesehatan Nomor 24 Tahun 2022 tentang Rekam Medis**. Sebagai implementator:

- Pastikan faskes (sebagai pengendali data) memahami kewajibannya; Anda membantu menyediakan sarana teknisnya.
- Berikan akses sesuai peran dan kebutuhan (prinsip minimum); nonaktifkan akun pegawai yang keluar.
- Aktifkan HTTPS, jangan membuka port database ke luar, dan simpan rahasia hanya di `.env` server atau secret manager ([Lingkungan](../LINGKUNGAN.md)).
- Pastikan cadangan terenkripsi dan pemulihannya diuji.
- Catat siapa yang memegang akun superadmin dan akses server.

Panduan ini bukan nasihat hukum; ikuti kebijakan faskes dan peraturan yang berlaku.

---

## 3. Data produksi tidak keluar dari faskes

- **Jangan** menyalin database, ekspor Excel/PDF, log, atau tangkapan layar berisi data pasien ke laptop pribadi, grup chat, issue GitHub, atau kanal komunitas.
- Staging **tidak** memakai salinan data pasien asli kecuali sudah dianonimkan ([Lingkungan](../LINGKUNGAN.md)).
- Untuk debugging, reproduksi masalah dengan data demo. Bila hanya terjadi dengan data tertentu, jelaskan **pola** datanya (mis. "pasien dengan dua penjamin aktif"), bukan datanya.
- Akses jarak jauh ke server faskes hanya lewat jalur yang disetujui faskes, dan dicatat.

---

## 4. Melaporkan bug dari lapangan

Buka GitHub Issue dengan format di [panduan Tester/QA](./TESTER-QA.md#3-format-laporan-bug), ditambah:

- segmen faskes dan modul yang aktif (tanpa nama faskes bila faskes tidak ingin disebut);
- versi/commit OpenSIMRS dan cara instalasi (Docker/native);
- dampak di lapangan (mis. "pendaftaran pagi tertahan ±15 menit") untuk membantu menentukan prioritas;
- langkah reproduksi dengan **data demo**.

Masalah keamanan dilaporkan privat ke `dev@opensimrs.id` ([SECURITY.md](../../SECURITY.md)).

---

## 5. Berbagi praktik baik

- Ceritakan pengalaman implementasi di kanal `#implementasi` Discord atau grup WhatsApp implementator ([COMMUNITY.md](../../COMMUNITY.md)).
- Tulis panduan yang belum ada (mis. konfigurasi PCare di puskesmas, pemetaan LIS untuk alat tertentu) sebagai PR dokumentasi.
- Usulkan penyesuaian preset segmen bila pola faskes Anda umum dijumpai ([Product development](./PRODUCT-DEV.md)).
- Bagikan daftar periksa, templat pelatihan, atau skrip pembantu yang tidak memuat data/kredensial faskes.
