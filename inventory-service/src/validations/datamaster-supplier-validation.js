import { z } from "zod";
import DatamasterSupplierRepository from "../repositories/datamaster-supplier-repository.js";

export default class DatamasterSupplierValidation {
    static CREATE_SUPPLIER = z.object({
        faskes_uuid: z.string().min(1, "Faskes UUID wajib diisi"),
        status: z.boolean({ required_error: "Status wajib diisi" }),
        name: z.string({ required_error: "Nama supplier wajib diisi" }).min(1, "Nama supplier tidak boleh kosong"),
        code: z.string({ required_error: "Kode supplier wajib diisi" })
            .min(1, "Kode supplier tidak boleh kosong")
            .transform((val) => val.trim()),
        alamat: z.string({ required_error: "Alamat wajib diisi" }).min(1, "Alamat tidak boleh kosong"),
        kecamatan_code: z.string({ required_error: "Kecamatan wajib diisi" }).min(1, "Kecamatan tidak boleh kosong"),
        provinsi_code: z.string({ required_error: "Provinsi wajib diisi" }).min(1, "Provinsi tidak boleh kosong"),
        kabupaten_code: z.string({ required_error: "Kabupaten wajib diisi" }).min(1, "Kabupaten tidak boleh kosong"),
        kelurahan_code: z.string({ required_error: "Kelurahan wajib diisi" }).min(1, "Kelurahan tidak boleh kosong"),
        no_tlp: z.string({ required_error: "No. Telepon wajib diisi" }).min(1, "No. Telepon tidak boleh kosong"),
        supllier_items: z.array(z.object({
            kategori_item: z.string().min(1, "Kategori item tidak boleh kosong"),
        })).min(1, { message: "Daftar item supplier tidak boleh kosong" }),
    }).strict()
    .superRefine(async (data, ctx) => {
        const existingSupplier = await DatamasterSupplierRepository.getCode(
            data.code,
            data.faskes_uuid
        );

        console.log(`[E2E DEBUG] Validating code ${data.code}. Found:`, existingSupplier);

        if (existingSupplier) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["code"], 
            message: "Kode sudah digunakan",
        });
    }
    });

    static UPDATE_SUPPLIER = z.object({
        uuid: z.string().uuid("Format UUID tidak valid"),
        faskes_uuid: z.string().uuid("Format faskes_uuid tidak valid"),
        name: z.string().optional(),
        code: z.string().optional().transform((val) => (val ? val.trim().toUpperCase() : val)),
        alamat: z.string().optional(),
        status: z.boolean().optional(),
        provinsi_code: z.string().optional(),
        kabupaten_code: z.string().optional(),
        kecamatan_code: z.string().optional(),
        kelurahan_code: z.string().optional(),
        no_tlp: z.string().optional(),
        supllier_items: z.array(z.object({ "kategori_item": z.string().min(1, "Kategori item wajib diisi")})).optional(),
    });

    static GET_SUPLLIER_BY_UUID = z.object({
        uuid: z.string().uuid({ message: "Format UUID tidak valid" }),
        faskes_uuid: z.string().uuid(),
    });

    static GET_ALL_SUPPLIER = z.object({
        faskes_uuid: z.string().uuid("Format faskes_uuid tidak valid"),
        name: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),
    });

    static GET_ALL_SUPPLIER_WITHOUT_PAGINATION = z.object({
        faskes_uuid: z.string().uuid("Format faskes_uuid tidak valid"),
        name: z.string().optional(),
    });

    static DELETE_SUPPLIER = z.object({
        uuid: z.string().uuid({ message: "Format UUID tidak valid" }),
        faskes_uuid: z.string().uuid({ message: "Format faskes_uuid tidak valid" }),
    });

    static IMPORT_SUPPLIER_ROW = z.object({
        Kode_supplier: z.string().min(1, { message: "Kode supplier wajib diisi" }),
        Nama_supplier: z.string().min(1, { message: "Nama supplier wajib diisi" }),
        "Provinsi": z.string({ required_error: "Kolom 'Provinsi' wajib diisi" }).min(1, "Kolom 'Provinsi' tidak boleh kosong"), 
        "Kabupaten": z.string({ required_error: "Kolom 'Kabupaten' wajib diisi" }).min(1, "Kolom 'Kabupaten' tidak boleh kosong"), 
        "Kecamatan": z.string({ required_error: "Kolom 'Kecamatan' wajib diisi" }).min(1, "Kolom 'Kecamatan' tidak boleh kosong"),
        "Kelurahan": z.string({ required_error: "Kolom 'Kelurahan' wajib diisi" }) .min(1, "Kolom 'Kelurahan' tidak boleh kosong"),
        "Alamat": z.string().optional().nullable(),
        "No_tlp": z.string().optional().nullable(),
        "Kategori_item": z.string({ required_error: "Kolom 'Kategori Item' wajib diisi" })
                          .min(1, "Kategori Item wajib diisi (Medis/Non-Medis)")
                          .refine(val => {
                              if (!val) return false; 
                              const validCategories = ["Medis", "Non-Medis"];
                              const categories = val.split(",").map(s => s.trim());
                              return categories.every(cat => 
                                  validCategories.some(validCat => 
                                      validCat.toLowerCase() === cat.toLowerCase()
                                  )
                              );
                          }, "Kategori Item harus 'Medis', 'Non-Medis', atau gabungan valid dipisah koma (contoh: Medis,Non-Medis)"),
    });
}