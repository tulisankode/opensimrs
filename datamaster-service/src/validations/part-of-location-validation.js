import { z } from "zod";

export class PartOfLocationValidation {
  static CREATE = z.object({
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "faskes_uuid tidak valid"}),
    code: z.string({ required_error: "code tidak boleh kosong" }),
    name: z.string({ required_error: "name tidak boleh kosong" }),
    description: z.string().nullable().optional(),
    location_type: z.string({ required_error: "lcoation_type tidak boleh kosong" }),
    status_operasional: z.string({invalid_type_error: "tipe status_operasional tidak valid"}).nullable().optional(),
    class_code: z.string({invalid_type_error: "tipe class_code tidak valid"}).nullable().optional(),
    class_name: z.string({invalid_type_error: "tipe class_name tidak valid"}).nullable().optional(),
    part_of: z.string({ required_error: "part_of tidak boleh kosong" }),
    part_of_name: z.string().nullable().optional(),
    email: z.string({required_error: "email tidak boleh kosong"}).email({message: "email tidak valid"}),
    phone: z.string({required_error: "phone tidak boleh kosong"}).max(16, "phone tidak valid"),
    url: z.string({ required_error: "url tidak boleh kosong", required_error: "url tidak boleh kosong" }),
    satu_sehat_id: z.string().optional().nullable(),
    organization_ihs_number: z.string({required_error: "organization_ihs_number tidak boleh kosong"}),
    code_antrian_poli: z.string({required_error: "code_antrian poli tidak boleh kosong"}).max(15, "code_antrian_poli tidak boleh lebih dari 15 karakter").nullable().optional(),
    is_poli: z.boolean({required_error: "status tidak boleh kosong"}),
    status: z.boolean({required_error: "status tidak boleh kosong"}),
  }).refine(v => {
    console.log(v.is_poli)
    if(v.is_poli == true){
      if(v.code_antrian_poli == null || v.code_antrian_poli == undefined){
        return false
      }
      return true;
    }
    return true;
  }, { message: "code_antrian_poli tidak boleh kosong", path: ["code_antrian_poli"]});


  static UPDATE = z.object({
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "faskes_uuid tidak valid"}),
    code: z.string({ required_error: "code tidak boleh kosong" }),
    name: z.string({ required_error: "name tidak boleh kosong" }),
    location_type: z.string({ required_error: "lcoation_type tidak boleh kosong" }),
    status_operasional: z.string({invalid_type_error: "tipe status_operasional tidak valid"}).nullable().optional(),
    class_code: z.string({invalid_type_error: "tipe class_code tidak valid"}).nullable().optional(),
    class_name: z.string({invalid_type_error: "tipe class_name tidak valid"}).nullable().optional(),
    part_of: z.string({ required_error: "part_of tidak boleh kosong" }),
    url: z.string({ required_error: "url tidak boleh kosong", required_error: "url tidak boleh kosong" }),
    satu_sehat_id: z.string().optional().nullable(),
    organization_ihs_number: z.string({required_error: "organization_ihs_number tidak boleh kosong"}),
    code_antrian_poli: z.string({required_error: "code_antrian poli tidak boleh kosong"}).max(15, "code_antrian_poli tidak boleh lebih dari 15 karakter").nullable().optional(),
    is_poli: z.boolean({required_error: "status tidak boleh kosong"}),
    status: z.boolean({required_error: "status tidak boleh kosong"}),
  }).refine(v => {
    if(v.is_poli == true){
      if(v.code_antrian_poli == null || v.code_antrian_poli == undefined){
        return false
      }
      return true;
    }
    return true;
  }, { message: "code_antrian_poli tidak boleh kosong", path: ["code_antrian_poli"] });
}
