import express from "express"
import CommandCenterService from "../services/command-center-service.js"
import { pesanIzin, punyaIzin, wajibIzin } from "../helpers/izin.js"

// Command Center (STD-0037): izin Dashboard › Command Center dengan aksi terpisah: READ (lihat dasbor & peringatan),
// ATUR AMBANG, TINJAU PERINGATAN, ESKALASI PERINGATAN. Izin diperiksa sebelum data apa pun diambil; fitur katalog
// `command_center` harus aktif untuk faskes token. Faskes selalu dari JWT.
const izin = (aksi) => wajibIzin("Dashboard", "Command Center", aksi)

const fiturAktif = (req, res, next) => CommandCenterService.pastikanFitur(req.author).then(() => next()).catch(next)

const kirim = (pesan, kerja) => async (req, res, next) => {
  try {
    return res.status(200).json({ message: pesan, payload: await kerja(req) })
  } catch (error) {
    next(error)
  }
}

// Tinjau dan eskalasi memakai aksi izin berbeda; aksi ditentukan dari isi permintaan.
const izinTindakan = async (req, res, next) => {
  try {
    const aksi = req.body?.jenis === "eskalasi" ? "ESKALASI PERINGATAN" : "TINJAU PERINGATAN"
    if (!(await punyaIzin(req, "Dashboard", "Command Center", aksi))) {
      return res.status(403).json({ message: pesanIzin("Dashboard", "Command Center", aksi) })
    }
    next()
  } catch (error) {
    next(error)
  }
}

const routes = express.Router()
routes.get("/command-center/ringkasan", izin("READ"), fiturAktif,
  kirim("Ringkasan Command Center berhasil dimuat", (req) => CommandCenterService.ringkasan(req)))
routes.get("/command-center/peringatan", izin("READ"), fiturAktif,
  kirim("Peringatan Command Center berhasil dimuat", (req) => CommandCenterService.peringatan(req.author, req.query)))
routes.post("/command-center/peringatan/:uuid/tindakan", izinTindakan, fiturAktif,
  kirim("Tindakan peringatan berhasil dicatat", (req) => CommandCenterService.catatTindakan(req.author, req.params.uuid, req.body ?? {})))
routes.get("/command-center/ambang", izin(["READ", "ATUR AMBANG"]), fiturAktif,
  kirim("Ambang Command Center berhasil dimuat", (req) => CommandCenterService.daftarAmbang(req.author)))
routes.put("/command-center/ambang", izin("ATUR AMBANG"), fiturAktif,
  kirim("Ambang Command Center berhasil disimpan", (req) => CommandCenterService.simpanAmbang(req.author, req.body ?? {})))

export default routes
