import { test } from "node:test";
import assert from "node:assert/strict";
import { ALAT_DITOLAK, aturAgen, ambilJson } from "../src/openclaw.js";

test("ambilJson: JSON diapit banner dan teks penutup CLI tetap terurai", () => {
  const keluaran = 'OpenClaw 2026.10.4 (383c124)\n{\n  "status": "ok",\n  "result": { "payloads": [{ "text": "Halo {dunia}" }] }\n}\nCLI cleanup timed out: shared-state after 5000ms\n';
  assert.equal(ambilJson(keluaran).result.payloads[0].text, "Halo {dunia}");
  assert.deepEqual(ambilJson('[{"id":"main"}]\n'), [{ id: "main" }]);
  assert.equal(ambilJson("tidak ada json"), null);
});

test("aturAgen: masukan tidak valid ditolak sebelum menjalankan OpenClaw", async () => {
  await assert.rejects(aturAgen({ agen: "Helpdesk OpenSIMRS", model: "ollama/qwen3:4b" }), /ID agen/);
  await assert.rejects(aturAgen({ agen: "helpdesk-opensimrs", model: "qwen3:4b" }), /penyedia\/nama-model/);
  await assert.rejects(aturAgen({ agen: "helpdesk-opensimrs", model: "ollama/qwen3:4b", kunciApi: "rahasia" }), /tidak memakai kunci API/);
  await assert.rejects(aturAgen({ agen: "helpdesk-opensimrs", model: "ollama/qwen3:4b", batasBootstrap: 10 }), /2\.000–200\.000/);
});

test("agen helpdesk: alat tulis, eksekusi, peramban, dan subagen selalu ditolak", () => {
  for (const alat of ["exec", "write", "edit", "apply_patch", "browser", "web_fetch", "sessions_spawn", "subagents"]) assert.ok(ALAT_DITOLAK.includes(alat), alat);
});

test("aturAgen: body snake_case dari frontend Studio (kunci_api, batas_bootstrap) dibaca", async () => {
  await assert.rejects(aturAgen({ agen: "helpdesk-opensimrs", model: "ollama/qwen3:4b", kunci_api: "rahasia" }), /tidak memakai kunci API/);
  await assert.rejects(aturAgen({ agen: "helpdesk-opensimrs", model: "ollama/qwen3:4b", batas_bootstrap: 10 }), /2\.000–200\.000/);
});
