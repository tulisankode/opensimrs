import { string, z } from "zod";
import { emailRequired, faskesUuidRequired, nameRequired, passwordRequired, phoneRequired, roleRequired, usernameRequired, uuidRequired } from "./user-validation-message-error.js";
import { invalidMessage, requiredMessage } from "../helpers/generate-message.js";

export default class UserValidation {
  static #PERMISSIONS = z.array(
    z.object({
      module: z.string(),
      sub_modules: z.array(
        z.union([
          z.object({
            name: z.string(),
            allows: z.array(z.string()),
          }),

          z.object({
            name: z.string(),
            features: z.array(
              z.object({
                name: z.string(),
                allows: z.array(z.string()),
              })
            ),
          }),
        ])
      ),
    })
  );

  static CREATE = z.object({
    faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid({ message: "faskes uuid tidak valid" }),
    role_uuid: z.string({ required_error: "role_uuid tidak boleh kosong" }).uuid({ message: "role uuid tidak valid" }),
    practitioner_uuid: z.string({ required_error: "practitioner uuid tidak boleh kosong" }).min(1, "practitioner uuid tidak boleh kosong"),
    permissions: this.#PERMISSIONS,
    phone: z.string({required_error: "phone tidak boleh kosong"}).min(1, phoneRequired),
    email: z.string({required_error: "email tidak boleh kosong"}).email({message: "email tidak valid"}).min(1, emailRequired),
    username: z.string({required_error: "email tidak valid"}).min(1, usernameRequired),
    password: z
      .string({required_error: "password tidak boleh kosong"})
      .min(8, "password minimal harus 8 karakter")
      .regex(/\d/, "password harus mengandung setidaknya satu angka")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "password harus mengandung setidaknya satu karakter spesial"),
    status: z.boolean({required_error: requiredMessage("status")}),
  });

  static UPDATE = z
    .object({
      user_uuid: z.string({ required_error: "user_uuid tidak boleh kosong" }).min(1, uuidRequired),
      role_uuid: z.string({ required_error: roleRequired }).min(1, roleRequired),
      faskes_uuid: z.string({ required_error: faskesUuidRequired }).min(1, faskesUuidRequired),
      practitioner_uuid: z.string().min(1, "uuid praktisioner tidak boleh kosong").optional(),
      phone: z.string({required_error: requiredMessage("phone")}).min(1, phoneRequired),
      email: z.string({required_error: requiredMessage("email")}).email({message: invalidMessage("email")}).min(1, emailRequired),
      username: z.string({required_error: requiredMessage("username")}).min(1, usernameRequired),
      password: z.string().optional().nullable(),
      confirm_password: z.string().optional().nullable(),
      status: z.boolean({required_error: requiredMessage("status")}),
    })
    .superRefine((data, ctx) => {
      const password = data.password ?? "";
      const confirmPassword = data.confirm_password ?? "";
      if (password) {
        if (password.length < 8) {
          ctx.addIssue({
            path: ["password"],
            message: "password minimal harus 8 karakter",
            code: z.ZodIssueCode.custom,
          });
        }

        if (!/\d/.test(password)) {
          ctx.addIssue({
            path: ["password"],
            message: "password harus mengandung setidaknya satu angka",
            code: z.ZodIssueCode.custom,
          });
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
          ctx.addIssue({
            path: ["password"],
            message: "password harus mengandung setidaknya satu karakter spesial",
            code: z.ZodIssueCode.custom,
          });
        }

        // Validasi konfirmasi password
        if (password !== confirmPassword) {
          ctx.addIssue({
            path: ["confirm_password"],
            message: "konfirmasi password harus sama dengan password",
            code: z.ZodIssueCode.custom,
          });
        }
      }
    });

  static UPDATE_PASSWORD = z.object({
    uuid: z.string({ required_error: uuidRequired }).min(1, uuidRequired),
    faskesUuid: z.string({ required_error: faskesUuidRequired }).min(1, faskesUuidRequired),
    new_password: z
      .string({ required_error: faskesUuidRequired })
      .min(8, "pasword minimal harus 8 karakter")
      .regex(/\d/, "password harus mengandung setidaknya satu angka")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "password harus mengandung setidaknya satu karakter spesial"),
  });

  static DELETE = z.object({
    uuid: z.string({ required_error: uuidRequired }).min(1, uuidRequired),
    faskesUuid: z.string({ required_error: faskesUuidRequired }).min(1, faskesUuidRequired),
  });

  static IMPORT_USER = z.array(
    z.object({
        faskesUuid: z.string({required_error: requiredMessage("faskes_uuid")}).min(1).optional(),
        roleUuid: z.string({required_error: requiredMessage("role_uuid")}),
        practitionerUuid: z.string().min(1, "practitioner uuid tidak boleh kosong").optional(),
        permissions: z.string().min(1).optional(),
        email: z.string({required_error: requiredMessage("email")}).email({message: requiredMessage("email")}).min(1, emailRequired),
        username: z.string({required_error: requiredMessage("username")}).min(1, usernameRequired),
        password: z.string({required_error: requiredMessage("password")}).min(1, "password tidak boleh kosong"),
        status: z.boolean({required_error: requiredMessage("status")}),
      })
      .superRefine((data, ctx) => {
        const password = data.password?.trim();

        // Jangan validasi jika kosong (akan ditangani oleh .min(1) di atas)
        if (!password) return;

        if (password.length < 8) {
          ctx.addIssue({
            path: ["password"],
            code: z.ZodIssueCode.custom,
            message: "password minimal harus 8 karakter",
          });
        }

        if (!/\d/.test(password)) {
          ctx.addIssue({
            path: ["password"],
            code: z.ZodIssueCode.custom,
            message: "password harus mengandung setidaknya satu angka",
          });
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
          ctx.addIssue({
            path: ["password"],
            code: z.ZodIssueCode.custom,
            message: "password harus mengandung setidaknya satu karakter spesial",
          });
        }
      })
  );

  
  static IMPORT_PRACTITOR = z.array(
    z.object({
      faskes_uuid: z.string({required_error: requiredMessage("faskes_uuid")}).min(1, faskesUuidRequired),
      pegawai_uuid: z.string({required_error: requiredMessage("pegawai_uuid")}).min(1, "uuid pegawai tidak boleh kosong"),
      is_doctor: z.boolean({ required_error: "is_doctor tidak boleh kosong", invalid_type_error: "is_doctor harus boolean" }),
      code_bpjs: z.string().min(1, "kode bpjs tidak boleh kosong").nullable(),
      sip: z.string({required_error: requiredMessage("sip")}).min(1, "sip tidak boleh kosong"),
      str: z.string({required_error: requiredMessage("str")}).min(1, "str tidak boleh kosong"),
      code_antrian_dokter: z.string().min(1, "code antrian dokter tidak boleh kosong").optional().nullable(),
    })
  );

  static IMPORT_PEGAWAI = z.array(
    z.object({
      name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255),
      nik: z.string({ required_error: "NIK tidak boleh kosong" }).min(1, "NIK Required").max(255),
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
      gender: z.enum(["Laki-laki", "Perempuan"], { message: "gender tidak valid" }),
      status: z.boolean({ required_error: "status tidak boleh kosong" }),
    })
  );

  static FIND_BY_UUID = z.object({
    uuid: z.string({ required_error: uuidRequired }).min(1, uuidRequired),
    faskesUuid: z.string({ required_error: faskesUuidRequired }).min(1, faskesUuidRequired),
  });
}
