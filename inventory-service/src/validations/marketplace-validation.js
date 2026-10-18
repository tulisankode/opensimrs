import { z } from "zod";

export default class MarketplaceValidation {
    static PUT_KONFIGURASI = z.object({
        faskes_uuid: z.string().uuid("Format faskes_uuid tidak valid"),
        mitra_kode: z.string({ required_error: "Kode mitra wajib diisi" }).min(1).max(50),
        nama_mitra: z.string({ required_error: "Nama mitra wajib diisi" }).min(1).max(255),
        base_url: z.string({ required_error: "URL mitra wajib diisi" }).max(255).url("Format URL tidak valid")
            .refine((u) => /^https?:\/\//i.test(u), "URL mitra harus diawali http:// atau https://"),
        akun_afiliasi: z.string().max(255).optional().nullable(),
        supplier_uuid: z.string({ required_error: "Supplier (datamaster) wajib dipilih" }).uuid("Format supplier_uuid tidak valid"),
        mode_mock: z.boolean().optional().default(true),
        aktif: z.boolean().optional().default(false),
        api_key: z.string().min(1).optional(),
    }).strict();

    static GET_KONFIGURASI = z.object({
        faskes_uuid: z.string().uuid(),
    });

    static GET_PENAWARAN = z.object({
        faskes_uuid: z.string().uuid(),
        mitra_kode: z.string({ required_error: "Kode mitra wajib diisi" }).min(1),
        q: z.string().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
    });

    static GET_KONVERSI_ITEM = z.object({
        faskes_uuid: z.string().uuid(),
        item_uuid: z.string().uuid("Format item_uuid tidak valid"),
    });

    static PUT_PEMETAAN = z.object({
        faskes_uuid: z.string().uuid(),
        mitra_kode: z.string({ required_error: "Kode mitra wajib diisi" }).min(1).max(50),
        produk_mitra_id: z.string({ required_error: "produk_mitra_id wajib diisi" }).min(1).max(100),
        nama_produk_mitra: z.string().max(255).optional(),
        kemasan_mitra: z.string().max(100).optional(),
        item_uuid: z.string({ required_error: "item_uuid wajib diisi" }).uuid("Format item_uuid tidak valid"),
        satuan_uuid: z.string({ required_error: "satuan_uuid wajib diisi" }).uuid("Format satuan_uuid tidak valid"),
    }).strict();

    static GET_PEMETAAN = z.object({
        faskes_uuid: z.string().uuid(),
        mitra_kode: z.string().optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),
    });

    static CREATE_PERMINTAAN = z.object({
        faskes_uuid: z.string().uuid(),
        pemohon_uuid: z.string().uuid(),
        pemohon_nama: z.string().optional(),
        mitra_kode: z.string({ required_error: "Kode mitra wajib diisi" }).min(1),
        jenis_stok_uuid: z.string({ required_error: "Jenis stok wajib diisi" }).uuid(),
        lokasi_stok_uuid: z.string({ required_error: "Lokasi stok wajib diisi" }).uuid(),
        kategori_item: z.enum(["medis", "non-medis"], { required_error: "Kategori item wajib diisi" }),
        jenis_item: z.enum(["obat", "alkes"], { required_error: "Jenis item wajib diisi" }),
        metode_pembelian: z.enum(["tunai", "kredit"], { required_error: "Metode pembelian wajib diisi" }),
        catatan: z.string().max(255).optional(),
        items: z.array(z.object({
            produk_mitra_id: z.string({ required_error: "produk_mitra_id wajib diisi" }).min(1).max(100),
            nama_produk_mitra: z.string().max(255).optional(),
            jumlah: z.number({ required_error: "Jumlah wajib diisi" }).int().positive("Jumlah harus lebih dari 0"),
            harga_satuan: z.number({ required_error: "Harga satuan wajib diisi" }).nonnegative(),
            stok_penawaran: z.number().int().optional(),
            estimasi_kirim: z.string().max(100).optional(),
        })).min(1, "Minimal harus ada 1 item dalam permintaan"),
    }).strict();

    static GET_LIST_PESANAN = z.object({
        faskes_uuid: z.string().uuid(),
        status_pesanan: z.string().optional(),
        status_persetujuan: z.string().optional(),
        mitra_kode: z.string().optional(),
        search: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),
    });

    static GET_DETAIL_PESANAN = z.object({
        uuid: z.string().uuid("Format UUID pesanan tidak valid"),
        faskes_uuid: z.string().uuid(),
    });

    static PERSETUJUAN = z.object({
        uuid: z.string().uuid(),
        faskes_uuid: z.string().uuid(),
        pemberi_uuid: z.string().uuid(),
        pemberi_nama: z.string().optional(),
        keputusan: z.enum(["setujui", "tolak"], { required_error: "Keputusan wajib diisi" }),
        alasan: z.string().max(255).optional(),
    }).strict().refine((data) => data.keputusan !== "tolak" || !!data.alasan, {
        message: "Alasan wajib diisi bila menolak permintaan",
        path: ["alasan"],
    });

    static CHECKOUT = z.object({
        uuid: z.string().uuid(),
        faskes_uuid: z.string().uuid(),
    });

    static SINKRON_STATUS = z.object({
        uuid: z.string().uuid(),
        faskes_uuid: z.string().uuid(),
    });

    static WEBHOOK = z.object({
        koneksi_uuid: z.string().uuid("Format koneksi_uuid tidak valid"),
        nomor_pesanan_mitra: z.string({ required_error: "nomor_pesanan_mitra wajib diisi" }).min(1).max(100),
        status: z.string({ required_error: "status wajib diisi" }).min(1).max(50),
        peristiwa_id: z.string().max(100).optional(),
        tagihan: z.object({
            referensi_tagihan: z.string().max(100).optional(),
            nilai: z.number().optional(),
            tanggal: z.number().optional(),
            status_dikonfirmasi: z.enum(["belum", "sebagian", "lunas"]).optional(),
        }).optional(),
    });

    static GET_LAPORAN = z.object({
        faskes_uuid: z.string().uuid(),
        dari: z.coerce.number().int().optional(),
        sampai: z.coerce.number().int().optional(),
        status: z.string().optional(),
        mitra_kode: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),
    });
}
