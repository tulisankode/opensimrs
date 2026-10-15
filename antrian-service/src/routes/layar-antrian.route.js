import express from "express";
import { LayarAntrianController } from "../controllers/layar-antrian.controller.js";
import { KioskLayarController } from "../controllers/kiosk-layar.controller.js";

export const layarAntrianRouter = express.Router();

layarAntrianRouter.get("/", LayarAntrianController.findAll);

layarAntrianRouter.get("/:layar_antrian_uuid", LayarAntrianController.findOne);

// Link mode kiosk (layar TV tanpa login)
layarAntrianRouter.get("/:layar_antrian_uuid/kiosk", KioskLayarController.ambilKunci);
layarAntrianRouter.post("/:layar_antrian_uuid/kiosk", KioskLayarController.buatUlangKunci);

layarAntrianRouter.post("/", LayarAntrianController.create);

layarAntrianRouter.put("/:layar_antrian_uuid", LayarAntrianController.update);

layarAntrianRouter.delete(
  "/:layar_antrian_uuid",
  LayarAntrianController.delete
);
