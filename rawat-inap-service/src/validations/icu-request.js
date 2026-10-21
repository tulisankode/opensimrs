import { z } from "zod";
import { definisiTemplate, aturanKelengkapan, nilaiDinamis } from "../services/icu-template-service.js";

const serahTerima = z.object({
    kriteria: z.string().max(2000).optional(),
    kondisi: z.string().max(2000).optional(),
    tindakan: z.string().max(2000).optional(),
    terapi_berjalan: z.string().max(2000).optional(),
    alergi_relevan: z.string().max(1000).optional(),
    akses_alat: z.string().max(1000).optional(),
    tindak_lanjut: z.string().max(2000).optional(),
});

export default class IcuRequest {
    static MULAI_PERAWATAN = z.object({
        layanan_kode: z.enum(["umum", "burn", "neuro"]).default("umum"),
        template_versi_uuid: z.string().uuid().optional(),
        diagnosis_ringkas: z.string().max(500).optional(),
        serah_terima: serahTerima,
    });

    // jenis_keluar "pindah" (bawaan) wajib tertaut ke perpindahan keluar yang sudah approve; "meninggal" dan "pulang"
    // menutup episode tanpa perpindahan bed sehingga perpindahan tidak boleh dikirim. Kondisi keluar mengikuti jenisnya.
    static KELUAR_PERAWATAN = z.object({
        jenis_keluar: z.enum(["pindah", "pulang", "meninggal"]).default("pindah"),
        perpindahan_keluar_uuid: z.string().uuid().optional(),
        kondisi_keluar: z.enum(["hidup", "meninggal"]).optional(),
        ringkasan: serahTerima.default({}),
    }).superRefine((v, ctx) => {
        const galat = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
        if (v.jenis_keluar === "pindah") {
            if (!v.perpindahan_keluar_uuid) galat("perpindahan_keluar_uuid", "Perpindahan keluar wajib untuk keluar karena pindah ruangan");
            if (!v.kondisi_keluar) galat("kondisi_keluar", "Kondisi keluar wajib diisi");
            return;
        }
        if (v.perpindahan_keluar_uuid) galat("perpindahan_keluar_uuid", "Keluar pulang/meninggal tidak memakai perpindahan keluar");
        const kondisi = v.jenis_keluar === "meninggal" ? "meninggal" : "hidup";
        if (v.kondisi_keluar && v.kondisi_keluar !== kondisi) galat("kondisi_keluar", "Kondisi keluar tidak sesuai jenis keluar");
    }).transform((v) => ({ ...v, kondisi_keluar: v.jenis_keluar === "pindah" ? v.kondisi_keluar : v.jenis_keluar === "meninggal" ? "meninggal" : "hidup" }));

    static OBSERVASI = z.object({
        parameter_tambahan: nilaiDinamis.default([]),
        waktu_pengukuran: z.number().int().positive(),
        tekanan_sistolik: z.number().int().min(0).max(400).nullish(),
        tekanan_diastolik: z.number().int().min(0).max(300).nullish(),
        nadi: z.number().int().min(0).max(350).nullish(),
        suhu: z.number().min(25).max(45).nullish(),
        laju_napas: z.number().int().min(0).max(100).nullish(),
        spo2: z.number().int().min(0).max(100).nullish(),
        gcs_e: z.number().int().min(1).max(4).nullish(),
        gcs_v: z.number().int().min(1).max(5).nullish(),
        gcs_m: z.number().int().min(1).max(6).nullish(),
        skala_nyeri: z.number().int().min(0).max(10).nullish(),
        ventilator_terpasang: z.boolean().optional(),
        ventilator_mode: z.string().max(50).nullish(),
        ventilator_fio2: z.number().min(0).max(100).nullish(),
        ventilator_peep: z.number().min(0).max(50).nullish(),
        ventilator_tidal_volume: z.number().min(0).max(2000).nullish(),
        ventilator_laju_napas: z.number().int().min(0).max(100).nullish(),
        obat_drip: z
            .array(z.object({ nama: z.string().max(200), laju: z.string().max(50).optional(), satuan: z.string().max(20).optional() }))
            .optional(),
        catatan: z.string().max(1000).nullish(),
    });

    static KOREKSI_OBSERVASI = z.object({
        nilai_baru: IcuRequest.OBSERVASI.omit({ waktu_pengukuran: true }).partial().strict(),
        revisi: z.number().int().positive(),
        alasan: z.string().min(3).max(500),
    });

    static INTAKE_OUTPUT = z.object({
        waktu_pencatatan: z.number().int().positive(),
        jenis: z.enum(["intake", "output"]),
        kategori: z.string().min(1).max(100),
        jumlah_ml: z.number().min(0),
        keterangan: z.string().max(500).optional(),
    });

    static SKOR_SOFA = z.object({
        waktu_penilaian: z.number().int().positive(),
        pao2_fio2: z.number().positive().nullish(),
        ventilator_dibantu: z.boolean().optional(),
        trombosit: z.number().nonnegative().nullish(),
        bilirubin: z.number().nonnegative().nullish(),
        map: z.number().nonnegative().nullish(),
        vasopressor: z.enum(["tidak_ada", "dopamin_rendah", "dopamin_tinggi", "norepinefrin"]).nullish(),
        gcs_total: z.number().int().min(3).max(15).nullish(),
        kreatinin: z.number().nonnegative().nullish(),
        urine_output_ml_hari: z.number().nonnegative().nullish(),
        catatan: z.string().max(1000).optional(),
    });
    static KUERI = z.object({
        dari: z.coerce.number().int().positive().optional(), sampai: z.coerce.number().int().positive().optional(),
        layanan_kode: z.enum(["umum", "burn", "neuro", "belum_diklasifikasikan"]).optional(), ruangan_uuid: z.string().uuid().optional(),
        status: z.enum(["draf", "ditetapkan", "diarsipkan"]).optional(),
        halaman: z.coerce.number().int().min(1).default(1), batas: z.coerce.number().int().min(1).max(100).default(50),
        kode_dokumen: z.string().max(64).optional(),
    }).refine((v) => !v.dari || !v.sampai || v.sampai > v.dari, "Akhir periode harus setelah awal periode");
    static AKTIVASI = z.object({ aktif: z.boolean(), revisi: z.number().int().nonnegative(), alasan: z.string().trim().min(3).max(500) }).strict();
    static BED = z.object({ layanan_kode: z.enum(["umum", "burn", "neuro"]), berlaku_mulai: z.number().int().positive(),
        revisi: z.number().int().nonnegative(), alasan: z.string().trim().min(3).max(500) }).strict();
    static AKSES = IcuRequest.AKTIVASI.extend({ role_uuid: z.string().uuid(), ruangan_uuid: z.string().uuid() });
    static TEMPLATE = z.object({ layanan_kode: z.enum(["umum", "burn", "neuro"]), kode_template: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
        nama: z.string().trim().min(1).max(200), definisi: definisiTemplate, aturan_kelengkapan: aturanKelengkapan }).strict();
    static DRAF = IcuRequest.TEMPLATE.omit({ layanan_kode: true, kode_template: true });
    static UBAH_DRAF = IcuRequest.DRAF.extend({ revisi: z.number().int().positive() });
    static PENETAPAN = z.object({ revisi: z.number().int().positive(), alasan: z.string().trim().min(3).max(500) }).strict();
    static DOKUMENTASI = z.object({ kode_dokumen: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), waktu_pencatatan: z.number().int().positive(), nilai: nilaiDinamis }).strict();
    static KOREKSI_DOKUMENTASI = z.object({ revisi: z.number().int().positive(), alasan: z.string().trim().min(3).max(500), nilai_baru: nilaiDinamis }).strict();

}
