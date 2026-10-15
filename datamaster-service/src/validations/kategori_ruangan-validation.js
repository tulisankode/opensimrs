import { z } from "zod";
import { codeRequired, nameRequired, statusRequired } from "./message-validation-error.js";

export default class KategoriRuanganValidation {
  static CREATE = z.object({
    code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255),
    name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
    status: z.boolean({ required_error: statusRequired }),
  });

  static IMPORT = z.array(
    z.object({
      faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "faskes_uuid tidak valid"}),
      code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255),
      name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
      status: z.boolean({ required_error: statusRequired }),
    })
  );

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255).optional(),
    name: z.string().min(1, nameRequired).max(255).optional(),
    status: z.boolean(statusRequired).optional(),
  });
}
