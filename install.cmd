@echo off
rem OpenSIMRS - instalasi lokal tanpa Docker untuk Windows. Opsi: -Cek  -Ya  -TanpaDemo  -Jalankan
rem Penjelasan lengkap ada di bagian atas install.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
if errorlevel 1 pause
