import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  SUMBER_STATUS,
  awalanKode,
  cekKonfigurasiSiklus,
  cekTransisiStatus,
  cekUnitAlur,
  daftarKode,
  jumlahDariKode,
  kodeUnitKe,
  normalKode,
  pilahDiterima,
  statusSiklus,
} from "../src/laundry/unit-alur.js";
import { laundryPermission } from "../../auth-service/src/helpers/permission-list.js";

// Pelacakan per unit linen (STD-0030): fungsi murni unit-alur.js, izin, katalog, dan migrasi.
const require = createRequire(import.meta.url);
const unit = (x) => ({ uuid: x.kode, kode_unit: x.kode, status: "aktif", cara_pencatatan: "per_unit", jenis_linen_uuid: "J1", nama_jenis: "Selimut", lokasi_tipe: "ruangan", lokasi_uuid: "R1", ...x });

test("normalKode & daftarKode: hasil pindai dirapikan, kosong/ganda ditolak", () => {
  assert.equal(normalKode("  slm-000001 "), "SLM-000001");
  assert.deepEqual(daftarKode(["slm-1", " SLM-2"]), ["SLM-1", "SLM-2"]);
  assert.throws(() => daftarKode([]), /minimal satu kode/);
  assert.throws(() => daftarKode("SLM-1"), /minimal satu kode/);
  assert.throws(() => daftarKode(["SLM-1", "slm-1 "]), /lebih dari sekali: SLM-1/);
  assert.throws(() => daftarKode(["SLM-1", ""]), /kosong/);
  assert.throws(() => daftarKode(Array.from({ length: 501 }, (_, i) => `K${i}`)), /maksimal 500/);
});

test("awalanKode & kodeUnitKe: kode unit stabil berawalan jenis", () => {
  assert.equal(awalanKode("slm"), "SLM");
  assert.equal(awalanKode("bed cover"), "BED-COVER");
  assert.equal(kodeUnitKe("SLM", 123), "SLM-000123");
  assert.throws(() => awalanKode("SLM/01"), /huruf, angka/);
  assert.throws(() => awalanKode(""), /huruf, angka/);
});

test("cekKonfigurasiSiklus: batas > 0, peringatan ≤ batas dan butuh batas", () => {
  assert.deepEqual(cekKonfigurasiSiklus(150, 140), { batas: 150, peringatan: 140 });
  assert.deepEqual(cekKonfigurasiSiklus(null, null), { batas: null, peringatan: null });
  assert.throws(() => cekKonfigurasiSiklus(0, null), /bilangan bulat/);
  assert.throws(() => cekKonfigurasiSiklus(10.5, null), /bilangan bulat/);
  assert.throws(() => cekKonfigurasiSiklus(100, 120), /tidak boleh melebihi/);
  assert.throws(() => cekKonfigurasiSiklus(null, 5), /hanya dapat diisi/);
});

test("statusSiklus: normal → mendekati (ambang) → tercapai (batas)", () => {
  assert.equal(statusSiklus(10, 150, 140), "normal");
  assert.equal(statusSiklus(145, 150, 140), "mendekati");
  assert.equal(statusSiklus(150, 150, 140), "tercapai");
  assert.equal(statusSiklus(170, 150, null), "tercapai");
  assert.equal(statusSiklus(999, null, null), "normal");
});

test("cekTransisiStatus: alasan wajib, dimusnahkan final, nonaktif hanya dari posisi diam", () => {
  assert.deepEqual(cekTransisiStatus(unit({ kode: "A" }), "rusak", "sobek"), { keluarBuku: true, masukBuku: false });
  assert.deepEqual(cekTransisiStatus(unit({ kode: "A", status: "rusak" }), "hilang", "tidak ada"), { keluarBuku: false, masukBuku: false });
  assert.deepEqual(cekTransisiStatus(unit({ kode: "A", status: "hilang" }), "aktif", "ditemukan"), { keluarBuku: false, masukBuku: true });
  assert.throws(() => cekTransisiStatus(unit({ kode: "A" }), "rusak", "  "), /Alasan/);
  assert.throws(() => cekTransisiStatus(unit({ kode: "A" }), "dicuri", "x"), (e) => e.status === 400);
  assert.throws(() => cekTransisiStatus(unit({ kode: "A" }), "aktif", "x"), (e) => e.status === 409);
  assert.throws(() => cekTransisiStatus(unit({ kode: "A", status: "dimusnahkan" }), "aktif", "x"), /dimusnahkan/);
  assert.throws(() => cekTransisiStatus(unit({ kode: "A", lokasi_tipe: "batch" }), "rusak", "x"), (e) => e.status === 409 && /selesaikan alurnya/.test(e.message));
  assert.equal(SUMBER_STATUS.dimusnahkan, "afkir");
});

test("cekUnitAlur: unit nonaktif, beda jenis, atau beda lokasi ditolak 409 dengan posisi terakhir", () => {
  const syarat = { jenisLinenUuid: "J1", namaJenis: "Selimut", lokasiTipe: "ruangan", lokasiUuid: "R1", keterangan: "bukan di ruangan ini" };
  assert.equal(cekUnitAlur([unit({ kode: "A" })], syarat).length, 1);
  assert.throws(() => cekUnitAlur([unit({ kode: "A", status: "hilang" })], syarat), (e) => e.status === 409 && /tidak aktif/.test(e.message));
  assert.throws(() => cekUnitAlur([unit({ kode: "A", jenis_linen_uuid: "J2", nama_jenis: "Bed Cover" })], syarat), /Bed Cover/);
  assert.throws(() => cekUnitAlur([unit({ kode: "A", lokasi_uuid: "R2", nama_lokasi: "Mawar" })], syarat), (e) => e.status === 409 && /Posisi terakhir: Di ruangan Mawar/.test(e.message));
  assert.throws(() => cekUnitAlur([unit({ kode: "A", lokasi_tipe: "kotor" })], syarat), /Antrean cuci/);
  assert.throws(() => cekUnitAlur([unit({ kode: "A", cara_pencatatan: "per_jumlah" })], syarat), /tidak dilacak per unit/);
});

test("jumlahDariKode & pilahDiterima: jumlah mengikuti hasil pindai, sebagian wajib dipindai", () => {
  assert.equal(jumlahDariKode(["A", "B"], undefined, "jumlah"), 2);
  assert.equal(jumlahDariKode(["A", "B"], 2, "jumlah"), 2);
  assert.throws(() => jumlahDariKode(["A", "B"], 3, "jumlah"), /tidak sama/);
  const units = [unit({ kode: "A" }), unit({ kode: "B" }), unit({ kode: "C" })];
  const p = pilahDiterima(units, ["B", "A"], undefined, "Selimut");
  assert.deepEqual(p.diterima.map((u) => u.kode_unit), ["B", "A"]);
  assert.deepEqual(p.tidak.map((u) => u.kode_unit), ["C"]);
  assert.equal(pilahDiterima(units, null, 3, "Selimut").tidak.length, 0);
  assert.equal(pilahDiterima(units, null, 0, "Selimut").diterima.length, 0);
  assert.throws(() => pilahDiterima(units, null, 2, "Selimut"), /pindai kode unit/);
  assert.throws(() => pilahDiterima(units, ["X"], undefined, "Selimut"), /tidak termasuk/);
  assert.throws(() => pilahDiterima(units, ["A"], 2, "Selimut"), /tidak sama/);
});

test("permission-list: submodul pelacakan unit tersedia dengan aksi yang dipakai rute", () => {
  const sub = Object.fromEntries(laundryPermission.subModules.map((s) => [s.name, s.allows ?? []]));
  assert.deepEqual(sub["Unit Linen"], ["READ", "CREATE", "UPDATE", "CETAK LABEL"]);
  assert.deepEqual(sub["Pemindaian Unit"], ["READ"]);
  assert.deepEqual(sub["Koreksi Unit"], ["READ", "UPDATE"]);
  assert.deepEqual(sub["Laporan Unit"], ["READ", "CETAK LAPORAN"]);
});

test("katalog: tiga fitur unit pada modul laundry dengan rute halaman", () => {
  const katalog = require("../../database/data/katalog-modul.json");
  const fitur = Object.fromEntries(katalog.fitur.filter((f) => f.modul === "laundry").map((f) => [f.kode, f.rute]));
  assert.deepEqual(fitur.laundry_unit, ["/laundry/unit"]);
  assert.deepEqual(fitur.laundry_pemindaian_unit, ["/laundry/pemindaian-unit"]);
  assert.deepEqual(fitur.laundry_laporan_unit, ["/laundry/laporan-unit"]);
});

test("migrasi pelacakan unit: DDL idempoten, jenis lama tetap per_jumlah, siklus unik per batch", async () => {
  const migrasi = require("../../database/migrations/20261018160000-laundry_pelacakan_unit.cjs");
  const perintah = [];
  const queryInterface = { sequelize: { transaction: async (fn) => fn({}), query: async (sql) => perintah.push(sql) } };
  await migrasi.up(queryInterface);
  assert.ok(perintah.every((sql) => /IF NOT EXISTS/.test(sql)));
  assert.ok(perintah.some((sql) => sql.includes("cara_pencatatan varchar(20) NOT NULL DEFAULT 'per_jumlah'")));
  assert.ok(perintah.some((sql) => sql.includes("laundry_unit_kode_aktif") && sql.includes("faskes_uuid, upper(kode_unit)")));
  assert.ok(perintah.some((sql) => sql.includes("laundry_unit_siklus_batch") && sql.includes("peristiwa = 'selesai_cuci'")));
  assert.ok(!perintah.some((sql) => /^\s*(UPDATE|DELETE|DROP)/i.test(sql)));
});
