import { QueryTypes } from "sequelize"
import sequelizeInstance from "../config/sequelize-db.js"
import { isSuperadmin } from "@opensimrs/authorization-sdk/peran"
import { cocokIzin } from "./cocok-izin.js"
import { buatTembolok } from "./tembolok-izin.js"

// Izin dibaca dari UUID akun dan faskes token karena username tidak unik. Superadmin dapat berpindah faskes
// sambil mempertahankan UUID akun, sehingga akun otorisasinya dicari dengan UUID saja. Data laporan tetap
// dibatasi faskes aktif token. Struktur izin: [{ module, subModules: [{ name, allows: [..] }] }].
const PESAN_IDENTITAS_TIDAK_LENGKAP = "Konteks autentikasi tidak lengkap"

export class GalatIzin extends Error {
  constructor(message, code = 403) {
    super(message)
    this.code = code
  }
}

const identitasLengkap = (author) => Boolean(author?.user_uuid && author?.faskesUuid)

// Query dan tembolok dapat diganti untuk pengujian tanpa basis data.
export const buatPembacaIzin = (
  jalankanQuery = (sql, opsi) => sequelizeInstance.query(sql, opsi),
  tembolok = buatTembolok()
) => {
  const izinPengguna = async (author) => {
    if (!identitasLengkap(author)) throw new GalatIzin(PESAN_IDENTITAS_TIDAK_LENGKAP, 401)
    const admin = isSuperadmin(author)
    const kunci = JSON.stringify([author.user_uuid, author.faskesUuid, admin])
    const tersimpan = tembolok.ambil(kunci)
    if (tersimpan) return tersimpan

    const kondisi = ["uuid = :pengguna_uuid", "deleted_at IS NULL"]
    if (!admin) kondisi.push("faskes_uuid = :faskes_uuid")
    const [baris] = await jalankanQuery(`SELECT permissions FROM users WHERE ${kondisi.join(" AND ")} LIMIT 1`, {
      replacements: { pengguna_uuid: author.user_uuid, faskes_uuid: author.faskesUuid },
      type: QueryTypes.SELECT,
    })

    let izin = []
    if (baris) {
      izin = baris.permissions ?? []
      if (typeof izin === "string") {
        try {
          izin = JSON.parse(izin)
        } catch {
          izin = []
        }
      }
      izin = Array.isArray(izin) ? izin : []
    }
    // Akun tidak ditemukan/terhapus harus dibedakan dari akun sah dengan izin kosong untuk pengecualian superadmin.
    const hasil = { izin, ditemukan: Boolean(baris), superadmin: admin }
    tembolok.simpan(kunci, hasil)
    return hasil
  }

  // Tanpa submodul, cukup periksa keberadaan izin modul.
  const punyaIzin = async (req, modul, submodul, aksi) => {
    const { izin, ditemukan, superadmin } = await izinPengguna(req.author)
    if (!ditemukan) return false
    if (!izin.length && superadmin) return true
    return cocokIzin(izin, modul, submodul, aksi)
  }

  const pesanIzin = (modul, submodul, aksi) =>
    submodul
      ? `Akses ditolak: Anda tidak memiliki hak ${modul} › ${submodul} › ${[].concat(aksi).join("/")}`
      : `Akses ${modul} ditolak`

  // Tolak sebelum controller dijalankan bila konteks autentikasi tidak lengkap atau izin tidak tersedia.
  const wajibIzin = (modul, submodul, aksi) => (req, res, next) =>
    punyaIzin(req, modul, submodul, aksi)
      .then((boleh) => (boleh ? next() : res.status(403).json({ message: pesanIzin(modul, submodul, aksi), payload: null })))
      .catch((error) => {
        if (error instanceof GalatIzin) return res.status(error.code).json({ message: error.message, payload: null })
        return next(error)
      })

  return { izinPengguna, punyaIzin, pesanIzin, wajibIzin }
}

const pembacaBawaan = buatPembacaIzin()
export const punyaIzin = pembacaBawaan.punyaIzin
export const pesanIzin = pembacaBawaan.pesanIzin
export const wajibIzin = pembacaBawaan.wajibIzin
