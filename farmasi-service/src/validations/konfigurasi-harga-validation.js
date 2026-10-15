import { z } from "zod";
import {faskesUuidRequired, required} from "./message-validation-error.js";

export default class KonfigurasiHargaValidation {
    static UPDATE = z.object({
        faskes_uuid : z.string().min(1, faskesUuidRequired),
        metode_pemotongan_stok : z.string().min(1, required),
        metode_hpp : z.string().min(1, required),
        ppn : z.number(),
        margin : z.number(),
        biaya_embalase_racik : z.boolean(),
        metode_biaya_racikan : z.string().min(1, required),
        petugas : z.string().min(1, required),
    });

    static GET = z.object({
        faskes_uuid : z.string().min(1, faskesUuidRequired),
    });
}