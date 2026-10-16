// Runtime ekstensi tanpa kode (dibuat lewat SIMRS Studio, berjalan juga di produksi):
// - laporan/cetak: kueri SELECT tervalidasi, dijalankan dalam transaksi READ ONLY + statement_timeout
// - formulir: isian tambahan per pasien/kunjungan (data tetap di database OpenSIMRS)
// - kelola (superadmin): validasi, pratinjau, impor paket bertanda tangan (Ed25519), pasang, copot
import crypto from "node:crypto"
import express from "express"
import { QueryTypes } from "sequelize"
import sequelizeInstance from "../config/sequelize-db.js"
import { isSuperadmin as superadmin } from "@opensimrs/authorization-sdk/peran"
import { bersihkanIsian, siapkanParameter, validasiEkstensi } from "./validasi.js"

const rute = express.Router()
const sekarang = () => Math.floor(Date.now() / 1000)
const pilih = (sql, replacements = {}, transaction) => sequelizeInstance.query(sql, { replacements, type: QueryTypes.SELECT, transaction })
const ubahData = (sql, replacements = {}) => sequelizeInstance.query(sql, { replacements })

class Galat extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const tangani = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    const status = Number(e.status) >= 400 && Number(e.status) < 600 ? Number(e.status) : 500
    if (status >= 500) console.error("[ekstensi]", e)
    res.status(status).json({ message: e.message })
  })
const kirim = (res, payload, message = "Data berhasil ditampilkan") => res.json({ message, payload })

const isSuperadmin = (req) => superadmin(req.author)
const wajibSuperadmin = (req) => {
  if (!isSuperadmin(req)) throw new Galat(403, "Hanya superadmin yang dapat mengelola ekstensi")
}

// Izin modul pengguna (users.permissions), disimpan sementara 60 detik.
const tembolok = new Map()
const punyaModul = async (req, modul) => {
  if (isSuperadmin(req)) return true
  const username = req.author?.username
  let ada = tembolok.get(username)
  if (!ada || Date.now() - ada.pada > 60000) {
    const [baris] = await pilih(`SELECT permissions FROM users WHERE username = :u AND deleted_at IS NULL LIMIT 1`, { u: username })
    let izin = baris?.permissions ?? []
    if (typeof izin === "string") {
      try {
        izin = JSON.parse(izin)
      } catch {
        izin = []
      }
    }
    ada = { pada: Date.now(), izin: Array.isArray(izin) ? izin : [] }
    tembolok.set(username, ada)
  }
  return ada.izin.some((m) => String(m?.module ?? "").toLowerCase() === String(modul).toLowerCase())
}

const untukFaskes = (e, faskesUuid) => !e.faskes || (Array.isArray(e.faskes) && e.faskes.includes(faskesUuid))
const modulIzin = (e) => e.definisi?.izin_modul || "Laporan"

const ambilTerpasang = async (kode, req) => {
  const [e] = await pilih(`SELECT * FROM ekstensi WHERE kode = :kode AND status = 'terpasang' AND deleted_at IS NULL`, { kode })
  if (!e || !untukFaskes(e, req.author?.faskesUuid)) throw new Galat(404, "Ekstensi tidak ditemukan atau belum dipasang")
  if (!(await punyaModul(req, modulIzin(e)))) throw new Galat(403, `Akses ditolak: perlu hak modul ${modulIzin(e)}`)
  return e
}

// Kueri ekstensi: READ ONLY, batas waktu 15 detik, dibungkus LIMIT/OFFSET.
const jalankanKueri = async (definisi, parameter, faskesUuid, { limit = 50, offset = 0, hitung = true } = {}) => {
  const { galat, nilai } = siapkanParameter(definisi, parameter, faskesUuid)
  if (galat.length) throw new Galat(400, galat.join("; "))
  return sequelizeInstance.transaction(async (t) => {
    await sequelizeInstance.query("SET TRANSACTION READ ONLY", { transaction: t })
    await sequelizeInstance.query("SET LOCAL statement_timeout = 15000", { transaction: t })
    const data = await pilih(`SELECT * FROM (${definisi.sql}) AS hasil LIMIT :__batas OFFSET :__geser`, { ...nilai, __batas: limit, __geser: offset }, t)
    const total = hitung ? Number((await pilih(`SELECT COUNT(*) AS n FROM (${definisi.sql}) AS hasil`, nilai, t))[0]?.n ?? 0) : data.length
    return { data, total }
  })
}

// Bentuk kanonik untuk tanda tangan paket (urutan kunci stabil) — sama persis dengan studio-service/src/ekstensi.js.
export const kanonik = (v) =>
  Array.isArray(v) ? `[${v.map(kanonik).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${kanonik(v[k])}`).join(",")}}` : JSON.stringify(v ?? null)

const kunciPublik = () => {
  const k = process.env.EKSTENSI_KUNCI_PUBLIK
  if (!k) return null
  return k.includes("BEGIN") ? crypto.createPublicKey(k.replace(/\\n/g, "\n")) : crypto.createPublicKey({ key: Buffer.from(k, "base64"), format: "der", type: "spki" })
}

// ---------- Pemakai (semua pengguna dengan hak modul terkait) ----------

rute.get("/ekstensi", tangani(async (req, res) => {
  const semua = await pilih(`SELECT uuid, kode, jenis, nama, deskripsi, versi, definisi, faskes FROM ekstensi WHERE status = 'terpasang' AND deleted_at IS NULL ORDER BY jenis, nama`)
  const hasil = []
  for (const e of semua) {
    if (!untukFaskes(e, req.author?.faskesUuid) || !(await punyaModul(req, modulIzin(e)))) continue
    const { sql, ...definisi } = e.definisi ?? {}
    hasil.push({ ...e, definisi: isSuperadmin(req) ? e.definisi : definisi, faskes: undefined })
  }
  kirim(res, hasil)
}))

// ---------- Kelola (superadmin) ----------

rute.get("/ekstensi/kelola", tangani(async (req, res) => {
  wajibSuperadmin(req)
  kirim(res, await pilih(`SELECT * FROM ekstensi WHERE deleted_at IS NULL ORDER BY updated_at DESC`))
}))

rute.post("/ekstensi/validasi", tangani(async (req, res) => {
  wajibSuperadmin(req)
  kirim(res, { galat: validasiEkstensi(req.body?.ekstensi) })
}))

rute.post("/ekstensi/pratinjau", tangani(async (req, res) => {
  wajibSuperadmin(req)
  const e = req.body?.ekstensi
  const galat = validasiEkstensi(e)
  if (galat.length) throw new Galat(400, galat.join("; "))
  if (e.jenis === "formulir") return kirim(res, { data: [], total: 0 })
  kirim(res, await jalankanKueri(e.definisi, req.body?.parameter ?? {}, req.author?.faskesUuid, { limit: 50 }))
}))

rute.post("/ekstensi/impor", tangani(async (req, res) => {
  wajibSuperadmin(req)
  const paket = req.body?.paket
  if (paket?.format !== "opensimrs-ekstensi" || !paket.ekstensi || !paket.tanda_tangan) throw new Galat(400, "Berkas bukan paket ekstensi OpenSIMRS")
  const publik = kunciPublik()
  if (!publik) throw new Galat(400, "EKSTENSI_KUNCI_PUBLIK belum diatur di laporan-service/.env — salin kunci publik dari SIMRS Studio (instalasi staging)")
  const sah = crypto.verify(null, Buffer.from(kanonik(paket.ekstensi)), publik, Buffer.from(paket.tanda_tangan, "base64"))
  if (!sah) throw new Galat(400, "Tanda tangan paket tidak sah (paket diubah atau dari penanda tangan lain)")
  const e = paket.ekstensi
  const galat = validasiEkstensi(e)
  if (galat.length) throw new Galat(400, galat.join("; "))
  const [lama] = await pilih(`SELECT uuid FROM ekstensi WHERE kode = :kode AND deleted_at IS NULL`, { kode: e.kode })
  const data = { kode: e.kode, jenis: e.jenis, nama: e.nama, deskripsi: e.deskripsi ?? null, versi: e.versi ?? "1.0.0", definisi: JSON.stringify(e.definisi), tanda_tangan: paket.tanda_tangan, oleh: req.author?.username, t: sekarang() }
  if (lama) {
    await ubahData(`UPDATE ekstensi SET jenis = :jenis, nama = :nama, deskripsi = :deskripsi, versi = :versi, definisi = :definisi, tanda_tangan = :tanda_tangan, sumber = 'impor', status = 'draf', updated_at = :t WHERE uuid = :uuid`, { ...data, uuid: lama.uuid })
  } else {
    await ubahData(`INSERT INTO ekstensi (uuid, kode, jenis, nama, deskripsi, versi, definisi, status, sumber, tanda_tangan, dibuat_oleh, created_at, updated_at)
                    VALUES (:uuid, :kode, :jenis, :nama, :deskripsi, :versi, :definisi, 'draf', 'impor', :tanda_tangan, :oleh, :t, :t)`, { ...data, uuid: crypto.randomUUID() })
  }
  kirim(res, { kode: e.kode, versi: e.versi }, `Paket ${e.nama} ${e.versi} diimpor (status draf — pasang untuk mengaktifkan)`)
}))

rute.put("/ekstensi/:uuid/pasang", tangani(async (req, res) => {
  wajibSuperadmin(req)
  const [e] = await pilih(`SELECT * FROM ekstensi WHERE uuid = :uuid AND deleted_at IS NULL`, { uuid: req.params.uuid })
  if (!e) throw new Galat(404, "Ekstensi tidak ditemukan")
  const galat = validasiEkstensi(e)
  if (galat.length) throw new Galat(400, galat.join("; "))
  const faskes = Array.isArray(req.body?.faskes) && req.body.faskes.length ? JSON.stringify(req.body.faskes) : null
  await ubahData(`UPDATE ekstensi SET status = 'terpasang', faskes = :faskes, dipasang_oleh = :oleh, dipasang_pada = :t, updated_at = :t WHERE uuid = :uuid`, { faskes, oleh: req.author?.username, t: sekarang(), uuid: e.uuid })
  kirim(res, { kode: e.kode }, `${e.nama} dipasang`)
}))

rute.put("/ekstensi/:uuid/copot", tangani(async (req, res) => {
  wajibSuperadmin(req)
  await ubahData(`UPDATE ekstensi SET status = 'dicopot', updated_at = :t WHERE uuid = :uuid AND deleted_at IS NULL`, { t: sekarang(), uuid: req.params.uuid })
  kirim(res, null, "Ekstensi dicopot (data isian formulir tetap tersimpan)")
}))

// ---------- Laporan & cetak ----------

rute.post("/ekstensi/:kode/jalankan", tangani(async (req, res) => {
  const e = await ambilTerpasang(req.params.kode, req)
  if (e.jenis === "formulir") throw new Galat(400, "Formulir tidak dijalankan sebagai laporan")
  const limit = Math.min(Math.max(Number(req.body?.limit) || 20, 1), 10000)
  const page = Math.max(Number(req.body?.page) || 1, 1)
  kirim(res, await jalankanKueri(e.definisi, req.body?.parameter ?? {}, req.author?.faskesUuid, { limit, offset: (page - 1) * limit, hitung: e.jenis === "laporan" }))
}))

// ---------- Formulir ----------

const ambilFormulir = async (req) => {
  const e = await ambilTerpasang(req.params.kode, req)
  if (e.jenis !== "formulir") throw new Galat(400, "Ekstensi ini bukan formulir")
  return e
}

rute.get("/ekstensi/:kode/isian", tangani(async (req, res) => {
  const e = await ambilFormulir(req)
  const rows = await pilih(
    `SELECT uuid, patient_uuid, no_reg, isian, dibuat_oleh, diubah_oleh, created_at, updated_at FROM ekstensi_formulir_isian
      WHERE ekstensi_uuid = :e AND faskes_uuid = :f AND deleted_at IS NULL
        AND (:p::text IS NULL OR patient_uuid = :p) AND (:r::text IS NULL OR no_reg = :r)
      ORDER BY created_at DESC LIMIT 200`,
    { e: e.uuid, f: req.author?.faskesUuid, p: req.query.patient_uuid || null, r: req.query.no_reg || null },
  )
  kirim(res, rows)
}))

rute.post("/ekstensi/:kode/isian", tangani(async (req, res) => {
  const e = await ambilFormulir(req)
  const { galat, isian } = bersihkanIsian(e.definisi, req.body?.isian)
  if (galat.length) throw new Galat(400, galat.join("; "))
  const kaitan = e.definisi.kaitan === "kunjungan" ? "no_reg" : "patient_uuid"
  if (!req.body?.[kaitan]) throw new Galat(400, `${kaitan} wajib diisi`)
  const uuid = crypto.randomUUID()
  await ubahData(
    `INSERT INTO ekstensi_formulir_isian (uuid, ekstensi_uuid, faskes_uuid, patient_uuid, no_reg, isian, dibuat_oleh, created_at, updated_at)
     VALUES (:uuid, :e, :f, :p, :r, :isian, :oleh, :t, :t)`,
    { uuid, e: e.uuid, f: req.author?.faskesUuid, p: req.body?.patient_uuid ?? null, r: req.body?.no_reg ?? null, isian: JSON.stringify(isian), oleh: req.author?.username, t: sekarang() },
  )
  kirim(res, { uuid }, "Isian formulir disimpan")
}))

rute.put("/ekstensi/:kode/isian/:uuid", tangani(async (req, res) => {
  const e = await ambilFormulir(req)
  const { galat, isian } = bersihkanIsian(e.definisi, req.body?.isian)
  if (galat.length) throw new Galat(400, galat.join("; "))
  const [baris] = await ubahData(
    `UPDATE ekstensi_formulir_isian SET isian = :isian, diubah_oleh = :oleh, updated_at = :t
      WHERE uuid = :uuid AND ekstensi_uuid = :e AND faskes_uuid = :f AND deleted_at IS NULL RETURNING uuid`,
    { isian: JSON.stringify(isian), oleh: req.author?.username, t: sekarang(), uuid: req.params.uuid, e: e.uuid, f: req.author?.faskesUuid },
  )
  if (!baris?.length) throw new Galat(404, "Isian tidak ditemukan")
  kirim(res, null, "Isian formulir diperbarui")
}))

rute.delete("/ekstensi/:kode/isian/:uuid", tangani(async (req, res) => {
  const e = await ambilFormulir(req)
  await ubahData(`UPDATE ekstensi_formulir_isian SET deleted_at = :t, diubah_oleh = :oleh WHERE uuid = :uuid AND ekstensi_uuid = :e AND faskes_uuid = :f AND deleted_at IS NULL`, {
    t: sekarang(), oleh: req.author?.username, uuid: req.params.uuid, e: e.uuid, f: req.author?.faskesUuid,
  })
  kirim(res, null, "Isian formulir dihapus")
}))

export default rute
