import { test } from "node:test";
import assert from "node:assert/strict";
import { susunPromptDokumen, uraiKeluaran } from "../src/agen/prompt.js";
import { argumenClaude } from "../src/agen/claude.js";
import { namaBranch } from "../src/git.js";
import { berkasBerubah } from "../src/git.js";

test("uraiKeluaran memisahkan artefak, meta, catatan, commit", () => {
  const k = uraiKeluaran(`Pembuka\n<artefak>\n# PRD\nIsi\n</artefak>\n<meta>{"risiko":"tinggi","modul":["Lab"]}</meta>\n<catatan>Sudah dibuat.</catatan>\n<commit>feat(lab): filter</commit>`);
  assert.equal(k.artefak, "# PRD\nIsi");
  assert.deepEqual(k.meta, { risiko: "tinggi", modul: ["Lab"] });
  assert.equal(k.catatan, "Sudah dibuat.");
  assert.equal(k.commit, "feat(lab): filter");
});

test("uraiKeluaran tanpa penanda memakai seluruh teks; meta rusak diabaikan", () => {
  const k = uraiKeluaran("# Dokumen\nisi <meta>{rusak</meta>");
  assert.equal(k.artefak, "# Dokumen\nisi");
  assert.equal(k.meta, null);
});

test("prompt dokumen memuat permintaan, artefak sebelumnya, dan instruksi", () => {
  const p = susunPromptDokumen({
    item: { nomor: 3, judul: "Filter ruangan", jenis: "fitur", permintaan: { masalah: "Sulit mencari" } },
    tahap: "prd",
    artefakSebelumnya: [{ tahap: "usecase", versi: 2, isi: "UC-01" }],
    artefakTahapIni: null,
    diskusi: [{ dari: "pengguna", pengguna: "superadmin", isi: "Tambah KT isolasi faskes" }],
    instruksi: "Perjelas KT-4",
    aturanInstalasi: "",
  });
  assert.match(p, /STD-0003/);
  assert.match(p, /Sulit mencari/);
  assert.match(p, /UC-01/);
  assert.match(p, /Perjelas KT-4/);
  assert.match(p, /<artefak>/);
});

test("argumen CLI: dokumen hanya baca, coding tanpa git commit/push", () => {
  const dok = argumenClaude({ mode: "dokumen" });
  assert.equal(dok[dok.indexOf("--tools") + 1], "Read,Grep,Glob");
  assert.ok(!dok.includes("acceptEdits"));
  const kode = argumenClaude({ mode: "coding", model: "claude-opus-5-5", resume: "abc" });
  assert.ok(kode.includes("acceptEdits"));
  assert.ok(kode.includes("Bash(git push:*)"));
  assert.ok(kode.indexOf("Bash(git push:*)") > kode.indexOf("--disallowedTools"));
  assert.equal(kode[kode.indexOf("--resume") + 1], "abc");
});

test("argumen CLI: peta kode codebase-memory hanya bila diaktifkan", () => {
  const mcpConfig = (args) => JSON.parse(args[args.indexOf("--mcp-config") + 1]).mcpServers;
  const tanpa = argumenClaude({ mode: "dokumen", base: "/repo" });
  assert.deepEqual(Object.keys(mcpConfig(tanpa)), ["opensimrs"]);
  assert.ok(!tanpa.some((a) => a.startsWith("mcp__codebase-memory__")));
  const dengan = argumenClaude({ mode: "coding", base: "/repo", codebaseMemory: "/bin/codebase-memory-mcp" });
  assert.equal(mcpConfig(dengan)["codebase-memory"].command, "/bin/codebase-memory-mcp");
  assert.ok(dengan.includes("mcp__codebase-memory__search_graph"));
  assert.ok(dengan.includes("mcp__codebase-memory__manage_adr"));
  assert.ok(!dengan.includes("mcp__codebase-memory__delete_project"));
  assert.match(dengan[dengan.indexOf("--append-system-prompt") + 1], /"repo_path": "\/repo"/);
  // Uji koneksi (mcp: false) tidak memasang server apa pun.
  assert.ok(!argumenClaude({ mode: "dokumen", mcp: false, codebaseMemory: "/bin/x" }).includes("--mcp-config"));
});

test("namaBranch mengikuti <jenis>/STD-<nomor>-<ringkasan>", () => {
  assert.equal(namaBranch({ nomor: 7, jenis: "perbaikan", judul: "Blokir bayar sebelum discharge!" }), "fix/STD-0007-blokir-bayar-sebelum-discharge");
  assert.equal(namaBranch({ nomor: 12, jenis: "modul", judul: "Modul Gizi: menu & diet pasien rawat inap" }), "feat/STD-0012-modul-gizi-menu-diet-pasien-rawat");
});

test("berkasBerubah hanya mengambil berkas yang disentuh agen", () => {
  const sebelum = { status: { "a.js": "M", "vite.config.ts": "M" }, sidik: { "a.js": "h1", "vite.config.ts": "v1" } };
  const sesudah = { status: { "a.js": "M", "vite.config.ts": "M", "b.js": "??" }, sidik: { "a.js": "h2", "vite.config.ts": "v1", "b.js": "h3" } };
  assert.deepEqual(berkasBerubah(sebelum, sesudah).map((b) => b.path).sort(), ["a.js", "b.js"]);
});

test("teksLampiran: isi lampiran teks disisipkan utuh bila tersedia, sisanya cukup lokasi", async () => {
  const { teksLampiran } = await import("../src/agen/prompt.js");
  assert.equal(teksLampiran([]), null);
  const lokasi = teksLampiran([{ nama: "a.png", lokasi: "/x/a.png" }]);
  assert.match(lokasi, /a\.png: \/x\/a\.png/);
  assert.match(lokasi, /alat baca berkas/);
  const sisip = teksLampiran([{ nama: "prd.md", lokasi: "/x/prd.md", isi: "# PRD\nisi rahasia tidak ada" }]);
  assert.match(sisip, /prd\.md \(isi di bawah\)/);
  assert.match(sisip, /<lampiran nama="prd\.md">\n# PRD\nisi rahasia tidak ada\n<\/lampiran>/);
  assert.doesNotMatch(sisip, /\/x\/prd\.md/);
  assert.doesNotMatch(sisip, /alat baca berkas/);
});
