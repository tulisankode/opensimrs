import express from "express";
import ReportController from "../controllers/report-controller.js";

const reportRoutes = express.Router();

reportRoutes.get(
    "/barang-expired",
    ReportController.getExpiredItems  
);

reportRoutes.get(
    "/persediaan",
    ReportController.getPersediaan
);

export default reportRoutes;