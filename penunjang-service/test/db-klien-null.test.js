import { test } from "node:test";
import assert from "node:assert/strict";
import * as db from "../src/db.js";

// Repositori (mis. jadwal dinas) meneruskan klien null untuk pembacaan di luar transaksi; dulu nilai bawaan `k = pool`
// tidak berlaku untuk null sehingga semua daftar jadwal gagal "Cannot read properties of null (reading 'query')".
test("query/satu: klien null atau undefined memakai pool, klien transaksi dipakai bila ada", async () => {
  const asli = db.pool.query;
  const dipanggil = [];
  db.pool.query = async (sql) => { dipanggil.push(`pool:${sql}`); return { rows: [{ n: 1 }] }; };
  const klien = { query: async (sql) => { dipanggil.push(`klien:${sql}`); return { rows: [] }; } };
  try {
    assert.deepEqual(await db.query("A", [], null), [{ n: 1 }]);
    assert.deepEqual(await db.satu("B"), { n: 1 });
    assert.equal(await db.satu("C", [], klien), null);
    assert.deepEqual(dipanggil, ["pool:A", "pool:B", "klien:C"]);
  } finally {
    db.pool.query = asli;
    await db.pool.end().catch(() => {});
  }
});
