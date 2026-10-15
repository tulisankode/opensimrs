import { Router } from "express";
import multer from "multer";
import NameTarifKomponenController from "../controllers/name_tarif_komponen-controller.js";

const nameTarifKomponenRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Tarif
nameTarifKomponenRouter.post(
  "/komponen-tarif",
  NameTarifKomponenController.createNameTarifKomponen
);
nameTarifKomponenRouter.put(
  "/komponen-tarif/:uuid",
  NameTarifKomponenController.updateNameTarifKomponen
);
nameTarifKomponenRouter.get(
  "/komponen-tarif",
  NameTarifKomponenController.getAllNameTarifKomponen
);
nameTarifKomponenRouter.get(
  "/komponen-tarif/export",
  NameTarifKomponenController.exportNameTarifKomponen
);
nameTarifKomponenRouter.post(
  "/komponen-tarif/import",
  upload.single("file"),
  NameTarifKomponenController.importNameTarifKomponen
);
nameTarifKomponenRouter.get(
  "/komponen-tarif/aktif",
  NameTarifKomponenController.getAllNameTarifKomponenAktif
);
nameTarifKomponenRouter.get(
  "/komponen-tarif/:uuid",
  NameTarifKomponenController.getNameTarifKomponenById
);
nameTarifKomponenRouter.delete(
  "/komponen-tarif/:uuid",
  NameTarifKomponenController.deleteNameTarifKomponen
);

export default nameTarifKomponenRouter;
