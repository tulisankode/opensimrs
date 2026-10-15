import { Router } from "express";
import DiagnosisController from "../controllers/diagnosis-controller.js";
import multer from "multer";

const diagnosisRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Diagnosis
diagnosisRouter.post("/diagnosis", DiagnosisController.createDiagnosis);
diagnosisRouter.put("/diagnosis/:uuid", DiagnosisController.updateDiagnosis);
diagnosisRouter.get("/diagnosis", DiagnosisController.getAllDiagnosis);
diagnosisRouter.get("/diagnosis/export", DiagnosisController.exportDiagnosis);
diagnosisRouter.post(
  "/diagnosis/import",
  upload.single("file"),
  DiagnosisController.importDiagnosis
);
diagnosisRouter.get(
  "/diagnosis/aktif",
  DiagnosisController.getAllDiagnosisAktif
);
diagnosisRouter.get("/diagnosis/:uuid", DiagnosisController.getDiagnosisById);
diagnosisRouter.delete("/diagnosis/:uuid", DiagnosisController.deleteDiagnosis);

export default diagnosisRouter;
