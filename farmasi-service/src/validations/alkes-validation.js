import { z } from "zod";
import { faskesUuidRequired, required } from "./message-validation-error.js";

 const verifikasiItemSchema = z.object({
   item_uuid: z.string().uuid({ message: "UUID Item Alkes tidak valid" }),
   jenis_stok_uuid: z
     .string()
     .uuid({ message: "Jenis stok item wajib diisi." }),
 });
 
export default class AlkesValidation {
  static ALKES_ITEM_SCHEMA = z.object({
    item_medis_uuid: z.string().min(1, required),
    qty: z.number().min(1, "Jumlah (qty) minimal 1"),
  });
  
  static ORDER_ALKES = z.object({
    faskes_uuid: z.string().min(1, faskesUuidRequired),
    no_reg: z.string().min(1, required),
    patient_uuid: z.string().min(1, required),
    no_rm: z.string().min(1, required),
    jenis_pelayanan: z.string().min(1, required),
    rekam_medis_uuid: z.string().min(1, required),
    petugas_order: z.string().min(1, required),
    rekam_medis_date: z.string().min(1, required),
    lokasi_uuid: z.string().min(1, required),
    payment_method: z.number(),
    alkes: z
      .array(AlkesValidation.ALKES_ITEM_SCHEMA)
      .nonempty("Minimal harus ada satu item alkes yang dipesan"),
  });

  static CREATE_ALKES_ITEM = z.object({
    item_medis_uuid: z.string().min(1, required),
    order_alkes_uuid: z.string().min(1, required),
    qty: z.number().min(1, required),
  });

  static GET_SOME_ORDER = z.object({
    rekam_medis_uuid: z.string().min(1, required),
    rekam_medis_date: z.string().min(1, required),
  });

  static DELETE_ALKES_ITEM = z.object({
    alkes_item_uuid: z.string().min(1, required),
  });

  static UPDATE_ALKES = z.object({
    uuid: z.string().min(1, required),
    lokasi_stok_uuid: z.string().min(1, required),
  });

  static UPDATE_ALKES_ITEM = z.object({
    uuid: z.string().min(1, required),
    qty: z.number().min(1, required),
    item_medis_uuid: z.string().min(1, required),
  });

  static UPDATE_JENIS_ITEM = z.object({
    uuid: z.string().min(1, required),
    jenis_stok_uuid: z.string().min(1, required),
  });

  static BATAL_ORDER = z.object({
    uuid: z.string().min(1, required),
    petugas_pembatalan: z.string().min(1, required),
    alasan_batal: z.string().min(1, required),
  });

  static UPDATE_SERAHKAN = z.object({
    uuid: z.string().min(1, required),
    petugas_pemberi: z.string().min(1, required),
    penerima: z.string().min(1, required),
  });

  static UPDATE_VERIFIKASI = z.object({
    uuid: z.string().uuid({ message: "UUID Order Alkes tidak valid" }),
    items: z
      .array(verifikasiItemSchema)
      .nonempty({ message: "Array 'items' tidak boleh kosong." }),
  });
}
