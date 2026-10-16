@echo off
rem OpenSIMRS - hapus instalasi lokal di Windows. Opsi: -Simulasi  -Ya  -TanpaCadangan  -HapusFolder  -AlatAi
rem Penjelasan lengkap ada di bagian atas uninstall.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1" %*
if errorlevel 1 pause
