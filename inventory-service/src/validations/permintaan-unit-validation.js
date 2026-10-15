import {z} from "zod";
import {required} from "./message-validation-error.js";

const STATUS_PERMINTAAN_ENUM = [
    "request",
    "request_sebagian",
    "verified",
    "verif_sebagian",
    "dikirim",
    "cancel"
];

export default class PermintaanUnitValidation {
    static GET_ALL = z.object({
        faskes_uuid: z.string().min(1, required),
        lokasi_gudang_uuid: z.string().min(1, required),
        status : z.preprocess(
            (val) => {
                if (!val) return undefined;
                if (Array.isArray(val)) return val;
                if (typeof val === "string") return val.split(",");
                return undefined;
            },
            z.array(z.enum(STATUS_PERMINTAAN_ENUM)).optional()
        ),
        search: z.string().optional(),
        page: z.string().optional(), 
        limit: z.string().optional(),
    });

    static GET_DETAIL = z.object({
      uuid: z.string().min(1, required)
    });

    static TOLAK_PERMINTAAN = z.object({
        uuid: z.string().min(1, required),
        alasan_batal: z.string().min(1, required),
        petugas_batal_tolak: z.string().min(1, required)
    });

    static VERIFIKASI_PERMINTAAN = z.object({
        uuid: z.string().min(1, required),
        item : z.array(z.object({
            uuid: z.string().min(1, required),
            quantity: z.number().min(1, {message: "jumlah pengiriman harus lebih dari 0",
            })
        }), required),
        faskes_uuid: z.string().min(1, required),
        petugas_uuid: z.string().optional(),
    });

    static KIRIM_PERMINTAAN = z.object({
        uuid: z.string().min(1, required),
        petugas_kirim: z.string().optional(),
        petugas_uuid: z.string().optional(),
        faskes_uuid: z.string().min(1, required),
        catatan_pengiriman: z.string().optional(),
    });
}