import { z } from "zod";
import { faskesUuidRequired, nameRequired, roleRequired, uuidRequired } from "./message-validation-error.js";

export default class DokterValidation {
  static CREATE = z.object({
    faskesUuid: z.string().min(1, faskesUuidRequired),
    bpjsCode: z.string(),
    role: z.string().min(1, roleRequired),
    queueCode: z.string(),
    name: z.string().min(1, nameRequired),
    title: z.string(),
    sip: z.string(),
    kuotaJkn: z.string(),
    kuotaNonJkn: z.string(),
    serviceTime: z.number(),
    serviceDuration: z.number(),
    locationUuid: z.string(),
    status: z.boolean()
  });

  static UPDATE = z.object({
    uuid: z.string().min(1, uuidRequired),
    faskesUuid: z.string().min(1, faskesUuidRequired),
    bpjsCode: z.string(),
    queueCode: z.string(),
    role: z.string().min(1, roleRequired),
    name: z.string().min(1, nameRequired),
    title: z.string(),
    sip: z.string(),
    kuotaJkn: z.string(),
    kuotaNonJkn: z.string(),
    serviceTime: z.number(),
    serviceDuration: z.number(),
    locationUuid: z.string(),
    status: z.boolean()
  });

  static UUID = z.string().min(1, uuidRequired);

}
