import { z } from "zod";

const uuid = z.string().uuid();
const teks = z.string().trim().min(1).max(2000);
const waktu = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const jenisDokumentasi = ["antropometri", "observasi", "asesmen", "perkembangan", "keperawatan", "tindakan", "terapi", "rencana"];
const jenis = z.enum(jenisDokumentasi);
const kolom = z.object({
    kode: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/), nama: teks,
    tipe: z.enum(["angka", "teks"]), satuan: z.string().trim().max(50), wajib: z.boolean(),
}).strict();
export const konfigurasiSchema = z.object({
    jenis, nama: teks.max(255), definisi: z.array(kolom).min(1).max(100),
}).strict().refine((v) => new Set(v.definisi.map((k) => k.kode)).size === v.definisi.length, "Kode parameter harus unik.");
export const dokumentasiSchema = z.object({
    konfigurasi_uuid: uuid, waktu_catatan: waktu, isi: z.record(z.union([z.number().finite(), z.string().max(10000)])),
    koreksi_uuid: uuid.optional(), alasan: teks.optional(),
}).strict().refine((v) => !v.koreksi_uuid || !!v.alasan, "Alasan koreksi wajib diisi.");
export const penerimaanSchema = z.object({
    pasien_uuid: uuid, kunjungan_uuid: uuid, tempat_tidur_uuid: uuid,
    referensi_penerimaan_uuid: uuid, sumber_penerimaan: z.literal("rawat_inap"),
}).strict();
export const transisiSchema = z.object({
    versi: z.number().int().positive(), referensi_uuid: uuid.optional(), alasan: teks,
    jenis_keluar: z.enum(["transfer", "pulang"]).optional(),
}).strict();
export const periodeSchema = z.object({
    mulai_at: z.coerce.number().int().nonnegative(), selesai_at: z.coerce.number().int().positive(),
}).strict().refine((v) => v.selesai_at >= v.mulai_at, "Akhir periode harus setelah awal periode.");
export const uuidSchema = uuid;
export const pengesahanSchema = z.object({ referensi_penetapan: teks }).strict();
export const pemetaanSchema = z.object({ tempat_tidur_uuid: uuid }).strict();
export const kosongSchema = z.object({}).strict();

export function validasiIsi(definisi, isi) {
    const kolom = new Map(definisi.map((k) => [k.kode, k]));
    if (Object.keys(isi).some((k) => !kolom.has(k))) throw new Error("Parameter tidak terdaftar pada konfigurasi.");
    for (const k of definisi) {
        const v = isi[k.kode];
        if (v === undefined || v === "") {
            if (k.wajib) throw new Error(`Parameter ${k.nama} wajib diisi.`);
        } else if (k.tipe === "angka" ? typeof v !== "number" || !Number.isFinite(v) : typeof v !== "string") {
            throw new Error(`Tipe parameter ${k.nama} tidak sesuai konfigurasi.`);
        }
    }
    if (!Object.values(isi).some((v) => v !== "")) throw new Error("Isi dokumentasi wajib diisi.");
}
