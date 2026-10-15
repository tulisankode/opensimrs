import express from "express";
// import AntrianRawatJalanController from "../controllers/antrian_rj-controller.js";
import authorizationMiddleware from "../middlewares/authorization-middleware.js";
import ReportController from "../controllers/report-controller.js";
import AntrianRawatJalanController from "../controllers/antrian_rj-controller.js";

const routes = express.Router();

routes.use(authorizationMiddleware);

routes.get(`/`, (req, res) => res.status(200).json({ message: "Hello World" }));

//* Pemanggilan Antrian RJ
routes.put(`/antrian-call/kunjungan/:rawatJalanUuid/periksa`, AntrianRawatJalanController.mulaiPeriksa);
routes.put(`/antrian-call/:uuid`, AntrianRawatJalanController.updateStatus);
routes.get(`/antrian-call/konteks`, AntrianRawatJalanController.konteksPetugas);
routes.get(`/antrian-call`, AntrianRawatJalanController.getAntrian);

//* Reports
routes.get(`/laporan-tindakan`, ReportController.getTindakans);
routes.get(`/report/laporan-tindakan`, ReportController.getTindakans); // dipanggil frontend (stores/rawatJalan/laporan/rekapTindakan.ts)
routes.get(`/report/kunjungan`, ReportController.getAllKunjungan);
routes.get(`/report/batal-kunjungan`, ReportController.getCancelKunjungan);

export default routes;
