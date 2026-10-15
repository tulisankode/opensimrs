import { Router } from "express";
import multer from "multer";
import OklusiGigiController from "../controllers/oklusi_gigi-controller.js";

const oklusiGigiRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Oklusi Gigi
oklusiGigiRouter.post("/oklusi_gigi", OklusiGigiController.createOklusiGigi);
oklusiGigiRouter.put(
  "/oklusi_gigi/:uuid",
  OklusiGigiController.updateOklusiGigi
);
oklusiGigiRouter.get("/oklusi_gigi", OklusiGigiController.getAllOklusiGigi);
oklusiGigiRouter.get(
  "/oklusi_gigi/export",
  OklusiGigiController.exportOklusiGigi
);  
oklusiGigiRouter.post(
  "/oklusi_gigi/import",
  upload.single("file"),
  OklusiGigiController.importOklusiGigi
);
oklusiGigiRouter.get(
  "/oklusi_gigi/aktif",
  OklusiGigiController.getOklusiGigiAktif
);
oklusiGigiRouter.get(
  "/oklusi_gigi/:uuid",
  OklusiGigiController.getOklusiGigiByUuid
);
oklusiGigiRouter.delete(
  "/oklusi_gigi/:uuid",
  OklusiGigiController.deleteOklusiGigi
);

export default oklusiGigiRouter;
