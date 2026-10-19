# Kontrak simulasi dan prasyarat event operasional

Tidak ada endpoint penerimaan event dari pengguna. Semua event prototipe dibentuk server dari konfigurasi sintetis. Event hanya berisi `event_uuid`, `faskes_uuid`, `source_service`, `source_kind`, `source_uuid`, `source_revision`, `kode_unit`, dan `event_type`. Pengenal event dan pekerjaan sintetis memakai UUIDv7; nama pasien, NIK, nomor rekam medis, diagnosis, hasil pemeriksaan, serta payload sumber tidak dibutuhkan.

Kunci pekerjaan: fasilitas + layanan + jenis + UUID sumber. Kunci deduplikasi: fasilitas + layanan + UUID event. Revisi harus bilangan bulat positif. Event duplikat diabaikan; revisi lama tidak mengganti status; revisi sama dengan identitas event lain dikembalikan sebagai konflik. Unit asing tidak dimasukkan; jenis event asing pada unit dikenal dicatat sebagai belum dipetakan. Agregat dihitung dari keadaan pekerjaan, bukan jumlah event. Status sumber tidak ditulis kembali.

Kontrak ini hanya bahan uji. Integrasi nyata memerlukan skema berversi tervalidasi, identitas sumber tepercaya, revisi monoton, waktu kejadian/penerimaan epoch detik, versi pemetaan, dan relasi eksplisit. Deduplikasi dan pembaruan harus atomik serta tahan mulai ulang; penyimpanan sementara prototipe tidak memenuhi syarat itu. Penghapusan lunak, pembatalan, serta pembukaan kembali harus bersumber dari event atau rekonsiliasi yang diverifikasi.

Transport operasional belum dipilih. Syaratnya autentikasi tanpa token URL, filter fasilitas dari token, evaluasi ulang izin/sesi, heartbeat, cursor berversi, deteksi celah, snapshot ulang, serta watermark konsumen sebelum label Live. Heartbeat saja tidak membuktikan sumber sehat.
