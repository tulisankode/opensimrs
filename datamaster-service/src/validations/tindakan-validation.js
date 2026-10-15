import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class TindakanValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    snomed_uuid: z.string().max(255).optional().nullable(),
    icd9_uuid: z.string().max(255).optional().nullable(),
    status: z.boolean({ required_error: codeRequired }),
  });

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255).optional(),
    name: z.string().min(1, nameRequired).max(255).optional(),
    snomed_uuid: z.string().max(255).optional().nullable(),
    icd9_uuid: z.string().max(255).optional().nullable(),
    status: z.boolean(statusRequired).optional(),
  });


  static IMPORT = z.array(this.CREATE)
}
