import { Router } from "express";
import TarifController from "../controllers/tarif-controller.js";
import multer from "multer";

const tarifRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Tarif
tarifRouter.post("/tarif", TarifController.createTarif);
tarifRouter.put("/tarif/:uuid", TarifController.updateTarif);
tarifRouter.get("/tarif", TarifController.getAllTarif);
tarifRouter.get("/tarif/export", TarifController.exportTarif);
tarifRouter.post("/tarif/import", upload.single("file"), TarifController.importTarif);
tarifRouter.get("/tarif/aktif", TarifController.getAllTarifAktif);
tarifRouter.get("/tarif/:uuid", TarifController.getTarifById);
tarifRouter.delete("/tarif/:uuid", TarifController.deleteTarif);

export default tarifRouter;
