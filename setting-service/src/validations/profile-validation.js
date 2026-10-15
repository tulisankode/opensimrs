import { z } from 'zod';
import {nameRequired, phoneRequired, photoRequired, uuidRequired} from "./message-validation-error.js";

export default class ProfileValidation {
    static UPDATE = z.object({
        name: z.string().min(1, nameRequired),
        phone: z.string().min(1, phoneRequired),
        photo: z.string(),
        username: z.string().min(1, nameRequired),
        awalan_gelar : z.string(),
        akhiran_gelar : z.string(),
    })
}