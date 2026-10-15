import { z } from "zod";
import {
  addressRequired,
  codeRequired,
  nameRequired,
  phoneMaxLength,
  phoneRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class PenjaminValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    phone: z.string().max(15, phoneMaxLength).optional().nullable(),
    address: z.string().max(255).optional().nullable(),
    status: z.boolean({ required_error: statusRequired }),
  });


  static IMPORT = z.array(this.CREATE)

  static UPDATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255)
      .optional(),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255)
      .optional(),
    phone: z
      .string()
      .min(1, phoneRequired)
      .max(15, phoneMaxLength)
      .optional()
      .nullable(),
    address: z.string().min(1, addressRequired).max(255).optional().nullable(),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });
}
