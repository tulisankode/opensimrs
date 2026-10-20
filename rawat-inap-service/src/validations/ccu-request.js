import { z } from "zod";

const waktu = z.number().int().positive();
const teks = (maks) => z.string().max(maks).optional();

export const SINDROM_CCU = [
    "stemi", "nstemi", "angina_tidak_stabil", "gagal_jantung_akut", "syok_kardiogenik", "aritmia", "pasca_pci",
    "pasca_bedah_jantung", "miokarditis_perikarditis", "emboli_paru", "lainnya",
];
export const IRAMA_EKG = [
    "sinus", "sinus_takikardia", "sinus_bradikardia", "fibrilasi_atrium", "flutter_atrium", "svt", "vt", "vf",
    "torsades", "blok_av_1", "blok_av_2", "blok_av_3", "irama_pacu", "asistol", "pea", "lainnya",
];
export const JENIS_PENANDA = [
    "troponin_i", "troponin_t", "hs_troponin_i", "hs_troponin_t", "ck_mb", "ck", "nt_probnp", "bnp", "d_dimer",
    "kalium", "magnesium",
];
export const JENIS_INTERVENSI = [
    "pci_primer", "pci", "angiografi_koroner", "trombolisis", "pacu_jantung_sementara", "iabp", "kardioversi",
    "defibrilasi", "rjp", "perikardiosentesis", "lainnya",
];
export const FAKTOR_RISIKO = ["hipertensi", "diabetes", "dislipidemia", "merokok", "riwayat_keluarga", "obesitas", "ckd"];

export default class CcuRequest {
    // Data klinis kardiak episode (satu baris per episode; diperbarui, bukan ditambah).
    static KLINIS = z.object({
        sindrom: z.enum(SINDROM_CCU),
        lokasi_infark: teks(200),
        waktu_onset: waktu.nullish(),
        waktu_kontak_medis_pertama: waktu.nullish(),
        waktu_tiba_rs: waktu.nullish(),
        kelas_killip: z.number().int().min(1).max(4).nullish(),
        fraksi_ejeksi: z.number().min(5).max(90).nullish(),
        faktor_risiko: z.array(z.enum(FAKTOR_RISIKO)).max(10).optional(),
        catatan: teks(2000),
    });

    static EKG = z.object({
        waktu_rekam: waktu,
        irama: z.enum(IRAMA_EKG),
        laju_jantung: z.number().int().min(0).max(350).nullish(),
        interval_pr: z.number().int().min(0).max(600).nullish(),
        durasi_qrs: z.number().int().min(0).max(300).nullish(),
        interval_qt: z.number().int().min(100).max(800).nullish(),
        aksis: z.enum(["normal", "deviasi_kiri", "deviasi_kanan", "ekstrem"]).nullish(),
        perubahan_st: z.enum(["tidak_ada", "elevasi", "depresi"]).default("tidak_ada"),
        lead_st: teks(200),
        gelombang_q: z.boolean().optional(),
        blok_cabang: z.enum(["tidak_ada", "rbbb", "lbbb"]).nullish(),
        interpretasi: teks(2000),
    });

    static PENANDA = z.object({
        waktu_sampel: waktu,
        jenis: z.enum(JENIS_PENANDA),
        nilai: z.number().nonnegative(),
        satuan: z.string().min(1).max(20),
        batas_atas: z.number().nonnegative().nullish(),
        sumber: z.enum(["manual", "lab"]).default("manual"),
        referensi_lab: teks(255),
        catatan: teks(1000),
    });

    static SKOR = z.discriminatedUnion("jenis", [
        z.object({
            jenis: z.literal("killip"), waktu_penilaian: waktu, catatan: teks(1000),
            parameter: z.object({ kelas: z.number().int().min(1).max(4) }),
        }),
        z.object({
            jenis: z.literal("timi_nste"), waktu_penilaian: waktu, catatan: teks(1000),
            parameter: z.object({
                usia_lanjut: z.boolean(), tiga_faktor_risiko: z.boolean(), pjk_diketahui: z.boolean(), aspirin_seminggu: z.boolean(),
                angina_berat: z.boolean(), deviasi_st: z.boolean(), penanda_positif: z.boolean(),
            }),
        }),
        z.object({
            jenis: z.literal("timi_stemi"), waktu_penilaian: waktu, catatan: teks(1000),
            parameter: z.object({
                umur: z.number().int().min(0).max(130), dm_ht_angina: z.boolean(), sistolik: z.number().int().min(0).max(400),
                laju_jantung: z.number().int().min(0).max(350), killip: z.number().int().min(1).max(4),
                berat_badan: z.number().min(1).max(400), ste_anterior_lbbb: z.boolean(), waktu_terapi_jam: z.number().min(0).max(240),
            }),
        }),
    ]);

    static INTERVENSI = z.object({
        jenis: z.enum(JENIS_INTERVENSI),
        waktu_mulai: waktu,
        waktu_selesai: waktu.nullish(),
        operator: teks(255),
        hasil: teks(2000),
        komplikasi: teks(2000),
        catatan: teks(2000),
    }).refine((d) => !d.waktu_selesai || d.waktu_selesai >= d.waktu_mulai, {
        message: "Waktu selesai tidak boleh sebelum waktu mulai", path: ["waktu_selesai"],
    });

    // Pembatalan entri (koreksi berjejak): entri tidak dihapus fisik, ditandai dibatalkan + alasan + pelaku.
    static BATAL = z.object({ alasan: z.string().min(3).max(500) });
}
