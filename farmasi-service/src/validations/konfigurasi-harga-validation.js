import { z } from "zod";
import {faskesUuidRequired, required} from "./message-validation-error.js";

export default class KonfigurasiHargaValidation {
    static UPDATE = z.object({
        faskes_uuid : z.string().min(1, faskesUuidRequired),
        // Nilai di luar daftar membuat pemotongan stok/HPP diam-diam jatuh ke perilaku lain
        // (mis. LIFO atau harga terakhir), jadi batasi ke opsi yang dikenali kode stok & harga.
        metode_pemotongan_stok : z.enum(["FIFO", "FEFO", "LIFO"], { message: "Metode pemotongan stok harus FIFO, FEFO, atau LIFO" }),
        metode_hpp : z.enum(["average", "last", "avg"], { message: "Metode HPP harus average atau last" }),
        ppn : z.number().min(0, { message: "PPN tidak boleh negatif" }).max(100, { message: "PPN maksimal 100%" }),
        margin : z.number().min(0, { message: "Margin tidak boleh negatif" }),
        biaya_embalase_racik : z.boolean(),
        metode_biaya_racikan : z.string().min(1, required),
        petugas : z.string().min(1, required),
    });

    static GET = z.object({
        faskes_uuid : z.string().min(1, faskesUuidRequired),
    });
}