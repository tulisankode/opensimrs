import { test } from "node:test";
import assert from "node:assert/strict";
import { waktuMulaiProses } from "../src/proses.js";

test("waktuMulaiProses: proses ini terbaca sebelum sekarang; PID tidak ada → null", () => {
  const sekarang = Math.floor(Date.now() / 1000);
  const mulai = waktuMulaiProses(process.pid);
  assert.ok(mulai && mulai <= sekarang + 1 && mulai > sekarang - 3600, `waktu mulai ${mulai}`);
  assert.equal(waktuMulaiProses(999999), null);
});
