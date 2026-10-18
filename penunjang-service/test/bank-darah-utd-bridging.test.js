import { test } from "node:test";
import assert from "node:assert/strict";
import bankDarah from "../src/bank-darah/rute.js";
import rute from "../src/rute.js";
import { ruteMasuk } from "../src/bank-darah/utd/utd-push-rute.js";
import { normalisasiImltd, normalisasiGolongan, normalisasiRhesus } from "../src/bank-darah/utd/utd-hasil.js";
import { alasanEpochDetik } from "../src/bank-darah/stok.js";
import { kodeRsNomor, nomorRegistrasiUtd } from "../src/bank-darah/utd/utd-service.js";
import utdPermintaan from "../src/bank-darah/utd/utd-permintaan-rute.js";

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

// Fitur bdrs_bridging diperiksa PER RUTE bridging: router yang menempel di /permintaan/:uuid tidak boleh punya
// middleware global (router.use) karena dilewati semua rute /permintaan/:uuid/* dan /permintaan/kunjungan.
test("utd-permintaan-rute.js: tanpa middleware global, pemeriksaan fitur hanya pada rute bridging", () => {
  const global = utdPermintaan.stack.filter((l) => !l.route);
  assert.equal(global.length, 0, "router /permintaan/:uuid tidak boleh memasang middleware global (rute.use)");
  const jalur = utdPermintaan.stack.map((l) => l.route?.path).sort();
  assert.deepEqual(jalur, ["/ambil-status-utd", "/kirim-utd"]);
  for (const l of utdPermintaan.stack) {
    assert.ok(l.route.stack.some((s) => s.name === "wajibFiturBdrsBridgingAktif"), `${l.route.path} wajib memeriksa fitur bdrs_bridging`);
  }
});

// KT-11 (PRD): normalisasi IMLTD hanya trim + huruf kecil; nilai harus persis non_reaktif | reaktif | belum_diperiksa.
test("normalisasiImltd: hanya trim + huruf kecil ke enum tertutup", () => {
  assert.equal(normalisasiImltd(" Non_Reaktif "), "non_reaktif");
  assert.equal(normalisasiImltd("REAKTIF"), "reaktif");
  assert.equal(normalisasiImltd(" belum_diperiksa"), "belum_diperiksa");
});

test("normalisasiImltd: sinonim & variasi ejaan TIDAK diterjemahkan → 'tidak_dikenal' (ditolak)", () => {
  for (const v of ["negatif", "negative", "non-reaktif", "nonreaktif", "non reaktif", "positif", "reactive", "Belum Diperiksa", "pending"]) {
    assert.equal(normalisasiImltd(v), "tidak_dikenal", `"${v}" harus tidak_dikenal`);
  }
});

test("normalisasiImltd: nilai asing atau kosong ditolak sebagai 'tidak_dikenal'", () => {
  assert.equal(normalisasiImltd("entah"), "tidak_dikenal");
  assert.equal(normalisasiImltd(""), "tidak_dikenal");
  assert.equal(normalisasiImltd(null), "tidak_dikenal");
  assert.equal(normalisasiImltd(undefined), "tidak_dikenal");
});

// Keselamatan: tanggal kantong wajib epoch DETIK; milidetik/nilai tak wajar ditolak dengan alasan spesifik.
test("alasanEpochDetik: epoch detik wajar diterima", () => {
  assert.equal(alasanEpochDetik(1792224258, "tanggal_kedaluwarsa"), null);
  assert.equal(alasanEpochDetik("1792224258", "tanggal_kedaluwarsa"), null);
  assert.equal(alasanEpochDetik(1e9, "tanggal_produksi"), null);
});

test("alasanEpochDetik: milidetik, terlalu kecil, pecahan → 'format tanggal harus epoch detik'", () => {
  for (const v of [1792224258000, 1792224258 * 1000 - 3600000, 999999999, 0, -5, 1792224258.5, "1792224258000"]) {
    assert.match(alasanEpochDetik(v, "tanggal_kedaluwarsa") ?? "", /format tanggal harus epoch detik/, `nilai ${v}`);
  }
});

test("alasanEpochDetik: kosong / bukan angka → tidak valid", () => {
  for (const v of [undefined, null, "", "besok", true, NaN, Infinity]) {
    assert.equal(alasanEpochDetik(v, "tanggal_kedaluwarsa"), "tanggal_kedaluwarsa tidak valid", `nilai ${String(v)}`);
  }
});

test("normalisasiGolongan: trim + huruf besar, hanya A/B/AB/O", () => {
  assert.equal(normalisasiGolongan(" ab "), "AB");
  assert.equal(normalisasiGolongan("o"), "O");
  assert.equal(normalisasiGolongan("X"), false);
  assert.equal(normalisasiGolongan("A+"), false);
  assert.equal(normalisasiGolongan(""), null);
  assert.equal(normalisasiGolongan(null), null);
});

test("normalisasiRhesus: trim + huruf kecil, positif/negatif, '+'/'-' diterima", () => {
  assert.equal(normalisasiRhesus(" Positif "), "positif");
  assert.equal(normalisasiRhesus("NEGATIF"), "negatif");
  assert.equal(normalisasiRhesus("+"), "positif");
  assert.equal(normalisasiRhesus(" - "), "negatif");
  assert.equal(normalisasiRhesus("pos"), false);
  assert.equal(normalisasiRhesus("rh+"), false);
  assert.equal(normalisasiRhesus(undefined), null);
});

// Nomor registrasi memuat kode RS koneksi agar tidak bertabrakan antar faskes di UTD yang sama.
test("nomorRegistrasiUtd: UTDREG-<kode_rs>-YYYYMMDD-NNNN", () => {
  assert.equal(nomorRegistrasiUtd("UTDREG-20261017-0001", "RSUJI-A"), "UTDREG-RSUJI-A-20261017-0001");
  assert.equal(nomorRegistrasiUtd("UTDREG-20261017-0001", " rs sehat/01 "), "UTDREG-RS-SEHAT-01-20261017-0001");
  assert.equal(nomorRegistrasiUtd("UTDREG-20261017-0001", ""), "UTDREG-20261017-0001");
  assert.notEqual(nomorRegistrasiUtd("UTDREG-20261017-0001", "RS-A"), nomorRegistrasiUtd("UTDREG-20261017-0001", "RS-B"));
  assert.match(nomorRegistrasiUtd("UTDREG-20261017-0042", "3271011"), /^UTDREG-[A-Z0-9-]+-\d{8}-\d{4}$/);
});

test("kodeRsNomor: dibersihkan & dibatasi 30 karakter tanpa tanda hubung di ujung", () => {
  assert.equal(kodeRsNomor("--abc--"), "ABC");
  assert.equal(kodeRsNomor(null), "");
  const panjang = kodeRsNomor("A".repeat(29) + "-B");
  assert.ok(panjang.length <= 30 && !panjang.endsWith("-"));
});
