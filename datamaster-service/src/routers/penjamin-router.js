import { Router } from "express";
import PenjaminController from "../controllers/penjamin-controller.js";
import multer from "multer";

const penjaminRouter = Router();
const upload = multer({ dest: "src/uploads/" });

// Penjamin
penjaminRouter.post("/penjamin", PenjaminController.createPenjamin);
penjaminRouter.put("/penjamin/:uuid", PenjaminController.updatePenjamin);
penjaminRouter.get("/penjamin", PenjaminController.getAllPenjamin);
penjaminRouter.get("/penjamin/export", PenjaminController.exportPenjamin);
penjaminRouter.post(
  "/penjamin/import",
  upload.single("file"),
  PenjaminController.importPenjamin
);
penjaminRouter.get("/penjamin/aktif", PenjaminController.getPenjaminAktif);
penjaminRouter.get("/penjamin/:uuid", PenjaminController.getPenjaminById);
penjaminRouter.delete("/penjamin/:uuid", PenjaminController.deletePenjamin);

export default penjaminRouter;
