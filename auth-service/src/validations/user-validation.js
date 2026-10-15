import { string, z } from "zod";
import { emailRequired, faskesUuidRequired, nameRequired, passwordRequired, phoneRequired, roleRequired, usernameRequired, uuidRequired } from "./message-validation-error.js";

export default class UserValidation {

  static #PERMISSIONS = z.array(z.object({
    module: z.string(),
    subModules: z.array(z.union([
      z.object({
        name: z.string(),
        allows: z.array(z.string())
      }),
      
      z.object({
        name: z.string(),
        features: z.array(z.object({
          name: z.string(),
          allows: z.array(z.string())
          
        }))
      })
    ]))
  }))

  static CREATE = z.object({
    faskesUuid: z.string().min(1).optional(),
    roleUuid: z.string(),
    practitionerUuid: z.string().min(1, "practitioner uuid tidak boleh kosong").optional(),
    permissions: this.#PERMISSIONS,
    phone: z.string().min(1, phoneRequired),
    email: z.string().email().min(1, emailRequired),
    username: z.string().min(1, usernameRequired),
    password: z.string().min(1, passwordRequired),
    status: z.boolean(),
  });

  static UPDATE = z.object({
    roleUuid: z.string().min(1, roleRequired),
    practitionerUuid: z.string().min(1, "uuid praktisioner tidak boleh kosong").optional(),
    phone: z.string().min(1, phoneRequired),
    email: z.string().email().min(1, emailRequired),
    username: z.string().min(1, usernameRequired),
    password: z.string().min(1, passwordRequired).optional(),
    confirmPassword: z.string().min(1, "konfirmasi password tidak boleh kosong").optional(),
    status: z.boolean(),
  }).refine(
    (ctx) => ctx.password === ctx.confirmPassword, { message: "konfirmasi password harus sama dengan password", path: ["confirmPassword"] }
  );

  static UPDATE_PASSWORD = z.object({
    uuid: z.string().min(1, uuidRequired),
    newPassword: z.string().min(1, passwordRequired),
  });

  static DELETE = z.string();

  static IMPORT_USER = z.array(
    z.object({
      faskesUuid: z.string().min(1).optional(),
      roleUuid: z.string(),
      practitionerUuid: z.string().min(1, "practitioner uuid tidak boleh kosong").optional(),
      permissions: string().min(1).optional(),
      email: z.string().email().min(1, emailRequired),
      username: z.string().min(1, usernameRequired),
      password: z.string().min(1, passwordRequired),
      status: z.boolean(),
    })
  );
  static IMPORT_PRACTITOR = z.array(
    z.object({
      faskes_uuid: z.string().min(1, faskesUuidRequired),
      pegawai_uuid: z.string().min(1, "uuid pegawai tidak boleh kosong"),
      is_doctor: z.boolean(),
      code_bpjs: z.string().min(1, "kode bpjs tidak boleh kosong").nullable(),
      sip: z.string().min(1, "sip tidak boleh kosong"),
      str: z.string().min(1, "str tidak boleh kosong"),
      code_antrian_dokter: z.string().min(1, "code antrian dokter tidak boleh kosong"),
    })
  );

  static IMPORT_PEGAWAI = z.array(
    z.object({
      name: z
      .string({ required_error: nameRequired })
      .min(1, nameRequired)
      .max(255),
    nik: z
      .string({ required_error: "NIK tidak boleh kosong" })
      .min(1, "NIK Required")
      .max(255),
    tipe: z
      .number({
        required_error: "Tipe tidak boleh kosong",
      })
      .int(),
    first_title: z.string().max(25, "first_title tidak boleh lebih dari 25 karakter").optional().nullable(),
    last_title: z.string().max(25, "last_title tidak boleh lebih dari 25 karakter").optional().nullable(),
    tanggal_lahir: z.date({
      required_error: "Tanggal Lahir tidak boleh kosong",
    }),
    gender: z
      .enum(["Laki-laki", "Perempuan"], {message: "gender tidak valid"}),
    status: z.boolean({ required_error: "status tidak boleh kosong" }),
    })
  )
}
