import { test } from "node:test";
import assert from "node:assert/strict";
import { periksaKebijakan } from "../src/kebijakan.js";

const cek = (hasil, nama) => hasil.temuan.find((t) => t.cek === nama);
const changelog = { path: "CHANGELOG.md", status: "M", patch: "+- Fitur baru" };

test("perubahan bersih di zona hijau lulus", () => {
  const h = periksaKebijakan([
    { path: "frontend-service/src/views/Laporan/Baru.vue", status: "??", patch: "+<template><div>Halo</div></template>" },
    changelog,
  ]);
  assert.equal(h.lulus, true);
});

test("zona merah ditolak", () => {
  const h = periksaKebijakan([{ path: "studio-service/src/rute.js", status: "M", patch: "+x" }, changelog]);
  assert.equal(cek(h, "Zona merah").lulus, false);
  assert.equal(h.lulus, false);
  assert.equal(cek(periksaKebijakan([{ path: "lab-service/.env", status: "??", patch: "+A=1" }, changelog]), "Zona merah").lulus, false);
});

test("zona kuning butuh risiko tinggi", () => {
  const berkas = [{ path: "payment-service/src/x.js", status: "M", patch: "+const a = 1;" }, { path: "payment-service/test/x.test.js", status: "??", patch: "+t" }, changelog];
  assert.equal(periksaKebijakan(berkas, { risiko: "sedang" }).lulus, false);
  assert.equal(periksaKebijakan(berkas, { risiko: "tinggi" }).lulus, true);
});

test("rahasia & data pribadi terdeteksi, data fiktif lolos", () => {
  const bocor = periksaKebijakan([
    { path: "x/a.js", status: "??", patch: "+const k = 'sk-ant-abcdefghijklmnopqrstuvwxyz123';\n+const host = '192.0.2.10';" },
    changelog,
  ]);
  assert.equal(cek(bocor, "Rahasia & kunci").lulus, false);
  const pribadi = periksaKebijakan([{ path: "x/a.js", status: "??", patch: "+nik: '3201234567890123', hp: '081234567890', email: 'budi@gmail.com'" }, changelog]);
  assert.equal(cek(pribadi, "Data pribadi").lulus, false);
  const fiktif = periksaKebijakan([{ path: "x/a.js", status: "??", patch: "+nik: '9999012345678901', hp: '080000000000', email: 'pasien@contoh.id'" }, changelog]);
  assert.equal(cek(fiktif, "Data pribadi").lulus, true);
});

test("baris yang dihapus tidak diperiksa", () => {
  const h = periksaKebijakan([{ path: "x/a.js", status: "M", patch: "-const k = 'sk-ant-abcdefghijklmnopqrstuvwxyz123';\n+const k = process.env.K;" }, changelog]);
  assert.equal(cek(h, "Rahasia & kunci").lulus, true);
});

test("migrasi: lama diubah, nama, urutan, idempoten", () => {
  const lama = periksaKebijakan([{ path: "database/migrations/20260101000000-a.cjs", status: "M", patch: "+x" }, changelog]);
  assert.equal(cek(lama, "Migrasi").lulus, false);
  const urutan = periksaKebijakan([{ path: "database/migrations/20260101000000-b.cjs", status: "??", patch: "+CREATE TABLE IF NOT EXISTS t (id int);" }, changelog], { migrasiTerakhir: "20261015100000" });
  assert.equal(cek(urutan, "Migrasi").lulus, false);
  const tidakIdempoten = periksaKebijakan([{ path: "database/migrations/20261101000000-c.cjs", status: "??", patch: "+CREATE TABLE t (id int);" }, changelog], { migrasiTerakhir: "20261015100000" });
  assert.equal(cek(tidakIdempoten, "Migrasi").lulus, false);
  const baik = periksaKebijakan([{ path: "database/migrations/20261101000000-c.cjs", status: "??", patch: "+CREATE TABLE IF NOT EXISTS t (id int);\n+ALTER TABLE t ADD COLUMN IF NOT EXISTS n int;" }, changelog], { migrasiTerakhir: "20261015100000" });
  assert.equal(cek(baik, "Migrasi").lulus, true);
});

test("katalog modul wajib disertai dokumen katalog; CHANGELOG wajib", () => {
  const tanpaDok = periksaKebijakan([{ path: "database/data/katalog-modul.json", status: "M", patch: "+{}" }, changelog]);
  assert.equal(cek(tanpaDok, "Katalog modul").lulus, false);
  const denganDok = periksaKebijakan([{ path: "database/data/katalog-modul.json", status: "M", patch: "+{}" }, { path: "docs/KATALOG-MODUL.md", status: "M", patch: "+x" }, changelog]);
  assert.equal(cek(denganDok, "Katalog modul").lulus, true);
  assert.equal(periksaKebijakan([{ path: "frontend-service/src/a.vue", status: "M", patch: "+x" }]).lulus, false);
});

test("uji backend hanya peringatan", () => {
  const h = periksaKebijakan([{ path: "penunjang-service/src/mcu/a.js", status: "M", patch: "+x" }, changelog]);
  assert.equal(cek(h, "Uji").lulus, false);
  assert.equal(h.lulus, true);
});
