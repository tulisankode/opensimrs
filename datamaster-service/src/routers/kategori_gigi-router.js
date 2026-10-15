import { Router } from "express";
import multer from "multer";
import KategoriGigiController from "../controllers/kategori_gigi-controller.js";

const kategoriGigiRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Gigi
kategoriGigiRouter.post(
  "/kategori_gigi",
  KategoriGigiController.createKategoriGigi
);
kategoriGigiRouter.put(
  "/kategori_gigi/:uuid",
  KategoriGigiController.updateKategoriGigi
);
kategoriGigiRouter.get(
  "/kategori_gigi",
  KategoriGigiController.getAllKategoriGigi
);
kategoriGigiRouter.get(
  "/kategori_gigi/export",
  KategoriGigiController.exportKategoriGigi
);
kategoriGigiRouter.post(
  "/kategori_gigi/import",
  upload.single("file"),
  KategoriGigiController.importKategoriGigi
);
kategoriGigiRouter.get(
  "/kategori_gigi/aktif",
  KategoriGigiController.getKategoriGigiAktif
);
kategoriGigiRouter.get(
  "/kategori_gigi/:uuid",
  KategoriGigiController.getKategoriGigiByUuid
);
kategoriGigiRouter.delete(
  "/kategori_gigi/:uuid",
  KategoriGigiController.deleteKategoriGigi
);

export default kategoriGigiRouter;
