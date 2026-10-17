import { test } from "node:test";
import assert from "node:assert/strict";
import bankDarah from "../src/bank-darah/rute.js";
import rute from "../src/rute.js";
import { ruteMasuk } from "../src/bank-darah/utd/utd-push-rute.js";
import { normalisasiImltd } from "../src/bank-darah/utd/utd-hasil.js";

// STD-0017 — Bridging Bank Darah ke UTD: memastikan router termuat tanpa kesalahan impor/ekspor (tidak membuka
// koneksi database) dan terpasang di bawah bank-darah/rute.js, sama seperti smoke test modul lain (lihat
// test/utd-rute.test.js untuk pola yang sama pada modul UTD internal STD-0011).
test("bank-darah/rute.js memasang router bridging /utd", () => {
  assert.equal(typeof bankDarah, "function");
  const lapisan = bankDarah.stack.find((l) => l.regexp?.test("/utd/koneksi"));
  assert.ok(lapisan, "/utd belum terdaftar di bank-darah/rute.js");
});

test("rute.js penunjang-service tetap memasang /bank-darah (bridging ikut ter-mount)", () => {
  const lapisan = rute.stack.find((l) => l.regexp?.test("/bank-darah/utd/koneksi"));
  assert.ok(lapisan, "/bank-darah belum terdaftar di penunjang-service/src/rute.js");
});

test("utd-push-rute.js mengekspor ruteMasuk dengan endpoint push terdaftar", () => {
  assert.equal(typeof ruteMasuk, "function");
  const adaBridging = ruteMasuk.stack.some((l) => l.route?.path?.includes("/adam-utd/bridging"));
  assert.ok(adaBridging, "/adam-utd/bridging harus terdaftar di titik masuk push");
});

// KT-11: normalisasi IMLTD (trim + huruf kecil) ke enum tertutup; nilai lain -> 'tidak_dikenal' (ditolak dari stok).
test("normalisasiImltd: variasi spasi/huruf besar-kecil dipetakan ke enum tertutup", () => {
  assert.equal(normalisasiImltd(" Non_Reaktif "), "non_reaktif");
  assert.equal(normalisasiImltd("REAKTIF"), "reaktif");
  assert.equal(normalisasiImltd("Belum Diperiksa"), "belum_diperiksa");
  assert.equal(normalisasiImltd("positif"), "reaktif");
  assert.equal(normalisasiImltd("negatif"), "non_reaktif");
});

test("normalisasiImltd: nilai asing atau kosong ditolak sebagai 'tidak_dikenal'", () => {
  assert.equal(normalisasiImltd("entah"), "tidak_dikenal");
  assert.equal(normalisasiImltd(""), "tidak_dikenal");
  assert.equal(normalisasiImltd(null), "tidak_dikenal");
  assert.equal(normalisasiImltd(undefined), "tidak_dikenal");
});
