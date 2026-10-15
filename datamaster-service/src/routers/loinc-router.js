import { Router } from "express";
import multer from "multer";
import LoincController from "../controllers/loinc-controller.js";

const loincRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// LOINC
loincRouter.post("/loinc", LoincController.createLoinc);
loincRouter.put("/loinc/:uuid", LoincController.updateLoinc);
loincRouter.get("/loinc", LoincController.getAllLoinc);
loincRouter.get("/loinc/export", LoincController.exportLoinc);
loincRouter.post(
  "/loinc/import",
  upload.single("file"),
  LoincController.importLoinc
);
loincRouter.get("/loinc/aktif", LoincController.getAllLoincAktif);
loincRouter.get("/loinc/:uuid", LoincController.getLoincById);
loincRouter.delete("/loinc/:uuid", LoincController.deleteLoinc);

export default loincRouter;
