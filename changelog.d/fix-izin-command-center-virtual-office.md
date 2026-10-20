### Diperbaiki
- **Menu Command Center dan tombol Virtual Office tidak tampil bagi super admin.** STD-0037 dan STD-0042 hanya menyinkronkan katalog, tanpa memberi izin submodul Dashboard › Command Center dan Dashboard › Virtual Office. Super admin (dikenali dari nama peran) kini mendapat keduanya lewat migrasi; peran faskes lain diatur di Setting › Hak Akses.
  - **Migrasi baru:** `20261019230000-izin_dashboard_command_center_virtual_office`.
