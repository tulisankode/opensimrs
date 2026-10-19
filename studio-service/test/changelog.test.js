import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { gabungKeChangelog, namaFragmenBranch, namaFragmenSah, uraiFragmen, urutFragmen } from "../../scripts/lib/changelog.mjs";

// Fragmen CHANGELOG (changelog.d/) dan skrip penggabungnya ada di scripts/ root repo; diuji di sini karena SIMRS Studio
// memerintahkan agen menulis fragmen dan pemeriksa kebijakan menerimanya.
const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const CHANGELOG = `# Catatan Perubahan

## [Belum dirilis]

### Ditambahkan
- Fitur lama.
  - Rincian lama.

### Diperbaiki
- Perbaikan lama.

---

## [1.0.0-alpha.1] - 2026-10-15

### Ditambahkan
- Rilis awal.
`;

test("uraiFragmen: format valid & galat yang umum", () => {
  const ok = uraiFragmen("### Ditambahkan\n- **Gizi**: diet pasien.\n  - **Migrasi baru:** `20261018160000-gizi`.\n\n### Diperbaiki\n- Kasir.\n");
  assert.deepEqual(ok.galat, []);
  assert.deepEqual(ok.kategori.Ditambahkan, ["- **Gizi**: diet pasien.", "  - **Migrasi baru:** `20261018160000-gizi`."]);
  assert.deepEqual(ok.kategori.Diperbaiki, ["- Kasir."]);
  assert.match(uraiFragmen("### Fitur\n- x\n").galat[0], /tidak dikenal/);
  assert.match(uraiFragmen("## [1.1.0]\n### Ditambahkan\n- x\n").galat[0], /hanya judul/);
  assert.match(uraiFragmen("- tanpa kategori\n").galat[0], /di luar bagian/);
  assert.match(uraiFragmen("### Ditambahkan\n").galat[0], /kosong/);
  assert.match(uraiFragmen("").galat[0], /fragmen kosong/);
});

test("nama & urutan fragmen: STD urut nomor, lalu nama branch", () => {
  assert.equal(namaFragmenSah("STD-0031.md"), true);
  assert.equal(namaFragmenSah("README.md"), false);
  assert.equal(namaFragmenSah("feat 1.md"), false);
  assert.equal(namaFragmenBranch("feat/123-filter-ruangan"), "feat-123-filter-ruangan.md");
  assert.deepEqual(["fix-a.md", "STD-0010.md", "STD-0002.md", "docs-b.md"].sort(urutFragmen), ["STD-0002.md", "STD-0010.md", "docs-b.md", "fix-a.md"]);
});

test("gabungKeChangelog: entri masuk ke akhir kategori [Belum dirilis], kategori baru sesuai urutan, versi lain utuh", () => {
  const hasil = gabungKeChangelog(CHANGELOG, [
    { nama: "STD-0032.md", kategori: { Ditambahkan: ["- ICU."], Keamanan: ["- Token."] } },
    { nama: "STD-0031.md", kategori: { Ditambahkan: ["- Gizi.", "  - Rincian gizi."], Diubah: ["- Menu."] } },
  ]);
  assert.equal(hasil, `# Catatan Perubahan

## [Belum dirilis]

### Ditambahkan
- Fitur lama.
  - Rincian lama.
- Gizi.
  - Rincian gizi.
- ICU.

### Diubah
- Menu.

### Diperbaiki
- Perbaikan lama.

### Keamanan
- Token.

---

## [1.0.0-alpha.1] - 2026-10-15

### Ditambahkan
- Rilis awal.
`);
  // CRLF dipertahankan.
  assert.ok(gabungKeChangelog(CHANGELOG.replace(/\n/g, "\r\n"), [{ nama: "a.md", kategori: { Diperbaiki: ["- x"] } }]).includes("- Perbaikan lama.\r\n- x\r\n"));
  assert.throws(() => gabungKeChangelog("# Kosong\n", []), /Belum dirilis/);
});

test("scripts/gabung-changelog.mjs: --cek memvalidasi, mode biasa menggabungkan lalu menghapus fragmen", () => {
  const akar = fs.mkdtempSync(path.join(os.tmpdir(), "studio-uji-changelog-"));
  try {
    fs.mkdirSync(path.join(akar, "scripts", "lib"), { recursive: true });
    fs.mkdirSync(path.join(akar, "changelog.d"));
    fs.copyFileSync(path.join(AKAR, "scripts", "gabung-changelog.mjs"), path.join(akar, "scripts", "gabung-changelog.mjs"));
    fs.copyFileSync(path.join(AKAR, "scripts", "lib", "changelog.mjs"), path.join(akar, "scripts", "lib", "changelog.mjs"));
    fs.writeFileSync(path.join(akar, "CHANGELOG.md"), CHANGELOG);
    fs.writeFileSync(path.join(akar, "changelog.d", "README.md"), "# Panduan (bukan fragmen)\n");
    fs.writeFileSync(path.join(akar, "changelog.d", "STD-0031.md"), "### Ditambahkan\n- Gizi.\n");
    fs.writeFileSync(path.join(akar, "changelog.d", "fix-kasir.md"), "### Diperbaiki\n- Kasir.\n");
    const skrip = path.join(akar, "scripts", "gabung-changelog.mjs");

    fs.writeFileSync(path.join(akar, "changelog.d", "salah.md"), "### Fitur\n- x\n");
    const gagal = spawnSync(process.execPath, [skrip, "--cek"], { encoding: "utf8" });
    assert.equal(gagal.status, 1);
    assert.match(gagal.stdout, /salah\.md.*tidak dikenal/);
    fs.rmSync(path.join(akar, "changelog.d", "salah.md"));

    assert.match(execFileSync(process.execPath, [skrip, "--cek"], { encoding: "utf8" }), /2 fragmen CHANGELOG valid/);
    assert.equal(fs.readFileSync(path.join(akar, "CHANGELOG.md"), "utf8"), CHANGELOG);

    execFileSync(process.execPath, [skrip], { encoding: "utf8" });
    const hasil = fs.readFileSync(path.join(akar, "CHANGELOG.md"), "utf8");
    assert.ok(hasil.includes("  - Rincian lama.\n- Gizi.\n"));
    assert.ok(hasil.includes("- Perbaikan lama.\n- Kasir.\n"));
    assert.deepEqual(fs.readdirSync(path.join(akar, "changelog.d")), ["README.md"]);
  } finally {
    fs.rmSync(akar, { recursive: true, force: true });
  }
});
