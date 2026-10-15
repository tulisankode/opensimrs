import { z } from "zod";

export default class TarifPelayananValidation {
  static CREATE = z.object({
    tarif_uuid: z
      .string({ required_error: "Tarif uuid tidak boleh kosong" })
      .uuid(),
    unit_pelayanan: z
      .number({ required_error: "Unit pelayanan tidak boleh kosong" })
      .int(),
  });

  static UPDATE = z.object({
    tarif_uuid: z
      .string({ required_error: "Tarif uuid tidak boleh kosong" })
      .uuid()
      .optional(),
    unit_pelayanan: z
      .number({ required_error: "Unit pelayanan tidak boleh kosong" })
      .int()
      .optional(),
  });

  static IMPORT = z.array(
    z.object({
      uuid: z.string().uuid({ required_error: "UUID is required" }),
      tarif_uuid: z.string().uuid({ required_error: "Tarif UUID is required" }),
      faskes_uuid: z.string().uuid({ required_error: "Faskes UUID is required" }),
      unit_pelayanan: z.number({ required_error: "Unit pelayanan is required" }),
    })
  );
}
