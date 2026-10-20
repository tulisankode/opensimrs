### Ditambahkan
- **SIMRS Studio: menu Helpdesk AI** (superadmin). Halaman ini mengatur OpenClaw di mesin pengembang untuk tombol Bantuan tanpa terminal:
  - status gateway dan endpoint HTTP;
  - membuat agen helpdesk dengan batasan alat (hanya-baca);
  - memilih model Ollama lokal atau penyedia API beserta kuncinya, mode berpikir, dan batas isi prompt;
  - sinkron panduan;
  - membuat token gateway sekaligus menyelaraskan URL/agen/token ke pengaturan Helpdesk AI OpenSIMRS;
  - menjalankan ulang gateway dan uji tanya.

  Kunci API dan token diteruskan lewat berkas patch berizin terbatas yang langsung dihapus, tidak disimpan di database OpenSIMRS. Kanal pesan tidak diatur.
- **Helpdesk: persona agen** `SOUL.md`, `IDENTITY.md`, `USER.md` di `deploy/helpdesk/` ikut disalin `sinkron-panduan.sh`, menggantikan persona asisten pribadi bawaan OpenClaw. `BOOTSTRAP.md` dihapus dari workspace agen. Prompt agen menjadi lebih kecil dan jawabannya tetap pada peran helpdesk.
