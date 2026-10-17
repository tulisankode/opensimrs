// Uji unit fiturLayak: node --test test/*.test.mjs (ekstensi .mjs agar tidak ikut dijalankan jest).
// STD-0018: modul_syarat boleh berisi beberapa modul dipisah koma (OR), mis. "bpjs_fkrtl,bpjs_fktp".
import { test } from "node:test";
import assert from "node:assert/strict";
import { fiturLayak } from "../src/modul/katalog-modul.js";

test("fiturLayak: tanpa modul_syarat, hanya modul induk yang diperiksa", () => {
  assert.equal(fiturLayak({ modul: "antrian", modul_syarat: null }, ["antrian"]), true);
  assert.equal(fiturLayak({ modul: "antrian", modul_syarat: null }, ["farmasi"]), false);
});

test("fiturLayak: modul_syarat tunggal (kompatibel dengan katalog lama)", () => {
  const f = { modul: "antrian", modul_syarat: "bpjs_fkrtl" };
  assert.equal(fiturLayak(f, ["antrian", "bpjs_fkrtl"]), true);
  assert.equal(fiturLayak(f, ["antrian", "bpjs_fktp"]), false);
});

test("fiturLayak: modul_syarat berisi beberapa modul dipisah koma = OR", () => {
  const f = { modul: "antrian", modul_syarat: "bpjs_fkrtl,bpjs_fktp" };
  assert.equal(fiturLayak(f, ["antrian", "bpjs_fkrtl"]), true);
  assert.equal(fiturLayak(f, ["antrian", "bpjs_fktp"]), true);
  assert.equal(fiturLayak(f, ["antrian", "bpjs_fkrtl", "bpjs_fktp"]), true);
  assert.equal(fiturLayak(f, ["antrian"]), false);
  assert.equal(fiturLayak(f, ["bpjs_fkrtl"]), false); // modul induk "antrian" tidak aktif
});
