import { z } from "zod";

import { codeRequired, nameRequired, statusRequired, codeMaxLength, nameMaxLength } from "./message-validation-error.js";

export default class RoleValidation {

  static #PERMISSION = z.array(
    z.object({
      module: z.string({ required_error: "modul tidak boleh kosong" }),
      sub_modules: z.array(
        z.union([
          z.object({
            name: z.string({ required_error: "nama tidak boleh kosong" }),
            allows: z.array(z.string({ invalid_type_error: "allows tidak valid" })),
          }),

          z.object({
            name: z.string({ required_error: "nama fitur tidak boleh kosong" }),
            features: z.array([
              z.object({
                name: z.string({ required_error: "name tidak boleh kosong" }),
                allows: z.array(z.string({ invalid_type_error: "allows tidak valid" })),
              }),
            ]),
          }),
        ])
      ),
    })
  )

  static CREATE = z.object({
    code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255, codeMaxLength),
    name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255, nameMaxLength),
    status: z.boolean({ required_error: statusRequired }),
    permissions: this.#PERMISSION,
  }).refine(v => v.permissions.length !== 0, {message: "permissions tidak boleh kosong", path: ["permissions"]});

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255, codeMaxLength).optional(),
    name: z.string().min(1, nameRequired).max(255, nameMaxLength).optional(),
    status: z
      .boolean({
        invalid_type_error: statusRequired,
      })
      .optional(),
    permissions: z.string().nullable().optional(),
  });
}
