import { uuidv7 } from "uuidv7";
import sequelizeInstance from "../configs/sequelize-instance.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import PicuRepository, { PicuError } from "../repositories/picu-repository.js";
import successResponse from "../responses/success-response.js";
import { uuidSchema } from "../validations/picu-request.js";

export const picuHandler = (schema, proses, tulis = false) => async (req, res) => {
    try {
        const data = schema.parse(tulis ? req.body : req.query);
        for (const p of Object.values(req.params)) uuidSchema.parse(p);
        const repo = new PicuRepository(sequelizeInstance, Context.get(CTX_AUTHOR), uuidv7, res.locals.picuDokumentasi);
        const hasil = tulis
            ? await repo.tulis(req.path.replace(/\/+$/, ""), req.get("Idempotency-Key"), data, (t) => proses(repo, req, data, t))
            : await proses(repo, req, data);
        res.status(200).json(successResponse("Permintaan PICU berhasil diproses.", hasil));
    } catch (e) {
        if (e.name === "ZodError") return res.status(422).json({ message: "Data permintaan PICU tidak valid.", payload: { kesalahan: e.issues.map((i) => ({ kolom: i.path.join("."), pesan: "Nilai atau kolom tidak sesuai kontrak PICU." })) } });
        if (e instanceof PicuError) return res.status(e.status).json({ message: e.message });
        // Isi klinis dan rincian koneksi tidak dicatat dalam log teknis.
        res.status(503).json({ message: "Permintaan PICU belum tersimpan atau belum dapat dimuat. Coba kembali dengan kunci permintaan yang sama." });
    }
};
