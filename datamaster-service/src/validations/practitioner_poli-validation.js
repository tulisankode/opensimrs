import { z } from "zod";
import { statusRequired } from "./message-validation-error.js";

export default class PractitionerPoliValidation {
  static CREATE = z.object({
    practitioner_uuid: z
      .string({ required_error: "Practitioner UUID tidak boleh kosong" })
      .uuid(),
    location_uuid: z
      .string({ required_error: "Location UUID tidak boleh kosong" })
      .uuid(),
    status: z.boolean({ required_error: statusRequired }),
  });

  static UPDATE = z.object({
    practitioner_uuid: z
      .string({ required_error: "Practitioner UUID tidak boleh kosong" })
      .uuid()
      .optional(),
    location_uuid: z
      .string({ required_error: "Location UUID tidak boleh kosong" })
      .uuid()
      .optional(),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });
}
