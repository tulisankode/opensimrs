import { z } from "zod";
import { nameRequired } from "./message-validation-error.js";

export default class SubMenuValidation {
  static CREATE = z.object({
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    main_menu_id: z
      .number({ required_error: "Main menu uuid tidak boleh kosong" })
      .min(1, nameRequired)
      .max(255),
  });

  static UPDATE = z.object({
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255)
      .optional(),
    main_menu_id: z.number().min(1, nameRequired).max(255).optional(),
  });
}
