import { z } from "zod";
import { statusRequired } from "./message-validation-error.js";

export default class ItemGigiValidation {
  static CREATE = z.object({
    kategori_gigi_uuid: z.string({ required_error: "Kategori gigi uuid tidak boleh kosong" }).uuid(),
    system: z.string({ required_error: "System tidak boleh kosong" }).min(1).max(255),
    code: z.string({ required_error: "Code tidak boleh kosong" }).min(1).max(255),
    display: z.string({ required_error: "Display tidak boleh kosong" }).min(1).max(255),
    name: z.string({ required_error: "Name tidak boleh kosong" }).min(1).max(255),
    image: z.string().nullable().optional(),
  });

  static IMPORT = z.array(
    z.object({
      kategori: z.string({ required_error: "Kategori gigi uuid tidak boleh kosong" }),
      system: z.string({ required_error: "System tidak boleh kosong" }).min(1).max(255),
      code: z.string({ required_error: "Code tidak boleh kosong" }).min(1).max(255),
      display: z.string({ required_error: "Display tidak boleh kosong" }).min(1).max(255),
      name: z.string({ required_error: "Name tidak boleh kosong" }).min(1).max(255),
      image: z.string().nullable().optional(),
    })
  );

  static UPDATE = z.object({
    kategori_gigi_uuid: z.string({ required_error: "Kategori gigi uuid tidak boleh kosong" }).uuid().optional(),
    system: z.string({ required_error: "System tidak boleh kosong" }).min(1).max(255).optional(),
    code: z.string({ required_error: "Code tidak boleh kosong" }).min(1).max(255).optional(),
    display: z.string({ required_error: "Display tidak boleh kosong" }).min(1).max(255).optional(),
    name: z.string({ required_error: "Name tidak boleh kosong" }).min(1).max(255).optional(),
    image: z.string().nullable().optional(),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });
}
