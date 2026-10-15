import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class SnomedValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    status: z.boolean({ required_error: codeRequired }),
  });

  static IMPORT = z.array(this.CREATE);

  static UPDATE = z.object({
    uuid: z.string({required_error: "uuid tidak tidak boleh kosong"}),
    code: z.string().min(1, codeRequired).max(255).optional(),
    name: z.string().min(1, nameRequired).max(255).optional(),
    status: z.boolean(statusRequired).optional(),
  });
}
