import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.SECRET_KEY = process.env.SECRET_KEY || "kunci-uji";
const { tandaTangan } = await import("../src/klien-pcare.js");
const { signatureValid, terbitkanToken, faskesDariToken } = await import("../src/klien-antrean.js");
const {
  validasiAmbilAntrean, validasiStatusAntrean, validasiBatalAntrean, validasiCheckIn, ValidasiGagal,
} = await import("../src/validasi-antrean.js");
const { namaHari } = await import("../src/antrean-peta.js");

test("signatureValid: cocok dengan tandaTangan (X-cons-id/X-timestamp/X-signature)", () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = tandaTangan("CONS1", "rahasia", timestamp);
  assert.equal(signatureValid("CONS1", "rahasia", timestamp, sig), true);
  assert.equal(signatureValid("CONS1", "rahasia", timestamp, "salah"), false);
  assert.equal(signatureValid("CONS1", "rahasia", timestamp - 1000, sig), false); // di luar toleransi waktu
});

test("terbitkanToken/faskesDariToken: faskesUuid hanya berasal dari token yang valid", () => {
  const token = terbitkanToken("FASKES-1");
  assert.equal(faskesDariToken(token), "FASKES-1");
  assert.equal(faskesDariToken("token-acak"), null);
  assert.equal(faskesDariToken(""), null);
});

test("validasiAmbilAntrean: menolak bila nomorkartu/nik dan kodepoli/tanggal tidak lengkap", () => {
  assert.throws(() => validasiAmbilAntrean({ kodepoli: "001", tanggalperiksa: "2026-10-20" }), ValidasiGagal);
  assert.throws(() => validasiAmbilAntrean({ nik: "9999000000000001", tanggalperiksa: "2026-10-20" }), ValidasiGagal);
  assert.throws(() => validasiAmbilAntrean({ nik: "9999000000000001", kodepoli: "001", tanggalperiksa: "2026/10/20" }), ValidasiGagal);
  const hasil = validasiAmbilAntrean({ nik: "9999000000000001", kodepoli: "001", tanggalperiksa: "2026-10-20", pasienbaru: "0" });
  assert.equal(hasil.nik, "9999000000000001");
  assert.equal(hasil.pasienbaru, false);
});

test("validasiStatusAntrean/validasiBatalAntrean/validasiCheckIn: field wajib", () => {
  assert.throws(() => validasiStatusAntrean({ tanggalperiksa: "2026-10-20" }), ValidasiGagal);
  assert.deepEqual(validasiStatusAntrean({ kodepoli: "001", tanggalperiksa: "2026-10-20" }), {
    kodepoli: "001", kodedokter: null, tanggalperiksa: "2026-10-20",
  });
  assert.throws(() => validasiBatalAntrean({}), ValidasiGagal);
  assert.throws(() => validasiCheckIn({}), ValidasiGagal);
});

test("namaHari: pemetaan tanggal -> nama hari Indonesia", () => {
  assert.equal(namaHari("2026-10-19"), "Senin");
  assert.equal(namaHari("2026-10-25"), "Minggu");
});
