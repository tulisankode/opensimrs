import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { ProyeksiSimulasi } from "../src/virtual-office/proyeksi.js"
import { buatSnapshot } from "../src/virtual-office/snapshot.js"

const konfigurasi = JSON.parse(readFileSync(new URL("../src/virtual-office/konfigurasi.json", import.meta.url)))
// TEST-0001 hanya label skenario; pengenal fixture tetap UUIDv7 sintetis.
const faskesA = "0199aa00-0000-7000-8000-000000000001"
const faskesB = "0199aa00-0000-7000-8000-000000000002"
const sumber = "0199aa00-0000-7000-8000-000000000003"
const event = (revisi, tipe = "order", tambahan = {}) => ({
  event_uuid: `0199aa00-0000-7000-8000-${String(revisi).padStart(12, "0")}`,
  faskes_uuid: faskesA, source_service: "simulasi", source_kind: "pekerjaan", source_uuid: sumber,
  source_revision: revisi, kode_unit: "laboratorium", event_type: tipe, ...tambahan,
})

test("TEST-0001: order, penerimaan dan validasi laboratorium tetap satu pekerjaan", () => {
  const p = new ProyeksiSimulasi(konfigurasi)
  const awal = event(1)
  const salinan = structuredClone(awal)
  assert.equal(p.terapkan(awal), "antre")
  assert.equal(p.terapkan(awal), "duplikat")
  assert.equal(p.ringkasan(faskesA, "laboratorium").antre, 1)
  assert.equal(p.terapkan(event(2, "penerimaan")), "diproses")
  assert.equal(p.terapkan(event(3, "validasi")), "selesai")
  assert.equal(p.terapkan(event(2, "penerimaan", { event_uuid: "0199aa00-0000-7000-8000-000000000099" })), "terlambat")
  assert.equal(p.terapkan(event(3, "order", { event_uuid: "0199aa00-0000-7000-8000-000000000098" })), "konflik")
  assert.equal(p.ringkasan(faskesA, "laboratorium").selesai, 1)
  assert.equal(p.ringkasan(faskesA, "laboratorium").antre, 0)
  assert.equal(p.pekerjaan.size, 1)
  assert.deepEqual(awal, salinan)
})

test("resep dan dispensing sintetis tidak menggandakan pekerjaan Farmasi", () => {
  const p = new ProyeksiSimulasi(konfigurasi)
  const resep = event(1, "resep", { kode_unit: "farmasi" })
  p.terapkan(resep); p.terapkan(resep)
  assert.equal(p.ringkasan(faskesA, "farmasi").antre, 1)
  p.terapkan(event(2, "dispensing", { kode_unit: "farmasi" }))
  assert.equal(p.ringkasan(faskesA, "farmasi").selesai, 1)
  assert.equal(p.ringkasan(faskesB, "farmasi").selesai, 0)
})

test("unit asing, revisi tidak valid dan status asing tidak ditebak", () => {
  const p = new ProyeksiSimulasi(konfigurasi)
  assert.equal(p.terapkan(event(1, "asing", { kode_unit: "asing" })), "belum_dipetakan")
  assert.equal(p.terapkan(event(0)), "tidak_valid")
  assert.equal(p.terapkan(event(1, "__proto__")), "belum_dipetakan")
  assert.equal(p.ringkasan(faskesA, "laboratorium").belum_dipetakan, 1)
  assert.equal(p.ringkasan(faskesA, "laboratorium").sla, null)
})

const respons = () => ({ kode: 200, status(k) { this.kode = k; return this }, json(data) { this.data = data; return this } })
const layanan = (opsi = {}) => buatSnapshot({ konfigurasi,
  bacaModul: async (f) => { assert.equal(f, faskesA); return { fitur: true, modul: ["dashboard", "rawat_jalan", "laboratorium", "farmasi"] } },
  punyaIzin: async (_req, _m, _s, aksi) => aksi === "LABORATORIUM",
  uuidv7: (() => { let id = 100; return () => `0199aa00-0000-7000-8000-${String(++id).padStart(12, "0")}` })(), ...opsi,
})
test("snapshot hanya memakai faskes token serta menolak pemilihan faskes dari kueri", async () => {
  let dibaca = false
  const handler = layanan({ bacaModul: async () => { dibaca = true } })
  const tanpaToken = respons()
  await handler({ author: {}, query: {} }, tanpaToken)
  assert.equal(tanpaToken.kode, 401)
  const kueri = respons()
  await handler({ author: { faskesUuid: faskesA }, query: { faskes_uuid: faskesB } }, kueri)
  assert.equal(kueri.kode, 400)
  assert.equal(dibaca, false)
})
test("snapshot menyembunyikan unit dan jalur tanpa izin, tanpa pengenal pekerjaan", async () => {
  const res = respons()
  await layanan()({ author: { faskesUuid: faskesA }, query: {} }, res)
  const data = res.data.payload
  assert.equal(data.mode_data, "simulasi")
  assert.deepEqual(data.unit.map(u => u.kode_unit), ["laboratorium"])
  assert.deepEqual(data.jalur, [])
  assert.equal(data.unit[0].antre, 1)
  assert.equal(data.unit[0].aktif, 1)
  assert.equal(data.unit[0].tertunda, 1)
  assert.equal(data.unit[0].waktu_tunggu, null)
  for (const kolom of ["source_uuid", "faskes_uuid", "nama_pasien", "nik", "diagnosis", "hasil_pemeriksaan", "nomor_rekam_medis"]) assert.equal(JSON.stringify(data).includes(`"${kolom}"`), false)
})
test("fitur atau modul nonaktif tidak menyajikan data simulasi unit terkait", async () => {
  const res = respons()
  await layanan({ bacaModul: async () => ({ fitur: false, modul: ["dashboard"] }) })({ author: { faskesUuid: faskesA }, query: {} }, res)
  assert.equal(res.kode, 403)
  const kosong = respons()
  await layanan({ bacaModul: async () => ({ fitur: true, modul: ["dashboard"] }) })({ author: { faskesUuid: faskesA }, query: {} }, kosong)
  assert.deepEqual(kosong.data.payload.unit, [])
})
test("kegagalan konfigurasi diteruskan, bukan snapshot kosong yang tampak berhasil", async () => {
  await assert.rejects(() => layanan({ bacaModul: async () => { throw new Error("Konfigurasi gagal") } })({ author: { faskesUuid: faskesA }, query: {} }, respons()), /Konfigurasi gagal/)
})
