import { z } from "zod";

const uuid = z.string().uuid();
const waktu = z.number().int().positive().max(9999999999);
const alasan = z.string().trim().min(1).max(2000);
export const versi = z.number().int().positive();
export const konfigurasiSchema = z.object({ ruangan_uuid: uuid, nama: z.string().trim().min(1).max(150), aktif: z.boolean() }).strict();
export const ubahKonfigurasiSchema = konfigurasiSchema.omit({ ruangan_uuid: true }).extend({ versi }).strict();
export const instruksiSchema = z.object({ interval_detik: z.number().int().min(1).max(604800), berlaku_mulai: waktu, alasan, versi }).strict();
export const serahTerimaSchema = z.object({
    perpindahan_uuid: uuid, arah: z.enum(["masuk", "keluar"]), waktu_kejadian: waktu,
    ringkasan: z.object({ kondisi: alasan, terapi_berjalan: alasan, tindak_lanjut: alasan }).strict(),
    tujuan_icu: z.boolean().default(false),
}).strict();
export const konfirmasiSchema = z.object({ waktu_kejadian: waktu, versi }).strict();
export const uuidSchema = uuid;
export const paginasiSchema = z.object({
    halaman: z.coerce.number().int().positive().default(1), batas: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(["aktif", "selesai"]).optional(), konfigurasi_uuid: uuid.optional(),
}).strict();

export const gagal = (message, status = 409) => {
    const error = new Error(message);
    error.status = status;
    error.hdu = true;
    throw error;
};
export const periksaVersi = (baris, nilai) => {
    if (Number(baris.versi) !== nilai) gagal("Data telah berubah. Muat ulang dan tinjau sebelum mengirim kembali.");
};
export const periksaWaktu = (nilai, sekarang, mulai = 1, akhir = sekarang) => {
    if (nilai < mulai || nilai > Math.min(akhir, sekarang)) gagal("Waktu kejadian berada di luar periode perawatan atau di masa depan.", 422);
};
export const pilihInstruksi = (instruksi, kebijakan, waktuPengukuran) => {
    const terbaru = (daftar) => daftar.filter((r) => Number(r.berlaku_mulai) <= waktuPengukuran)
        .sort((a, b) => Number(b.berlaku_mulai) - Number(a.berlaku_mulai) || Number(b.versi) - Number(a.versi))[0];
    const episode = terbaru(instruksi);
    const unit = terbaru(kebijakan);
    return episode ? { sumber: "episode", ...episode } : unit ? { sumber: "unit", ...unit } : null;
};
