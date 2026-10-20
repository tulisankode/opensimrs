### Ditambahkan
- **SIMRS Studio: panel Kesiapan penerapan.** Tab Rilis memeriksa item sebelum Terapkan (berkas belum di-commit, commit yang belum tercatat, urutan migrasi, konflik dengan branch lokal, berkas belum di-commit di repo aplikasi) dan menampilkan tombol perbaikan untuk tiap langkah. Tombol Terapkan baru aktif bila tidak ada langkah yang menghalangi.
- **SIMRS Studio: penyelesaian konflik kode tanpa terminal.** *Mulai selesaikan konflik* menggabungkan branch lokal ke branch item dengan penanda konflik yang dibiarkan, lalu konflik diselesaikan di VS Code atau oleh agen (tanpa perintah git). *Tutup penggabungan* memeriksa penanda, sintaks, dokumen katalog, dan integritas sebelum Studio membuat commit merge. Penggabungan bisa dibatalkan.

### Diperbaiki
- SIMRS Studio: item yang commit-nya dibuat langsung di branch (oleh agen atau programmer) tidak lagi buntu di tahap Rilis. Commit dan Terapkan kini mencatat commit itu, dan bagian Terapkan tetap tampil walau belum ada commit tercatat.
- SIMRS Studio: Terapkan yang ditolak git karena berkas belum di-commit di branch lokal kini dijelaskan sebagai berkas yang akan tertimpa, bukan "konflik". Galat Terapkan juga dicatat di diskusi item.
