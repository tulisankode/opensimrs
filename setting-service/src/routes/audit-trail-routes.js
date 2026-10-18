import express from "express";
import AuditTrailController from "../controllers/audit-trail-controller.js";
import { permissionSdk } from "../configurations/permission.config.js";

// STD-0029 — Audit Trail terpusat. Izin lihat/ekspor diperiksa di server (bukan hanya UI); faskes_uuid selalu dari
// token lewat request.author (tidak pernah diterima dari parameter permintaan).
const apiBase = process.env.API_BASE || "api";
const apiVersion = process.env.API_VERSION || "v1";
const PREFIX = `/${apiBase}/${apiVersion}/setting/audit-trail`;

const LIHAT = permissionSdk("Setting", "Audit Trail", null, "LIHAT");
const EKSPOR = permissionSdk("Setting", "Audit Trail", null, "EKSPOR");

const router = express.Router();

router.get(`${PREFIX}`, LIHAT, AuditTrailController.cari);
router.get(`${PREFIX}/pasien/:patientUuid`, LIHAT, AuditTrailController.riwayatPasien);
router.get(`${PREFIX}/:uuid`, LIHAT, AuditTrailController.detail);
router.post(`${PREFIX}/ekspor`, EKSPOR, AuditTrailController.ekspor);
router.post(`${PREFIX}/verifikasi`, LIHAT, AuditTrailController.verifikasi);

export default router;
