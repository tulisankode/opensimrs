import { z } from "zod";
import { statusRequired } from "./message-validation-error.js";

export default class KategoriGigiValidation {
  static CREATE = z.object({
    system: z
      .string({ required_error: "System tidak boleh kosong" })
      .min(1)
      .max(255),
    code: z
      .string({ required_error: "Code tidak boleh kosong" })
      .min(1)
      .max(255),
    display: z
      .string({ required_error: "Display tidak boleh kosong" })
      .min(1)
      .max(255),
    name: z
      .string({ required_error: "Name tidak boleh kosong" })
      .min(1)
      .max(255),
    status: z.boolean({ required_error: statusRequired }),
  });

  static IMPORT = z.array(
    this.CREATE
  )

  static UPDATE = z.object({
    system: z
      .string({ required_error: "System tidak boleh kosong" })
      .min(1)
      .max(255)
      .optional(),
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
      .string({ required_error: "Name tidak boleh kosong" })
      .min(1)
      .max(255)
      .optional(),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });
}
