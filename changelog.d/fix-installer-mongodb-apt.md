### Diperbaiki
- `install.sh` di Ubuntu/Debian (mis. VPS baru) tidak lagi berhenti dengan pesan "MongoDB 7 + mongosh perlu repositori resmi MongoDB". Installer kini menawarkan pemasangan **MongoDB 8.0 + mongosh** dari repositori resmi `repo.mongodb.org`, termasuk kunci GPG, sumber apt, dan menyalakan `mongod`. Dukungannya:
  - resmi untuk Ubuntu 20.04/22.04/24.04 dan Debian 12;
  - rilis yang lebih baru (Ubuntu 25.x, Debian 13) dan turunan Ubuntu memakai repositori rilis terdekat yang didukung;
  - CPU x86_64 tanpa AVX (tidak bisa menjalankan MongoDB ≥ 5) dihentikan dengan pesan yang jelas.
- `install.sh` tidak lagi berhenti tanpa pesan di langkah cek dependensi bila sebuah program terpasang tetapi tidak menghasilkan versi (mis. `mongod` yang langsung berhenti karena CPU tanpa AVX atau pustaka kurang). Program itu kini dilaporkan "terpasang tetapi tidak bisa dijalankan" beserta kode keluarnya, ditambah petunjuk AVX untuk MongoDB.
- `uninstall.sh` tidak lagi tampak macet di langkah cadangan ("Enter password for mongo user" tersembunyi di balik spinner) bila `MONGO_DB_PASSWORD`/`DB_PASSWORD` di `.env` kosong, misalnya karena instalasi berhenti sebelum `.env` terisi.
  - `mongodump`, `pg_dump`, dan `psql` kini tidak pernah meminta sandi.
  - Bila sandi Mongo kosong, cadangan dicoba tanpa autentikasi. Kegagalannya dilaporkan, lalu uninstall berlanjut.
