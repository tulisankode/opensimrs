import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

// Codex tiruan: mengeluarkan event JSONL seperti `codex exec --json`, menulis hasil ke -o, dan (mode coding)
// melanggar zona terlarang agar penjaga Studio bisa diuji tanpa akun ChatGPT.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uji-codex-"));
const tiruan = path.join(dir, "codex-tiruan.js");
fs.writeFileSync(tiruan, `
const fs = require("fs"); const path = require("path");
const a = process.argv.slice(2);
const cwd = a[a.indexOf("-C") + 1]; const keluar = a[a.indexOf("-o") + 1]; const sandbox = a[a.indexOf("-s") + 1];
let masuk = ""; process.stdin.on("data", (d) => (masuk += d)).on("end", () => {
  const e = (o) => console.log(JSON.stringify(o));
  e({ type: "thread.started", thread_id: "utas-1" });
  e({ type: "item.completed", item: { type: "command_execution", command: "git status", exit_code: 0 } });
  if (sandbox === "workspace-write") {
    fs.writeFileSync(path.join(cwd, "fitur.js"), "// boleh\\n");
    fs.mkdirSync(path.join(cwd, "studio-service"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "studio-service", "rute.js"), "// diubah agen\\n");
    fs.writeFileSync(path.join(cwd, ".env"), "SECRET_KEY=diubah\\n");
    e({ type: "item.completed", item: { type: "file_change", changes: [{ path: "fitur.js", kind: "add" }] } });
  }
  e({ type: "item.completed", item: { type: "agent_message", text: "Selesai. Prompt berisi aturan: " + masuk.includes("Batas khusus agen ini") } });
  e({ type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 } });
  fs.writeFileSync(keluar, "HASIL AKHIR");
});
`);
process.env.STUDIO_CODEX_BIN = tiruan;
process.env.DB_PORT = "1"; // tanpa basis data: log & status tugas diabaikan

const { argumenCodex, jalankanCodex, terlarang } = await import("../src/agen/codex.js");

const git = (cwd, ...a) => execFileSync("git", ["-c", "safe.directory=*", "-c", "user.email=uji@contoh.id", "-c", "user.name=uji", ...a], { cwd, encoding: "utf8" }).trim();

test("argumenCodex: sandbox per mode & instruksi dari stdin", () => {
  const dok = argumenCodex({ mode: "dokumen", model: "", base: "/repo", berkasHasil: "/tmp/h.txt" });
  assert.equal(dok[dok.indexOf("-s") + 1], "read-only");
  assert.equal(dok.at(-1), "-");
  const cod = argumenCodex({ mode: "coding", model: "gpt-5-codex", base: "/repo", berkasHasil: "/tmp/h.txt" });
  assert.equal(cod[cod.indexOf("-s") + 1], "workspace-write");
  assert.ok(cod.includes("--json") && cod.includes("--ignore-user-config") && cod.includes('approval_policy="never"') && cod.includes("gpt-5-codex"));
});

test("argumenCodex: coding di Windows memakai sandbox Windows agar bisa menulis; dokumen & non-Windows tidak", () => {
  const win = argumenCodex({ mode: "coding", model: "", base: "C:\\repo", berkasHasil: "h.txt", platform: "win32" });
  assert.ok(win.includes('windows.sandbox="unelevated"'));
  assert.equal(win.at(-1), "-");
  assert.ok(!argumenCodex({ mode: "dokumen", model: "", base: "C:\\repo", berkasHasil: "h.txt", platform: "win32" }).includes('windows.sandbox="unelevated"'));
  assert.ok(!argumenCodex({ mode: "coding", model: "", base: "/repo", berkasHasil: "h.txt", platform: "linux" }).includes('windows.sandbox="unelevated"'));
});

test("terlarang: zona yang tidak boleh diubah agen", () => {
  for (const p of [".env", "lab-service/.env.example", "studio-service/src/rute.js", "packages/authorization-sdk/auth.js", ".github/workflows/ci.yml", "deploy/server/deploy.sh", "CLAUDE.md"]) assert.ok(terlarang(p), p);
  for (const p of ["lab-service/src/app.js", "packages/model-sdk/models/x.js", "docs/CLAUDE-lain.md", "frontend-service/src/env.ts"]) assert.ok(!terlarang(p), p);
});

test("jalankanCodex: hasil, sesi, dan pelanggaran zona terlarang dikembalikan", async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "uji-codex-repo-"));
  try {
    git(repo, "init", "-q");
    fs.mkdirSync(path.join(repo, "studio-service"));
    fs.writeFileSync(path.join(repo, "studio-service", "rute.js"), "// asli\n");
    git(repo, "add", "-A");
    git(repo, "commit", "-qm", "awal");
    fs.writeFileSync(path.join(repo, ".env"), "SECRET_KEY=asli\n");

    const dok = await jalankanCodex({ tugasUuid: "uji-dok", prompt: "Tulis PRD", mode: "dokumen", base: repo });
    assert.equal(dok.hasil, "HASIL AKHIR");
    assert.equal(dok.sessionId, "codex:utas-1");

    await jalankanCodex({ tugasUuid: "uji-coding", prompt: "Tambah fitur", mode: "coding", base: repo });
    assert.equal(fs.readFileSync(path.join(repo, "fitur.js"), "utf8"), "// boleh\n");
    assert.equal(fs.readFileSync(path.join(repo, "studio-service", "rute.js"), "utf8").replace(/\r/g, ""), "// asli\n");
    assert.equal(fs.readFileSync(path.join(repo, ".env"), "utf8"), "SECRET_KEY=asli\n");
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test.after(async () => {
  fs.rmSync(dir, { recursive: true, force: true });
  const { pool } = await import("../src/db.js");
  await pool.end().catch(() => {});
});
