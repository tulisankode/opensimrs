import { nullable, z } from "zod";
import { codeMaxLength, codeRequired, emailInvalid, emailRequired, nameRequired, phoneRequired, statusRequired, urlInvalid } from "./message-validation-error.js";

export default class OrganizationValidation {
  static CREATE = z.object({
    faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid(),
    organization_ihs_number: z.string({ required_error: "organization_ihs_number tidak boleh kosong" }).max(20, "organization_ihs_number tidak valid"),
    code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255, codeMaxLength),
    name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
    email: z.string({ required_error: emailRequired }).min(1, emailRequired).email(emailInvalid).max(255),
    phone: z.string({ required_error: phoneRequired }).min(1, phoneRequired).max(255),
    url: z.string({ required_error: "URL tidak boleh kosong" }).url(urlInvalid).max(255),
    satu_sehat_id: z.string({ required_error: "satu_sehat_id tidak boleh kosong" }).min(1, "satu_sehat_id tidak valid").max(255, "satu_sehat_id tidak valid").optional().nullable(),
    part_of_uuid: z.string().uuid().optional().nullable(),
    status: z.boolean({ required_error: statusRequired }),
    address: z.object({
      full_address: z.string({required_error: "full_address tidak boleh kosong"}),
      prov: z.string({required_error: "prov tidak boleh kososng"}),
      city: z.string({required_error: "city tidak boleh kososng"}),
      district: z.string({required_error: "district tidak boleh kososng"}),
      rt: z.string().nullable().optional(),
      rw: z.string().nullable().optional(),
      village: z.string({required_error: "vilage tidak boleh kososng"}),
      postal_code: z.string().nullable().optional(),
      country: z.string({required_error: "country tidak boleh kososng"})
    }),
  });

  static IMPORT = z.array(
    z.object({
      uuid: z.string({ required_error: "uuid required" }).uuid({ message: "uuid tidak valid" }),
      faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid(),
      organization_ihs_number: z.string({ required_error: "organization_ihs_number tidak boleh kosong" }).max(20, "organization_ihs_number tidak valid"),
      code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255, codeMaxLength),
      name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
      email: z.string({ required_error: emailRequired }).min(1, emailRequired).email(emailInvalid).max(255),
      phone: z.string({ required_error: phoneRequired }).min(1, phoneRequired).max(255),
      url: z.string({ required_error: "URL tidak boleh kosong" }).max(255),
      status: z.boolean({ required_error: statusRequired }),
      province: z.string({ required_error: "province tidak boleh kosong" }).min(3).max(50),
      kabupaten: z.string({ required_error: "kabupaten tidak boleh kosong" }).min(3).max(50),
      kecamatan: z.string({ required_error: "kecamatan tidak boleh kosong" }).min(3).max(50),
      alamat: z.string({ required_error: "alamat tidak boleh kosong" }).min(3).max(255),
      kode_pos: z.string({ required_error: "kode_pos tidak boleh kosong", invalid_type_error: "kode pos tidak valid" }).max(10),
      part_of_name: z.string().max(255).optional().nullable(),
    })
  );

  static UPDATE = z.object({
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid(),
    organization_ihs_number: z.string().nullable().optional(),
    code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255, codeMaxLength),
    name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
    email: z.string({ required_error: emailRequired }).min(1, emailRequired).email(emailInvalid).max(255),
    phone: z.string({ required_error: phoneRequired }).min(1, phoneRequired).max(255),
    url: z.string({ required_error: "URL tidak boleh kosong" }).url(urlInvalid).max(255),
    status: z.boolean({ required_error: statusRequired }),
    satu_sehat_id: z.string({ required_error: "satu_sehat_id tidak boleh kosong" }).min(1, "satu_sehat_id tidak valid").max(255, "satu_sehat_id tidak valid").optional().nullable(),
    part_of_uuid: z.string().uuid().optional().nullable(),
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

  static CREATE_PART_OF_ORG = z.object({
    faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid(),
    name: z.string({ required_error: "name tidak boleh kosong" }).min(3).max(100),
    code: z.string({ required_error: "code tidak boleh kosong" }).min(1).max(50),
    type: z.string({ required_error: "type tidak boleh kosong" }).min(1).max(50),
    satu_sehat_id: z.string().max(50).nullable().optional(),
    part_of: z.string().optional().nullable(),
  });


  static DELETE = z.object({
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"})
  })

  static FIND_BY_UUID = z.object({
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"})
  })
}
