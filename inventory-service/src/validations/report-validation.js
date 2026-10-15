import { z } from "zod";

const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
const dateFormatMessage = "Format tanggal harus DD-MM-YYYY (contoh: 11-11-2024)";

// --- HELPER UNTUK EPOCH (UNTUK LAPORAN PERSEDIAAN) ---
function toStartOfDayEpochSeconds(val) {
    const [day, month, year] = val.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return Math.floor(date.getTime() / 1000); // Dibagi 1000
}

function toEndOfDayEpochSeconds(val) {
    const [day, month, year] = val.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return Math.floor(date.getTime() / 1000); // Dibagi 1000
}

// --- HELPER BARU UNTUK DATE OBJECT (UNTUK LAPORAN EXPIRED) ---
function toStartOfDayDate(val) {
    const [day, month, year] = val.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}
function toEndOfDayDate(val) {
    const [day, month, year] = val.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export default class ReportValidation {
    static GET_EXPIRED = z.object({
        faskes_uuid: z.string().uuid("faskes_uuid tidak valid"),
        tanggal_mulai: z.string({ required_error: "Tanggal mulai wajib diisi" })
        .regex(dateRegex, dateFormatMessage)
        .transform(toStartOfDayDate) 
        .pipe(z.date()),
        tanggal_selesai: z.string({ required_error: "Tanggal selesai wajib diisi" })
        .regex(dateRegex, dateFormatMessage)
        .transform(toEndOfDayDate) 
        .pipe(z.date()), 
        lokasi_stok_uuid: z.string().optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),
    }).strict();

    static GET_PERSEDIAAN = z.object({
        faskes_uuid: z.string().uuid("faskes_uuid tidak valid"),
        tanggal_mulai: z.string({ required_error: "Tanggal mulai wajib diisi" })
            .regex(dateRegex, dateFormatMessage)
            .transform(toStartOfDayEpochSeconds) 
            .pipe(z.number().min(1, "Tanggal mulai tidak valid")),
        tanggal_selesai: z.string({ required_error: "Tanggal selesai wajib diisi" })
            .regex(dateRegex, dateFormatMessage)
            .transform(toEndOfDayEpochSeconds) 
            .pipe(z.number().min(1, "Tanggal selesai tidak valid")),
        lokasi_stok_uuid: z.string().optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),
    }).strict();
}