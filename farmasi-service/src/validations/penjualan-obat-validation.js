import { z } from "zod";
import { required } from "./message-validation-error.js";

export default class PenjualanObatValidation {
  static CREATE_OTC = z.object({
    lokasi_stok_uuid: z.string().min(1, required),
    dokter_pemberi_resep: z.string().min(1, required),
    nama_pembeli: z.string().min(1, required),
    no_hp: z.string().min(1, required),
    no_transaksi: z.string().min(1, required),
    items: z.array(z.any()).min(1, "Minimal satu item obat"),
  });

  static CREATE_OTC_ITEM = z.object({
    stock_uuid: z.string().min(1, required),
    // qty bilangan bulat > 0: qty negatif/nol sebelumnya lolos sehingga total menjadi minus tanpa mengurangi stok
    qty: z.number().int("Jumlah harus bilangan bulat").positive("Jumlah harus lebih dari 0"),
    jenis_stok_uuid: z.string().min(1, required),
    // diskon nominal (Rp) per baris, bukan per satuan
    diskon: z.number().min(0, "Diskon tidak boleh negatif").optional().nullable(),
  });

  static BATAL_OTC = z.object({
    uuid: z.string().min(1, required),
    alasan_batal: z.string().min(1, required),
  });

  static BAYAR_OTC = z.object({
    uuid: z.string().min(1, required),
  });

  static GET_ALL = z.object({
    status: z.enum(["belum_lunas", "lunas", "cancel"]),
    start_date: z.number(),
    end_date: z.number(),
  });

  static GET_ALL_WITHOUT_PAGINATION = z.object({
    status: z.enum(["belum_lunas", "lunas", "cancel"]),
    start_date: z.number(),
    end_date: z.number(),
  });
}
