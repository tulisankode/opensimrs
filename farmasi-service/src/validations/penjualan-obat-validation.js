import { z } from "zod";
import { required } from "./message-validation-error.js";

export default class PenjualanObatValidation {
  static CREATE_OTC = z.object({
    lokasi_stok_uuid: z.string().min(1, required),
    dokter_pemberi_resep: z.string().min(1, required),
    nama_pembeli: z.string().min(1, required),
    no_hp: z.string().min(1, required),
    no_transaksi: z.string().min(1, required),
  });

  static CREATE_OTC_ITEM = z.object({
    stock_uuid: z.string().min(1, required),
    qty: z.number(),
    jenis_stok_uuid: z.string().min(1, required),
  });

  static BATAL_OTC = z.object({
    uuid: z.string().min(1, required),
    alasan_batal: z.string().min(1, required),
  });

  static GET_ALL = z.object({
    status: z.string().min(1, required),
    start_date: z.number(),
    end_date: z.number(),
  });

  static GET_ALL_WITHOUT_PAGINATION = z.object({
    status: z.string().min(1, required),
    start_date: z.number(),
    end_date: z.number(),
  });
}
