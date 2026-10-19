import express from "express"
import sequelizeInstance from "../config/sequelize-db.js"
import { QueryTypes } from "sequelize"

const routes = express.Router()
const indikator = [
  {
    kode: "ketersediaan_bed",
    definisi: "Ketersediaan tempat tidur per ruangan dan kelas mengikuti status sumber resmi.",
    sumber: null,
  },
  {
    kode: "igd_menunggu_kamar",
    definisi: "Jumlah dan lama tunggu pasien IGD yang memenuhi status menunggu kamar pada sumber IGD/admisi.",
    sumber: null,
  },
  {
    kode: "antrean_poli",
    definisi: "Jumlah antrean dan waktu tunggu poli sesuai definisi sumber antrean.",
    sumber: null,
  },
  {
    kode: "antrean_admisi",
    definisi: "Jumlah antrean dan waktu tunggu admisi sesuai definisi sumber admisi.",
    sumber: null,
  },
]

const bacaIzin = async (req) => {
  const { username, faskesUuid } = req.author ?? {}
  if (!username || !faskesUuid) return false
  const [user] = await sequelizeInstance.query(
    "SELECT permissions FROM users WHERE username = :username AND faskes_uuid = :faskes_uuid AND deleted_at IS NULL LIMIT 1",
    { replacements: { username, faskes_uuid: faskesUuid }, type: QueryTypes.SELECT },
  )
  let permissions = user?.permissions ?? []
  if (typeof permissions === "string") {
    try { permissions = JSON.parse(permissions) } catch { permissions = [] }
  }
  return Array.isArray(permissions) && permissions.some((module) =>
    String(module?.module ?? "").toLowerCase() === "dashboard" &&
    (module.subModules ?? module.submodules ?? []).some((submodule) =>
      String(submodule?.name ?? "").toLowerCase() === "command center" &&
      (submodule.allows ?? []).some((allow) => String(allow?.name ?? allow).toUpperCase() === "READ"),
    ),
  )
}

routes.get("/command-center/ringkasan", async (req, res, next) => {
  try {
    if (!(await bacaIzin(req))) return res.status(403).json({ message: "Akses Command Center ditolak" })
    const now = Math.floor(Date.now() / 1000)
    return res.json({
      message: "Ringkasan Command Center berhasil dimuat",
      payload: {
        diperbarui_pada: now,
        indikator: indikator.map((item) => ({
          ...item,
          status_sumber: "belum_tersedia",
          diperbarui_pada: null,
          kesegaran: "belum_tersedia",
          nilai: null,
        })),
        peringatan: [],
      },
    })
  } catch (error) {
    next(error)
  }
})

export default routes
