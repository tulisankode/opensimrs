import { z } from "zod";
import { KATALOG_INDIKATOR, MAKS_HARI_PERIODE, hariPeriode } from "../helpers/indikator-eksekutif.js";

const KODE = KATALOG_INDIKATOR.map((i) => i.kode);

// faskes_uuid opsional: satu nilai, larik (?faskes_uuid=a&faskes_uuid=b), atau dipisah koma.
const daftarFaskes = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => [...new Set([].concat(v ?? []).flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter(Boolean))]);

const periode = {
  startDate: z.string({ required_error: "startDate wajib diisi" }).date("startDate harus berformat YYYY-MM-DD"),
  endDate: z.string({ required_error: "endDate wajib diisi" }).date("endDate harus berformat YYYY-MM-DD"),
  faskes_uuid: daftarFaskes,
};

const cekPeriode = (data, ctx) => {
  const hari = hariPeriode(data.startDate, data.endDate);
  if (hari < 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate tidak boleh sebelum startDate" });
  else if (hari > MAKS_HARI_PERIODE) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: `Periode maksimal ${MAKS_HARI_PERIODE} hari` });
};

const angkaOpsional = z.union([z.number().finite(), z.null()]).optional().transform((v) => v ?? null);

export default class EksekutifValidator {
  static RINGKASAN = z.object(periode).superRefine(cekPeriode);

  static RINCIAN = z
    .object({ ...periode, kode: z.enum(KODE, { message: "Kode indikator tidak dikenal" }), dimensi: z.string().min(1, "dimensi wajib diisi") })
    .superRefine(cekPeriode)
    .superRefine((data, ctx) => {
      const indikator = KATALOG_INDIKATOR.find((i) => i.kode === data.kode);
      if (indikator && !indikator.dimensi_rincian.includes(data.dimensi)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dimensi"],
          message: indikator.dimensi_rincian.length
            ? `Dimensi rincian ${data.kode}: ${indikator.dimensi_rincian.join(", ")}`
            : `Indikator ${data.kode} tidak memiliki rincian`,
        });
      }
    });

  static TARGET = z.object({
    target: z
      .array(
        z
          .object({
            kode: z.enum(KODE, { message: "Kode indikator tidak dikenal" }),
            target_min: angkaOpsional,
            target_maks: angkaOpsional,
            toleransi_persen: z.number().min(0).max(100).optional().default(10),
            catatan: z.string().max(500).nullable().optional(),
          })
          .refine((t) => t.target_min === null || t.target_maks === null || t.target_min <= t.target_maks, {
            message: "target_min tidak boleh lebih besar dari target_maks",
            path: ["target_min"],
          })
      )
      .max(KODE.length)
      .refine((d) => new Set(d.map((t) => t.kode)).size === d.length, { message: "Kode indikator ganda" }),
  });
}
