import { Router } from "express";
import multer from "multer";
import PegawaiController from "../controllers/pegawai-controller.js";

const pegawaiRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Pegawai
pegawaiRouter.post("/pegawai", PegawaiController.createPegawai);
pegawaiRouter.put("/pegawai/:uuid", PegawaiController.updatePegawai);
pegawaiRouter.get("/pegawai", PegawaiController.getAllPegawai);
pegawaiRouter.get("/pegawai/export", PegawaiController.exportPegawai);
pegawaiRouter.post(
  "/pegawai/import",
  upload.single("file"),
  PegawaiController.importPegawai
);
pegawaiRouter.get("/pegawai/aktif", PegawaiController.getPegawaiAktif);
pegawaiRouter.get("/pegawai/:uuid", PegawaiController.getPegawaiById);
pegawaiRouter.delete("/pegawai/:uuid", PegawaiController.deletePegawai);

export default pegawaiRouter;
