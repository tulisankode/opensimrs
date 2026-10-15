import { z } from "zod";
import {
  faskesUuidRequired,
  required,
  uuidRequired,
} from "./message-validation-error.js";

export default class DatamasterValidation {
  static CREATE_SATUAN = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    status: z.boolean(),
    satuan_dosis: z.boolean().optional(),
    editable: z.boolean().optional(),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static CREATE_INGREDIENT = z.object({
    status: z.boolean(),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static CREATE_BENTUK_RACIKAN = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    nama_bentuk_racikan: z
      .string({
        required_error: required,
      })
      .min(1, required),
    jumlah: z.number(),
    tarif_embalase: z.number(),
    tarif_racik: z.number(),
  });

  static CREATE_ATURAN_PAKAI = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    status: z.boolean(),
    frekuensi: z.number(),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    periode_unit: z
      .string({
        required_error: required,
      })
      .min(1, required),
    periode: z.number(),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static CREATE_MANUFACTURE = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    status: z.boolean(),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    alamat: z
      .string({
        required_error: required,
      })
      .min(1, required),
    kecamatan_code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    provinsi_code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    kabupaten_code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    kelurahan_code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    kode_pos: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static CREATE_LOKASI_STOK = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    status: z.boolean(),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    jenis_lokasi: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static UPDATE_SATUAN = z.object({
    uuid: z.string().min(1, uuidRequired),
    status: z.boolean().optional(),
    satuan_dosis: z.boolean().optional(),
    editable: z.boolean().optional(),
    name: z.string().optional(),
    code:z.string().optional()
  });

  static UPDATE_BENTUK_RACIKAN = z.object({
    uuid: z.string().min(1, uuidRequired),
    nama_bentuk_racikan: z
      .string({
        required_error: required,
      })
      .min(1, required),
    jumlah: z.number(),
    tarif_embalase: z.number(),
    tarif_racik: z.number(),
  });

  static UPDATE_ATURAN_PAKAI = z.object({
    uuid: z.string().min(1, uuidRequired),
    status: z.boolean(),
    frekuensi: z.number(),
    periode_unit: z
      .string({
        required_error: required,
      })
      .min(1, required),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    periode: z.number(),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static UPDATE_LOKASI_STOK = z.object({
    uuid: z.string().min(1, uuidRequired),
    status: z.boolean(),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    jenis_lokasi: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static UPDATE_MANUFACTURE = z.object({
    uuid: z.string().min(1, uuidRequired),
    status: z.boolean(),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    alamat: z
      .string({
        required_error: required,
      })
      .min(1, required),
    // demografi_wilayah_code: z
    //   .string({
    //     required_error: required,
    //   })
    //   .min(1, required),
  });

  static GET_ALL_SATUAN = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
  });

  static DELETE_SATUAN = z.object({
    uuid: z.string().min(1, uuidRequired),
  });

  static CREATE_CARA_PAKAI = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    status: z.boolean(),
    cara_pakai: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static UPDATE_CARA_PAKAI = z.object({
    uuid: z.string().min(1, uuidRequired),
    status: z.boolean(),
    cara_pakai: z
      .string({
        required_error: required,
      })
      .min(1, required),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static CREATE_ITEM_MEDIS = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    jenis_item: z
      .string({
        required_error: required,
      })
      .min(1, required),
    satuan_penggunaan_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    manufacture_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    bentuk_sediaan_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    dosis: z.number(),
    satuan_dosis_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    isi_kemasan: z.number(),
    satuan_kemasan_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    kategori_obat_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    status: z.boolean(),
  });

  static UPDATE_ITEM_MEDIS = z.object({
    uuid: z.string().min(1, uuidRequired),
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    code: z
      .string({
        required_error: required,
      })
      .min(1, required),
    name: z
      .string({
        required_error: required,
      })
      .min(1, required),
    jenis_item: z
      .string({
        required_error: required,
      })
      .min(1, required),
    satuan_penggunaan_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    manufacture_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    bentuk_sediaan_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    dosis: z.number(),
    satuan_dosis_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    isi_kemasan: z.number(),
    satuan_kemasan_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    kategori_obat_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    status: z.boolean(),
  });

  static GET_CONVERSIONS = z.object({
    item_medis_uuid: z.string().min(1, uuidRequired),
  });

  static INSERT_JENIS_STOK_ITEM_MEDIS = z.object({
    jenis_stok_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static UPDATE_JENIS_STOK_ITEM_MEDIS = z.object({
    jenis_stok_uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
    uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

  static DELETE_JENIS_STOK_ITEM_MEDIS = z.object({
    uuid: z
      .string({
        required_error: required,
      })
      .min(1, required),
  });

}
