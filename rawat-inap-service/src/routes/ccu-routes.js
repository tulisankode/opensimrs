import CcuController from "../controllers/ccu-controller.js";
import { buatRuteIntensif } from "./intensif-routes.js";

// CCU (Coronary Care Unit). Rute dasar (dasbor, episode masuk/keluar + serah terima, flowsheet, balance cairan, laporan)
// sama dengan ICU dan tertaut ke ri_perpindahan; izin modul "CCU" di auth-service/src/helpers/permission-list.js.
const { router, izin } = buatRuteIntensif({ unit: "ccu", modul: "CCU", submodulLaporan: "Laporan CCU" });

// Dasbor & laporan kardiak
router.get("/dashboard/kardiak", izin("Dasbor", "READ"), CcuController.GetDashboardKardiak);
router.get("/laporan/kardiak", izin("Laporan CCU", "READ"), CcuController.GetLaporanKardiak);

// Data klinis kardiak episode (sindrom, onset, waktu tiba RS, Killip saat masuk)
router.get("/perawatan/:perawatan_uuid/klinis", izin("Data Klinis Kardiak", "READ"), CcuController.GetKlinis);
router.put("/perawatan/:perawatan_uuid/klinis", izin("Data Klinis Kardiak", "KELOLA"), CcuController.SimpanKlinis);

// EKG & irama
router.post("/perawatan/:perawatan_uuid/ekg", izin("EKG & Irama", "CREATE"), CcuController.TambahEkg);
router.get("/perawatan/:perawatan_uuid/ekg", izin("EKG & Irama", "READ"), CcuController.GetEkg);
router.post("/ekg/:uuid/batal", izin("EKG & Irama", "BATAL"), CcuController.BatalEkg);

// Penanda jantung (troponin, CK-MB, NT-proBNP, elektrolit)
router.post("/perawatan/:perawatan_uuid/penanda-jantung", izin("Penanda Jantung", "CREATE"), CcuController.TambahPenanda);
router.get("/perawatan/:perawatan_uuid/penanda-jantung", izin("Penanda Jantung", "READ"), CcuController.GetPenanda);
router.post("/penanda-jantung/:uuid/batal", izin("Penanda Jantung", "BATAL"), CcuController.BatalPenanda);

// Skor risiko (Killip, TIMI UA/NSTEMI, TIMI STEMI)
router.post("/perawatan/:perawatan_uuid/skor-risiko", izin("Skor Risiko", "CREATE"), CcuController.TambahSkor);
router.get("/perawatan/:perawatan_uuid/skor-risiko", izin("Skor Risiko", "READ"), CcuController.GetSkor);

// Intervensi & terapi kardiak
router.post("/perawatan/:perawatan_uuid/intervensi", izin("Intervensi Kardiak", "CREATE"), CcuController.TambahIntervensi);
router.get("/perawatan/:perawatan_uuid/intervensi", izin("Intervensi Kardiak", "READ"), CcuController.GetIntervensi);
router.post("/intervensi/:uuid/batal", izin("Intervensi Kardiak", "BATAL"), CcuController.BatalIntervensi);

export default router;
