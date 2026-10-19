import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { buatSnapshot, hariIni, hitungBeban } from "../src/virtual-office/snapshot.js"
import { tataLetak } from "../src/virtual-office/tata-letak.js"

const konfigurasi = JSON.parse(readFileSync(new URL("../src/virtual-office/konfigurasi.json", import.meta.url)))
// Pengenal fixture UUIDv7 sintetis; tidak ada data pasien.
const faskesA = "0199aa00-0000-7000-8000-000000000001"
const faskesB = "0199aa00-0000-7000-8000-000000000002"
const SEMUA_MODUL = ["dashboard", "pendaftaran", "rawat_jalan", "igd", "rawat_inap", "laboratorium", "radiologi", "farmasi", "pembayaran"]

const sumberContoh = () => ({
  pendaftaran: { menunggu: 2, dilayani: 1, selesai: 7, metrik: [], keterangan: "uji" },
  rawat_jalan: {
    menunggu: 6, dilayani: 2, selesai: 3, metrik: [],
    ruang: [
      { kode_ruang: "poli-a", nama: "Poli Umum", menunggu: 6, dilayani: 1, selesai: 2, metrik: [] },
      { kode_ruang: "poli-b", nama: "Poli Gigi", menunggu: 0, dilayani: 1, selesai: 1, metrik: [] },
    ],
    masuk: { pendaftaran: 11 },
  },
  igd: { menunggu: 1, dilayani: 2, selesai: 0, metrik: [] },
  rawat_inap: {
    menunggu: 1, dilayani: 9, selesai: 1, bor: 90, metrik: [],
    ruang: [{ kode_ruang: "r-1", nama: "Melati", menunggu: 1, dilayani: 9, selesai: 1, bor: 90, metrik: [] }],
    masuk: { igd: 2, rawat_jalan: 0 },
  },
  laboratorium: { menunggu: 16, dilayani: 1, selesai: 4, metrik: [], masuk: { rawat_jalan: 3, igd: 1 } },
  radiologi: { menunggu: 0, dilayani: 0, selesai: 0, metrik: [], masuk: { rawat_jalan: 0, igd: 0 } },
  farmasi: { menunggu: 4, dilayani: 2, selesai: 9, metrik: [], masuk: { rawat_jalan: 5, igd: 0 } },
  kasir: { menunggu: 1, dilayani: 3, selesai: 8, metrik: [] },
})

const respons = () => ({ kode: 200, status(k) { this.kode = k; return this }, json(data) { this.data = data; return this } })
const layanan = (opsi = {}) => {
  const panggilan = []
  const handler = buatSnapshot({
    konfigurasi,
    bacaModul: async (f) => { assert.equal(f, faskesA); return { fitur: true, modul: SEMUA_MODUL } },
    punyaIzin: async () => true,
    uuidv7: () => "0199aa00-0000-7000-8000-000000000099",
    bacaSumber: async (f, kode) => { panggilan.push({ f, kode }); const s = sumberContoh(); return Object.fromEntries(kode.map((k) => [k, s[k]])) },
    jam: () => Date.parse("2026-10-19T05:00:00Z"),
    ...opsi,
  })
  return { handler, panggilan }
}
const minta = async (handler, author = { faskesUuid: faskesA }, query = {}) => {
  const res = respons()
  await handler({ author, query }, res)
  return res
}

test("hari ini dihitung dalam tanggal lokal faskes (WIB)", () => {
  // 2026-10-19 20:00 UTC = 2026-10-20 03:00 WIB
  const w = hariIni(Date.parse("2026-10-19T20:00:00Z") / 1000, "+07:00")
  assert.equal(w.tanggal, "2026-10-20")
  assert.equal(w.awal, Date.parse("2026-10-20T00:00:00+07:00") / 1000)
  assert.equal(w.akhir - w.awal, 86399)
})

test("ambang beban hijau/kuning/merah", () => {
  const ambang = { kuning: 5, merah: 10 }
  assert.equal(hitungBeban(0, ambang), "hijau")
  assert.equal(hitungBeban(5, ambang), "kuning")
  assert.equal(hitungBeban(10, ambang), "merah")
  assert.equal(hitungBeban(null, ambang), null)
})

test("snapshot memakai faskes token dan menolak pemilihan faskes dari kueri", async () => {
  let dibaca = false
  const { handler } = layanan({ bacaModul: async () => { dibaca = true } })
  assert.equal((await minta(handler, {})).kode, 401)
  assert.equal((await minta(handler, { faskesUuid: faskesA }, { faskes_uuid: faskesB })).kode, 400)
  assert.equal(dibaca, false)
})

test("bawaan data nyata: angka per unit sesuai sumber, beban dari ambang, tanpa label simulasi", async () => {
  const { handler, panggilan } = layanan()
  const res = await minta(handler)
  const p = res.data.payload
  assert.equal(p.mode_data, "nyata")
  assert.equal(p.tanggal, "2026-10-19")
  assert.equal(panggilan[0].f, faskesA)
  const u = Object.fromEntries(p.unit.map((x) => [x.kode_unit, x]))
  assert.equal(u.laboratorium.menunggu, 16)
  assert.equal(u.laboratorium.beban, "merah")
  assert.equal(u.radiologi.beban, "hijau")
  assert.equal(u.rawat_jalan.ruang.length, 2)
  assert.equal(u.rawat_jalan.ruang[0].beban, "kuning")
  assert.equal(u.rawat_jalan.beban, "kuning")
  assert.equal(u.rawat_inap.beban, "kuning") // BOR 90% ≥ 80
  assert.ok(u.rawat_jalan.ruang.every((r) => r.posisi && r.posisi.w > 0))
  const lab = p.jalur.find((j) => j.asal === "rawat_jalan" && j.tujuan === "laboratorium")
  assert.equal(lab.jumlah, 3)
  assert.ok(!JSON.stringify(p).includes("simulasi"))
})

test("unit tanpa aksi izin tampil terkunci tanpa angka, ruang, dan jalur", async () => {
  const { handler, panggilan } = layanan({ punyaIzin: async (_r, _m, _s, aksi) => ["READ", "RAWAT JALAN", "FARMASI"].includes(aksi) })
  const p = (await minta(handler)).data.payload
  assert.deepEqual(panggilan[0].kode, ["rawat_jalan", "farmasi"])
  const lab = p.unit.find((x) => x.kode_unit === "laboratorium")
  assert.equal(lab.terkunci, true)
  assert.equal(lab.izin_dibutuhkan, "LABORATORIUM")
  for (const k of ["menunggu", "dilayani", "selesai", "ruang", "metrik"]) assert.equal(lab[k], undefined)
  assert.deepEqual(p.jalur.map((j) => `${j.asal}>${j.tujuan}`), ["rawat_jalan>farmasi"])
  for (const kolom of ["patient_uuid", "faskes_uuid", "nama_pasien", "no_rm", "nik", "diagnosis", "hasil"]) assert.equal(JSON.stringify(p).includes(`"${kolom}"`), false)
})

test("modul nonaktif tidak ditampilkan; fitur nonaktif ditolak", async () => {
  const { handler } = layanan({ bacaModul: async () => ({ fitur: true, modul: ["dashboard", "pendaftaran", "pembayaran"] }) })
  const p = (await minta(handler)).data.payload
  assert.deepEqual(p.unit.map((u) => u.kode_unit), ["pendaftaran", "kasir"])
  const mati = layanan({ bacaModul: async () => ({ fitur: false, modul: SEMUA_MODUL }) })
  assert.equal((await minta(mati.handler)).kode, 403)
})

test("sumber gagal ditandai galat, bukan nol; jalur unit galat disembunyikan", async () => {
  const { handler } = layanan({ bacaSumber: async (_f, kode) => Object.fromEntries(kode.map((k) => [k, k === "laboratorium" ? { galat: true } : sumberContoh()[k]])) })
  const p = (await minta(handler)).data.payload
  const lab = p.unit.find((x) => x.kode_unit === "laboratorium")
  assert.equal(lab.galat, true)
  assert.equal(lab.menunggu, undefined)
  assert.ok(!p.jalur.some((j) => j.tujuan === "laboratorium"))
})

test("mode simulasi hanya dengan flag eksplisit dan berlabel simulasi", async () => {
  const { handler } = layanan({ modeSimulasi: () => true })
  const p = (await minta(handler)).data.payload
  assert.equal(p.mode_data, "simulasi")
  assert.ok(p.unit.every((u) => Number.isInteger(u.menunggu)))
})

test("tembolok agregat per faskes berlaku singkat", async () => {
  let t = Date.parse("2026-10-19T05:00:00Z")
  const { handler, panggilan } = layanan({ jam: () => t })
  await minta(handler)
  await minta(handler)
  assert.equal(panggilan.length, 1)
  t += 16000
  await minta(handler)
  assert.equal(panggilan.length, 2)
})

test("kegagalan konfigurasi modul diteruskan, bukan snapshot kosong", async () => {
  const { handler } = layanan({ bacaModul: async () => { throw new Error("Konfigurasi gagal") } })
  await assert.rejects(() => minta(handler), /Konfigurasi gagal/)
})

test("tata letak: ruang tidak bertumpuk dan berada di dalam zona unitnya", () => {
  const unit = [
    { kode_unit: "pendaftaran" },
    { kode_unit: "rawat_jalan", ruang: Array.from({ length: 7 }, (_, i) => ({ kode_ruang: `p${i}` })) },
    { kode_unit: "laboratorium" },
  ]
  const { unit: hasil, denah } = tataLetak(unit, konfigurasi.denah)
  const kotak = hasil.flatMap((u) => (u.ruang ? u.ruang.map((r) => r.posisi) : [u.posisi]))
  for (let i = 0; i < kotak.length; i++)
    for (let j = i + 1; j < kotak.length; j++) {
      const a = kotak[i], b = kotak[j]
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y, "ruang bertumpuk")
    }
  const rj = hasil[1]
  assert.ok(rj.ruang.every((r) => r.posisi.x >= rj.posisi.x && r.posisi.x + r.posisi.w <= rj.posisi.x + rj.posisi.w && r.posisi.y + r.posisi.d <= rj.posisi.y + rj.posisi.d))
  assert.ok(hasil.every((u) => u.posisi.x + u.posisi.w <= denah.lebar && u.posisi.y + u.posisi.d <= denah.dalam))
})
