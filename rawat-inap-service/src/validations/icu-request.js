import { z } from "zod";

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
        diagnosis_ringkas: z.string().max(500).optional(),
        serah_terima: serahTerima,
    });

    static KELUAR_PERAWATAN = z.object({
        perpindahan_keluar_uuid: z.string().uuid(),
        kondisi_keluar: z.enum(["hidup", "meninggal"]),
        ringkasan: serahTerima,
    });

    static OBSERVASI = z.object({
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
        catatan: z.string().max(1000).optional(),
    });

    static KOREKSI_OBSERVASI = z.object({
        nilai_baru: z.record(z.any()),
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
}
