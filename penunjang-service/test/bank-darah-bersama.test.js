import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOLONGAN_ABO,
  RHESUS,
  HASIL_UJI,
  pilihan,
  cekPilihan,
  teks,
  angkaOpsional,
} from "../src/bank-darah/bersama.js";

test("pilihan: mengubah objek enum menjadi daftar {kode, nama}", () => {
  assert.deepEqual(pilihan(GOLONGAN_ABO), [
    { kode: "A", nama: "A" },
    { kode: "B", nama: "B" },
    { kode: "AB", nama: "AB" },
    { kode: "O", nama: "O" },
  ]);
});

test("cekPilihan: menerima nilai yang terdaftar", () => {
  assert.equal(cekPilihan("positif", RHESUS, "rhesus"), "positif");
  assert.equal(cekPilihan("kompatibel", HASIL_UJI, "hasil_mayor"), "kompatibel");
});

test("cekPilihan: menolak nilai yang tidak terdaftar (golongan darah tidak valid)", () => {
  assert.throws(() => cekPilihan("AA", GOLONGAN_ABO, "golongan_abo"), /golongan_abo harus salah satu/);
});

test("cekPilihan: string kosong dianggap null (field opsional), undefined dibiarkan apa adanya", () => {
  assert.equal(cekPilihan("", RHESUS, "rhesus"), null);
  assert.equal(cekPilihan(undefined, RHESUS, "rhesus"), undefined);
  assert.equal(cekPilihan(null, RHESUS, "rhesus"), null);
});

test("teks: memangkas spasi dan mengosongkan jadi null, undefined tetap undefined", () => {
  assert.equal(teks("  Hb 6,5 g/dl  "), "Hb 6,5 g/dl");
  assert.equal(teks("   "), null);
  assert.equal(teks(""), null);
  assert.equal(teks(undefined), undefined);
});

test("angkaOpsional: menerima angka & koma desimal, menolak teks bukan angka", () => {
  assert.equal(angkaOpsional("3", "ambang_kedaluwarsa_hari"), 3);
  assert.equal(angkaOpsional("12,5", "volume_ml"), 12.5);
  assert.equal(angkaOpsional(undefined, "volume_ml"), undefined);
  assert.equal(angkaOpsional(null, "volume_ml"), null);
  assert.equal(angkaOpsional("", "volume_ml"), null);
  assert.throws(() => angkaOpsional("abc", "volume_ml"), /volume_ml harus berupa angka/);
});
