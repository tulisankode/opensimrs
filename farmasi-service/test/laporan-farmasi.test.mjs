// Uji aturan murni Penjualan Obat & Laporan Farmasi: batas hari WIB dan filter lokasi penjualan.
// Jalankan: node --test test/laporan-farmasi.test.mjs (berkas .mjs tidak diambil jest).
import { test } from "node:test";
import assert from "node:assert/strict";
import { setRangeDate } from "../src/helpers/date-helper.js";
import PenjualanObatRepository from "../src/repositories/penjualan-obat-repository.js";
import { Op } from "sequelize";

test("rentang tanggal mengikuti hari WIB, tidak bergantung zona server", () => {
  // 2026-10-20 05:00 WIB (= 2026-10-19 22:00 UTC)
  const req = setRangeDate({ start_date: "1792447200", end_date: "1792447200" });
  assert.equal(req.start_date, Date.parse("2026-10-20T00:00:00+07:00") / 1000);
  assert.equal(req.end_date, Date.parse("2026-10-20T23:59:59+07:00") / 1000);
});

test("filter lokasi penjualan: kosong/Semua tidak menyaring, beberapa nilai dipisah koma", () => {
  assert.equal(PenjualanObatRepository.includeLokasi("").required, false);
  assert.equal(PenjualanObatRepository.includeLokasi("1,4").required, false);
  const pilih = PenjualanObatRepository.includeLokasi("1,2");
  assert.equal(pilih.required, true);
  assert.deepEqual(pilih.where.default_tujuan_order_permintaan[Op.in], ["1", "2"]);
});

test("pendapatan penjualan bebas: hanya lunas, filter Asuransi menghasilkan kosong", () => {
  const w = PenjualanObatRepository.pendapatanWhere({ start_date: 1, end_date: 2, faskes_uuid: "f" });
  assert.equal(w.status, "lunas");
  assert.equal(w.faskes_uuid, "f");
  assert.equal(w.uuid, undefined);
  const asuransi = PenjualanObatRepository.pendapatanWhere({ start_date: 1, end_date: 2, faskes_uuid: "f", payment_method: 2 });
  assert.ok(asuransi.uuid);
});
