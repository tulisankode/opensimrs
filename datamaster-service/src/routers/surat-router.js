import { Router } from "express";
import SuratController from "../controllers/surat-controller.js";
import multer from "multer";

const suratRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Surat
suratRouter.post("/general-consent", SuratController.createSurat);
suratRouter.put("/general-consent/:uuid", SuratController.updateSurat);
suratRouter.get("/general-consent", SuratController.getAllSurat);
suratRouter.get("/general-consent/export", SuratController.exportSurat);
suratRouter.get("/general-consent/aktif", SuratController.getAllSuratAktif);
suratRouter.get("/general-consent/:uuid", SuratController.getSuratById);
suratRouter.delete("/general-consent/:uuid", SuratController.deleteSurat);

export default suratRouter;
