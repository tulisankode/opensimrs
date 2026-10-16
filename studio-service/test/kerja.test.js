import { test } from "node:test";
import assert from "node:assert/strict";
import { folderBranchTerbuka } from "../src/kerja.js";

// Keluaran `git worktree list --porcelain`: repo utama di branch item, satu worktree item lain, satu HEAD terlepas.
const PORCELAIN = [
  "worktree D:/project/opensimrs\nHEAD 060e532aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbranch refs/heads/feat/STD-0007-modul-gizi",
  "worktree C:/tmp/opensimrs/STD-0003\nHEAD 060e532aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbranch refs/heads/feat/STD-0003-modul-training",
  "worktree C:/tmp/simrs-studio-terapkan-9\nHEAD 060e532aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\ndetached",
  "",
].join("\n\n");

test("folderBranchTerbuka: menemukan folder repo utama dan worktree tempat branch terbuka", () => {
  assert.equal(folderBranchTerbuka(PORCELAIN, "feat/STD-0007-modul-gizi"), "D:/project/opensimrs");
  assert.equal(folderBranchTerbuka(PORCELAIN, "feat/STD-0003-modul-training"), "C:/tmp/opensimrs/STD-0003");
});

test("folderBranchTerbuka: branch yang tidak terbuka di mana pun → null", () => {
  assert.equal(folderBranchTerbuka(PORCELAIN, "feat/STD-0008-modul-icu"), null);
  assert.equal(folderBranchTerbuka("", "rs-lokal"), null);
});

test("folderBranchTerbuka: nama branch harus sama persis, bukan awalan", () => {
  assert.equal(folderBranchTerbuka(PORCELAIN, "feat/STD-0007"), null);
  assert.equal(folderBranchTerbuka(PORCELAIN, "feat/STD-0003-modul"), null);
});
