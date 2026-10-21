// Uji arah mutasi kartu stok: node --test test/kartu-stok-mutasi.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import KartuStokMutasiMapper from "../src/mappers/kartu-stok-mutasi-mapper.js";

const baris = (data) => KartuStokMutasiMapper.toRiwayatMutasiListDTO(data);

test("defisit bernilai positif (resep, retur unit) tercatat sebagai stok keluar", () => {
  const r = baris({ type: "defisit", stok_awal: 8, stok_mutasi: 3 });
  assert.equal(r.stok_masuk, 0);
  assert.equal(r.stok_keluar, 3);
  assert.equal(r.sisa_stok, 5);
});

test("defisit bernilai negatif (pengiriman/pengeluaran unit) tetap keluar", () => {
  const r = baris({ type: "defisit", stok_awal: 5, stok_mutasi: -3 });
  assert.equal(r.stok_keluar, 3);
  assert.equal(r.sisa_stok, 2);
});

test("surplus tercatat sebagai stok masuk", () => {
  const r = baris({ type: "surplus", stok_awal: 5, stok_mutasi: 3 });
  assert.equal(r.stok_masuk, 3);
  assert.equal(r.stok_keluar, 0);
  assert.equal(r.sisa_stok, 8);
});

test("tanpa type, tanda nilai menentukan arah", () => {
  assert.equal(baris({ stok_awal: 5, stok_mutasi: -2 }).sisa_stok, 3);
  assert.equal(baris({ stok_awal: 5, stok_mutasi: 2 }).sisa_stok, 7);
});
