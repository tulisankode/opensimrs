import express from "express"
import DashboardController from "../controllers/dashboard-controller.js"
import EksekutifController from "../controllers/eksekutif-controller.js"
import { wajibIzin } from "../helpers/izin.js"

// Dashboard Eksekutif (STD-0034): izin Dashboard › Eksekutif dengan aksi terpisah untuk lihat, rincian, ekspor, target.
const izinEksekutif = (aksi) => wajibIzin("Dashboard", "Eksekutif", aksi)

const dashboardRoutes = express.Router()
dashboardRoutes.get("/dashboard/eksekutif", izinEksekutif("READ"), EksekutifController.getRingkasan)
dashboardRoutes.get("/dashboard/eksekutif/rincian/:kode", izinEksekutif("RINCIAN"), EksekutifController.getRincian)
dashboardRoutes.post("/dashboard/eksekutif/ekspor", izinEksekutif("EKSPOR PDF"), EksekutifController.postEkspor)
dashboardRoutes.get("/dashboard/eksekutif/target", izinEksekutif(["READ", "ATUR TARGET"]), EksekutifController.getTarget)
dashboardRoutes.put("/dashboard/eksekutif/target", izinEksekutif("ATUR TARGET"), EksekutifController.putTarget)
dashboardRoutes.get("/dashboard/rekap", DashboardController.getRekapDashboard)
dashboardRoutes.get("/dashboard/rekap/rawat-jalan", DashboardController.getTotalKunjunganRawatJalan)
dashboardRoutes.get("/dashboard/rekap/status-rawat", DashboardController.getTotalKunjunganStatusRawat)
dashboardRoutes.get("/dashboard/rekap/pasien", DashboardController.getTotalKunjunganPasien)
dashboardRoutes.get("/dashboard/rekap/gender", DashboardController.getTotalKunjunganByGender)
dashboardRoutes.get("/dashboard/rekap/pendapatan", DashboardController.getTotalPendapatan)
dashboardRoutes.get("/dashboard/rekap/poli", DashboardController.getRekapitulasiTopPoli)
dashboardRoutes.get("/dashboard/rekap/dpjp", DashboardController.getRekapitulasiTopDPJP)

export default dashboardRoutes
