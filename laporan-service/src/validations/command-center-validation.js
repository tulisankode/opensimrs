import { z } from "zod";
import { KODE_AMBANG, OPERATOR } from "../helpers/command-center.js";

const batas = z.union([z.number().finite().min(0, "Batas tidak boleh negatif"), z.null()]).optional().transform((v) => v ?? null);

export default class CommandCenterValidator {
  // PUT /command-center/ambang. Batas peringatan & kritis kosong = ambang kode itu dihapus.
  static AMBANG = z.object({
    ambang: z
      .array(
        z
          .object({
            kode: z.enum(KODE_AMBANG, { message: "Kode ambang tidak dikenal" }),
            operator: z.enum(OPERATOR, { message: "Operator harus > atau >=" }).optional().default(">"),
            batas_peringatan: batas,
            batas_kritis: batas,
            aktif: z.boolean().optional().default(true),
          })
          .refine((a) => a.batas_peringatan === null || a.batas_kritis === null || a.batas_peringatan <= a.batas_kritis, {
            message: "Batas peringatan tidak boleh lebih besar dari batas kritis",
            path: ["batas_peringatan"],
          })
      )
      .max(KODE_AMBANG.length)
      .refine((d) => new Set(d.map((a) => a.kode)).size === d.length, { message: "Kode ambang ganda" }),
  });

  // POST /command-center/peringatan/:uuid/tindakan. Catatan operasional (tanpa identitas pasien) wajib diisi.
  static TINDAKAN = z
    .object({
      uuid: z.string().min(1).max(255),
      jenis: z.enum(["tinjau", "eskalasi"], { message: "Jenis tindakan harus tinjau atau eskalasi" }),
      catatan: z.string({ required_error: "Catatan tindak lanjut wajib diisi" }).trim().min(3, "Catatan tindak lanjut minimal 3 karakter").max(1000),
      tujuan: z.string().trim().max(255).nullable().optional().transform((v) => v || null),
    })
    .refine((t) => t.jenis !== "eskalasi" || t.tujuan, { message: "Tujuan eskalasi wajib diisi", path: ["tujuan"] });
}
