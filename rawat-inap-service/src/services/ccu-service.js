import CcuRepository from "../repositories/ccu-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import CcuRequest from "../validations/ccu-request.js";
import BadRequestException from "../exceptions/bad-request-exception.js";
import { hitungSkorRisiko } from "./ccu-skor.js";

const wajib = (uuid) => {
    if (!uuid) throw new BadRequestException("Bad Request");
    return uuid;
};

export default class CcuService {
    static async GetKlinis(perawatanUuid) {
        return CcuRepository.GetKlinis(wajib(perawatanUuid));
    }

    static async SimpanKlinis(perawatanUuid, body) {
        const data = ZodValidator.validate(CcuRequest.KLINIS, body);
        const urutan = [data.waktu_onset, data.waktu_kontak_medis_pertama, data.waktu_tiba_rs].filter(Boolean);
        if (data.waktu_onset && data.waktu_tiba_rs && data.waktu_tiba_rs < data.waktu_onset) {
            throw new BadRequestException("Waktu tiba RS tidak boleh sebelum waktu onset gejala.");
        }
        if (urutan.some((w) => w > Math.floor(Date.now() / 1000) + 300)) throw new BadRequestException("Waktu tidak boleh di masa depan.");
        return CcuRepository.SimpanKlinis(wajib(perawatanUuid), data);
    }

    static async TambahEkg(perawatanUuid, body) {
        return CcuRepository.TambahEkg(wajib(perawatanUuid), ZodValidator.validate(CcuRequest.EKG, body));
    }

    static async GetEkg(perawatanUuid) {
        return CcuRepository.GetEkg(wajib(perawatanUuid));
    }

    static async TambahPenanda(perawatanUuid, body) {
        return CcuRepository.TambahPenanda(wajib(perawatanUuid), ZodValidator.validate(CcuRequest.PENANDA, body));
    }

    static async GetPenanda(perawatanUuid) {
        return CcuRepository.GetPenanda(wajib(perawatanUuid));
    }

    static async TambahSkor(perawatanUuid, body) {
        const data = ZodValidator.validate(CcuRequest.SKOR, body);
        return CcuRepository.TambahSkor(wajib(perawatanUuid), data, hitungSkorRisiko(data.jenis, data.parameter));
    }

    static async GetSkor(perawatanUuid) {
        return CcuRepository.GetSkor(wajib(perawatanUuid));
    }

    static async TambahIntervensi(perawatanUuid, body) {
        return CcuRepository.TambahIntervensi(wajib(perawatanUuid), ZodValidator.validate(CcuRequest.INTERVENSI, body));
    }

    static async GetIntervensi(perawatanUuid) {
        return CcuRepository.GetIntervensi(wajib(perawatanUuid));
    }

    static async Batalkan(jenis, uuid, body) {
        const data = ZodValidator.validate(CcuRequest.BATAL, body);
        return CcuRepository.Batalkan(jenis, wajib(uuid), data.alasan);
    }

    static async GetDashboardKardiak() {
        return CcuRepository.GetDashboardKardiak();
    }

    static async GetLaporanKardiak(query) {
        const dari = Number(query?.dari);
        const sampai = Number(query?.sampai);
        if (!dari || !sampai) throw new BadRequestException("Parameter dari dan sampai (epoch detik) wajib diisi.");
        if (sampai < dari) throw new BadRequestException("Parameter sampai harus setelah dari.");
        return CcuRepository.GetLaporanKardiak({ dari, sampai });
    }
}
