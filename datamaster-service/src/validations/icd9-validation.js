import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class ICD9Validation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .trim()
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .trim()
      .min(1, nameRequired)
      .max(255),
    status: z.boolean(statusRequired),
  });

  static IMPORT = z.array(this.CREATE);

  static UPDATE = z.object({
    code: z.string().trim().min(1, codeRequired).max(255).optional(),
    name: z.string().trim().min(1, nameRequired).max(255).optional(),
    status: z.boolean(statusRequired).optional().nullable(),
  });
}
