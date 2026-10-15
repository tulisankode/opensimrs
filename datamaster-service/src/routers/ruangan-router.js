import { Router } from "express";
import RuanganController from "../controllers/ruangan-controller.js";
import multer from "multer";

const ruanganRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Ruangan
ruanganRouter.post("/ruangan", RuanganController.createRuangan);
ruanganRouter.put("/ruangan/:uuid", RuanganController.updateRuangan);
ruanganRouter.get("/ruangan", RuanganController.getAllRuangan);
ruanganRouter.get("/ruangan/export", RuanganController.exportRuangan);
ruanganRouter.post(
  "/ruangan/import",
  upload.single("file"),
  RuanganController.importRuangan
);
ruanganRouter.get("/ruangan/aktif", RuanganController.getAllRuanganAktif);
ruanganRouter.get("/ruangan/:uuid", RuanganController.getRuanganById);
ruanganRouter.delete("/ruangan/:uuid", RuanganController.deleteRuangan);

export default ruanganRouter;
