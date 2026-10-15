import {z} from "zod";
import {required} from "./message-validation-error.js";

export default class StokOpnameValidation {
    static GET_ALL = z.object({
        faskes_uuid: z.string().min(1, required),
        lokasi_stok_uuid: z.string().min(1, required),
    });

    static GET_STOCK_CARD = z.object({
        faskes_uuid: z.string().min(1, required),
        lokasi_stok_uuid: z.string().min(1, required),
        jenis_stok_uuids: z.string().min(1, required),
        jenis_items: z.string().min(1, required),
        type: z.string().min(1, required),
    });

    static SAVE = z.object({
        faskes_uuid: z.string().min(1, required),
        type: z.enum(["draft", "final"], { message: "Type harus 'draft' atau 'final'" }),
        petugas_so: z.string().min(1, "Petugas SO wajib diisi"),
        tanggal_cut_off: z.number().gte(1000000000, "Tanggal cut off wajib diisi"),
        judul_stok_opname: z.string().min(1, "Judul wajib diisi"),
        jenis_stoks: z.array(z.string()).min(1, "Minimal 1 Jenis Stok"),
        kategori_item: z.enum(["medis", "non-medis"], { message: "Kategori item tidak valid" }),
        jenis_items: z.array(z.string()).min(1, "Minimal 1 Jenis Item"),
        lokasi_stok_uuid: z.string().min(1, "Lokasi stok wajib diisi"),
        stok_opname_uuid: z.string().uuid("Format UUID Stok Opname tidak valid").optional(),
        petugas_pengubah: z.string().optional(),
        items: z.array(z.object({
            kode_item: z.string().min(1, "Kode item wajib diisi"),
            stok_fisik: z.number().min(0, "Stok fisik wajib diisi"),
            stok_sistem: z.number().min(0, "Stok sistem wajib diisi"),
            id_stok: z.string().uuid("Format ID Stok tidak valid").nullable(),
            ed: z.string().min(1, "ED wajib diisi"), 
            jenis_stok: z.string().min(1, "Jenis stok wajib diisi"),
        })).optional() 
    }).strict();

    static DELETE_SOME = z.object({
        uuids: z.array(z.string().min(1, required))
    });
}