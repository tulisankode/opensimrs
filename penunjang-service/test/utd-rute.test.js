import { test } from "node:test";
import assert from "node:assert/strict";
import utd from "../src/utd/rute.js";
import rute from "../src/rute.js";

// Memuat seluruh modul UTD (donor, aftap, imltd, komponen, distribusi, pelaporan, pengaturan) lewat rute.js
// tanpa menjalankan handler (tidak membuka koneksi database): memastikan tidak ada kesalahan impor/ekspor
// atau path yang rusak saat dirangkai, mis. router UTD belum terdaftar di rute.js layanan.
test("utd/rute.js termuat sebagai Express Router dengan rute terdaftar", () => {
  assert.equal(typeof utd, "function");
  assert.ok(Array.isArray(utd.stack) && utd.stack.length > 0, "router UTD harus punya rute terdaftar");
});

test("rute.js penunjang-service mendaftarkan /utd", () => {
  const lapisan = rute.stack.find((l) => l.regexp?.test("/utd/donor"));
  assert.ok(lapisan, "/utd belum terdaftar di penunjang-service/src/rute.js");
});
