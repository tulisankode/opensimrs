import test from "node:test";
import assert from "node:assert/strict";
import { vaksinBerikutnya, dasarLengkap } from "../src/umum/jadwal-imunisasi.js";
import { kelompokUmur, rentangPeriode } from "../src/umum/kelompok-umur.js";

const VAKSIN_BAYI = [
  { kode: "bcg", urutan_dosis: 1, wajib_dasar_lengkap: true },
  { kode: "polio1", urutan_dosis: 2, wajib_dasar_lengkap: true },
  { kode: "dpt1", urutan_dosis: 3, wajib_dasar_lengkap: true },
];

test("vaksinBerikutnya mengembalikan dosis berikutnya yang belum diberikan", () => {
  const berikutnya = vaksinBerikutnya([{ jenis_vaksin_kode: "bcg" }], VAKSIN_BAYI);
  assert.equal(berikutnya.kode, "polio1");
});

test("vaksinBerikutnya null bila semua sudah diberikan", () => {
  const riwayat = VAKSIN_BAYI.map((v) => ({ jenis_vaksin_kode: v.kode }));
  assert.equal(vaksinBerikutnya(riwayat, VAKSIN_BAYI), null);
});

test("dasarLengkap false bila ada vaksin wajib yang belum diberikan", () => {
  assert.equal(dasarLengkap([{ jenis_vaksin_kode: "bcg" }], VAKSIN_BAYI), false);
});

test("dasarLengkap true bila semua vaksin wajib sudah diberikan", () => {
  const riwayat = VAKSIN_BAYI.map((v) => ({ jenis_vaksin_kode: v.kode }));
  assert.equal(dasarLengkap(riwayat, VAKSIN_BAYI), true);
});

test("kelompokUmur membagi sesuai rentang usia", () => {
  assert.equal(kelompokUmur(0), "<1");
  assert.equal(kelompokUmur(3), "1-4");
  assert.equal(kelompokUmur(10), "5-14");
  assert.equal(kelompokUmur(20), "15-24");
  assert.equal(kelompokUmur(30), "25-44");
  assert.equal(kelompokUmur(50), "45-64");
  assert.equal(kelompokUmur(70), "65+");
  assert.equal(kelompokUmur(null), null);
});

test("rentangPeriode menolak format selain YYYY-MM", () => {
  assert.equal(rentangPeriode("2026/01"), null);
  const r = rentangPeriode("2026-02");
  assert.ok(r.mulai < r.selesai);
});
