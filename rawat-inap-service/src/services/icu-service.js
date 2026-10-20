import { z } from "zod";
import Dokumentasi from "../repositories/icu-dokumentasi-repository.js";
import { punyaIzin } from "../middlewares/icu-permission-middleware.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { pastikanModulIcu } from "../helpers/icu-modul-helper.js";
import IcuRepository from "../repositories/icu-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import IcuRequest from "../validations/icu-request.js";
import BadRequestException from "../exceptions/bad-request-exception.js";

// Skor SOFA (Sequential Organ Failure Assessment), versi "sofa-1996" yang umum dipakai. Bobot/ambang di bawah
// perlu ditinjau & disahkan pemilik klinis sebelum dipakai untuk keputusan klinis resmi (lihat PRD STD-0008 §13 #2
// dan Desain Teknis "Keputusan yang harus ditetapkan sebelum implementasi klinis").
const skorRespirasi = (pao2Fio2, ventilatorDibantu) => {
    if (pao2Fio2 == null) return null;
    if (pao2Fio2 >= 400) return 0;
    if (pao2Fio2 >= 300) return 1;
    if (pao2Fio2 >= 200) return 2;
    if (pao2Fio2 >= 100) return ventilatorDibantu ? 3 : 2;
    return ventilatorDibantu ? 4 : 2;
};
const skorKoagulasi = (trombosit) => {
    if (trombosit == null) return null;
    if (trombosit >= 150) return 0;
    if (trombosit >= 100) return 1;
    if (trombosit >= 50) return 2;
    if (trombosit >= 20) return 3;
    return 4;
};
const skorHepar = (bilirubin) => {
    if (bilirubin == null) return null;
    if (bilirubin < 1.2) return 0;
    if (bilirubin < 2.0) return 1;
    if (bilirubin < 6.0) return 2;
    if (bilirubin < 12.0) return 3;
    return 4;
};
const skorKardiovaskular = (map, vasopressor) => {
    if (vasopressor === "norepinefrin") return 4;
    if (vasopressor === "dopamin_tinggi") return 3;
    if (vasopressor === "dopamin_rendah") return 2;
    if (map == null) return null;
    return map < 70 ? 1 : 0;
};
const skorSarafPusat = (gcsTotal) => {
    if (gcsTotal == null) return null;
    if (gcsTotal === 15) return 0;
    if (gcsTotal >= 13) return 1;
    if (gcsTotal >= 10) return 2;
    if (gcsTotal >= 6) return 3;
    return 4;
};
const skorGinjal = (kreatinin, urineOutput) => {
    let skor = null;
    if (kreatinin != null) {
        if (kreatinin < 1.2) skor = 0;
        else if (kreatinin < 2.0) skor = 1;
        else if (kreatinin < 3.5) skor = 2;
        else if (kreatinin < 5.0) skor = 3;
        else skor = 4;
    }
    if (urineOutput != null) {
        if (urineOutput < 200) skor = Math.max(skor ?? 0, 4);
        else if (urineOutput < 500) skor = Math.max(skor ?? 0, 3);
    }
    return skor;
};

const hitungSofa = (p) => {
    const skor = {
        respirasi: skorRespirasi(p.pao2_fio2, p.ventilator_dibantu),
        koagulasi: skorKoagulasi(p.trombosit),
        hepar: skorHepar(p.bilirubin),
        kardiovaskular: skorKardiovaskular(p.map, p.vasopressor),
        saraf_pusat: skorSarafPusat(p.gcs_total),
        ginjal: skorGinjal(p.kreatinin, p.urine_output_ml_hari),
    };
    const lengkap = Object.values(skor).every((v) => v !== null);
    const totalSkor = lengkap ? Object.values(skor).reduce((a, v) => a + v, 0) : null;
    return { skor, lengkap, total_skor: totalSkor };
};

export default class IcuService {
    static async GetDashboard(query = {}, unit = "icu") {
        const hasil = await IcuRepository.GetDashboard(IcuRequest.KUERI.parse(query), unit);
        if (unit === "icu" && (Context.get("icu_superadmin") || punyaIzin(Context.get("icu_izin") ?? [], "ICU", "Kelengkapan Dokumentasi", "READ"))) {
            try { await pastikanModulIcu(Context.get(CTX_AUTHOR).faskesUuid, "icu_kelengkapan_dokumentasi"); }
            catch (error) { if (error.code === 403) return hasil; throw error; }
            for (const kartu of hasil) kartu.kelengkapan = await Dokumentasi.kelengkapan(kartu.perawatan_uuid);
        }
        return hasil;
    }

    static async GetPerawatan(perawatanUuid, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        return IcuRepository.GetPerawatan(perawatanUuid, unit);
    }

    static async MulaiPerawatan(perpindahanUuid, body, unit = "icu") {
        z.string().uuid().parse(perpindahanUuid);
        const data = ZodValidator.validate(IcuRequest.MULAI_PERAWATAN, body);
        return IcuRepository.MulaiPerawatan(perpindahanUuid, data, unit);
    }

    static async KeluarPerawatan(perawatanUuid, body, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        const data = ZodValidator.validate(IcuRequest.KELUAR_PERAWATAN, body);
        return IcuRepository.KeluarPerawatan(perawatanUuid, data, unit);
    }

    static async TambahObservasi(perawatanUuid, body, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        const data = ZodValidator.validate(IcuRequest.OBSERVASI, body);
        return IcuRepository.TambahObservasi(perawatanUuid, data, unit);
    }

    static async GetObservasi(perawatanUuid, query, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        const { dari, sampai } = IcuRequest.KUERI.parse(query);
        const observasi = await IcuRepository.GetObservasi(perawatanUuid, { dari, sampai }, unit);
        return {
            observasi,
            tren: observasi.map((o) => ({
                waktu_pengukuran: o.waktu_pengukuran,
                tekanan_sistolik: o.tekanan_sistolik,
                tekanan_diastolik: o.tekanan_diastolik,
                nadi: o.nadi,
                spo2: o.spo2,
                suhu: o.suhu,
                laju_napas: o.laju_napas,
            })),
        };
    }

    static async KoreksiObservasi(observasiUuid, body, unit = "icu") {
        z.string().uuid().parse(observasiUuid);
        const data = ZodValidator.validate(IcuRequest.KOREKSI_OBSERVASI, body);
        return IcuRepository.KoreksiObservasi(observasiUuid, data, unit);
    }

    static async TambahIntakeOutput(perawatanUuid, body, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        const data = ZodValidator.validate(IcuRequest.INTAKE_OUTPUT, body);
        return IcuRepository.TambahIntakeOutput(perawatanUuid, data, unit);
    }

    static async GetBalance(perawatanUuid, query, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        const { dari, sampai } = IcuRequest.KUERI.parse(query);
        if (!dari || !sampai) throw new BadRequestException("Parameter dari dan sampai (epoch detik) wajib diisi.");
        return IcuRepository.GetBalance(perawatanUuid, { dari, sampai }, unit);
    }

    static async TambahSkorSofa(perawatanUuid, body, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        const data = ZodValidator.validate(IcuRequest.SKOR_SOFA, body);
        const hasil = hitungSofa(data);
        return IcuRepository.TambahSkorSofa(perawatanUuid, {
            waktu_penilaian: data.waktu_penilaian,
            parameter: data,
            catatan: data.catatan,
            ...hasil,
        }, unit);
    }

    static async GetSkorSofa(perawatanUuid, unit = "icu") {
        z.string().uuid().parse(perawatanUuid);
        return IcuRepository.GetSkorSofa(perawatanUuid, unit);
    }

    static async GetLaporan(query, unit = "icu") {
        const { dari, sampai } = IcuRequest.KUERI.parse(query);
        if (!dari || !sampai) throw new BadRequestException("Parameter dari dan sampai (epoch detik) wajib diisi.");
        if (!Number.isSafeInteger(dari) || !Number.isSafeInteger(sampai) || sampai <= dari) throw new BadRequestException("Parameter sampai harus setelah dari.");
        return IcuRepository.GetLaporan({ ...IcuRequest.KUERI.parse(query), dari, sampai }, unit);
    }

    static async GetPerpindahanSiap(query, unit) {
        const arah = query?.arah === "keluar" ? "keluar" : "masuk";
        if (arah === "keluar" && !query?.perawatan_uuid) throw new BadRequestException("Parameter perawatan_uuid wajib untuk arah keluar.");
        return IcuRepository.GetPerpindahanSiap(arah, query?.perawatan_uuid, unit);
    }
}
