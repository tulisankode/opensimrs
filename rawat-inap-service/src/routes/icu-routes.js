import express from "express";
import IcuController from "../controllers/icu-controller.js";
import icuPermission from "../middlewares/icu-permission-middleware.js";

import icuUnit from "../middlewares/icu-unit-middleware.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { pastikanModulIcu } from "../helpers/icu-modul-helper.js";
const router = express.Router();
const fitur = (kode) => async (req, res, next) => {
    try { await pastikanModulIcu(Context.get(CTX_AUTHOR)?.faskesUuid, kode); next(); }
    catch (error) { res.status(error.code ?? 500).json({ message: error.code === 403 ? error.message : "Gagal memeriksa fitur ICU", payload: null }); }
};
router.use(icuUnit);
const khusus = (metode, path, sub, aksi, kode, tindakan) => router[metode](path, icuPermission(sub, aksi), fitur(kode), IcuController.Khusus(tindakan));
khusus("get", "/layanan", "Perawatan", "READ", null, "layanan");
khusus("get", "/konfigurasi", "Konfigurasi Layanan", "READ", "icu_konfigurasi_layanan", "konfigurasi");
khusus("put", "/konfigurasi/layanan/:kode", "Konfigurasi Layanan", "KELOLA", "icu_konfigurasi_layanan", "aktivasi");
khusus("put", "/konfigurasi/bed/:bed_uuid", "Konfigurasi Layanan", "KELOLA", "icu_konfigurasi_layanan", "bed");
khusus("put", "/konfigurasi/akses-unit", "Konfigurasi Layanan", "KELOLA", "icu_konfigurasi_layanan", "akses");
khusus("get", "/konfigurasi/riwayat", "Konfigurasi Layanan", "READ", "icu_konfigurasi_layanan", "riwayat-konfigurasi");
// Pemakaian template klinis memerlukan izin perawatan; pengelola memakai daftar lengkap secara terpisah.
khusus("get", "/template/pilihan", "Perawatan", "READ", null, "pilihan-template");
khusus("get", "/template", "Template Klinis", "READ", "icu_template_klinis", "daftar-template");
khusus("post", "/template", "Template Klinis", "CREATE", "icu_template_klinis", "buat-template");
khusus("post", "/template/:versi_uuid/versi", "Template Klinis", "CREATE", "icu_template_klinis", "versi-template");
khusus("put", "/template/:versi_uuid", "Template Klinis", "UPDATE", "icu_template_klinis", "ubah-template");
khusus("post", "/template/:versi_uuid/tetapkan", "Template Klinis", "TETAPKAN", "icu_template_klinis", "tetapkan");
khusus("post", "/template/:versi_uuid/arsipkan", "Template Klinis", "TETAPKAN", "icu_template_klinis", "arsipkan");
khusus("get", "/perawatan/:perawatan_uuid/riwayat", "Perawatan", "READ", null, "riwayat");
khusus("get", "/perawatan/:perawatan_uuid/dokumentasi", "Dokumentasi Klinis", "READ", "icu_dokumentasi_klinis", "dokumentasi");
khusus("post", "/perawatan/:perawatan_uuid/dokumentasi", "Dokumentasi Klinis", "CREATE", "icu_dokumentasi_klinis", "tambah-dokumentasi");
khusus("post", "/dokumentasi/:dokumentasi_uuid/koreksi", "Dokumentasi Klinis", "KOREKSI", "icu_dokumentasi_klinis", "koreksi-dokumentasi");
khusus("get", "/perawatan/:perawatan_uuid/kelengkapan", "Kelengkapan Dokumentasi", "READ", "icu_kelengkapan_dokumentasi", "kelengkapan");
khusus("get", "/laporan/kelengkapan", "Kelengkapan Dokumentasi", "READ", "icu_kelengkapan_dokumentasi", "laporan-kelengkapan");

// Dasbor
router.get("/dashboard", icuPermission("Dasbor", "READ"), IcuController.GetDashboard);

// Perawatan & serah terima (tertaut ke ri_perpindahan — tidak membuat status perpindahan paralel).
router.get("/perpindahan-siap", icuPermission("Serah Terima", "KELOLA"), IcuController.GetPerpindahanSiap);
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

router.use((error, req, res, next) => {
    const code = error.name === "SequelizeUniqueConstraintError" ? 409 : error.code;
    if ([400, 403, 404, 409].includes(code)) return res.status(code).json({ message: code === 409 ? "Perubahan ICU berkonflik; muat ulang data" : error.message, payload: null });
    next(error);
});
export default router;
