import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Regresi: setiap kolom VARCHAR(n) dengan CHECK (... IN (...)) harus cukup lebar untuk nilai terpanjang di
// daftarnya sendiri. Sebelumnya status_kantong (karantina_reaktif), status komponen (didistribusikan),
// penerima_tipe (bdrs_internal), dan status distribusi (menunggu_integrasi) lebih pendek dari nilainya sendiri,
// sehingga INSERT/UPDATE akan gagal ("value too long for type character varying") tepat pada skenario inti PRD.
const migrasiPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "database",
  "migrations",
  "20261016191100-buat_tabel_utd.cjs",
);
const sql = readFileSync(migrasiPath, "utf8");

test("setiap VARCHAR(n) ber-CHECK IN(...) cukup lebar untuk nilai terpanjang di daftarnya", () => {
  const pola = /VARCHAR\((\d+)\)[\s\S]{0,80}?CHECK\s*\(\s*\w+\s+IN\s*\(([^)]+)\)\)/g;
  const temuan = [];
  let cocok;
  let jumlah = 0;
  while ((cocok = pola.exec(sql))) {
    jumlah += 1;
    const lebar = Number(cocok[1]);
    const nilai = [...cocok[2].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    const terpanjang = Math.max(...nilai.map((v) => v.length));
    if (terpanjang > lebar) temuan.push(`VARCHAR(${lebar}) terlalu sempit untuk nilai sepanjang ${terpanjang}: ${nilai.find((v) => v.length === terpanjang)}`);
  }
  assert.ok(jumlah >= 10, "pola regex harus menemukan kolom VARCHAR+CHECK pada migrasi utd (periksa bila migrasi diubah)");
  assert.deepEqual(temuan, []);
});
