import { z } from "zod";
import { required } from "./message-validation-error.js";

export default class ReturValidation {
  static CREATE = z
    .object({
      jenis_retur: z.enum(["obat", "alkes"], { message: "jenis_retur harus 'obat' atau 'alkes'" }),
      alasan_retur: z.string().min(1, required),
      prescription_uuid: z.string().optional().nullable(),
      order_alkes_uuid: z.string().optional().nullable(),
      items: z.array(z.object({ qty_retur: z.coerce.number().min(0, "Jumlah retur tidak boleh negatif") }).passthrough()).min(1, required),
    })
    .refine((d) => (d.jenis_retur === "obat" ? !!d.prescription_uuid : !!d.order_alkes_uuid), {
      message: "UUID resep/order alkes wajib diisi",
      path: ["prescription_uuid"],
    });

  static CREATE_ITEM = z.object({
    faskes_uuid: z.string().min(1, required),
    retur_uuid: z.string().min(1, required),
    qty_retur: z.number(),
    harga_satuan: z.number(),
  });

  static GET_DETAIL = z.object({
    item_type: z.string().min(1, required),
  });

  static GET_ALL = z.object({
    item_type: z.string().min(1, required),
  });
}
