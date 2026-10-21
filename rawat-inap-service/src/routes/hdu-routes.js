import express from "express";
import { ZodError } from "zod";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import sequelizeInstance from "../configs/sequelize-instance.js";
import hduPermission, { modulIcuAktif } from "../middlewares/hdu-permission-middleware.js";
import HduRepository from "../repositories/hdu-repository.js";
import HduService from "../services/hdu-service.js";

const router = express.Router();
const daftar = (metode, path, izin, aksi, operasi) => router[metode](path, hduPermission(izin, aksi), async (req, res, next) => {
    try {
        const author = Context.get(CTX_AUTHOR);
        const service = new HduService(new HduRepository(sequelizeInstance, author));
        const payload = await service.jalankan(operasi, req, res.locals.hduBoleh, operasi === "konfirmasi" && await modulIcuAktif(author.faskesUuid));
        res.status(metode === "post" ? 201 : 200).json({ message: "Proses HDU berhasil.", payload });
    } catch (error) {
        if (error instanceof ZodError) return res.status(422).json({ message: "Masukan HDU tidak valid. Periksa bidang dan tipe data yang dikirim.", payload: { bidang: error.issues.map((i) => i.path.join(".")) } });
        if (error.hdu) return res.status(error.status).json({ message: error.message, payload: null });
        if (error.name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Data bertentangan dengan penempatan atau catatan yang sudah ada.", payload: null });
        return res.status(503).json({ message: "Layanan sumber HDU tidak dapat memproses permintaan. Muat ulang untuk memeriksa status sebelum mengirim kembali.", payload: null });
    }
});

daftar("get", "/konfigurasi", "HDU Konfigurasi", "READ", "konfigurasi");
daftar("post", "/konfigurasi", "HDU Konfigurasi", "KELOLA", "buatKonfigurasi");
daftar("patch", "/konfigurasi/:uuid", "HDU Konfigurasi", "KELOLA", "ubahKonfigurasi");
daftar("get", "/konfigurasi/:uuid/kebijakan-observasi", "HDU Konfigurasi", "READ", "kebijakan");
daftar("post", "/konfigurasi/:uuid/kebijakan-observasi", "HDU Kebijakan Observasi", "KELOLA", "kebijakanTulis");
daftar("get", "/tempat-tidur", "HDU Episode", "READ", "tempatTidur");
daftar("get", "/episode", "HDU Episode", "READ", "daftar");
daftar("get", "/episode/:uuid", "HDU Episode", "READ", "detail");
daftar("get", "/episode/:uuid/instruksi-observasi", "HDU Episode", "READ", "riwayat");
daftar("post", "/episode/:uuid/instruksi-observasi", "HDU Instruksi Observasi", "KELOLA", "instruksiTulis");
daftar("post", "/episode/:uuid/selesai", "HDU Serah Terima", "CREATE", "selesai");
daftar("get", "/serah-terima", "HDU Serah Terima", "READ", "serahTerima");
daftar("post", "/serah-terima", "HDU Serah Terima", "CREATE", "siapkan");
daftar("post", "/serah-terima/:uuid/konfirmasi", "HDU Serah Terima", "KONFIRMASI", "konfirmasi");

export default router;
