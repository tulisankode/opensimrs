import { test } from "node:test";
import assert from "node:assert/strict";
import { cocokModel } from "../src/agen/model.js";

test("cocokModel: model mengikuti agen tahap", () => {
  // Claude Code (bawaan = tanpa pilihan)
  for (const m of ["", "opus", "sonnet", "haiku", "claude-opus-5-5", "claude-haiku-5-5"]) assert.ok(cocokModel(undefined, m), m);
  for (const m of ["gpt-5-codex", "o3", "deepseek-chat"]) assert.ok(!cocokModel("claude_code", m), m);
  // Codex
  for (const m of ["", "gpt-5-codex", "o4-mini"]) assert.ok(cocokModel("codex", m), m);
  for (const m of ["claude-sonnet-5-5", "sonnet", "gpt 5; rm -rf"]) assert.ok(!cocokModel("codex", m), m);
  // Konektor API: model diatur di konektor, bukan per tahap
  assert.ok(cocokModel("0199-uuid-konektor", ""));
  assert.ok(!cocokModel("0199-uuid-konektor", "gpt-4o"));
});
