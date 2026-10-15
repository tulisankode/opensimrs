import { z } from "zod";
import { statusRequired } from "./message-validation-error.js";

export default class GigiValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: "Code tidak boleh kosong" })
      .min(1)
      .max(255).refine(value => value.trim() != "", { message: "code tidak boleh blank", path: ["code"]}),
    display: z
      .string({ required_error: "Display tidak boleh kosong" })
      .min(1)
      .max(255).refine(value => value.trim() != "", { message: "display tidak boleh blank", path: ["display"]}),
    name: z.string({ required_error: "Name tidak boleh kosong", invalid_type_error: "nama tidak valid" }),
    status: z.boolean({ required_error: statusRequired }),
  });

  static IMPORT = z.array(
    z.object({
      code: z
      .string({ required_error: "Code tidak boleh kosong" })
      .min(1)
      .max(255).refine(value => value.trim() != "", { message: "code tidak boleh blank", path: ["code"]}),
    display: z
      .string({ required_error: "Display tidak boleh kosong" })
      .min(1)
      .max(255).refine(value => value.trim() != "", { message: "display tidak boleh blank", path: ["display"]}),
    name: z.string({ required_error: "Name tidak boleh kosong", invalid_type_error: "nama tidak valid" }),
    })
  )

  static UPDATE = z.object({
    code: z
      .string({ required_error: "Code tidak boleh kosong" })
      .min(1)
      .max(255)
      .optional(),
    display: z
      .string({ required_error: "Display tidak boleh kosong" })
      .min(1)
      .max(255)
      .optional(),
    name: z
      .string({ required_error: "Name tidak boleh kosong", invalid_type_error: "nama tidak valid" })
      .optional(),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });
}
