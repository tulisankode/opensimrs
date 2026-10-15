import { z } from "zod";

export default class FaskesValidation {
  static CREATE = z.object({
    code: z.string(),
    name: z.string(),
    status: z.boolean(),
  });

  static UPDATE = z.object({
    uuid: z.string(),
    code: z.string(),
    name: z.string(),
    status: z.boolean(),
  });

  static FIND = z.string();

  static DELETE = z.string()
}
