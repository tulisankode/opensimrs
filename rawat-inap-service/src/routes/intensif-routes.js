import express from "express";
import IcuController from "../controllers/icu-controller.js";
import { izinIntensif } from "../middlewares/icu-permission-middleware.js";

// Rute dasar ruang perawatan intensif selain ICU (CCU, HDU): pengendali & tabel episode yang sama dengan ICU
// (icu_perawatans.unit), dengan izin & label unit sendiri. Nama submodul izin sama dengan ICU agar pola hak akses
// seragam; rute khusus unit (EKG, EWS, dst.) ditambahkan berkas rute unit masing-masing pada router yang dikembalikan.
export const buatRuteIntensif = ({ unit, modul, submodulLaporan }) => {
    const router = express.Router();
    const izin = izinIntensif(modul);
    router.use((req, res, next) => {
        req.unitIntensif = unit;
        next();
    });

    router.get("/dashboard", izin("Dasbor", "READ"), IcuController.GetDashboard);
    router.get("/perpindahan-siap", izin("Serah Terima", "KELOLA"), IcuController.GetPerpindahanSiap);
    router.get("/perawatan/:perawatan_uuid", izin("Perawatan", "READ"), IcuController.GetPerawatan);
    router.post("/perpindahan/:perpindahan_uuid/mulai", izin("Serah Terima", "KELOLA"), IcuController.MulaiPerawatan);
    router.post("/perawatan/:perawatan_uuid/keluar", izin("Serah Terima", "KELOLA"), IcuController.KeluarPerawatan);

    router.post("/perawatan/:perawatan_uuid/observasi", izin("Flowsheet Observasi", "CREATE"), IcuController.TambahObservasi);
    router.get("/perawatan/:perawatan_uuid/observasi", izin("Flowsheet Observasi", "READ"), IcuController.GetObservasi);
    router.post("/observasi/:observasi_uuid/koreksi", izin("Flowsheet Observasi", "KOREKSI"), IcuController.KoreksiObservasi);

    router.post("/perawatan/:perawatan_uuid/intake-output", izin("Balance Cairan", "CREATE"), IcuController.TambahIntakeOutput);
    router.get("/perawatan/:perawatan_uuid/balance", izin("Balance Cairan", "READ"), IcuController.GetBalance);

    router.get("/laporan", izin(submodulLaporan, "READ"), IcuController.GetLaporan);
    return { router, izin };
};
