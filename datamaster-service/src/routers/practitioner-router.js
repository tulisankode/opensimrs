import { Router } from "express";
import PractitionerController from "../controllers/practitioner-controller.js";
import multer from "multer";

const practitionerRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Practitioner
practitionerRouter.post(
  "/practitioner",
  upload.single("file_sign"),
  PractitionerController.createPractitioner
);
practitionerRouter.put(
  "/practitioner/:uuid",
  PractitionerController.updatePractitioner
);
practitionerRouter.get(
  "/practitioner",
  PractitionerController.getAllPractitioner
);
practitionerRouter.get(
  "/practitioner/export",
  PractitionerController.exportPractitioner
);
practitionerRouter.get(
  "/practitioner/aktif",
  PractitionerController.getAllPractitionerAktif
);
practitionerRouter.get(
  "/practitioner/poli/aktif",
  PractitionerController.getAllPractitionerAktifByPoli
);
practitionerRouter.get(
  "/practitioner/:uuid",
  PractitionerController.getPractitionerById
);
practitionerRouter.delete(
  "/practitioner/:uuid",
  PractitionerController.deletePractitioner
);
export default practitionerRouter;
