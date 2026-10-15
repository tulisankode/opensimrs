import express from "express"
import LaporanController from "../controllers/laporan-controller.js"

const laporanRoutes = express.Router()
laporanRoutes.get("/rekap/status-rawat", LaporanController.getRekapitulasiKunjungan)
laporanRoutes.get("/rekap/tindakan", LaporanController.getRekapitulasiTindakan)
laporanRoutes.get("/rekap/pemeriksaan-lab", LaporanController.getRekapitulasiLab)
laporanRoutes.get("/rekap/diagnosis", LaporanController.getRekapitulasiDiagnosis)
laporanRoutes.get("/rekap/status-rawat/export", LaporanController.exportRekapitulasiKunjungan)
laporanRoutes.get("/rekap/tindakan/export", LaporanController.exportRekapitulasiTindakan)
laporanRoutes.get("/rekap/pemeriksaan-lab/export", LaporanController.exportRekapitulasiLab)
laporanRoutes.get("/rekap/diagnosis/export", LaporanController.exportRekapitulasiDiagnosis)

export default laporanRoutes
