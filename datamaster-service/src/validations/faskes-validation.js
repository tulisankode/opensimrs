import { z } from "zod";
import {
  codeRequired,
  nameRequired,
  statusRequired,
} from "./message-validation-error.js";

export default class FaskesValidation {
  static CREATE = z.object({
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    organization_ihs_number: z
      .string({ required_error: "organization_ihs_number tidak boleh kosong" })
      .min(1, "organization_ihs_number tidak valid"),
    client_id: z
      .string({ required_error: "client_id tidak boleh kosong" })
      .min(1, "client_id tidak valid"),
    client_secret: z
      .string({ required_error: "client_secret tidak boleh kosong" })
      .min(1, "client_secret tidak valid"),
    status: z.boolean({ required_error: statusRequired }),
  });

  static IMPORT = z.array(this.CREATE);

  static UPDATE = z.object({
    uuid: z
      .string({ required_error: "uuid tidak boleh kosong" })
      .uuid({ message: "uuid tidak valid" }),
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    organization_ihs_number: z
      .string({ required_error: "organization_ihs_number tidak boleh kosong" })
      .min(1, "organization_ihs_number tidak valid"),
    client_id: z
      .string({ required_error: "client_id tidak boleh kosong" })
      .min(1, "client_id tidak valid"),
    client_secret: z
      .string({ required_error: "client_secret tidak boleh kosong" })
      .min(1, "client_secret tidak valid"),
    status: z.boolean({ required_error: statusRequired }),
  });

  static FIND_BY_UUID = z.object({
    uuid: z
      .string({ required_error: "uuid tidak boleh kosong" })
      .uuid({ message: "uuid tidak valid" }),
  });
}
