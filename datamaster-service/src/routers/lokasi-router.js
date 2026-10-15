import { Router } from "express";
import LokasiController from "../controllers/lokasi-controller.js";
import multer from "multer";

const lokasiRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Lokasi
lokasiRouter.post("/lokasi", LokasiController.createLokasi);
lokasiRouter.put("/lokasi/:uuid", LokasiController.updateLokasi);
lokasiRouter.get(
  "/lokasi/part_of/:part_of_uuid",
  LokasiController.getAllLokasiByPartOfUuid
);
lokasiRouter.get("/lokasi/code/:code", LokasiController.findByCode);
lokasiRouter.get("/lokasi", LokasiController.findAllIncludePartOf);
lokasiRouter.get("/lokasi/part_of", LokasiController.findAllPartOf);
lokasiRouter.get("/lokasi/export", LokasiController.exportLokasi);
lokasiRouter.post(
  "/lokasi/import",
  upload.single("file"),
  LokasiController.importLokasi
);
lokasiRouter.get("/lokasi/poli/aktif", LokasiController.getAllLokasiPoliAktif);
lokasiRouter.get("/lokasi/aktif", LokasiController.getAllLokasiAktif);
lokasiRouter.get("/lokasi/:uuid", LokasiController.getLokasiById);
lokasiRouter.delete("/lokasi/:uuid", LokasiController.deleteLokasi);

export default lokasiRouter;
