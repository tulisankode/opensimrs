import { test } from "node:test";
import assert from "node:assert/strict";
import struktur from "../../database/migrations/20261021050000-sdm_jadwal_dinas.cjs";
import katalog from "../../database/migrations/20261021050100-katalog_sdm_jadwal_dinas.cjs";
import izin from "../../database/migrations/20261021050200-izin_sdm_jadwal_dinas.cjs";

test("migrasi struktur dua kali memakai pengaman idempotensi dan relasi gabungan faskes", async () => {
  const log = [], transaction = {};
  const qi = { sequelize: { transaction: async (fn) => fn(transaction), query: async (sql, opsi) => { assert.equal(opsi.transaction, transaction); log.push(sql); return [[]]; } } };
  await struktur.up(qi); const pertama = [...log]; log.length = 0; await struktur.up(qi); assert.deepEqual(log, pertama);
  assert.equal(log.filter((x) => x.startsWith("CREATE TABLE IF NOT EXISTS")).length, 11);
  assert.ok(log.some((x) => x.includes("FOREIGN KEY (faskes_uuid, versi_uuid)")));
  assert.ok(log.some((x) => x.includes("status IN ('draf','diajukan','disetujui')")));
  for (const sql of log) assert.ok(sql.includes("IF NOT EXISTS"));
});
test("sinkron katalog menjalankan helper dalam transaksi dan mendaftarkan empat rute fitur", async () => {
  const log = [], transaction = {};
  await katalog.up({ sequelize: { transaction: async (fn) => fn(transaction), query: async (sql, opsi) => { assert.equal(opsi.transaction, transaction); log.push([sql, opsi.replacements]); return [[]]; } } });
  const rute = log.filter(([sql, p]) => sql.startsWith("INSERT INTO ref_rute") && p.kode === "sdm_jadwal_dinas");
  assert.equal(rute.length, 4); assert.equal(new Set(rute.map(([, p]) => p.rute)).size, 4);
  assert.ok(log.some(([sql, p]) => sql.startsWith("INSERT INTO ref_fitur") && p.kode === "sdm_jadwal_dinas" && sql.includes("false, true")));
});
test("migrasi izin mempertahankan daftar kosong dan izin lama, pengulangan tidak menulis ulang", async () => {
  const rows = [{ tabel: "role", uuid: "super-fiktif", permissions: JSON.stringify([{ module: "Lama", subModules: [] }]) }, { tabel: "users", uuid: "kosong", permissions: "[]" }], log = [];
  const transaction = {};
  const qi = { sequelize: { transaction: async (fn) => fn(transaction), query: async (sql, opsi) => {
    assert.equal(opsi.transaction, transaction);
    if (sql.startsWith("SELECT")) { assert.ok(sql.includes("lower(r.name) = 'super admin'")); return [rows]; }
    log.push(opsi.replacements); rows.find((r) => r.uuid === opsi.replacements.u).permissions = opsi.replacements.p; return [[]];
  } } };
  await izin.up(qi); assert.equal(log.length, 1); const isi = JSON.parse(rows[0].permissions); assert.equal(isi[0].module, "Lama");
  assert.equal(isi.find((x) => x.module === "HR / SDM").subModules.length, 5);
  await izin.up(qi); assert.equal(log.length, 1); assert.equal(rows[1].permissions, "[]");
});
