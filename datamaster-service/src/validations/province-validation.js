import { z } from "zod";

import {
  codeRequired,
  nameRequired,
  codeMaxLength,
  nameMaxLength,
} from "./message-validation-error.js";

export default class ProvinceValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255, codeMaxLength),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255, nameMaxLength),
  });


  static IMPORT_PROVINCE = z.array(z.object({
    code: z.string().min(1, "code tidak boleh kosong").refine(value => value.trim() !== "", { message: "code tidak boleh blank", path: ["code"]}),
    name: z.string().min(1, "name tidak boleh kosong").refine(value => value.trim() !== "", { message: "name tidak boleh blank", path: ["name"]})
  }))

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255, codeMaxLength).optional(),
    name: z.string().min(1, nameRequired).max(255, nameMaxLength).optional(),
  });
}
