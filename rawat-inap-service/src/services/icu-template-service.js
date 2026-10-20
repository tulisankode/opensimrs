import { z } from "zod";

const kode = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, "Kode parameter tidak valid");
const elemen = z.object({
    kode_parameter: kode, label: z.string().trim().min(1).max(200),
    jenis: z.enum(["angka", "teks", "boolean", "pilihan"]), satuan: z.string().max(40).optional(),
    wajib: z.boolean().default(false), minimum: z.number().finite().optional(), maksimum: z.number().finite().optional(),
    panjang_maksimum: z.number().int().min(1).max(10000).optional(), pilihan: z.array(z.string().min(1).max(200)).max(100).optional(),
}).strict().superRefine((e, ctx) => {
    if (e.minimum > e.maksimum || (e.jenis === "pilihan" && (!e.pilihan?.length || new Set(e.pilihan).size !== e.pilihan.length))) {
        ctx.addIssue({ code: "custom", message: "Rentang atau pilihan elemen tidak valid" });
    }
});
const unik = (daftar) => new Set(daftar.map((e) => e.kode_parameter)).size === daftar.length;
const daftarElemen = z.array(elemen).max(100).refine(unik, "Kode parameter ganda");
export const definisiTemplate = z.object({
    observasi: daftarElemen,
    dokumen: z.array(z.object({ kode_dokumen: kode, nama: z.string().min(1).max(200), elemen: daftarElemen }).strict()).max(50)
        .refine((d) => new Set(d.map((e) => e.kode_dokumen)).size === d.length, "Kode dokumen ganda"),
}).strict();
export const aturanKelengkapan = z.array(z.object({
    sumber: z.enum(["observasi", "dokumentasi"]), kode_dokumen: kode.optional(),
    parameter: z.array(kode).min(1).max(100), cakupan: z.enum(["episode", "interval", "selesai"]),
    interval_detik: z.number().int().min(60).optional(),
}).strict()).max(100);
export const nilaiDinamis = z.array(z.object({ kode_parameter: kode, nilai: z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.null()]) }).strict()).max(100);

export default class IcuTemplateService {
    static validasi(definisi, aturan = []) {
        const d = definisiTemplate.parse(definisi);
        const a = aturanKelengkapan.parse(aturan);
        for (const r of a) {
            const sumber = r.sumber === "observasi" ? d.observasi : d.dokumen.find((e) => e.kode_dokumen === r.kode_dokumen)?.elemen;
            if (!sumber || r.parameter.some((k) => !sumber.some((e) => e.kode_parameter === k)) ||
                (r.cakupan === "interval" && !r.interval_detik) || new Set(r.parameter).size !== r.parameter.length) {
                throw new Error("Aturan kelengkapan tidak merujuk elemen atau interval yang valid");
            }
        }
        return { definisi: d, aturan_kelengkapan: a };
    }

    static nilai(elemen, nilai, wajib = true) {
        const daftar = nilaiDinamis.parse(nilai);
        if (!unik(daftar)) throw new Error("Kode parameter ganda");
        for (const item of daftar) {
            const e = elemen.find((p) => p.kode_parameter === item.kode_parameter);
            if (!e) throw new Error("Parameter tidak dikenal pada versi template");
            const v = item.nilai;
            if (v === null) continue;
            const sah = e.jenis === "angka" ? typeof v === "number" && (e.minimum === undefined || v >= e.minimum) && (e.maksimum === undefined || v <= e.maksimum)
                : e.jenis === "boolean" ? typeof v === "boolean"
                    : e.jenis === "pilihan" ? e.pilihan.includes(v)
                        : typeof v === "string" && v.length <= (e.panjang_maksimum ?? 10000);
            if (!sah) throw new Error(`Nilai parameter ${e.kode_parameter} tidak valid`);
        }
        if (wajib && elemen.some((e) => e.wajib && !daftar.some((v) => v.kode_parameter === e.kode_parameter && IcuTemplateService.terisi(v.nilai)))) {
            throw new Error("Parameter wajib belum diisi");
        }
        return daftar;
    }

    static terisi(nilai) { return nilai !== null && nilai !== undefined && (typeof nilai !== "string" || nilai.trim().length > 0); }
}
