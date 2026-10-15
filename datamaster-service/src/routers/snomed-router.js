import { Router } from "express";
import multer from "multer";
import SnomedController from "../controllers/snomed-controller.js";

const snomedRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// SNOMED
snomedRouter.post("/snomed", SnomedController.createSnomed);
snomedRouter.put("/snomed/:uuid", SnomedController.updateSnomed);
snomedRouter.get("/snomed", SnomedController.getAllSnomed);
snomedRouter.post(
  "/snomed/import",
  upload.single("file"),
  SnomedController.importSnomed
);
snomedRouter.get("/snomed/export", SnomedController.exportSnomed);
snomedRouter.get("/snomed/aktif", SnomedController.getAllSnomedAktif);
snomedRouter.get("/snomed/:uuid", SnomedController.getSnomedById);
snomedRouter.delete("/snomed/:uuid", SnomedController.deleteSnomed);

export default snomedRouter;
