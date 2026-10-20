import { z } from "zod";

const uuid = z.string().uuid();
const teks = z.string().trim().min(1).max(5000);
const versi = z.number().int().positive();
const waktu = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const jenis = z.enum(["neonatal", "asesmen", "observasi", "keperawatan", "perkembangan", "tindakan", "terapi", "rencana"]);
const field = z.object({
    kode: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/), nama: teks,
    tipe: z.enum(["angka", "teks"]), satuan: z.string().trim().max(50), wajib: z.boolean(),
}).strict();
export const definisiSchema = z.object({ fields: z.array(field).min(1).max(60) }).strict().superRefine((data, ctx) => {
    if (new Set(data.fields.map((f) => f.kode)).size !== data.fields.length) {
        ctx.addIssue({ code: "custom", message: "Kode field tidak boleh berulang." });
    }
});

export const nicuSchemas = {
    tempat: z.object({ unit_uuid: uuid, room_monitoring_uuid: uuid, jenis: z.enum(["bed", "inkubator"]), status_alat: z.enum(["siap", "pembersihan", "pemeliharaan", "rusak"]) }).strict(),
    statusAlat: z.object({ versi, status_alat: z.enum(["siap", "pembersihan", "pemeliharaan", "rusak"]) }).strict(),
    konfigurasi: z.object({ unit_uuid: uuid, jenis, definisi: definisiSchema }).strict(),
    penerbitan: z.object({ versi, referensi_pengesahan: teks }).strict(),
    masuk: z.object({ rawat_inap_uuid: uuid, perpindahan_masuk_uuid: uuid, tempat_uuid: uuid, pasien_uuid: uuid, verifikasi_identitas: z.literal(true), serah_terima: teks }).strict(),
    pindah: z.object({ versi, perpindahan_uuid: uuid, tempat_tujuan_uuid: uuid }).strict(),
    selesai: z.object({ versi, perpindahan_keluar_uuid: uuid.optional(), serah_terima: teks }).strict(),
    dokumen: z.object({ konfigurasi_versi_uuid: uuid, waktu_pencatatan: waktu, isi: z.record(z.union([z.string().max(5000), z.number().finite()])) }).strict(),
    koreksi: z.object({ versi, alasan: teks, isi: z.record(z.union([z.string().max(5000), z.number().finite()])) }).strict(),
};

export const daftarSchema = z.object({
    unit_uuid: uuid.optional(), status: z.enum(["aktif", "selesai"]).optional(),
    dari: z.coerce.number().int().positive().optional(), sampai: z.coerce.number().int().positive().optional(),
    halaman: z.coerce.number().int().positive().default(1),
}).strict().refine((d) => !d.dari || !d.sampai || d.sampai >= d.dari, "Periode tidak valid.");

export function validasiIsi(definisi, isi) {
    const fields = definisiSchema.parse(definisi).fields;
    const bentuk = Object.fromEntries(fields.map((f) => {
        let nilai = f.tipe === "angka" ? z.number().finite() : teks;
        return [f.kode, f.wajib ? nilai : nilai.optional()];
    }));
    return z.object(bentuk).strict().parse(isi);
}

export { uuid as uuidSchema };
