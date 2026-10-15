import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class LoincValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    status: z.boolean({ required_error: statusRequired }),
  });

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255).optional(),
    name: z.string().min(1, nameRequired).max(255).optional(),
    status: z.boolean(statusRequired).optional(),
  });

  static IMPORT = z.array(z.object({
    uuid: z.string({required_error: "uuid tidak boleh blank"}).uuid({message: "uuid tidak valid"}),
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    status: z.boolean({ required_error: statusRequired }),
  }))
}
