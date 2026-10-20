'use strict';

// Pelindung verifikasi lokal: cegah pemuatan berkas rahasia dan koneksi PostgreSQL.
// Pemakaian: node --require ./scripts/verifikasi-tanpa-data.cjs --test --test-isolation=none ...
const fs = require('node:fs');
const Module = require('node:module');
const terlarang = (path) => /(^|[\\/])(?:\.env[^\\/]*|rahasia\.js)$/.test(String(path));
const baca = fs.readFileSync;
fs.readFileSync = function (path, ...opsi) {
  if (terlarang(path)) {
    const galat = new Error('Berkas rahasia tidak dimuat dalam verifikasi');
    galat.code = 'ENOENT';
    throw galat;
  }
  return baca.call(this, path, ...opsi);
};
const muat = Module._load;
Module._load = function (nama, ...opsi) {
  if (nama === 'dotenv/config') return {};
  const hasil = muat.call(this, nama, ...opsi);
  if (nama === 'dotenv' || /dotenv[\\/]lib[\\/]main/.test(nama)) hasil.config = () => ({ parsed: {} });
  if (nama === 'pg') {
    for (const kelas of [hasil.Pool, hasil.Client]) {
      if (!kelas) continue;
      for (const metode of ['connect', 'query']) kelas.prototype[metode] = () => { throw new Error('Koneksi database dilarang dalam verifikasi'); };
    }
  }
  return hasil;
};
