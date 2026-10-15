import { Router } from "express";
import multer from "multer";
import FaskesController from "../controllers/faskes-controller.js";

const faskesRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Faskes
faskesRouter.post("/faskes", FaskesController.createFaskes);
faskesRouter.put("/faskes/:uuid", FaskesController.updateFaskes);
faskesRouter.get("/faskes", FaskesController.getAllFaskes);
faskesRouter.get("/faskes/export", FaskesController.exportFaskes);
faskesRouter.get("/faskes/aktif", FaskesController.getAllFaskesAktif);
faskesRouter.post("/faskes/import", upload.single("file"), FaskesController.importFaskes);
faskesRouter.get("/mobile/patient", FaskesController.getAllForPatient);
faskesRouter.get("/faskes/:uuid", FaskesController.getFaskesByUuid);
faskesRouter.delete("/faskes/:uuid", FaskesController.deleteFaskes);

export default faskesRouter;
