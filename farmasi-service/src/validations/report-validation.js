import {z} from "zod";
import {required} from "./message-validation-error.js";

export default class ReportValidation {
    static GET_PENDAPATAN = z.object({
        start_date: z.number().min(1, required),
        end_date: z.number().min(1, required),
        faskes_uuid : z.string().min(1, required),
    })

    static GET_TAT = z.object({
        start_date: z.number(),
        end_date: z.number(),
        faskes_uuid : z.string().min(1, required),
    })
}