### Ditambahkan
- **SIMRS Studio: peta kode codebase-memory untuk agen Claude Code.** Pengaturan baru di Pengaturan & Agen › Agen langganan › **Peta kode (codebase-memory)** (mati bawaan). Bila aktif, Studio memasang `codebase-memory-mcp` sebagai server MCP tambahan agen Claude Code. Agen lalu:
  - mengindeks repo atau worktree item;
  - menelusuri graph kode (arsitektur, pemanggil, dampak) sebelum mencari berkas;
  - mencatat keputusan arsitektur per modul (ADR), sehingga pengembangan modul berikutnya lebih terarah.

  Lokasi biner dikenali otomatis dari `~/.local/bin` atau diatur lewat `STUDIO_CODEBASE_MEMORY_BIN`. Alat `delete_project` dan `ingest_traces` tidak diizinkan untuk agen. Tidak ada migrasi baru.
