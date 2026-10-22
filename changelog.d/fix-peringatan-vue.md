### Diperbaiki
- Peringatan compiler Vue saat `npm run dev`/build sudah dibereskan:
  - Tabel di Riwayat Order Lab, Laporan MCU, dan Rekap HRD MCU kini memakai `<thead>`/`<tbody>`; sebelumnya `<tr>` langsung di bawah `<table>`.
  - Impor `defineProps`/`defineEmits` dari `vue` dihapus di Laporan Admisi dan dialog Item Pemeriksaan Lab, karena keduanya makro compiler.
