import { test } from "node:test";
import assert from "node:assert/strict";
import { saringBerkasKotor } from "../src/git.js";

test("saringBerkasKotor: berkas yang sudah di-commit dibuang, yang masih kotor dipertahankan", () => {
  const daftar = [
    { path: "CHANGELOG.md", status: "M", sumber: "agen" },
    { path: "penunjang-service/src/laundry/stok.js", status: "??", sumber: "agen" },
    { path: "frontend-service/src/views/Laundry/StokPage.vue", status: "M", sumber: "manual" },
  ];
  // Setelah commit manual, hanya StokPage.vue yang masih berubah di worktree.
  const status = { "frontend-service/src/views/Laundry/StokPage.vue": "M" };
  assert.deepEqual(saringBerkasKotor(daftar, status).map((b) => b.path), ["frontend-service/src/views/Laundry/StokPage.vue"]);
});

test("saringBerkasKotor: worktree bersih → daftar kosong; masukan kosong aman", () => {
  assert.deepEqual(saringBerkasKotor([{ path: "a.js", status: "M" }], {}), []);
  assert.deepEqual(saringBerkasKotor(undefined, undefined), []);
  assert.deepEqual(saringBerkasKotor([], { "a.js": "M" }), []);
});
