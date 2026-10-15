import { string, z } from "zod";

export default class LokasiValidation {
  static FIND_BY_CODE = z.object({
    code: z
      .string({ required_error: "Kode tidak boleh kosong" })
      .min(1, "Kode diperlukan")
      .max(255),
    faskes_uuid: z
      .string({ required_error: "faskes_uuid tidak boleh kosong" })
      .uuid({ message: "faskes_uuid tidak valid" }),
  });

  static IMPORT = z.array(
    z.object({
      code: z.string().min(1, "Kode diperlukan").max(255),
      faskes_uuid: z
        .string({ required_error: "faskes_uuid tidak boleh kosong" })
        .uuid({ message: "uuid tidak valid" }),
      name: z.string().min(1, "Nama diperlukan").max(255),
      is_poli: z.boolean({
        required_error: "Status poli tidak boleh kosong",
        invalid_type_error: "Status poli harus berupa boolean",
      }),
      code_antrian_poli: z.string().max(255).optional().nullable(),
      description: z.string().min(1, "Deskripsi diperlukan").max(255),
      phone: z.string().min(1, "Nomor telepon diperlukan").max(100),
      email: z
        .string()
        .min(1, "Email diperlukan")
        .email("Format email tidak valid"),
      url: z.string({ required_error: "url tidak boleh kosong" }),
      organization_ihs_number: z.string({
        required_error: "organization_ihs_number tidak boleh kosong",
      }),
      location_type: z
        .string({ required_error: "type tidak boleh kosong" })
        .min(1, "Tipe lokasi diperlukan")
        .max(255),
      class_code: z
        .string()
        .min(1, "Kode kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      class_name: z
        .string()
        .min(1, "Nama kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      part_of_uuid: z.string().optional().nullable(),
      pelayanan: z.string().optional().nullable(),
      no_room: z.number().optional().nullable(),
      kategori_ruangan_uuid: z
        .string()
        .uuid({ message: "uuid tidak valid" })
        .optional()
        .nullable(),
      status: z.boolean({ required_error: "Status diperlukan" }),
    })
  );

  static CREATE = z
    .object({
      faskes_uuid: z
        .string({ required_error: "faskes_uuid tidak boleh kosong" })
        .uuid(),
      code: z
        .string({ required_error: "code tidak boeleh kosong" })
        .min(1, "Kode diperlukan")
        .max(255),
      name: z
        .string({ required_error: "name tidak boleh kosong" })
        .min(1, "Nama diperlukan")
        .max(255),
      description: z
        .string({ required_error: "description tidak boleh kosong" })
        .min(1, "Deskripsi diperlukan")
        .max(255),
      phone: z
        .string({ required_error: "phone tidak boleh kosong" })
        .min(1, "Nomor telepon diperlukan")
        .max(100),
      email: z
        .string({ required_error: "email tidak boleh kosong" })
        .min(1, "Email diperlukan")
        .email("Format email tidak valid"),
      url: z
        .string({ required_error: "url tidak boleh kosong" })
        .url("URL tidak valid"),
      satu_sehat_id: z.string().optional().nullable(),
      organization_ihs_number: z
        .string({
          required_error: "organization_ihs_number tidak boleh kosong",
        })
        .max(20, "organization_ihs_number tidak valid"),
      location_type: z
        .string({ required_error: "location_type tidak boleh kosong" })
        .min(1, "Tipe lokasi diperlukan")
        .max(255),
      part_of_uuid: z.string().optional().nullable(),
      part_of: z.string().optional().nullable(),
      pelayanan: z.string().optional().nullable(),
      no_room: z.number().optional().nullable(),
      kategori_ruangan_uuid: z
        .string()
        .uuid({ message: "uuid tidak valid" })
        .optional()
        .nullable(),
      class_code: z
        .string()
        .min(1, "Kode kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      class_name: z
        .string()
        .min(1, "Nama kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      code_antrian_poli: z.string().max(255).optional().nullable(),
      is_poli: z.boolean({
        required_error: "Status poli tidak boleh kosong",
        invalid_type_error: "Status poli harus berupa boolean",
      }),
      status: z.boolean({ required_error: "Status diperlukan" }),
    })
    .refine(
      (data) => {
        if (data.is_poli === true) {
          return (
            data.code_antrian_poli != null && data.code_antrian_poli !== ""
          );
        }
        return true;
      },
      {
        message: "Kode antrian poli diperlukan ketika is_poli bernilai true",
        path: ["code_antrian_poli"],
      }
    );

  static CREATE_WITH_IS_POLI_FALSE = z
    .object({
      code: z.string().min(1, "Kode diperlukan").max(255),
      name: z.string().min(1, "Nama diperlukan").max(255),
      is_poli: z.boolean({
        required_error: "Status poli tidak boleh kosong",
        invalid_type_error: "Status poli harus berupa boolean",
      }),
      code_antrian_poli: z.string().max(255).optional().nullable(),
      description: z.string().min(1, "Deskripsi diperlukan").max(255),
      phone: z.string().min(1, "Nomor telepon diperlukan").max(100),
      email: z
        .string()
        .min(1, "Email diperlukan")
        .email("Format email tidak valid"),
      url: z.string().url("URL tidak valid"),
      org_id: z
        .string("UUID Organisasi diperlukan")
        .max(255)
        .optional()
        .nullable(),
      location_type: z.string().min(1, "Tipe lokasi diperlukan").max(255),
      class_code: z
        .string()
        .min(1, "Kode kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      class_name: z
        .string()
        .min(1, "Nama kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      part_of: z.string().uuid().optional().nullable(),
      status: z.boolean({ required_error: "Status diperlukan" }),
    })
    .refine(
      (data) => {
        if (data.is_poli === true) {
          return (
            data.code_antrian_poli != null && data.code_antrian_poli !== ""
          );
        }
        return true;
      },
      {
        message: "Kode antrian poli diperlukan ketika is_poli bernilai true",
        path: ["code_antrian_poli"],
      }
    );

  static CREATE_WITH_IS_POLI_TRUE = z
    .object({
      code: z.string().min(1, "Kode diperlukan").max(255),
      name: z.string().min(1, "Nama diperlukan").max(255),
      is_poli: z.boolean({
        required_error: "Status poli tidak boleh kosong",
        invalid_type_error: "Status poli harus berupa boolean",
      }),
      code_antrian_poli: z
        .string({ required_error: "code_antrian_poli tidak boleh kosong" })
        .max(255),
      description: z.string().min(1, "Deskripsi diperlukan").max(255),
      phone: z.string().min(1, "Nomor telepon diperlukan").max(100),
      email: z
        .string()
        .min(1, "Email diperlukan")
        .email("Format email tidak valid"),
      url: z.string().url("URL tidak valid"),
      org_id: z
        .string("UUID Organisasi diperlukan")
        .max(255)
        .optional()
        .nullable(),
      location_type: z.string().min(1, "Tipe lokasi diperlukan").max(255),
      class_code: z
        .string()
        .min(1, "Kode kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      class_name: z
        .string()
        .min(1, "Nama kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      part_of: z.string().uuid().optional().nullable(),
      status: z.boolean({ required_error: "Status diperlukan" }),
    })
    .refine(
      (data) => {
        if (data.is_poli === true) {
          return (
            data.code_antrian_poli != null && data.code_antrian_poli !== ""
          );
        }
        return true;
      },
      {
        message: "Kode antrian poli diperlukan ketika is_poli bernilai true",
        path: ["code_antrian_poli"],
      }
    );

  static UPDATE = z
    .object({
      faskes_uuid: z
        .string({ required_error: "faskes_uuid tidak boleh kosong" })
        .uuid({ message: "uuid tidak valid" }),
      uuid: z
        .string({ required_error: "uuid tidak boleh kosong" })
        .uuid({ message: "uuid tidak valid" }),
      code: z.string().min(1, "Kode diperlukan").max(255).optional(),
      name: z.string().min(1, "Nama diperlukan").max(255).optional(),
      description: z.string({ required_error: "deskripsi tidak boleh kosong" }),
      phone: z.string().min(1, "Nomor telepon diperlukan").max(100).optional(),
      email: z
        .string()
        .min(1, "Email diperlukan")
        .email("Format email tidak valid")
        .optional(),
      url: z.string().url("URL tidak valid").optional().nullable(),
      location_type: z.string({
        required_error: "location_type tidak boleh kosong",
      }),
      class_code: z
        .string()
        .min(1, "Kode kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      class_name: z
        .string()
        .min(1, "Nama kelas diperlukan")
        .max(255)
        .optional()
        .nullable(),
      code_antrian_poli: z.string().max(255).optional().nullable(),
      part_of_uuid: z.string().optional().nullable(),
      pelayanan: z.string().optional().nullable(),
      no_room: z.number().optional().nullable(),
      kategori_ruangan_uuid: z
        .string()
        .uuid({ message: "uuid tidak valid" })
        .optional()
        .nullable(),
      is_poli: z
        .boolean({
          required_error: "Status poli tidak boleh kosong",
          invalid_type_error: "Status poli harus berupa boolean",
        })
        .optional(),
      status: z.boolean({ required_error: "Status diperlukan" }).optional(),
    })
    .refine(
      (data) => {
        if (data.is_poli === true) {
          return (
            data.code_antrian_poli != null && data.code_antrian_poli !== ""
          );
        }
        return true;
      },
      {
        message: "Kode antrian poli diperlukan ketika is_poli bernilai true",
        path: ["code_antrian_poli"],
      }
    );
}
