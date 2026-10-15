import { z } from "zod";

import {
  codeRequired,
  nameRequired,
  codeMaxLength,
  nameMaxLength,
} from "./message-validation-error.js";

export default class KelurahanValidation {
  static CREATE = z.array(
    z.object({
      code: z.number(),
      kecamatan_code: z.number(),
      name: z.string().min(1, "nama tidak boleh kosong")
    })
  )
  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255, codeMaxLength).optional(),
    kecamatan_code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255, codeMaxLength),
    name: z.string().min(1, nameRequired).max(255, nameMaxLength).optional(),
  });
}
