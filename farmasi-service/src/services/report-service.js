import PrescriptionRepository from "../repositories/prescription-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import ReportValidation from "../validations/report-validation.js";
import {setRangeDate} from "../helpers/date-helper.js";
import PenjualanObatRepository from "../repositories/penjualan-obat-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import FaskesRepository from "../repositories/faskes-repository.js";
import Utils from "../helpers/utils.js";

export default class ReportService {
    static async getPendapatan(req){
        setRangeDate(req);

        if(!req.pendapatan){
            return [];
        }

        ZodValidator.validate(ReportValidation.GET_PENDAPATAN, req);

        req.start_date = Number(req.start_date);
        req.end_date = Number(req.end_date);
        if (req.payment_method){
            req.payment_method = Number(req.payment_method);
        }

        let result;
        if (req.pendapatan === "prescription"){
            result = await PrescriptionRepository.getPendapatan(req);
        } else if (req.pendapatan === "penjualan_obat"){
            result = await PenjualanObatRepository.getPendapatan(req);
        } else {
            throw new BadRequestException("Invalid pendapatan type");
        }

        const faskes = await FaskesRepository.getFaskes(req.faskes_uuid);
        const faskesProfile = await FaskesRepository.getFaskesProfile(req.faskes_uuid);

        if (result.data){
            result.data.forEach((element) => {
                element.payment_method = element.payment_method === 1 ? "Tunai" : "Asuransi";
            });
        }

        const now = new Date();

        result.data = {
            items : result.data,
            faskes : faskes.name,
            message : `DICETAK OLEH: ${req.user}, ${Utils.convertDateInReport()}`,
            address : faskesProfile?.address?.full_address ?? "",
        }

        return result;
    }

    static async getTat(req){
        setRangeDate(req);

        ZodValidator.validate(ReportValidation.GET_TAT, req);

        const result = await PrescriptionRepository.getTat(req);

        if (result.data){
            result.data.forEach((element) => {
                element.jumlah_racikan = element.obat.filter(item => item.is_compound === true).length;
                element.payment_method = element.payment_method === 1 ? "Tunai" : "Asuransi";
                element.patient = element.patient?.name || "-";
                element.asal_resep = element.lokasi?.name || "-";
                element.lokasi = undefined;
                element.waktu_pelayanan = (element.waktu_pemberian || 0)-(element.waktu_verifikasi || 0)
                element.jenis_resep = element.jumlah_racikan > 0 ? element.jumlah_racikan === element.obat.length ? "Racikan" : "Racikan & Non-Racikan" : "Non-Racikan"
                element.obat = undefined;

                const hours = Math.floor(element.waktu_pelayanan / 3600);
                const minutes = Math.floor((element.waktu_pelayanan % 3600) / 60);
                const remainingSeconds = element.waktu_pelayanan % 60;

                element.waktu_pelayanan = `${String(hours).padStart(2, '0')}.${String(minutes).padStart(2, '0')}.${String(remainingSeconds).padStart(2, '0')}`;
            });
        }

        const faskesProfile = await FaskesRepository.getFaskesProfile(req.faskes_uuid);
        const faskes = await FaskesRepository.getFaskes(req.faskes_uuid);

        result.data = {
            items : result.data,
            faskes : faskes.name,
            message : `DICETAK OLEH: ${req.user}, ${Utils.convertDateInReport()}`,
            address : faskesProfile?.address?.full_address ?? "",
        }

        return result;
    }

    static async getPendapatanPerApotik(req){
        setRangeDate(req);

        ZodValidator.validate(ReportValidation.GET_TAT, req);

        const result = await PrescriptionRepository.getPendapatanPerApotik(req);

        if (result.data){
            result.data.forEach((element) => {
                element.payment_method = element.payment_method === 1 ? "Tunai" : "Asuransi";
                element.lokasi_stok_uuid = undefined;
                element.lokasi_stok = element.lokasi_stok?.name || "-";
            });
        }

        const faskesProfile = await FaskesRepository.getFaskesProfile(req.faskes_uuid);
        const faskes = await FaskesRepository.getFaskes(req.faskes_uuid);

        result.data = {
            items : result.data,
            faskes : faskes.name,
            message : `DICETAK OLEH: ${req.user}, ${Utils.convertDateInReport()}`,
            address : faskesProfile?.address?.full_address ?? "",
        }

        return result;
    }
}