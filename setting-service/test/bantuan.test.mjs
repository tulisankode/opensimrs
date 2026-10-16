// Uji unit penyaring Helpdesk: node --test test/*.test.mjs (ekstensi .mjs agar tidak ikut dijalankan jest).
import { test } from "node:test";
import assert from "node:assert/strict";
import { samarkanDataPribadi } from "../src/bantuan/saring.js";

test("samarkanDataPribadi: NIK, kartu, HP, email, dan nomor RM disamarkan", () => {
  const { teks, disamarkan } = samarkanDataPribadi(
    "Pasien NIK 3201234567890001 kartu 0001234567890 HP 081234567890 email budi@gmail.com no RM 00123 tidak muncul",
  );
  assert.equal(teks, "Pasien NIK [NIK] kartu [NO-KARTU] HP [HP] email [EMAIL] no RM [NO-RM] tidak muncul");
  assert.equal(disamarkan, 5);
});

test("samarkanDataPribadi: data contoh fiktif & pertanyaan biasa tidak diubah", () => {
  const masukan = "Cara daftar pasien NIK 9999000000000001, HP 080000000000, email petugas@contoh.id? Menu Admisi.";
  assert.deepEqual(samarkanDataPribadi(masukan), { teks: masukan, disamarkan: 0 });
  assert.equal(samarkanDataPribadi("Bagaimana membatalkan order lab?").disamarkan, 0);
});
