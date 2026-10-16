import { z } from "zod";

export default class RujukanValidation {
  static TANDAI = z.object({
    lab_rujukan_uuid: z
      .string({
        required_error: "Data gagal disimpan, Laboratorium rujukan harus diisi",
        invalid_type_error: "Data gagal disimpan, Laboratorium rujukan harus bernilai string",
      })
      .min(1, {
        message: "Data gagal disimpan, Laboratorium rujukan harus diisi",
      })
      .max(255),
    catatan_rujukan: z.string().max(255).optional().nullable(),
    faskes_uuid: z.string().min(1).max(255),
  });
}
