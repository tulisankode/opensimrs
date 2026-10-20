import express from "express";
import { z } from "zod";
import { buatPicuAkses, picuPermission as izin } from "../middlewares/picu-permission-middleware.js";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { picuHandler as aksi } from "../controllers/picu-controller.js";
import { konfigurasiSchema, dokumentasiSchema, penerimaanSchema, transisiSchema, periodeSchema,
    pengesahanSchema, pemetaanSchema, kosongSchema } from "../validations/picu-request.js";

const router = express.Router();
router.use(buatPicuAkses(sequelizeInstance));
router.get("/dashboard", izin("Dasbor"), aksi(periodeSchema, (r, req, d) => r.dashboard(d)));
router.get("/laporan/operasional", izin("Laporan Operasional"), aksi(periodeSchema, (r, req, d) => r.dashboard(d)));
router.get("/tempat-tidur", izin("Tempat Tidur"), aksi(kosongSchema, (r) => r.tempatTidur()));
router.get("/tempat-tidur/sumber", izin("Tempat Tidur", "KELOLA"), aksi(kosongSchema, (r) => r.sumberTempatTidur()));
router.get("/penerimaan", izin("Episode", "CREATE"), aksi(kosongSchema, (r) => r.calonPenerimaan()));
router.post("/tempat-tidur", izin("Tempat Tidur", "KELOLA"), aksi(pemetaanSchema, (r, req, d, t) => r.petakan(d, t), true));
router.get("/episode", izin("Episode"), aksi(z.object({ halaman: z.coerce.number().int().positive().max(100000).default(1) }).strict(), (r, req, d) => r.daftarEpisode(d.halaman)));
router.post("/episode", izin("Episode", "CREATE"), aksi(penerimaanSchema, (r, req, d, t) => r.mulai(d, t), true));
router.get("/episode/:episode_uuid", izin("Episode"), aksi(
    z.object({ halaman_dokumentasi: z.coerce.number().int().positive().max(100000).default(1) }).strict(),
    (r, req, d) => r.detail(req.params.episode_uuid, d.halaman_dokumentasi)));
router.get("/episode/:episode_uuid/perpindahan", izin("Episode"), aksi(kosongSchema, (r, req) => r.calonPerpindahan(req.params.episode_uuid)));
router.get("/episode/:episode_uuid/transaksi", izin("Episode"), izin("Transaksi Sumber"), aksi(
    z.object({ sumber: z.enum(["laboratorium", "radiologi", "farmasi"]) }).strict(),
    (r, req, d) => r.transaksiSumber(req.params.episode_uuid, d.sumber, req.res.locals.picuSumber)));
router.post("/episode/:episode_uuid/perpindahan", izin("Episode", "PINDAH"), aksi(transisiSchema, (r, req, d, t) => r.transisi(req.params.episode_uuid, d, false, t), true));
router.post("/episode/:episode_uuid/penutupan", izin("Episode", "TUTUP"), aksi(transisiSchema, (r, req, d, t) => r.transisi(req.params.episode_uuid, d, true, t), true));
router.get("/konfigurasi", izin("Konfigurasi"), aksi(kosongSchema, (r) => r.konfigurasi()));
router.post("/konfigurasi", izin("Konfigurasi", "CREATE"), aksi(konfigurasiSchema, (r, req, d, t) => r.buatKonfigurasi(d, t), true));
router.post("/konfigurasi/:konfigurasi_uuid/pengesahan", izin("Konfigurasi", "VALIDASI"), aksi(pengesahanSchema, (r, req, d, t) => r.sahkan(req.params.konfigurasi_uuid, d, t), true));
router.post("/episode/:episode_uuid/dokumentasi", izin("Episode"), aksi(dokumentasiSchema, (r, req, d, t) => r.catat(req.params.episode_uuid, d, t), true));
router.post("/episode/:episode_uuid/dokumentasi/:dokumen_uuid/finalisasi", izin("Episode"), aksi(kosongSchema, (r, req, d, t) => r.finalisasi(req.params.episode_uuid, req.params.dokumen_uuid, t), true));
export default router;
