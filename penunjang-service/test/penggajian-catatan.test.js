import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { teksOpsional } from "../src/hr/penggajian/bersama.js";

test("teksOpsional: kosong → null, teks dirapikan, batas panjang tetap berlaku", () => {
  assert.equal(teksOpsional(undefined, "catatan"), null);
  assert.equal(teksOpsional("   ", "catatan"), null);
  assert.equal(teksOpsional("  Rekening dicocokkan dengan buku tabungan ", "catatan"), "Rekening dicocokkan dengan buku tabungan");
  assert.throws(() => teksOpsional("x".repeat(5000), "catatan"));
});

// Pemeriksaan sumber: perilaku SQL diuji di penggajian-api.test.js; di sini dijaga agar kontrak respons tidak hilang.
test("kontrak: referensi sumber jaspel, catatan pemeriksaan tersimpan, dan komponen_uuid di rincian hasil", () => {
  const baca = (p) => fs.readFileSync(new URL(`../src/hr/penggajian/${p}`, import.meta.url), "utf8");
  assert.match(baca("rute.js"), /rute\.get\("\/referensi\/remunerasi", izin\(\[SUB\.periode, "READ"\], \[SUB\.periode, "CREATE"\]\)/);
  assert.match(baca("rute.js"), /r\.status = 'disetujui' AND r\.jurnal_uuid IS NOT NULL/);
  assert.match(baca("konfigurasi.js"), /catatan_verifikasi: teksOpsional\(req\.body\?\.catatan/);
  assert.match(baca("konfigurasi.js"), /catatan_pengesahan: catatan/);
  assert.match(baca("periode.js"), /'komponen_uuid', r\.komponen_uuid/);
});
