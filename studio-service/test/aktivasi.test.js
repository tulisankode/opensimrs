import { test } from "node:test";
import assert from "node:assert/strict";
import { katalogBaru, kurangiIzin, tambahIzin } from "../src/aktivasi.js";

const katalog = (modulTersedia, fiturTersedia) => ({
  modul: [
    { kode: "laboratorium", nama: "Laboratorium", tersedia: true, menu: ["Laboratorium"] },
    { kode: "mikrobiologi", nama: "Mikrobiologi", tersedia: modulTersedia, menu: ["Mikrobiologi"] },
  ],
  fitur: [
    { kode: "order_lab", modul: "laboratorium", nama: "Order Lab", tersedia: true },
    { kode: "lab_rujukan", modul: "laboratorium", nama: "Lab Rujukan", tersedia: fiturTersedia },
  ],
});

test("katalogBaru: hanya modul & fitur yang berubah menjadi tersedia", () => {
  const hasil = katalogBaru(katalog(false, false), katalog(true, true));
  assert.deepEqual(hasil.modul, [{ kode: "mikrobiologi", nama: "Mikrobiologi", menu: ["Mikrobiologi"] }]);
  assert.deepEqual(hasil.fitur, [{ kode: "lab_rujukan", modul: "laboratorium", nama: "Lab Rujukan" }]);
});

test("katalogBaru: tanpa perubahan atau katalog lama tidak terbaca", () => {
  assert.deepEqual(katalogBaru(katalog(true, true), katalog(true, true)), { modul: [], fitur: [] });
  // Katalog sebelum tidak ada (berkas baru) → semua yang tersedia dianggap baru.
  assert.equal(katalogBaru(null, katalog(false, true)).fitur.length, 2);
});

test("tambahIzin & kurangiIzin: hanya modul yang belum dimiliki, lalu dicabut kembali", () => {
  const awal = JSON.stringify([{ module: "Laboratorium", subModules: [] }]);
  const def = [{ module: "Laboratorium", subModules: [{ name: "X" }] }, { module: "Mikrobiologi", subModules: [] }];
  const hasil = tambahIzin(awal, def);
  assert.deepEqual(hasil.modul, ["Mikrobiologi"]);
  // Hak modul yang sudah ada tidak ditimpa.
  assert.deepEqual(JSON.parse(hasil.teks)[0], { module: "Laboratorium", subModules: [] });
  assert.equal(tambahIzin(hasil.teks, def), null);
  assert.equal(kurangiIzin(hasil.teks, hasil.modul), awal);
  assert.equal(kurangiIzin(awal, ["Mikrobiologi"]), null);
  assert.equal(tambahIzin("bukan json", def), null);
});
