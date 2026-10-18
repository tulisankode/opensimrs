import { QueryTypes } from "sequelize"
import sequelizeInstance from "../config/sequelize-db.js"
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran"
import { cocokIzin } from "./cocok-izin.js"

// Hak akses per aksi (Setting › Hak Akses), pola sama dengan penunjang-service/src/umum/izin.js. Daftar izin
// pengguna dibaca dari users.permissions (database bersama, sumber yang sama dengan login auth-service) dan disimpan
// sementara 60 detik per pengguna. Super admin tanpa daftar izin selalu boleh (aturan sama dengan layanan lain).
// Struktur izin: [{ module, subModules: [{ name, allows: [..] }] }]
const SIMPAN_MS = 60 * 1000
const tembolok = new Map()

export class GalatIzin extends Error {
  constructor(message, code = 403) {
    super(message)
    this.code = code
  }
}

const izinPengguna = async (username) => {
  if (!username) return []
  const ada = tembolok.get(username)
  if (ada && Date.now() - ada.pada < SIMPAN_MS) return ada.izin
  const [baris] = await sequelizeInstance.query(
    `SELECT permissions FROM users WHERE username = :u AND deleted_at IS NULL LIMIT 1`,
    { replacements: { u: username }, type: QueryTypes.SELECT }
  )
  let izin = baris?.permissions ?? []
  if (typeof izin === "string") {
    try {
      izin = JSON.parse(izin)
    } catch {
      izin = []
    }
  }
  izin = Array.isArray(izin) ? izin : []
  tembolok.set(username, { pada: Date.now(), izin })
  return izin
}

// true bila pengguna login memiliki salah satu aksi pada modul/submodul.
export const punyaIzin = async (req, modul, submodul, aksi) => {
  const izin = await izinPengguna(req.author?.username)
  if (!izin.length && isSuperadmin(req.author)) return true
  return cocokIzin(izin, modul, submodul, aksi)
}

export const pesanIzin = (modul, submodul, aksi) =>
  `Akses ditolak: Anda tidak memiliki hak ${modul} › ${submodul} › ${[].concat(aksi).join("/")}`

// Middleware Express: 403 bila tidak berhak (tidak ada data yang diambil sebelum pemeriksaan ini).
export const wajibIzin = (modul, submodul, aksi) => (req, res, next) =>
  punyaIzin(req, modul, submodul, aksi)
    .then((boleh) => (boleh ? next() : res.status(403).json({ message: pesanIzin(modul, submodul, aksi) })))
    .catch(next)
