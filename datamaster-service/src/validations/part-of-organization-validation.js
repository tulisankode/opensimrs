import { z } from "zod";

export class PartOfOrganizationValidation {
  static CREATE = z.object({
    faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid({ message: "uuid tidak valid" }),
    code: z.string({ message: "code tidak boleh kosong" }),
    name: z.string({ message: "name tidak boleh kosong" }),
    part_of: z.string().optional().nullable(),
    satu_sehat_id: z.string({ message: "satu_sehat_id tidak boleh kosong" }).optional().nullable(),
    phone: z.string({ message: "phone tidak boleh kosong" }),
    email: z.string({ message: "email tidak boleh kosong" }),
    url: z.string({ message: "url tidak boleh kosong" }),
    organization_ihs_number: z.string({required_error: "organization_ihs_number tidak boleh kosong"}),
    address: z.object({
      full_address: z.string(),
      prov: z.string(),
      city: z.string(),
      district: z.string(),
      rt: z.string().nullable().optional(),
      rw: z.string().nullable().optional(),
      village: z.string(),
      postal_code: z.string().nullable().optional(),
      country: z.string()
    })
  });

  static UPDATE = z.object({
    uuid: z.string({ required_error: "uuid tidak boleh kosong" }).uuid({ message: "uuid tidak valid" }),
    faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid({ message: "faskes_uuid tidak valid" }),
    code: z.string({ message: "code tidak boleh kosong" }),
    name: z.string({ message: "name tidak boleh kosong" }),
    part_of: z.string().optional().nullable(),
    phone: z.string({ message: "phone tidak boleh kosong" }),
    email: z.string({ message: "email tidak boleh kosong" }),
    url: z.string({ message: "url tidak boleh kosong" }),
    satu_sehat_id: z.string().nullable().optional(),
    address: z.object({
      full_address: z.string(),
      prov: z.string(),
      city: z.string(),
      district: z.string(),
      rt: z.string().nullable().optional(),
      rw: z.string().nullable().optional(),
      village: z.string(),
      postal_code: z.string().nullable().optional(),
      country: z.string()
    })
  });
}
