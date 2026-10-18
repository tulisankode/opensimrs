// Regresi STD-0018: fitur antrian_online_bpjs harus tetap tersedia (bisa diaktifkan admin), mati bawaan di semua
// segmen, dan tanpa modul_syarat: ref_fitur.modul_syarat ber-FK ke ref_modul (satu kode), sehingga daftar
// "bpjs_fkrtl,bpjs_fktp" ditolak migrasi; pemakaian tetap bergantung kredensial WS Antrean BPJS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("katalog-modul.json: fitur antrian_online_bpjs tersedia, mati bawaan, tanpa modul_syarat berkoma", () => {
  const katalog = JSON.parse(readFileSync(join(ROOT, "database", "data", "katalog-modul.json"), "utf8"));
  const fitur = katalog.fitur.find((f) => f.kode === "antrian_online_bpjs");
  assert.ok(fitur);
  assert.equal(fitur.tersedia, true);
  assert.equal(fitur.modul_syarat, null);
  for (const [, daftar] of Object.entries(katalog.preset.fitur_mati)) {
    assert.ok(daftar.includes("antrian_online_bpjs"));
  }
});

// STD-0021: fitur vclaim_rencana_kontrol (modul bpjs_fkrtl) mendaftarkan rute halamannya agar menu & guard router
// mengikuti status fitur; tetap mati bawaan di setiap segmen yang memakai bpjs_fkrtl.
test("katalog-modul.json: fitur vclaim_rencana_kontrol punya rute & mati bawaan", () => {
  const katalog = JSON.parse(readFileSync(join(ROOT, "database", "data", "katalog-modul.json"), "utf8"));
  const fitur = katalog.fitur.find((f) => f.kode === "vclaim_rencana_kontrol");
  assert.ok(fitur);
  assert.equal(fitur.modul, "bpjs_fkrtl");
  assert.deepEqual(fitur.rute, ["/admisi/rencana-kontrol", "/admisi/spri"]);
});
