import {z} from "zod";
import {required} from "./message-validation-error.js";

export default class RiwayatValidation {
    static GET_ALL = z.object({
        item_type: z.string().min(1, required),
        status_type: z.string().min(1, required),
    })

    static GET_DETAIL = z.object({
        item_type: z.string().min(1, required),
        uuid: z.string().min(1, required),
        status_type: z.string().min(1, required),
    })
}