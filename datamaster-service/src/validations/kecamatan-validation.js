import { z } from "zod";

import {
  codeRequired,
  nameRequired,
  codeMaxLength,
  nameMaxLength,
} from "./message-validation-error.js";

export default class KecamatanValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255, codeMaxLength).refine(value => value.trim() !== "", { message: "code tidak boleh blank", path: ["code"]}),
    kabupaten_code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255, codeMaxLength).refine(value => value.trim() !== "", { message: "kabupaten_code tidak boleh blank", path: ["kabupaten_code"]}),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255, nameMaxLength).refine(value => value.trim() !== "", { message: "name tidak boleh blank", path: ["name"]}),
  });

  static IMPORT = z.array(
    this.CREATE
  )

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255, codeMaxLength).optional(),
    kabupaten_code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255, codeMaxLength),
    name: z.string().min(1, nameRequired).max(255, nameMaxLength).optional(),
  });
}
