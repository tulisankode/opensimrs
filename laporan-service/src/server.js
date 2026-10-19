import express from "express"
import dotenv from "dotenv"
import laporanRoutes from "./routes/laporan-routes.js"
import dashboardRoutes from "./routes/dashboard-routes.js"
import errorMiddleware from "./middlewares/error-middleware.js"
import authorizationSdk from "@opensimrs/authorization-sdk"
import corsMiddleware from "./middlewares/cors-middleware.js"
import ekstensiRoutes from "./ekstensi/ekstensi-routes.js"
import commandCenterRoutes from "./routes/command-center-routes.js"

dotenv.config()
const baseUrl = `/${process.env.API_BASE ?? "api"}/${process.env.API_VERSION ?? "v3"}/${process.env.APPLICATION_MODULE ?? "laporan"}`
const application = express()
application.use(corsMiddleware)
application.use(express.json({ limit: "2mb" }))
application.use(authorizationSdk([]))
application.use(baseUrl, laporanRoutes)
application.use(baseUrl, dashboardRoutes)
application.use(baseUrl, commandCenterRoutes)
// Ekstensi tanpa kode dari SIMRS Studio (laporan, template cetak, formulir)
application.use(baseUrl, ekstensiRoutes)
application.use(errorMiddleware)

const SERVER_HOST = process.env.SERVER_HOST ?? process.env.APPLICATION_HOST ?? process.env.APP_HOST ?? "0.0.0.0"
const SERVER_PORT = process.env.SERVER_PORT ?? process.env.APPLICATION_PORT ?? process.env.APP_PORT ?? process.env.PORT ?? 8088

application.listen(SERVER_PORT, SERVER_HOST, () => {
  console.log(`The server running on http://${SERVER_HOST}:${SERVER_PORT}`)
})
