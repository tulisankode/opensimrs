import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
test("Migrasi reservasi unik, lebih baru, dan pembentukan SQL berulang tanpa database", async () => {
    const daftar = await readdir(new URL("../../database/migrations/", import.meta.url));
    // Kedua migrasi ICU ada & berurutan (tabel dulu, lalu sinkron katalog). Tidak lagi mensyaratkan keduanya migrasi
    // terbaru: syarat itu pasti gagal begitu ada migrasi lain yang lebih baru.
    const baru = daftar.filter((n) => /^20261020200[12]00-/.test(n)).sort();
    assert.deepEqual(baru, ["20261020200100-icu_layanan_khusus.cjs", "20261020200200-sinkron_katalog_icu_layanan_khusus.cjs"]);
    const migrasi = require("../../database/migrations/20261020200100-icu_layanan_khusus.cjs");
    const sql = [];
    const transaksi = {};
    const qi = { sequelize: { transaction: (fn) => fn(transaksi), query: async (teks, opsi) => { assert.equal(opsi.transaction, transaksi); sql.push(teks); } } };
    await migrasi.up(qi); await migrasi.up(qi);
    assert.equal(sql[0], sql[1]);
    assert.match(sql[0], /RAISE EXCEPTION 'Duplikasi perpindahan/);
    assert.match(sql[0], /WHERE deleted_at IS NULL/);
    assert.doesNotMatch(sql[0], /\b(?:DELETE FROM|DROP TABLE|TRUNCATE)\b/i);
    for (const baris of sql[0].split("\n")) if (/CREATE (?:UNIQUE )?(TABLE|INDEX)/.test(baris) || /ADD COLUMN/.test(baris)) assert.match(baris, /IF NOT EXISTS/);
});
