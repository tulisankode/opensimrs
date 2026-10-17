import { test } from "node:test";
import assert from "node:assert/strict";
import { cekPilihan, selisihHari, angkaOpsional, tanggalOpsional, waktuOpsional, teks, pilihan, GOLONGAN_DARAH } from "../src/utd/bersama.js";

test("cekPilihan: menerima nilai valid, menolak nilai di luar daftar", () => {
  assert.equal(cekPilihan("A", GOLONGAN_DARAH, "golongan_darah"), "A");
  assert.throws(() => cekPilihan("X", GOLONGAN_DARAH, "golongan_darah"));
});

test("cekPilihan: string kosong -> null, undefined -> undefined (dibiarkan untuk UPDATE parsial)", () => {
  assert.equal(cekPilihan("", GOLONGAN_DARAH, "golongan_darah"), null);
  assert.equal(cekPilihan(undefined, GOLONGAN_DARAH, "golongan_darah"), undefined);
});

test("selisihHari: jarak kalender UTC antar dua tanggal YYYY-MM-DD", () => {
  assert.equal(selisihHari("2026-01-01", "2026-01-11"), 10);
  assert.equal(selisihHari("2026-01-11", "2026-01-01"), -10);
});

test("angkaOpsional: menerima koma desimal, menolak non-angka", () => {
  assert.equal(angkaOpsional("12,5", "hb"), 12.5);
  assert.throws(() => angkaOpsional("abc", "hb"));
});

test("tanggalOpsional: memvalidasi format YYYY-MM-DD", () => {
  assert.equal(tanggalOpsional("2026-10-17", "tanggal_lahir"), "2026-10-17");
  assert.throws(() => tanggalOpsional("17-10-2026", "tanggal_lahir"));
});

test("waktuOpsional: epoch detik positif, kosong -> null", () => {
  assert.equal(waktuOpsional("", "waktu_mulai"), null);
  assert.equal(waktuOpsional("1760000000", "waktu_mulai"), 1760000000);
  assert.throws(() => waktuOpsional("-1", "waktu_mulai"));
});

test("teks: trim & string kosong -> null", () => {
  assert.equal(teks("  Budi  "), "Budi");
  assert.equal(teks(""), null);
  assert.equal(teks(undefined), undefined);
});

test("pilihan: mengubah objek enum menjadi daftar {kode, nama}", () => {
  assert.deepEqual(pilihan({ a: "A", b: "B" }), [
    { kode: "a", nama: "A" },
    { kode: "b", nama: "B" },
  ]);
});
