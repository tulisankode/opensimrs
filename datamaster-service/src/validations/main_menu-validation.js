import { z } from "zod";
import { nameRequired } from "./message-validation-error.js";

export default class MainMenuValidation {
  static CREATE = z.object({
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
  });

  static UPDATE = z.object({
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255)
      .optional(),
  });
}
