import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARMADA_UNTUK_LAYANAN,
  JENIS_LAYANAN,
  TAHAP_PERJALANAN,
  cekPilihan,
  hitungJarak,
  pastikanArmadaLayak,
  pastikanUrutanWaktu,
  wajibPilihan,
  waktuRespons,
} from "../src/ambulans/bersama.js";

// Aturan bisnis #7/KT-12/KT-13: jarak = km_akhir - km_awal; km_akhir tidak boleh lebih kecil dari km_awal.
test("hitungJarak: menghitung selisih & menolak km_akhir < km_awal", () => {
  assert.equal(hitungJarak(100, 142), 42);
  assert.equal(hitungJarak(100.5, 110), 9.5);
  assert.throws(() => hitungJarak(100, 90), /km_akhir tidak boleh lebih kecil/);
  assert.throws(() => hitungJarak("abc", 10), /wajib diisi dengan angka/);
});

// Aturan bisnis #6/KT-10: waktu respons = waktu berangkat - waktu permintaan.
test("waktuRespons: selisih waktu berangkat dengan waktu permintaan, null bila belum berangkat", () => {
  assert.equal(waktuRespons(1_700_000_000, 1_700_000_300), 300);
  assert.equal(waktuRespons(1_700_000_000, null), null);
});

test("wajibPilihan/cekPilihan: validasi nilai enum", () => {
  assert.equal(wajibPilihan("gawat_darurat", JENIS_LAYANAN, "jenis_layanan"), "gawat_darurat");
  assert.throws(() => wajibPilihan("tidak_dikenal", JENIS_LAYANAN, "jenis_layanan"), /jenis_layanan harus salah satu/);
  assert.equal(cekPilihan(undefined, JENIS_LAYANAN, "jenis_layanan"), undefined);
  assert.equal(cekPilihan("", JENIS_LAYANAN, "jenis_layanan"), null);
});

// KF-6/KT-7/G3: jenis armada harus sesuai jenis layanan & armada harus berstatus siap.
test("pastikanArmadaLayak: menolak armada tidak siap atau jenis tidak sesuai", () => {
  const siapTransport = { nomor_polisi: "B 1234 AM", status: "siap", jenis: "transport" };
  assert.doesNotThrow(() => pastikanArmadaLayak(siapTransport, "rujukan"));
  assert.throws(() => pastikanArmadaLayak({ ...siapTransport, status: "servis" }, "rujukan"), /tidak dapat ditugaskan/);
  assert.throws(() => pastikanArmadaLayak(siapTransport, "jenazah"), /tidak sesuai untuk layanan/);
  assert.doesNotThrow(() => pastikanArmadaLayak({ ...siapTransport, jenis: "jenazah" }, "jenazah"));
});

test("ARMADA_UNTUK_LAYANAN: gawat darurat & jenazah butuh armada khusus, rujukan/pemulangan boleh transport biasa", () => {
  assert.deepEqual(ARMADA_UNTUK_LAYANAN.gawat_darurat, ["gawat_darurat"]);
  assert.deepEqual(ARMADA_UNTUK_LAYANAN.jenazah, ["jenazah"]);
  assert.ok(ARMADA_UNTUK_LAYANAN.rujukan.includes("transport"));
  assert.ok(ARMADA_UNTUK_LAYANAN.pemulangan.includes("transport"));
});

// KT-11/G4: tahap berikutnya tidak boleh lebih awal dari tahap sebelumnya yang sudah tercatat.
test("pastikanUrutanWaktu: menolak waktu yang melanggar urutan tahap", () => {
  const perjalanan = { berangkat_pada: 1000, tiba_lokasi_pada: null, berangkat_tujuan_pada: null, tiba_tujuan_pada: null, kembali_pada: null };
  assert.doesNotThrow(() => pastikanUrutanWaktu(perjalanan, "tiba_lokasi", 1500));
  assert.throws(() => pastikanUrutanWaktu(perjalanan, "tiba_lokasi", 500), /tidak boleh lebih awal/);
});

test("TAHAP_PERJALANAN: urutan tahap sesuai alur utama use case", () => {
  assert.deepEqual(TAHAP_PERJALANAN, ["berangkat", "tiba_lokasi", "berangkat_tujuan", "tiba_tujuan", "kembali"]);
});

// Smoke test: seluruh berkas router Ambulans harus dapat diimpor (tanpa koneksi DB) tanpa galat ekspor/impor.
test("rute.js dan seluruh sub-router Ambulans dapat diimpor tanpa galat", async () => {
  const modul = await import("../src/ambulans/rute.js");
  assert.ok(modul.default, "default export (router) harus ada");
});
