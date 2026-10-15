import { z } from "zod";

const jenisTarifRequired = "Jenis tarif required";
const codeRequired = "Code required";
const nameRequired = "Name required";
const statusRequired = "Status required";
const unitPelayananRequired = "Unit pelayanan tidak boleh kosong";
const penjaminRequired = "Penjamin required";
const tindakanRequired = "Tindakan required";
const listKomponenTarifRequired = "List komponen tarif required";
const nameTarifKomponenUidRequired = "Name tarif komponen uid required";
const tarifPerKomponenRequired = "Tarif per komponen required";

export default class TarifValidation {
  static IMPORT = z.array(
    z.object({
      uuid: z.string().uuid({ required_error: "UUID is required" }),
      faskes_uuid: z
        .string()
        .uuid({ required_error: "Faskes UUID is required" }),
      jenis_tarif: z
        .string({ required_error: jenisTarifRequired })
        .min(1, jenisTarifRequired)
        .max(255),
      code: z
        .string({ required_error: codeRequired })
        .min(1, codeRequired)
        .max(255),
      name: z.string().max(255),
      grand_total: z.number("Grand total required"),
      mode: z.enum(["Single", "Multiple"], {
        message: "mode tidak valid",
        required_error: "Mode required",
      }),
      is_mcu: z.boolean({ message: "is_mcu tidak valid" }),
      status: z.boolean(statusRequired),
    })
  );

  static IMPORT_TARIF_KOMPONEN_TINDAKAN_POLI = z.array(
    z.object({
      uuid: z.string().uuid({ required_error: "UUID is required" }),
      faskes_uuid: z
        .string()
        .uuid({ required_error: "Faskes UUID is required" }),
      tarif_uuid: z.string().uuid({ required_error: "Tarif UUID is required" }),
      tindakan_uuid: z
        .string({ required_error: "Tindakan UUID is required" })
        .uuid({ required_error: "Tindakan UUID is required" }),
      persen_per_komponen: z.number({
        required_error: "Persen per komponen tidak boleh kosong",
      }),
      tarif_uuid: z
        .string({ required_error: "Tarif UUID is required" })
        .uuid({ required_error: "Tarif UUID is required" }),
      tarif_per_komponen: z.number({
        required_error: "Tarif per komponen tidak boleh kosong",
      }),
      presentase: z.boolean({
        required_error: "Presentase tidak boleh kosong",
      }),
    })
  );

  static #LIST_TINDAKAN_POLI = z.array(
    z.union([
      z.object({
        tindakan_uuid: z
          .string({ required_error: "tindakan uuid tidak boleh kosong" })
          .uuid({ message: "uuid tidak valid" }),
        komponen_tarif: z
          .array(
            z.object({
              tarif_komponen_uuid: z
                .string({
                  required_error: "tarif_komponen_uuid tidak boleh kosong",
                })
                .uuid({ message: "uuid tidak valid" }),
              tarif_per_komponen: z.number({
                required_error: "tarif_per_komponen tidak boleh kosong",
              }),
            })
          )
          .min(1, listKomponenTarifRequired),
        total_harga: z.number({
          required_error: "total_harga tidak boleh kosong",
          invalid_type_error: "total_harga harus angka",
        }),
        // presentase: z.boolean({required_error: "presentase tidak boleh kosong", invalid_type_error: "presentase "})
      }),
      z.object({
        tarif_komponen_tindakan_lab_uuid: z
          .string({ required_error: "tarif_komponen_tindakan_lab_uuid" })
          .uuid({ message: "tarif_komponen_tindakan_lab_uuid tidak valid" }),
      }),
    ])
  );

  static #UNIT_PELAYANAN = z.array(
    z.object({
      unit_pelayanan: z.enum(["IGD", "Rawat Inap", "Rawat Jalan"], {
        required_error: "unit_pelayanan tidak boleh kosong",
        invalid_type_error:
          "unit_pelayanan hanya (IDD, Rawat Inap, Rawat Jalan)",
      }),
    })
  );
  static #PENJAMIN = z.array(
    z.object({
      penjamin_uuid: z
        .string({ required_error: "penajamin_uuid tidak boleh kosong" })
        .uuid({ message: "penjamin_uuid tidak boleh kosong" }),
    })
  );

  static IS_MCU_FALSE = z.object({
    faskes_uuid: z
      .string({ required_error: "faskes_uuid tidak boleh kosong" })
      .uuid({ message: "faskes_uuid tidak valid" }),
    jenis_tarif: z
      .string({ required_error: jenisTarifRequired })
      .min(1, jenisTarifRequired)
      .max(255),
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: "nama tidak boleh kosong" })
      .min(3, "name tidak boleh kurang dari 3 karakter")
      .max(255),
    mode_pilihan_tarif: z.enum(["Single", "Multiple"], {
      required_error: "mode_pilihan_tarif tidak boleh kosong",
    }),
    tag_unit_pelayanan: this.#UNIT_PELAYANAN,
    tag_penjamin: this.#PENJAMIN,
    is_mcu: z.boolean({ required_error: "is_mcu tidak boleh kosong" }),
    tindakan: this.#LIST_TINDAKAN_POLI,
    grand_total: z.number({ required_error: "grand_total tidak boleh kosong" }),
    status: z.boolean({
      required_error: "status tidak boelh kosong",
      invalid_type_error: "status harus boolean",
    }),
  });

  static UPDATE_IS_MCU_FALSE = z.object({
    uuid: z
      .string({ required_error: "uuid tidak boleh kosong" })
      .uuid({ message: "uuid tidak valid" }),
    faskes_uuid: z
      .string({ required_error: "faskes_uuid tidak boleh kosong" })
      .uuid({ message: "faskes_uuid tidak valid" }),
    jenis_tarif: z
      .string({ required_error: jenisTarifRequired })
      .min(1, jenisTarifRequired)
      .max(255),
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: "nama tidak boleh kosong" })
      .min(3, "name tidak boleh kurang dari 3 karakter")
      .max(255),
    mode_pilihan_tarif: z.enum(["Single", "Multiple"], {
      required_error: "mode_pilihan_tarif tidak boleh kosong",
    }),
    tag_unit_pelayanan: this.#UNIT_PELAYANAN,
    tag_penjamin: this.#PENJAMIN,
    is_mcu: z.boolean({ required_error: "is_mcu tidak boleh kosong" }),
    tindakan: this.#LIST_TINDAKAN_POLI,
    grand_total: z.number({ required_error: "grand_total tidak boleh kosong" }),
    status: z.boolean({
      required_error: "status tidak boelh kosong",
      invalid_type_error: "status harus boolean",
    }),
  });

  static IS_MCU_TRUE = z.object({
    faskes_uuid: z
      .string({ required_error: "faskes_uuid tidak boleh kosong" })
      .uuid({ message: "faskes_uuid tidak valid" }),
    jenis_tarif: z
      .string({ required_error: jenisTarifRequired })
      .min(1, jenisTarifRequired)
      .max(255),
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: "nama tidak boleh kosong" })
      .min(3, "name tidak boleh kurang dari 3 karakter")
      .max(255),
    mode_pilihan_tarif: z.enum(["Single", "Multiple"], {
      required_error: "mode_pilihan_tarif tidak boleh kosong",
    }),
    tag_unit_pelayanan: this.#UNIT_PELAYANAN,
    tag_penjamin: this.#PENJAMIN,
    is_mcu: z.boolean({ required_error: "is_mcu tidak boleh kosong" }),
    tindakan: this.#LIST_TINDAKAN_POLI,
    grand_total: z.number({ required_error: "grand_total tidak boleh kosong" }),
    status: z.boolean({
      required_error: "status tidak boelh kosong",
      invalid_type_error: "status harus boolean",
    }),
  });

  static UPDATE_IS_MCU_TRUE = z.object({
    uuid: z
      .string({ required_error: "uuid tidak boleh kosong" })
      .uuid({ message: "uuid tidak valid" }),
    faskes_uuid: z
      .string({ required_error: "faskes_uuid tidak boleh kosong" })
      .uuid({ message: "faskes_uuid tidak valid" }),
    jenis_tarif: z
      .string({ required_error: jenisTarifRequired })
      .min(1, jenisTarifRequired)
      .max(255),
    code: z
      .string({ required_error: codeRequired })
      .min(1, codeRequired)
      .max(255),
    name: z
      .string({ required_error: "nama tidak boleh kosong" })
      .min(3, "name tidak boleh kurang dari 3 karakter")
      .max(255),
    mode_pilihan_tarif: z.enum(["Single", "Multiple"], {
      required_error: "mode_pilihan_tarif tidak boleh kosong",
    }),
    tag_unit_pelayanan: this.#UNIT_PELAYANAN,
    tag_penjamin: this.#PENJAMIN,
    is_mcu: z.boolean({ required_error: "is_mcu tidak boleh kosong" }),
    tindakan: this.#LIST_TINDAKAN_POLI,
    grand_total: z.number({ required_error: "grand_total tidak boleh kosong" }),
    status: z.boolean({
      required_error: "status tidak boelh kosong",
      invalid_type_error: "status harus boolean",
    }),
  });

  static CREATE_RUANGAN = z
    .object({
      faskes_uuid: z
        .string({ required_error: "faskes_uuid tidak boleh kosong" })
        .uuid({ message: "faskes_uuid tidak valid" }),
      jenis_tarif: z
        .string({ required_error: jenisTarifRequired })
        .min(1, jenisTarifRequired)
        .max(255),
      code: z
        .string({ required_error: codeRequired })
        .min(1, codeRequired)
        .max(255),
      name: z.string({ required_error: "nama tidak boleh kosong" }),
      unit_pelayanan: this.#UNIT_PELAYANAN
        .min(1, "unit_pelayanan tidak boleh kosong")
        .max(1, "unit_pelayanan haya boleh berisi 1 elemen"),
      lokasi_uuid: z
        .string({ required_error: "lokasi_uuid tidak boleh kosong" })
        .uuid({ message: "lokasi_uuid tidak valid" }),
      status: z.boolean({
        required_error: "status tidak boleh kosong",
        invalid_type_error: "status harus boolean",
      }),
      tarif_penjamin: z
        .array(
          z.object({
            penjamin_uuid: z
              .string()
              .uuid({ required_error: penjaminRequired }),
            harga: z.number({
              required_error: "Harga tarif penjamin tidak boleh kosong..",
            }),
          })
        )
        .min(1, penjaminRequired),
    })
    .refine((values) => values.name.trim().length > 0, {
      message: "name tidak boleh kosong",
      path: ["name"],
    });

  static UPDATE_RUANGAN = z
    .object({
      uuid: z
        .string({ required_error: "uuid tidak boleh kosong" })
        .uuid({ message: "uuid tidak valid" }),
      faskes_uuid: z
        .string({ required_error: "faskes_uuid tidak boleh kosong" })
        .uuid({ message: "faskes_uuid tidak valid" }),
      jenis_tarif: z
        .string({ required_error: jenisTarifRequired })
        .min(1, jenisTarifRequired)
        .max(255),
      code: z
        .string({ required_error: codeRequired })
        .min(1, codeRequired)
        .max(255),
      name: z.string({ required_error: "nama tidak boleh kosong" }),
      unit_pelayanan: this.#UNIT_PELAYANAN
        .min(1, "unit_pelayanan tidak boleh kosong")
        .max(1, "unit_pelayanan haya boleh berisi 1 elemen"),
      lokasi_uuid: z
        .string({ required_error: "lokasi_uuid tidak boleh kosong" })
        .uuid({ message: "lokasi_uuid tidak valid" }),
      status: z.boolean({
        required_error: "status tidak boleh kosong",
        invalid_type_error: "status harus boolean",
      }),
      tarif_penjamin: z
        .array(
          z.object({
            penjamin_uuid: z
              .string()
              .uuid({ required_error: penjaminRequired }),
            harga: z.number({
              required_error: "Harga tarif penjamin tidak boleh kosong..",
            }),
          })
        )
        .min(1, penjaminRequired),
    })
    .refine((values) => values.name.trim().length > 0, {
      message: "name tidak boleh kosong",
      path: ["name"],
    });

  static IMPORT_TARIF_RANGAN = z.array(
    z.object({
      jenis_tarif: z
        .string({ required_error: jenisTarifRequired })
        .min(1, jenisTarifRequired)
        .max(255),
      metode: z.string({ required_error: "metode tidak boleh kosong" }),
      code: z
        .string({ required_error: codeRequired })
        .min(1, codeRequired)
        .max(255),
      name: z.string({ required_error: "nama tidak boleh kosong" }),
      pelayanan: z.enum(["Rawat Inap", "Rawat Jalan", "IGD", "ICU"]),
      ruangan: z.string({ required_error: "ruangan tidak boleh kosong" }),
      harga_bed: z.string({ required_error: "harga bed tidak boleh kosong" }),
    })
  );

  static IMPORT_TARIF_TINDAKAN = z.array(
    z.object({
      jenis_tarif: z
        .string({ required_error: jenisTarifRequired })
        .min(1, jenisTarifRequired)
        .max(255),
      code: z
        .string({ required_error: codeRequired })
        .min(1, codeRequired)
        .max(255),
      name: z.string({ required_error: "nama tidak boleh kosong" }),
      mode: z.enum(["Single", "Multiple"], {
        required_error: "mode tidak boleh kosong",
      }),
      pelayanan: z.string({ required_error: "pelayanan tidak boleh kosong" }),
      tindakan: z.string({ required_error: "tindakan tidak boleh kosong" }),
      komponen_tarif: z.string({
        required_error: "komponen tarif tidak boleh kosong",
      }),
      presentase: z.boolean({
        required_error: "presentase tidak boleh kosong",
      }),
      grand_total: z.number({
        required_error: "grand total tidak boleh kosong",
      }),
      harga_tarif_persen: z.number().nullable().optional(),
      harga_tarif_rupiah: z.number().nullable().optional(),
      is_mcu: z.boolean({ required_error: "is_mcu tidak boleh kosong" }),
      tarif_lab: z.string().nullable().optional(),
    })
  );
}
