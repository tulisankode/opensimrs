import express from "express";
import authorizationMiddleware from "../middlewares/authorization-middleware.js";
import PerpindahanController from "../controllers/perpindahan-controller.js";
import ReportController from "../controllers/report-controller.js";

const router = express.Router();

router.use(authorizationMiddleware);

//* Perpindahan Bed
router.get('/transfer-bed/current-bed/:uuid', PerpindahanController.GetCurrentBed);
router.post('/transfer-bed/request/:uuid', PerpindahanController.RequestMoveBed);
router.put('/transfer-bed/reject/:uuid', PerpindahanController.RejectMoveBed);
router.put('/transfer-bed/approve/:uuid', PerpindahanController.ApproveMoveBed);
router.get('/transfer-bed/all', PerpindahanController.GetAllRequest);
router.get('/transfer-bed/history/:uuid', PerpindahanController.GetHistoryMoveBed);
router.get('/transfer-bed/request/detail/:uuid', PerpindahanController.GetRequestMoveBed);
router.get('/transfer-bed/total-pending', PerpindahanController.GetTotalPending);


//* Reports
router.get('/report/kunjungan', ReportController.getAllKunjungan);
router.get('/report/batal-kunjungan', ReportController.getCancelKunjungan);
router.get("/report/perpindahan", ReportController.getPerpindahanPasien);

export default router;