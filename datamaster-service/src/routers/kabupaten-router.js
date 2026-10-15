import { Router } from "express";
import multer from "multer";
import KabupatenController from "../controllers/kabupaten-controller.js";

const kabupatenRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Kabupaten
kabupatenRouter.post("/kabupaten", KabupatenController.createKabupaten);
kabupatenRouter.put("/kabupaten/:id", KabupatenController.updateKabupaten);
kabupatenRouter.get("/kabupaten", KabupatenController.getAllKabupaten);
kabupatenRouter.post(
  "/kabupaten/import",
  upload.single("file"),
  KabupatenController.importKabupaten
);
kabupatenRouter.get("/kabupaten/:id", KabupatenController.getKabupatenById);
kabupatenRouter.delete("/kabupaten/:id", KabupatenController.deleteKabupaten);

export default kabupatenRouter;
