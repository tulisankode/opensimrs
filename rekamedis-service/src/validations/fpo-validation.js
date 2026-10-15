import {
    required,
    stringMax
} from "./message-validation-error.js";
import { z } from "zod";

export default class FpoValidation {
    static GET = z.object({
        date : z.string().min(1, required),
        prescription_item_uuid : z.string().min(1, required),
    });

    static INSERT = z.object({
        jam_pemberian : z.number(),
        nama_pemberi : z.string().min(1, required),
        note : z.string().trim().min(1, required).max(255, { message: `Catatan ${stringMax}`}),
        prescription_item_uuid : z.string().min(1, required),
    });

    static UPDATE = z.object({
        uuid : z.string().min(1, required),
        jam_pemberian : z.number(),
        nama_pemberi : z.string().min(1, required),
        note : z.string().min(1, required),
    });


}