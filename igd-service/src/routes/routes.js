import express from "express";
import authorizationMiddleware from "../middlewares/authorization-middleware.js";
import ReportController from "../controllers/report-controller.js";

const routes = express.Router();

routes.use(authorizationMiddleware);

// // // HEALTH CHECK
// // routes.get(`/health`, (req, res) => res.status(200).json({ message: "OK" }));

//* Report
routes.get('/igd/report/kunjungan', ReportController.getAllKunjungan);
routes.get('/igd/report/batal-kunjungan', ReportController.getCancelKunjungan);
// routes.get('/laporan-tindakan', ReportController.getTindakans);

export default routes;