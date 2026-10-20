import express from "express";
import { QueryTypes } from "sequelize";
import { uuidv7 } from "uuidv7";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import sequelize from "../configs/sequelize-instance.js";
import permission from "../middlewares/nicu-permission-middleware.js";
import NicuRepository from "../repositories/nicu-repository.js";
import { NicuError } from "../helpers/nicu-aturan.js";
import { nicuSchemas, daftarSchema, uuidSchema } from "../validations/nicu-request.js";
import { ZodError } from "zod";
import successResponse from "../responses/success-response.js";

const router = express.Router();
const handler = (proses, schema, status = 200) => async (req, res, next) => {
    try {
        const author = Context.get(CTX_AUTHOR);
        const repo = new NicuRepository({
            query: (sql, replacements, transaction) => sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT }),
            transaction: (proses) => sequelize.transaction(proses), uuid: uuidv7, sekarang: () => Math.floor(Date.now() / 1000),
        }, author);
        const uuid = req.params.uuid ? uuidSchema.parse(req.params.uuid) : undefined;
        const data = schema ? schema.parse(req.body) : daftarSchema.parse(req.query);
        const hasil = await proses(repo, data, uuid, req.get("Idempotency-Key"));
        return res.status(status).json(successResponse("Operasi NICU berhasil.", hasil));
    } catch (error) {
        if (error instanceof ZodError) return res.status(422).json({ message: "Data NICU tidak valid. Periksa field dan format isian.", payload: { kesalahan: error.issues.map((i) => ({ field: i.path.join("."), kode: i.code })) } });
        if (error instanceof NicuError) return res.status(error.status).json({ message: error.message });
        if (error?.name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Data atau tempat telah digunakan. Muat ulang kondisi terbaru." });
        // Kesalahan penyimpanan tidak diteruskan sebagai teks SQL atau isi dokumentasi klinis.
        return res.status(500).json({ message: "Operasi NICU belum berhasil. Silakan coba kembali." });
    }
};
const tulis = (metode, path, sub, aksi, schema, jenis, proses, status = 200) => {
    router[metode](path, permission(sub, aksi), handler((r, d, uuid, key) => r.operasi(`${jenis}:${uuid ?? "baru"}`, key, d, (t) => proses(r, d, uuid, t)), schema, status));
};
router.get("/dashboard", permission("Dasbor"), handler(async (r, d) => {
    const sekarang = Math.floor(Date.now() / 1000);
    return { ringkasan: await r.laporan({ ...d, dari: d.dari ?? sekarang - 86400, sampai: d.sampai ?? sekarang }), tempat: await r.tempat(d) };
}));
router.get("/tempat", permission("Tempat"), handler((r, d) => r.tempat(d)));
router.get("/sumber-tempat", permission("Tempat"), handler((r, d) => r.sumberTempat(d)));
router.get("/unit", permission("Konfigurasi"), handler((r, d) => r.unit(d)));
tulis("post", "/tempat", "Tempat", "KELOLA", nicuSchemas.tempat, "tempat", (r, d, u, t) => r.tambahTempat(d, t), 201);
tulis("patch", "/tempat/:uuid", "Tempat", "KELOLA", nicuSchemas.statusAlat, "status-alat", (r, d, u, t) => r.statusAlat(u, d, t));
tulis("post", "/tempat/:uuid/status-alat", "Tempat", "KELOLA", nicuSchemas.statusAlat, "status-alat", (r, d, u, t) => r.statusAlat(u, d, t));
router.get("/konfigurasi", permission("Konfigurasi"), handler((r, d) => r.konfigurasi(d)));
tulis("post", "/konfigurasi", "Konfigurasi", "KELOLA", nicuSchemas.konfigurasi, "konfigurasi", (r, d, u, t) => r.tambahKonfigurasi(d, t), 201);
tulis("post", "/konfigurasi/:uuid/penerbitan", "Konfigurasi", "TERBITKAN", nicuSchemas.penerbitan, "terbit", (r, d, u, t) => r.terbitkan(u, d, t));
router.get("/penerimaan", permission("Penerimaan"), handler((r, d) => r.penerimaan(d)));
router.get("/episode", permission("Episode"), handler((r, d) => r.episode(d)));
router.get("/episode/:uuid", permission("Episode"), handler((r, d, u) => r.detail(u)));
router.get("/episode/:uuid/identitas", permission("Identitas"), handler((r, d, u) => r.identitas(u)));
router.get("/episode/:uuid/perpindahan", permission("Episode"), handler((r, d, u) => r.perpindahan(u)));
tulis("post", "/episode", "Penerimaan", "TERIMA", nicuSchemas.masuk, "masuk", (r, d, u, t) => r.masuk(d, t), 201);
router.get("/episode/:uuid/penempatan", permission("Penempatan"), handler((r, d, u) => r.histori(u, d)));
tulis("post", "/episode/:uuid/penempatan", "Penempatan", "PINDAH", nicuSchemas.pindah, "pindah", (r, d, u, t) => r.pindah(u, d, t));
tulis("post", "/episode/:uuid/penyelesaian", "Penyelesaian", "SELESAIKAN", nicuSchemas.selesai, "selesai", (r, d, u, t) => r.selesai(u, d, t));
router.get("/episode/:uuid/dokumen", permission("Dokumentasi"), handler((r, d, u) => r.dokumen(u, d)));
tulis("post", "/episode/:uuid/dokumen", "Dokumentasi", "CREATE", nicuSchemas.dokumen, "dokumen", (r, d, u, t) => r.tambahDokumen(u, d, t), 201);
tulis("post", "/dokumen/:uuid/koreksi", "Dokumentasi", "KOREKSI", nicuSchemas.koreksi, "koreksi", (r, d, u, t) => r.koreksi(u, d, t));
router.get("/dokumen/:uuid/revisi", permission("Dokumentasi", "RIWAYAT"), handler((r, d, u) => r.revisi(u, d)));
router.get("/laporan/operasional", permission("Laporan"), handler((r, d) => r.laporan(d)));
router.post("/laporan/ekspor", permission("Laporan", "EKSPOR"), handler((r, d, u, key) => r.operasi("ekspor", key, d, async () => ({ format: "json", baris: await r.laporan(d) })), daftarSchema));

export default router;
