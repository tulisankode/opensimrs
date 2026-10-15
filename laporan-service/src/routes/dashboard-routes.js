import express from "express"
import DashboardController from "../controllers/dashboard-controller.js"

const dashboardRoutes = express.Router()
dashboardRoutes.get("/dashboard/rekap", DashboardController.getRekapDashboard)
dashboardRoutes.get("/dashboard/rekap/rawat-jalan", DashboardController.getTotalKunjunganRawatJalan)
dashboardRoutes.get("/dashboard/rekap/status-rawat", DashboardController.getTotalKunjunganStatusRawat)
dashboardRoutes.get("/dashboard/rekap/pasien", DashboardController.getTotalKunjunganPasien)
dashboardRoutes.get("/dashboard/rekap/gender", DashboardController.getTotalKunjunganByGender)
dashboardRoutes.get("/dashboard/rekap/pendapatan", DashboardController.getTotalPendapatan)
dashboardRoutes.get("/dashboard/rekap/poli", DashboardController.getRekapitulasiTopPoli)
dashboardRoutes.get("/dashboard/rekap/dpjp", DashboardController.getRekapitulasiTopDPJP)

export default dashboardRoutes
