import { z } from "zod";
import { codeRequired, nameRequired, statusRequired } from "./message-validation-error.js";

export default class VoucherValidation {
  static CREATE = z.object({
    code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255),
    name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
    qty: z.number().int(),
    using: z.number().int().nullable().optional(),
    start_date: z.number({ required_error: "Start date tidak boleh kosong" }).int(),
    end_date: z.number({ required_error: "End date tidak boleh kosong" }).int(),
    type: z.string({ required_error: "Type tidak boleh kosong" }).min(1).max(255),
    value: z.number({ required_error: "Value tidak boleh kosong" }),
    status: z.boolean({ required_error: statusRequired }),
  });

  static IMPORT = z.array(
    z.object({
      uuid: z.string({ required_error: "uuid tidak boleh blank" }).uuid({ message: "uuid tidak valid" }),
      faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh blank" }).uuid({ message: "faskes_uuid tidak valid" }),
      code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255),
      name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
      qty: z.number({required_error: "qty tidak boleh kosong", invalid_type_error: "qty harus angka"}).int(),
      using: z.number().int().nullable().optional(),
      start_date: z.string({ required_error: "start_date tidak boleh kosong" }).regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: "Format start_date harus YYYY-MM-DD",
      }),
      end_date: z.string({ required_error: "end_date tidak boleh kosong" }).regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: "Format end_date harus YYYY-MM-DD",
      }),
      type: z.string({ required_error: "Type tidak boleh kosong" }).min(1).max(255),
      value: z.number({ required_error: "Value tidak boleh kosong" }),
      status: z.boolean({ required_error: statusRequired }),
    })
  );

  static UPDATE = z.object({
    code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255).optional(),
    name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255).optional(),
    qty: z.number().int().optional(),
    start_date: z.number({ required_error: "Start date tidak boleh kosong" }).int().optional(),
    end_date: z.number({ required_error: "End date tidak boleh kosong" }).int().optional(),
    type: z.string({ required_error: "Type tidak boleh kosong" }).min(1).max(255).optional(),
    using: z.number().int().nullable().optional(),
    value: z.number({ required_error: "Value tidak boleh kosong" }).optional(),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });
}
