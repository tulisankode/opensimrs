import { z } from "zod";
import { required } from "./message-validation-error.js";

export default class ReturValidation {
  static CREATE = z.object({
    jenis_retur: z.string().min(1, required),
    alasan_retur: z.string().min(1, required),
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
