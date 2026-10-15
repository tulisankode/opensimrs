import { z } from "zod";
import {required} from "./message-validation-error.js";

export default class InformConsentValidation {
    static  CREATE = z.object({
        faskes_uuid: z.string().min(1, required),
        rekam_medis_uuid: z.string().min(1, required),
        dokter_uuid: z.string().min(1, required),
        pemberi_informasi: z.string().min(1, required),
        penerima: z.string().min(1, required),
        nama_keluarga: z.string().optional(),
        hubungan_keluarga: z.string().optional(),
        no_hp: z.string().optional(),
        alamat: z.string().optional(),
        gender: z.string().optional(),
        diagnosis: z.string().min(1, required),
        tindakan_kedokteran: z.string().min(1, required),
        tatacara_tindakan: z.string().min(1, required),
        risiko_tindakan: z.string().min(1, required),
        prognosis: z.string().min(1, required),
        lainnya: z.string().min(1, required),
        dasar_diagnosis: z.string().min(1, required),
        indikasi_tindakan: z.string().min(1, required),
        tujuan_tindakan: z.string().min(1, required),
        komplikasi: z.string().min(1, required),
        alaternatif: z.string().min(1, required),
        persetujuan: z.boolean(),
        tgl_persetujuan: z.number().int(),
        saksi1: z.string().min(1, required),
        saksi2: z.string().min(1, required),
        petugas: z.string().min(1, required),
    })
}