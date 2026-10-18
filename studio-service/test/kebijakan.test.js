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
  // Tertinggal dari migrasi terakhir: hanya peringatan (Terapkan mengurutkan otomatis), gerbang tetap lulus.
  const urutan = periksaKebijakan([{ path: "database/migrations/20260101000000-b.cjs", status: "??", patch: "+CREATE TABLE IF NOT EXISTS t (id int);" }, changelog], { migrasiTerakhir: "20261015100000" });
  assert.equal(cek(urutan, "Migrasi").lulus, true);
  assert.equal(cek(urutan, "Urutan migrasi").lulus, false);
  assert.match(cek(urutan, "Urutan migrasi").pesan, /Terapkan/);
  assert.equal(urutan.lulus, true);
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

test("import @/main di frontend ditolak (import melingkar → layar putih)", () => {
  const h = periksaKebijakan([
    { path: "frontend-service/src/utils/baru.ts", status: "??", patch: '+import { app } from "@/main";' },
    { path: "frontend-service/src/views/Icu/Halaman.vue", status: "??", patch: '+import { app } from "../../main";' },
    changelog,
  ]);
  assert.equal(h.lulus, false);
  assert.match(cek(h, "Import melingkar").pesan, /utils\/baru\.ts.*Halaman\.vue/);
});

test("import @/utils/aplikasi lolos; main.ts sendiri dan baris dihapus tidak diperiksa", () => {
  const h = periksaKebijakan([
    { path: "frontend-service/src/utils/baru.ts", status: "??", patch: '+import { app } from "@/utils/aplikasi";' },
    { path: "frontend-service/src/main.ts", status: "M", patch: '+import { setAplikasi } from "./utils/aplikasi";' },
    { path: "frontend-service/src/utils/apiHandler.ts", status: "M", patch: '-import { app } from "@/main";\n+import { app } from "@/utils/aplikasi";' },
    changelog,
  ]);
  assert.equal(cek(h, "Import melingkar").lulus, true);
  assert.equal(h.lulus, true);
});

// Kriptografi: berkas enkripsi baru buatan agen wajib salinan baku lab-service/src/lis/rahasia.js.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const RAHASIA_LIS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../lab-service/src/lis/rahasia.js"), "utf8");
const sebagaiPatch = (isi) => isi.replace(/\r\n/g, "\n").split("\n").map((b) => `+${b}`).join("\n");

test("kriptografi: salinan baku (komentar & nama variabel kunci berbeda) lolos", () => {
  const salinan = RAHASIA_LIS.replace(/LIS_KUNCI_RAHASIA/g, "RAD_PACS_KUNCI_RAHASIA").replace(/^\/\/.*$/gm, "// Enkripsi rahasia PACS/RIS");
  const h = periksaKebijakan([{ path: "penunjang-service/src/pacs/kripto.js", status: "??", patch: sebagaiPatch(salinan) }, changelog], { kriptoBaku: [RAHASIA_LIS] });
  assert.equal(cek(h, "Kriptografi").lulus, true);
  assert.equal(h.lulus, true);
});

test("kriptografi: kode enkripsi buatan sendiri ditolak, kecuali risiko kritis", () => {
  const ubahan = RAHASIA_LIS.replace("aes-256-gcm", "aes-128-cbc");
  const berkas = [{ path: "penunjang-service/src/x/kunci.js", status: "??", patch: sebagaiPatch(ubahan) }, changelog];
  const h = periksaKebijakan(berkas, { kriptoBaku: [RAHASIA_LIS] });
  assert.equal(h.lulus, false);
  assert.match(cek(h, "Kriptografi").pesan, /x\/kunci\.js/);
  assert.equal(cek(periksaKebijakan(berkas, { risiko: "kritis", kriptoBaku: [RAHASIA_LIS] }), "Kriptografi").lulus, true);
});

test("kriptografi: menambah createCipheriv ke berkas lama ditolak; tanpa kriptografi tidak muncul", () => {
  const h = periksaKebijakan([{ path: "lab-service/src/services/x.js", status: "M", patch: '+const c = crypto.createCipheriv("aes-256-gcm", k, iv);' }, changelog], { kriptoBaku: [RAHASIA_LIS] });
  assert.equal(cek(h, "Kriptografi").lulus, false);
  assert.equal(cek(periksaKebijakan([changelog]), "Kriptografi"), undefined);
});

test("migrasi: awalan yang dipesan item lain ditolak, awalan item sendiri lulus", () => {
  const opsi = { migrasiTerakhir: "20261018140000", awalanMigrasi: "2026101816", awalanLain: [{ nomor: 31, awalan_migrasi: "2026101815" }] };
  const bentrok = periksaKebijakan([{ path: "database/migrations/20261018150000-x.cjs", status: "??", patch: "+SELECT 1;" }, changelog], opsi);
  assert.equal(cek(bentrok, "Migrasi").lulus, false);
  assert.match(cek(bentrok, "Migrasi").pesan, /STD-0031.*2026101816MMSS/);
  assert.equal(bentrok.lulus, false);
  const milikSendiri = periksaKebijakan([{ path: "database/migrations/20261018160100-x.cjs", status: "??", patch: "+SELECT 1;" }, changelog], opsi);
  assert.equal(milikSendiri.lulus, true);
  assert.equal(cek(milikSendiri, "Urutan migrasi"), undefined);
  // Tidak memakai awalan item (tetapi tidak bentrok): peringatan saja.
  const lain = periksaKebijakan([{ path: "database/migrations/20261018170000-x.cjs", status: "??", patch: "+SELECT 1;" }, changelog], opsi);
  assert.equal(lain.lulus, true);
  assert.match(cek(lain, "Urutan migrasi").pesan, /awalan item 2026101816/);
});

test("CHANGELOG: fragmen changelog.d lulus, CHANGELOG.md lama tetap diterima, README bukan fragmen", () => {
  const vue = { path: "frontend-service/src/a.vue", status: "M", patch: "+x" };
  const fragmen = periksaKebijakan([vue, { path: "changelog.d/STD-0031.md", status: "??", patch: "+### Ditambahkan\n+- x" }], { fragmen: "changelog.d/STD-0031.md" });
  assert.equal(cek(fragmen, "CHANGELOG").lulus, true);
  assert.equal(fragmen.lulus, true);
  const lama = periksaKebijakan([vue, changelog], { fragmen: "changelog.d/STD-0031.md" });
  assert.equal(cek(lama, "CHANGELOG").lulus, true);
  assert.match(cek(lama, "CHANGELOG").pesan, /changelog\.d\/STD-0031\.md/);
  const readme = periksaKebijakan([vue, { path: "changelog.d/README.md", status: "M", patch: "+x" }], { fragmen: "changelog.d/STD-0031.md" });
  assert.equal(cek(readme, "CHANGELOG").lulus, false);
  assert.match(cek(readme, "CHANGELOG").pesan, /changelog\.d\/STD-0031\.md/);
});
