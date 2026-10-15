import { Router } from "express";
import ICD9Controller from "../controllers/icd9-controller.js";
import multer from "multer";

const icd9Router = Router();
const upload = multer({ dest: "src/uploads/" });

// ICD9
icd9Router.post("/icd9", ICD9Controller.createICD9);
icd9Router.put("/icd9/:uuid", ICD9Controller.updateICD9);
icd9Router.get("/icd9/aktif", ICD9Controller.getAllICD9Aktif);
icd9Router.get("/icd9", ICD9Controller.getAllICD9);
icd9Router.get("/icd9/export", ICD9Controller.exportICD9);
icd9Router.post(
  "/icd9/import",
  upload.single("file"),
  ICD9Controller.importICD9
);
icd9Router.get("/icd9/:uuid", ICD9Controller.getICD9ById);
icd9Router.delete("/icd9/:uuid", ICD9Controller.deleteICD9);

export default icd9Router;
