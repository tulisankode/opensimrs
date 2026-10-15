import { z } from "zod";
import { codeRequired, faskesUuidRequired, nameRequired, permisionUuidRequired, uuidRequired } from "./message-validation-error.js";

export default class RoleValidation {
  static CREATE = z.object({
    faskesUuid: z.string().min(1, faskesUuidRequired),
    code: z.string().min(1, codeRequired),
    name: z.string().min(1, nameRequired),
    status: z.boolean(),
  });

  static UPDATE = z.object({
    uuid: z.string().min(1, uuidRequired),
    faskesUuid: z.string().min(1, faskesUuidRequired),
    code: z.string().min(1, codeRequired),
    name: z.string().min(1, nameRequired),
    status: z.boolean(),
  });
}
