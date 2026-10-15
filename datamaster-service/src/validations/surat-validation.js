import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
  codeMaxLength,
  nameMaxLength,
  isiSuratMaxLength,
} from "./message-validation-error.js";

export default class SuratValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255, codeMaxLength),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255, nameMaxLength),
    isi_surat: z
      .string({ required_error: "Isi surat tidak boleh kosong" }) ,
    status: z.boolean({
      required_error: statusRequired,
      invalid_type_error: statusRequired,
    }),
  });

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255, codeMaxLength).optional(),
    name: z.string().min(1, nameRequired).max(255, nameMaxLength).optional(),
    isi_surat: z.string(),
    status: z
      .boolean({
        required_error: statusRequired,
        invalid_type_error: statusRequired,
      })
      .optional(),
  });


  static FIND_BY_UUID = z.object({
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "faskes_uuid tidak valid"}),
    
  })
}
