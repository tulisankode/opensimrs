import { test } from "node:test";
import assert from "node:assert/strict";
import { buatAkses } from "../src/hr/jadwal-dinas/akses.js";
import { buatRepositori } from "../src/hr/jadwal-dinas/repositori.js";
import { buatKeluaran } from "../src/hr/jadwal-dinas/keluaran.js";
import { buatMaster } from "../src/hr/jadwal-dinas/master.js";
import { buatJadwal } from "../src/hr/jadwal-dinas/jadwal.js";
import { buatPersetujuan } from "../src/hr/jadwal-dinas/persetujuan.js";
import { buatTukar } from "../src/hr/jadwal-dinas/tukar.js";

const req = (body = {}) => ({ author: { faskesUuid: "faskes-fiktif", username: "akun-fiktif", role: "perawat" }, body, query: {} });
test("faskes wajib berasal dari token; masukan faskes bertingkat ditolak", () => {
  const a = buatAkses({}, async () => true);
  for (const body of [{ faskes_uuid: "lain" }, { penempatan: [{ faskesUuid: "lain" }] }]) assert.throws(() => a.faskes(req(body)), { status: 400 });
  assert.throws(() => a.faskes({ author: {} }), { status: 401 });
  assert.throws(() => a.faskes({ ...req(), query: { faskes_uuid: "lain" } }), { status: 400 });
  assert.equal(a.faskes(req()), "faskes-fiktif");
});
test("izin per aksi tetap diperiksa termasuk super admin; kewenangan unit terpisah", async () => {
  const a = buatAkses({ ambil: async () => ({}), satu: async () => null, sekarang: () => 1000 }, async () => false);
  await assert.rejects(a.hak(req(), "Jadwal Dinas", "READ"), { status: 403 });
  await assert.rejects(a.hak({ ...req(), author: { ...req().author, role: "super admin" } }, "Jadwal Dinas", "READ"), { status: 403 });
  await assert.rejects(a.unit(null, req(), "unit-lain"), { status: 403 });
  await assert.rejects(a.unit(null, { ...req(), author: { ...req().author, role: "super admin" } }, "unit", "setujui"), { status: 403 });
  const luar = buatAkses({ ambil: async () => { const e = new Error("Tidak ditemukan"); e.status = 404; throw e; } }, async () => true);
  await assert.rejects(luar.unit(null, req(), "unit-faskes-lain"), { status: 404 });
});
test("resolusi pegawai sendiri memakai akun dan faskes token, menolak akun tanpa tautan", async () => {
  let params;
  const a = buatAkses({ satu: async (sql, p) => { params = p; return { uuid: "pegawai-sendiri" }; } }, async () => true);
  assert.equal(await a.sendiri(null, req({ kepegawaian_uuid: "pegawai-lain" })), "pegawai-sendiri");
  assert.deepEqual(params, ["faskes-fiktif", "akun-fiktif"]);
  const b = buatAkses({ satu: async () => null }, async () => true);
  await assert.rejects(b.sendiri(null, req()), { status: 403 });
});
test("kelayakan membatasi referensi, unit, status aktif dan batas riwayat setengah terbuka", async () => {
  const log = [];
  const a = buatAkses({ satu: async (sql, p) => { log.push([sql, p]); return null; } }, async () => true);
  await assert.rejects(a.layak(null, req(), "pegawai-lain", "unit", 1000, 2000), { status: 422 });
  const [sql, p] = log[0];
  for (const fragmen of ["h.faskes_uuid = $1", "p.deleted_at IS NULL", "p.status = true", "j.unit_uuid = $3", "j.tanggal_selesai > $4", "j.tanggal_selesai >= $5", "h.deleted_at IS NULL"]) assert.ok(sql.includes(fragmen), fragmen);
  assert.deepEqual(p, ["faskes-fiktif", "pegawai-lain", "unit", 1000, 2000]);
});
test("repositori tidak menemukan UUID lintas faskes dan menerjemahkan kegagalan penguncian menjadi konflik", async () => {
  let params;
  const r = buatRepositori({ satu: async (sql, p) => { params = p; return null; }, transaksi: async () => { throw Object.assign(new Error("Kunci"), { code: "55P03" }); } }, async () => {});
  await assert.rejects(r.ambil(null, "faskes-fiktif", "hr_jadwal_versi", "uuid-lain"), { status: 404 });
  assert.deepEqual(params, ["uuid-lain", "faskes-fiktif"]);
  await assert.rejects(r.transaksi("faskes-fiktif", () => {}), { status: 409 });
});
test("jadwal sendiri tidak menerima pilihan identitas atau unit lain dari klien", async () => {
  let params;
  const r = { query: async (sql, p) => { params = p; return []; } };
  const a = { hak: async () => {}, faskes: () => "faskes-fiktif", sendiri: async () => "pegawai-sendiri" };
  const keluaran = buatKeluaran(r, a);
  const mulai = 1793466000;
  await keluaran.baca({ ...req(), query: { mulai, selesai: mulai + 86400, unit_uuid: "unit-lain", kepegawaian_uuid: "pegawai-lain" } }, true);
  assert.equal(params[0], "faskes-fiktif"); assert.equal(params[1], null); assert.equal(params[4], "pegawai-sendiri");
});
test("seluruh operasi publik menolak tanpa izin sebelum membaca atau mengubah data", async () => {
  let aksesData = 0;
  const r = new Proxy({}, { get: () => () => { aksesData++; throw new Error("Data tidak boleh diakses"); } });
  const a = { faskes: () => "faskes-fiktif", hak: async () => { throw Object.assign(new Error("Tanpa izin"), { status: 403 }); } };
  const master = buatMaster(r, a), jadwal = buatJadwal(r, a, master), keputusan = buatPersetujuan(r, a, jadwal), tukar = buatTukar(r, a, jadwal), keluaran = buatKeluaran(r, a);
  const q = { ...req({ setuju: true }), params: { uuid: "fiktif", unitUuid: "unit" } };
  const operasi = [() => master.referensi(q), () => master.pegawai(q), ...["pola-shift", "aturan", "rotasi", "kewenangan"].map((x) => () => master.baca(q, x)),
    () => master.simpanPola(q), () => master.simpanPola(q, true), () => master.simpanAturan(q), () => master.simpanRotasi(q), () => master.kewenangan(q),
    () => jadwal.buat(q), () => jadwal.daftar(q), () => jadwal.detail(q), ...["penempatan", "salin", "rotasi"].map((x) => () => jadwal.simpan(q, x)), () => jadwal.validasi(q),
    ...["ajukan", "setujui", "tolak", "terbitkan", "revisi"].map((x) => () => keputusan(q, x)),
    () => tukar.calon(q), () => tukar.daftar(q), () => tukar.buat(q), ...["tanggapi", "putuskan", "batalkan"].map((x) => () => tukar.proses(q, x)),
    () => keluaran.baca(q), () => keluaran.baca(q, true), () => keluaran.keluaran({ ...q, body: { jenis: "ekspor" } }), () => keluaran.keluaran({ ...q, body: { jenis: "cetak" } })];
  for (const operasiPublik of operasi) await assert.rejects(operasiPublik(), { status: 403 });
  assert.equal(aksesData, 0);
});
