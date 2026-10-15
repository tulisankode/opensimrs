import {z} from "zod";
import {required} from "./message-validation-error.js";

export default class StokAdjustmentValidation {
    static GET_DETAIL = z.object({
        uuid: z.string().min(1, required),
        lokasi_stok_uuid: z.string().min(1, required),
    });

    static UPDATE = z.object({
        uuid: z.string().min(1, required),
        sisa_stok: z.number().min(0, required),
        exp_date: z.preprocess((Val) => (typeof Val === "string" ? new Date(Val) : Val), z.date()),
        faskes_uuid: z.string().min(1, "faskes_uuid wajib diisi"),
        petugas_sa: z.string().min(1, "petugas_sa wajib diisi")
    });
}