import { Router } from "express";
import multer from "multer";
import KecamatanController from "../controllers/kecamatan-controller.js";

const kecamatanRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Kecamatan
kecamatanRouter.post("/kecamatan", KecamatanController.createKecamatan);
kecamatanRouter.put("/kecamatan/:id", KecamatanController.updateKecamatan);
kecamatanRouter.get("/kecamatan", KecamatanController.getAllKecamatan);
kecamatanRouter.post(
  "/kecamatan/import",
  upload.single("file"),
  KecamatanController.importKecamatan
);
kecamatanRouter.get("/kecamatan/:id", KecamatanController.getKecamatanById);
kecamatanRouter.delete("/kecamatan/:id", KecamatanController.deleteKecamatan);

export default kecamatanRouter;
