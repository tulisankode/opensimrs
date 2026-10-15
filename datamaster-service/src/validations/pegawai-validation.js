import { z } from "zod";
import {
  nameRequired,
  statusRequired,
  titleInvalid,
} from "./message-validation-error.js";
import { PegawaiModel } from "@opensimrs/model-sdk/datamaster";
PegawaiModel

export default class PegawaiValidation {
  static CREATE = z.object({
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    nik: z
      .string({ required_error: "NIK tidak boleh kosong" })
      .min(1, "NIK Required")
      .max(255),
    tipe: z
      .number({
        required_error: "Tipe tidak boleh kosong",
      })
      .int(),
    first_title: z.string().max(25, titleInvalid).optional().nullable(),
    last_title: z.string().max(25, titleInvalid).optional().nullable(),
    tanggal_lahir: z.date({
      required_error: "Tanggal Lahir tidak boleh kosong",
    }),
    gender: z.enum(["Laki-laki", "Perempuan"], {invalid_type_error: "gender tidak valid", required_error: "gender tidak boleh kosong"}),
    status: z.boolean({ required_error: statusRequired }),
  });

  static IMPORT = z.array(this.CREATE);

  static UPDATE = z.object({
    name: z.string().min(1, nameRequired).max(255).optional(),
    nik: z.string().min(1, "NIK Required").max(255).optional(),
    tipe: z.number().int().optional(),
    first_title: z.string().max(25, titleInvalid).optional().nullable(),
    last_title: z.string().max(25, titleInvalid).optional().nullable(),
    tanggal_lahir: z.date("Tanggal Lahir Required").optional(),
    gender: z.string().min(1, "Gender Required").max(15).optional(),
    status: z.boolean(statusRequired).optional(),
  });
}
