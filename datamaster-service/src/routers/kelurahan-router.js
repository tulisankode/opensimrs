import { Router } from "express";
import multer from "multer";
import KelurahanController from "../controllers/kelurahan-controller.js";

const kelurahanRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Kelurahan
kelurahanRouter.post("/kelurahan", KelurahanController.createKelurahan);
kelurahanRouter.put("/kelurahan/:id", KelurahanController.updateKelurahan);
kelurahanRouter.get("/kelurahan", KelurahanController.getAllKelurahan);
kelurahanRouter.post(
  "/kelurahan/import",
  upload.single("file"),
  KelurahanController.importKelurahan
);
kelurahanRouter.get("/kelurahan/:id", KelurahanController.getKelurahanById);
kelurahanRouter.delete("/kelurahan/:id", KelurahanController.deleteKelurahan);

export default kelurahanRouter;
