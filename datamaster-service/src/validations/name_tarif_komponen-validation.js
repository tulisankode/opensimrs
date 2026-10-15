import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class NameTarifKomponenValidation {
  static CREATE = z.object({
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
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
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
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
    status: z.boolean(statusRequired).optional(),
  });

  static IMPORT = z.array(
    z.object({
      code: z
        .string({ required_error: codeRequired })
        .min(1, codeRequired)
        .max(255),
      name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
      status: z.boolean({ required_error: statusRequired }),
      faskes_uuid: z.string().uuid({ required_error: "Faskes UUID is required" }),
      uuid: z.string().uuid({ required_error: "UUID is required" }),
    })
  );
}
