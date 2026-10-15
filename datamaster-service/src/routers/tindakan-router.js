import { Router } from "express";
import TindakanController from "../controllers/tindakan-controller.js";
import multer from "multer";

const tindakanRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Tindakan
tindakanRouter.post("/tindakan", TindakanController.createTindakan);
tindakanRouter.put("/tindakan/:uuid", TindakanController.updateTindakan);
tindakanRouter.get("/tindakan", TindakanController.getAllTindakan);
tindakanRouter.post(
  "/tindakan/import",
  upload.single("file"),
  TindakanController.importTindakan
);
tindakanRouter.get("/tindakan/export", TindakanController.exportTindakan);
tindakanRouter.get("/tindakan/aktif", TindakanController.getAllTindakanAktif);
tindakanRouter.get("/tindakan/:uuid", TindakanController.getTindakanById);
tindakanRouter.delete("/tindakan/:uuid", TindakanController.deleteTindakan);

export default tindakanRouter;
