import { Router } from "express";
import multer from "multer";
import GigiController from "../controllers/gigi-controller.js";

const gigiRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Gigi
gigiRouter.post("/gigi", GigiController.createGigi);
gigiRouter.put("/gigi/:uuid", GigiController.updateGigi);
gigiRouter.get("/gigi", GigiController.getAllGigi);
gigiRouter.get("/gigi/export", GigiController.exportGigi);
gigiRouter.post(
  "/gigi/import",
  upload.single("file"),
  GigiController.importGigi
);
gigiRouter.get("/gigi/aktif", GigiController.getGigiAktif);
gigiRouter.get("/gigi/:uuid", GigiController.getGigiByUuid);
gigiRouter.delete("/gigi/:uuid", GigiController.deleteGigi);

export default gigiRouter;
