import express from "express"
import { readFileSync } from "node:fs"
import { v7 as uuidv7 } from "uuid"
import { wajibIzin, punyaIzin } from "../helpers/izin.js"
import { bacaModul } from "./akses.js"
import { bacaSumber } from "./sumber.js"
import { buatSnapshot } from "./snapshot.js"

const konfigurasi = JSON.parse(readFileSync(new URL("./konfigurasi.json", import.meta.url), "utf8"))
// Data simulasi hanya untuk demo/QA dan harus dinyalakan eksplisit; bawaan = transaksi nyata.
const modeSimulasi = () => String(process.env.VIRTUAL_OFFICE_SIMULASI ?? "").toLowerCase() === "aktif"
const snapshot = buatSnapshot({ konfigurasi, bacaModul, punyaIzin, uuidv7, bacaSumber, modeSimulasi })

const routes = express.Router()
routes.get("/virtual-office/snapshot", wajibIzin("Dashboard", "Virtual Office", "READ"), async (req, res, next) => {
  try {
    return await snapshot(req, res)
  } catch (error) {
    next(error)
  }
})
export default routes
