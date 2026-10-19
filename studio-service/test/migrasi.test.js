import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { awalanLayak, gantiRujukan, hitungAwalan, jamBerikut, rencanaUrutMigrasi, terapkanUrutMigrasi } from "../src/migrasi.js";
import { aturanBerkasItem, susunPromptCoding } from "../src/agen/prompt.js";

const pada = (iso) => new Date(iso);

test("jamBerikut: melewati pergantian hari, bulan, dan tahun", () => {
  assert.equal(jamBerikut("2026101814"), "2026101815");
  assert.equal(jamBerikut("2026101823"), "2026101900");
  assert.equal(jamBerikut("2026103123"), "2026110100");
  assert.equal(jamBerikut("2026123123"), "2027010100");
});

test("hitungAwalan: lebih baru dari migrasi terakhir di target, tidak lebih awal dari jam sekarang", () => {
  assert.equal(hitungAwalan({ terakhir: "20261018140000", sekarang: pada("2026-10-18T10:20:00Z") }), "2026101815");
  assert.equal(hitungAwalan({ terakhir: "20261018140000", sekarang: pada("2026-10-18T17:05:00Z") }), "2026101817");
  // Migrasi terakhir di jam yang sama dengan sekarang → jam berikutnya (MMSS item bebas dipilih).
  assert.equal(hitungAwalan({ terakhir: "20261018175900", sekarang: pada("2026-10-18T17:05:00Z") }), "2026101818");
  assert.equal(hitungAwalan({ sekarang: pada("2026-10-18T17:05:00Z") }), "2026101817");
});

test("hitungAwalan: tiga item paralel tidak pernah mendapat awalan yang sama", () => {
  const sekarang = pada("2026-10-18T15:00:00Z");
  const terakhir = "20261018140000";
  const dipesan = [];
  for (let i = 0; i < 3; i++) dipesan.push(hitungAwalan({ terakhir, dipesan, sekarang }));
  assert.deepEqual(dipesan, ["2026101815", "2026101816", "2026101817"]);
  // Pesanan item lain yang lebih jauh di depan tetap dilampaui.
  assert.equal(hitungAwalan({ terakhir, dipesan: ["2026101823"], sekarang }), "2026101900");
});

test("awalanLayak: tertinggal dari target atau dipakai item lain → tidak layak", () => {
  assert.equal(awalanLayak("2026101815", { terakhir: "20261018140000", dipesan: [] }), true);
  assert.equal(awalanLayak("2026101815", { terakhir: "20261018150020", dipesan: [] }), false);
  assert.equal(awalanLayak("2026101815", { terakhir: "20261018140000", dipesan: ["2026101815"] }), false);
  assert.equal(awalanLayak(null, {}), false);
});

test("rencanaUrutMigrasi: migrasi yang sudah paling akhir tidak diubah", () => {
  const rencana = rencanaUrutMigrasi({
    milikItem: ["20261018160000-gizi.cjs", "20261018160100-izin_gizi.cjs"],
    diTarget: ["20261018140000-a.cjs", "20261018150000-b.cjs"],
    awalanBaru: "2026101817",
  });
  assert.deepEqual(rencana, []);
});

test("rencanaUrutMigrasi: item tertinggal → awalan baru, menit-detik & urutan relatif dipertahankan", () => {
  const rencana = rencanaUrutMigrasi({
    milikItem: ["20261018150100-izin_gizi.cjs", "20261018150000-gizi.cjs"],
    diTarget: ["20261018140000-a.cjs", "20261018153000-item_lain.cjs"],
    awalanBaru: "2026101816",
  });
  assert.deepEqual(rencana, [
    { lama: "20261018150000-gizi.cjs", baru: "20261018160000-gizi.cjs" },
    { lama: "20261018150100-izin_gizi.cjs", baru: "20261018160100-izin_gizi.cjs" },
  ]);
});

test("rencanaUrutMigrasi: stempel kembar dengan target & migrasi lintas jam dinomori ulang berurutan", () => {
  const kembar = rencanaUrutMigrasi({ milikItem: ["20261018150000-x.cjs"], diTarget: ["20261018150000-y.cjs"], awalanBaru: "2026101816" });
  assert.deepEqual(kembar, [{ lama: "20261018150000-x.cjs", baru: "20261018160000-x.cjs" }]);
  const lintasJam = rencanaUrutMigrasi({
    milikItem: ["20261017090000-a.cjs", "20261017120000-b.cjs", "20261017120010-c.cjs"],
    diTarget: ["20261018140000-z.cjs"],
    awalanBaru: "2026101815",
  });
  assert.deepEqual(lintasJam.map((r) => r.baru), ["20261018150000-a.cjs", "20261018150100-b.cjs", "20261018150200-c.cjs"]);
  assert.throws(() => rencanaUrutMigrasi({ milikItem: ["20261017090000-a.cjs"], diTarget: ["20261018140000-z.cjs"], awalanBaru: "2026101813" }));
});

test("gantiRujukan: nama dengan dan tanpa .cjs ikut diganti", () => {
  const peta = [{ lama: "20261018150000-gizi.cjs", baru: "20261018160000-gizi.cjs" }];
  assert.equal(
    gantiRujukan("- **Migrasi baru:** `20261018150000-gizi` (berkas 20261018150000-gizi.cjs)", peta),
    "- **Migrasi baru:** `20261018160000-gizi` (berkas 20261018160000-gizi.cjs)",
  );
});

test("terapkanUrutMigrasi: git mv, rujukan di fragmen & berkas lain diperbarui, commit di branch item", async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "studio-uji-urut-"));
  const g = (...a) => execFileSync("git", ["-c", "safe.directory=*", ...a], { cwd: repo, encoding: "utf8" });
  try {
    g("init", "-q", "-b", "utama");
    g("config", "user.name", "Uji");
    g("config", "user.email", "uji@contoh.id");
    g("config", "core.autocrlf", "false");
    fs.mkdirSync(path.join(repo, "database/migrations"), { recursive: true });
    fs.mkdirSync(path.join(repo, "changelog.d"));
    fs.writeFileSync(path.join(repo, "database/migrations/20261018150000-gizi.cjs"), "// lanjutan: 20261018150100-izin_gizi\nmodule.exports = {};\n");
    fs.writeFileSync(path.join(repo, "database/migrations/20261018150100-izin_gizi.cjs"), "module.exports = {};\n");
    fs.writeFileSync(path.join(repo, "changelog.d/STD-0031.md"), "### Ditambahkan\n- Gizi. **Migrasi baru:** `20261018150000-gizi`, `20261018150100-izin_gizi`.\n");
    fs.writeFileSync(path.join(repo, "logo.bin"), Buffer.from([0, 1, 2, 3]));
    g("add", "-A");
    g("commit", "-q", "-m", "feat: gizi");
    const peta = rencanaUrutMigrasi({
      milikItem: ["20261018150000-gizi.cjs", "20261018150100-izin_gizi.cjs"],
      diTarget: ["20261018153000-lain.cjs"],
      awalanBaru: "2026101816",
    });
    const hasil = await terapkanUrutMigrasi(repo, peta, "chore(studio): urutkan migrasi STD-0031\n");
    assert.ok(hasil.sha);
    assert.deepEqual(fs.readdirSync(path.join(repo, "database/migrations")).sort(), ["20261018160000-gizi.cjs", "20261018160100-izin_gizi.cjs"]);
    assert.match(fs.readFileSync(path.join(repo, "changelog.d/STD-0031.md"), "utf8"), /`20261018160000-gizi`, `20261018160100-izin_gizi`/);
    assert.match(fs.readFileSync(path.join(repo, "database/migrations/20261018160000-gizi.cjs"), "utf8"), /lanjutan: 20261018160100-izin_gizi/);
    assert.equal(g("status", "--porcelain").trim(), "");
    assert.equal(g("log", "-1", "--format=%s").trim(), "chore(studio): urutkan migrasi STD-0031");
    assert.ok(hasil.berkas.includes("changelog.d/STD-0031.md"));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("prompt coding menyebut awalan migrasi item & fragmen CHANGELOG secara eksplisit", () => {
  const item = { nomor: 31, judul: "Modul gizi", jenis: "modul" };
  const prompt = susunPromptCoding({ item, artefak: [], instruksi: null, aturanInstalasi: null, branch: "feat/STD-0031-gizi", revisi: false, awalanMigrasi: "2026101816" });
  assert.match(prompt, /WAJIB bernama database\/migrations\/2026101816MMSS-nama\.cjs/);
  assert.match(prompt, /changelog\.d\/STD-0031\.md/);
  assert.match(prompt, /JANGAN mengedit CHANGELOG\.md/);
  // Revisi (instruksi lanjutan) tetap memuat aturan yang sama.
  const revisi = susunPromptCoding({ item, artefak: [], instruksi: "Perbaiki validasi", aturanInstalasi: null, branch: "feat/STD-0031-gizi", revisi: true, awalanMigrasi: "2026101816" });
  assert.match(revisi, /2026101816MMSS/);
  assert.doesNotMatch(aturanBerkasItem(item, null), /WAJIB bernama/);
});
