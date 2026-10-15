import { z } from "zod";

export default class TarifRuanganValidation {
  static CREATE = z.object({
    tarif_uuid: z
      .string({ required_error: "Tarif uuid tidak boleh kosong" })
      .uuid(),
    ruangan_uuid: z
      .string({ required_error: "Ruangan uuid tidak boleh kosong" })
      .uuid(),
  });

  static UPDATE = z.object({
    tarif_uuid: z
      .string({ required_error: "Tarif uuid tidak boleh kosong" })
      .uuid()
      .optional(),
    ruangan_uuid: z
      .string({ required_error: "Ruangan uuid tidak boleh kosong" })
      .uuid()
      .optional(),
  });
}
