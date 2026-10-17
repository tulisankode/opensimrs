import express from "express";
import IcuController from "../controllers/icu-controller.js";
import icuPermission from "../middlewares/icu-permission-middleware.js";

const router = express.Router();

// Dasbor
router.get("/dashboard", icuPermission("Dasbor", "READ"), IcuController.GetDashboard);

// Perawatan & serah terima (tertaut ke ri_perpindahan — tidak membuat status perpindahan paralel).
router.get("/perawatan/:perawatan_uuid", icuPermission("Perawatan", "READ"), IcuController.GetPerawatan);
router.post("/perpindahan/:perpindahan_uuid/mulai", icuPermission("Serah Terima", "KELOLA"), IcuController.MulaiPerawatan);
router.post("/perawatan/:perawatan_uuid/keluar", icuPermission("Serah Terima", "KELOLA"), IcuController.KeluarPerawatan);

// Flowsheet observasi
router.post("/perawatan/:perawatan_uuid/observasi", icuPermission("Flowsheet Observasi", "CREATE"), IcuController.TambahObservasi);
router.get("/perawatan/:perawatan_uuid/observasi", icuPermission("Flowsheet Observasi", "READ"), IcuController.GetObservasi);
router.post("/observasi/:observasi_uuid/koreksi", icuPermission("Flowsheet Observasi", "KOREKSI"), IcuController.KoreksiObservasi);

// Balance cairan
router.post("/perawatan/:perawatan_uuid/intake-output", icuPermission("Balance Cairan", "CREATE"), IcuController.TambahIntakeOutput);
router.get("/perawatan/:perawatan_uuid/balance", icuPermission("Balance Cairan", "READ"), IcuController.GetBalance);

// Skor SOFA
router.post("/perawatan/:perawatan_uuid/skor-sofa", icuPermission("Skor SOFA", "CREATE"), IcuController.TambahSkorSofa);
router.get("/perawatan/:perawatan_uuid/skor-sofa", icuPermission("Skor SOFA", "READ"), IcuController.GetSkorSofa);

// Laporan
router.get("/laporan", icuPermission("Laporan ICU", "READ"), IcuController.GetLaporan);

export default router;
