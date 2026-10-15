import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class DiagnosisValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(500),
    status: z.boolean({ required_error: statusRequired }),
  });

  static IMPORT = z.array(
    z.object({
      code: z
        .string({ required_error: codeRequired })
        .min(1, codeRequired)
        .max(255),
      name: z
        .string({
          required_error:
            "english_name atau indonesian_name tidak boleh kosong",
        })
        .max(500),
      status: z.boolean({ required_error: statusRequired }),
    })
  );

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255).optional(),
    name: z.string().min(1, nameRequired).max(500).optional(),
    status: z.boolean(statusRequired).optional(),
  });
}
