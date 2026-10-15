import { z } from "zod";
import {faskesUuidRequired} from "./message-validation-error.js";

export default class PpnValidation {
    static UPDATE = z.object({
        uuid : z.string().min(1, faskesUuidRequired),
        status : z.boolean(),
        value : z.number().min(0).max(100)
    });
}