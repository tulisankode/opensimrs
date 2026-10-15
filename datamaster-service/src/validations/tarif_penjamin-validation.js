import { z } from "zod";

export default class TarifPenjaminValidation {
  static CREATE = z.object({
    penjamin_uuid: z
      .string({ required_error: "Penjamin uuid tidak boleh kosong" })
      .uuid(),
    harga: z
      .number({ required_error: "Harga tidak boleh kosong" })
      .nullable()
      .optional(),
  });

  static UPDATE = z.object({
    penjamin_uuid: z
      .string({ required_error: "Penjamin uuid tidak boleh kosong" })
      .uuid()
      .optional(),
    harga: z
      .number({ required_error: "Harga tidak boleh kosong" })
      .nullable()
      .optional(),
  });

  static IMPORT = z.array(
    z.object({
      uuid: z.string().uuid({ required_error: "UUID is required" }),
      faskes_uuid: z.string().uuid({ required_error: "Faskes UUID is required" }),
      tarif_uuid: z.string().uuid({ required_error: "Tarif UUID is required" }),
      penjamin_uuid: z.string().uuid({ required_error: "Penjamin UUID is required" }),
      harga: z.number({ required_error: "Harga is required" }),
    })

  )
}
