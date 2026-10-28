import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// Server MCP tiruan (stdio, JSON-RPC per baris) pengganti codebase-memory-mcp: alat yang diizinkan, satu alat terlarang,
// dan satu alat yang mengembalikan isError.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uji-petakode-"));
const tiruan = path.join(dir, "codebase-memory-tiruan");
fs.writeFileSync(tiruan, `#!${process.execPath}
let sisa = "";
const balas = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
process.stdin.on("data", (d) => {
  sisa += d;
  const baris = sisa.split("\\n");
  sisa = baris.pop();
  for (const b of baris) {
    const m = JSON.parse(b);
    if (m.method === "initialize") balas(m.id, { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "tiruan", version: "0" } });
    if (m.method === "tools/list") balas(m.id, { tools: ["search_graph", "manage_adr", "index_status", "delete_project"].map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {} } })) });
    if (m.method === "tools/call" && m.params.name === "index_status") balas(m.id, { isError: true, content: [{ type: "text", text: "proyek belum terindeks" }] });
    else if (m.method === "tools/call") balas(m.id, { content: [{ type: "text", text: m.params.name + ":" + JSON.stringify(m.params.arguments) }] });
  }
});
`);
fs.chmodSync(tiruan, 0o755);

const { bukaPetaKode, panduanCodebaseMemory } = await import("../src/agen/petakode.js");

test("bukaPetaKode: alat terlarang disaring, panggilan diteruskan, isError jadi galat", { skip: process.platform === "win32" }, async () => {
  const { alat, tutup } = await bukaPetaKode(tiruan);
  try {
    assert.deepEqual(alat.map((a) => a.nama).sort(), ["index_status", "manage_adr", "search_graph"]);
    assert.ok(alat.every((a) => a.mode === "baca" && a.deskripsi.startsWith("[Peta kode]")));
    const cari = alat.find((a) => a.nama === "search_graph");
    assert.equal(await cari.jalankan({ name_pattern: "Pasien" }), 'search_graph:{"name_pattern":"Pasien"}');
    await assert.rejects(alat.find((a) => a.nama === "index_status").jalankan({}), /belum terindeks/);
  } finally {
    tutup();
  }
});

test("bukaPetaKode: biner tidak ada → galat yang jelas", async () => {
  await assert.rejects(bukaPetaKode(path.join(dir, "tidak-ada")), /tidak ditemukan/);
});

test("panduan peta kode memuat repo_path dan larangan persistence", () => {
  const p = panduanCodebaseMemory("/repo/opensimrs");
  assert.match(p, /"repo_path": "\/repo\/opensimrs"/);
  assert.match(p, /tanpa persistence/);
  assert.match(p, /set_sections/);
});
