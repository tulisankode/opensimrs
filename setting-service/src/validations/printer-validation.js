import { z } from "zod";
import {faskesUuidRequired} from "./message-validation-error.js";

export default class PrinterValidation {
    static UPDATE = z.object({
        uuid : z.string().min(1, faskesUuidRequired),
        header: z.string(),
        footer: z.string(),
        background: z.string(),
    });
}