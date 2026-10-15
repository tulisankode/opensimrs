import express from "express";
import FaskesController from "../controllers/faskes-controller.js";
import LokasiController from "../controllers/lokasi-controller.js";
import PractitionerController from "../controllers/practitioner-controller.js";
import ProvinceController from "../controllers/province-controller.js";
import KabupatenController from "../controllers/kabupaten-controller.js";
import KecamatanController from "../controllers/kecamatan-controller.js";
import KelurahanController from "../controllers/kelurahan-controller.js";
import { apiKeyMiddleware } from "../middlewares/apiKey-middleware.js";

const mobileRouts = express.Router();
mobileRouts.get(
  "/mobile/faskes/:uuid",
  apiKeyMiddleware,
  FaskesController.getDetailForPatient
);
mobileRouts.get(
  "/mobile/faskes",
  apiKeyMiddleware,
  FaskesController.findAllFaskesIncludeAddressAndPoli
);
mobileRouts.get(
  "/mobile/lokasi/poli/aktif",
  apiKeyMiddleware,
  LokasiController.getAllLokasiPoliAktifMobile
);
mobileRouts.get(
  "/mobile/practitioner/poli/aktif",
  apiKeyMiddleware,
  PractitionerController.getAllPractitionerAktifByPoliMobile
);

mobileRouts.get(
  "/mobile/practitioner/:uuid",
  apiKeyMiddleware,
  PractitionerController.getPractitionerByIdMobile
);

mobileRouts.get(
  "/mobile/provinsi",
  apiKeyMiddleware,
  ProvinceController.getAllProvince
);
mobileRouts.get(
  "/mobile/kabupaten",
  apiKeyMiddleware,
  KabupatenController.getAllKabupaten
);
mobileRouts.get(
  "/mobile/kecamatan",
  apiKeyMiddleware,
  KecamatanController.getAllKecamatan
);
mobileRouts.get(
  "/mobile/kelurahan",
  apiKeyMiddleware,
  KelurahanController.getAllKelurahan
);

mobileRouts.get(
  "/mobile/practitioner/code-antrian/:code",
  apiKeyMiddleware,
  PractitionerController.findPractitionerByCodeAntrianByFaskes
);
export { mobileRouts };
