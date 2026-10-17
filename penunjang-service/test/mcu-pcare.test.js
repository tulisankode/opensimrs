import { test } from "node:test";
import assert from "node:assert/strict";
import rute from "../src/rute.js";
import mcu from "../src/mcu/rute.js";
import { petakanNilaiMcu, validasiRentangMcu, angkaHasilLab } from "../src/mcu/pcare.js";

// STD-0020 — MCU PCare (BPJS): memastikan router termuat tanpa membuka koneksi database (sama dengan pola
// smoke test modul lain, mis. test/utd-rute.test.js) dan terpasang di bawah mcu/rute.js.
test("mcu/rute.js memasang router /pcare", () => {
  const lapisan = mcu.stack.find((l) => l.regexp?.test("/pcare/peserta/x"));
  assert.ok(lapisan, "/pcare belum terdaftar di penunjang-service/src/mcu/rute.js");
});

test("rute.js penunjang-service tetap memasang /mcu (pcare ikut ter-mount)", () => {
  const lapisan = rute.stack.find((l) => l.regexp?.test("/mcu/pcare/peserta/x"));
  assert.ok(lapisan, "/mcu/pcare belum terdaftar di penunjang-service/src/rute.js");
});

// KF-3/KF-4/KT-6: hanya nilai dari sumber lokal yang sah; pemeriksaan yang tidak dilakukan / tidak ditemukan
// dibiarkan null (tidak boleh diperkirakan).
test("petakanNilaiMcu: tanda vital & lab terisi dari sumber lokal, yang tidak diperiksa tetap null", () => {
  const detail = {
    stasiun: [
      { kode: "tanda_vital", data: { sistole: 120, diastole: 80, berat_badan: 60, tinggi_badan: 165, lingkar_perut: 80 } },
      { kode: "anamnesis", data: {} },
    ],
    laboratorium: {
      hasil: [
        { nama: "Glukosa Darah Puasa", hasil: "95", satuan: "mg/dL" },
        { nama: "Kolesterol Total", hasil: "180", satuan: "mg/dL" },
        { nama: "Hemoglobin", hasil: "", satuan: "g/dL" },
      ],
    },
  };
  assert.deepEqual(petakanNilaiMcu(detail), {
    sistole: 120, diastole: 80, berat_badan: 60, tinggi_badan: 165, lingkar_perut: 80,
    gula_darah: 95, keterangan_gula_darah: "Glukosa Darah Puasa", kolesterol_total: 180,
  });
});

test("petakanNilaiMcu: stasiun/laboratorium kosong -> seluruh field null (tidak dikarang)", () => {
  assert.deepEqual(petakanNilaiMcu({ stasiun: [], laboratorium: null }), {
    sistole: null, diastole: null, berat_badan: null, tinggi_badan: null, lingkar_perut: null,
    gula_darah: null, keterangan_gula_darah: null, kolesterol_total: null,
  });
});

// KT-7: nilai di luar rentang wajar ditandai, tanpa meneruskan ke bpjs-service.
test("validasiRentangMcu: nilai wajar tidak menghasilkan masalah", () => {
  assert.deepEqual(validasiRentangMcu({ sistole: 120, diastole: 80, gula_darah: 95 }), []);
});

test("validasiRentangMcu: nilai di luar rentang dilaporkan per field", () => {
  const masalah = validasiRentangMcu({ sistole: 400, gula_darah: 5, berat_badan: null });
  assert.equal(masalah.length, 2);
  assert.match(masalah[0], /sistole/);
  assert.match(masalah[1], /gula_darah/);
});

test("angkaHasilLab: koma desimal & satuan dibaca, teks non-angka tetap null", () => {
  assert.equal(angkaHasilLab("120"), 120);
  assert.equal(angkaHasilLab("120,5"), 120.5);
  assert.equal(angkaHasilLab("98.6 mg/dL"), 98.6);
  assert.equal(angkaHasilLab(" 200 "), 200);
  assert.equal(angkaHasilLab("negatif"), null);
  assert.equal(angkaHasilLab(""), null);
  assert.equal(angkaHasilLab(null), null);
});
