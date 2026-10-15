import { Router } from "express";
import KategoriRuanganController from "../controllers/kategori_ruangan-controller.js";
import multer from "multer";

const kategoriRuanganRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Kategori Ruangan
kategoriRuanganRouter.post(
  "/kategori_ruangan",
  KategoriRuanganController.createKategoriRuangan
);
kategoriRuanganRouter.put(
  "/kategori_ruangan/:uuid",
  KategoriRuanganController.updateKategoriRuangan
);
kategoriRuanganRouter.get(
  "/kategori_ruangan",
  KategoriRuanganController.getAllKategoriRuangan
);
kategoriRuanganRouter.get(
  "/kategori_ruangan/export",
  KategoriRuanganController.exportKategoriRuangan
);
kategoriRuanganRouter.post(
  "/kategori_ruangan/import",
  upload.single("file"),
  KategoriRuanganController.importKategoriRuangan
);
kategoriRuanganRouter.get(
  "/kategori_ruangan/aktif",
  KategoriRuanganController.getAllKategoriRuanganAktif
);
kategoriRuanganRouter.get(
  "/kategori_ruangan/:uuid",
  KategoriRuanganController.getKategoriRuanganById
);
kategoriRuanganRouter.delete("/kategori_ruangan/:uuid", KategoriRuanganController.deleteKategoriRuangan);

export default kategoriRuanganRouter;
