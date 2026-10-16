import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AMBANG_KEDALUWARSA_HARI,
  METODE,
  STATUS_LAYAK_DIPAKAI,
  STATUS_MANUAL,
  STATUS_SET,
  angkaOpsional,
  boolOpsional,
  cekPilihan,
  hitungKedaluwarsa,
  pilihan,
  teks,
} from "../src/cssd/bersama.js";

// Aturan bisnis #9: tanggal kedaluwarsa steril = waktu load selesai + masa_berlaku_steril_jam master set.
test("hitungKedaluwarsa: menjumlahkan waktu selesai dengan masa berlaku (jam → detik)", () => {
  const waktuSelesai = 1_700_000_000;
  assert.equal(hitungKedaluwarsa(waktuSelesai, 168), waktuSelesai + 168 * 3600);
  assert.equal(hitungKedaluwarsa(waktuSelesai, 1), waktuSelesai + 3600);
});

test("cekPilihan: menerima nilai yang terdaftar, menolak nilai di luar daftar", () => {
  assert.equal(cekPilihan("lulus", { lulus: "", gagal: "" }, "hasil"), "lulus");
  assert.throws(() => cekPilihan("tidak_dikenal", { lulus: "", gagal: "" }, "hasil"), /hasil harus salah satu/);
});

test("cekPilihan: nilai kosong/undefined diteruskan apa adanya (field opsional)", () => {
  assert.equal(cekPilihan("", METODE, "metode"), null);
  assert.equal(cekPilihan(undefined, METODE, "metode"), undefined);
});

test("angkaOpsional: menolak nilai bukan angka, meneruskan angka valid", () => {
  assert.equal(angkaOpsional("12", "jumlah"), 12);
  assert.equal(angkaOpsional("", "jumlah"), null);
  assert.equal(angkaOpsional(undefined, "jumlah"), undefined);
  assert.throws(() => angkaOpsional("abc", "jumlah"), /jumlah harus berupa angka/);
});

test("boolOpsional & teks: membersihkan input form (string kosong → null, whitespace dipangkas)", () => {
  assert.equal(boolOpsional(undefined), undefined);
  assert.equal(boolOpsional("1"), true);
  assert.equal(teks("  CSSD-0001  "), "CSSD-0001");
  assert.equal(teks(""), null);
});

test("pilihan: mengubah peta kode→nama menjadi daftar {kode, nama} untuk opsi form", () => {
  const hasil = pilihan({ autoklaf: "Autoklaf", plasma: "Plasma" });
  assert.deepEqual(hasil, [
    { kode: "autoklaf", nama: "Autoklaf" },
    { kode: "plasma", nama: "Plasma" },
  ]);
});

// KF-17/KT-8: hanya status "layak" yang boleh dipilih untuk distribusi/pemakaian.
test("STATUS_LAYAK_DIPAKAI hanya mengizinkan status layak, bukan status lain yang terdaftar", () => {
  assert.equal(STATUS_LAYAK_DIPAKAI, "layak");
  assert.notEqual(STATUS_LAYAK_DIPAKAI, "tidak_layak");
  assert.notEqual(STATUS_LAYAK_DIPAKAI, "menunggu_keputusan");
});

test("STATUS_MANUAL hanya memuat status yang memang terdaftar di STATUS_SET", () => {
  for (const s of STATUS_MANUAL) assert.ok(STATUS_SET[s], `${s} harus terdaftar di STATUS_SET`);
});

test("AMBANG_KEDALUWARSA_HARI default H-3 sesuai KF-16/KT-10", () => {
  assert.equal(AMBANG_KEDALUWARSA_HARI, 3);
});

// Smoke test: seluruh berkas router CSSD harus dapat diimpor (tanpa koneksi DB) tanpa galat ekspor/impor.
test("rute.js dan seluruh sub-router CSSD dapat diimpor tanpa galat", async () => {
  const modul = await import("../src/cssd/rute.js");
  assert.ok(modul.default, "default export (router) harus ada");
});

