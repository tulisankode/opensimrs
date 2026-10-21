import express from "express"
import DashboardController from "../controllers/dashboard-controller.js"
import EksekutifController from "../controllers/eksekutif-controller.js"
import { wajibIzin } from "../helpers/izin.js"

// Dashboard Eksekutif (STD-0034): izin Dashboard › Eksekutif dengan aksi terpisah untuk lihat, rincian, ekspor, target.
const izinEksekutif = (aksi) => wajibIzin("Dashboard", "Eksekutif", aksi)
// Rekap Dashboard (STD-0049, tindak lanjut audit): izin dasar modul Dashboard, tanpa submodul tertentu.
const izinDashboard = wajibIzin("Dashboard", null, "READ")

const dashboardRoutes = express.Router()
dashboardRoutes.get("/dashboard/eksekutif", izinEksekutif("READ"), EksekutifController.getRingkasan)
dashboardRoutes.get("/dashboard/eksekutif/rincian/:kode", izinEksekutif("RINCIAN"), EksekutifController.getRincian)
dashboardRoutes.post("/dashboard/eksekutif/ekspor", izinEksekutif("EKSPOR PDF"), EksekutifController.postEkspor)
dashboardRoutes.get("/dashboard/eksekutif/target", izinEksekutif(["READ", "ATUR TARGET"]), EksekutifController.getTarget)
dashboardRoutes.put("/dashboard/eksekutif/target", izinEksekutif("ATUR TARGET"), EksekutifController.putTarget)
dashboardRoutes.get("/dashboard/rekap", izinDashboard, DashboardController.getRekapDashboard)
dashboardRoutes.get("/dashboard/rekap/rawat-jalan", izinDashboard, DashboardController.getTotalKunjunganRawatJalan)
dashboardRoutes.get("/dashboard/rekap/status-rawat", izinDashboard, DashboardController.getTotalKunjunganStatusRawat)
dashboardRoutes.get("/dashboard/rekap/pasien", izinDashboard, DashboardController.getTotalKunjunganPasien)
dashboardRoutes.get("/dashboard/rekap/gender", izinDashboard, DashboardController.getTotalKunjunganByGender)
dashboardRoutes.get("/dashboard/rekap/pendapatan", izinDashboard, DashboardController.getTotalPendapatan)
dashboardRoutes.get("/dashboard/rekap/poli", izinDashboard, DashboardController.getRekapitulasiTopPoli)
dashboardRoutes.get("/dashboard/rekap/dpjp", izinDashboard, DashboardController.getRekapitulasiTopDPJP)

export default dashboardRoutes
