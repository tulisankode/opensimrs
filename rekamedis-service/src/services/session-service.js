import ZodValidator from "../validations/zod-validator.js";
import RekamMedisValidation from "../validations/rekam-medis-validation.js";
import SessionRepository from "../repositories/session-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import { prescriptionDetail } from "../configurations/axios-instance.js";
import BadRequestException from "../errors/bad-request-exception.js";
import RekamMedisModel from "../models/mongos/rekam-medis-model.js";
import moment from "moment";

export default class SessionService {
    static async add(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.ADDSESSION, request);

        const rekamMedis = await RekamMedisModel.findById(validReq.rekam_medis_uuid).exec();
        const lastIndex = rekamMedis.daily_records.length - 1;
        const isLatest = validReq.date_order - 1 === lastIndex;

        //* Ambil daily record paling akhir
        const latestRecord = rekamMedis.daily_records[lastIndex];
        const today = moment().format("YYYY-MM-DD");
        const isToday = latestRecord.date === today;
        
        if (!isLatest || !isToday) {
        throw new BadRequestException("Penambahan sesi hanya dapat dilakukan untuk tanggal hari ini pada rekam medis terbaru.");
        }

        const latestRekamedis = await SessionRepository.add(validReq.rekam_medis_uuid, validReq.date_order - 1);
        const sessions = latestRekamedis.daily_records[validReq.date_order - 1].sessions;
        const data = await SessionRepository.getById(sessions[sessions.length - 1]);

        return {
            data: data,
            is_latest : validReq.date_order === rekamMedis.daily_records.length
        }
    }

    static async delete(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.DELETESESSION, request);

        const session = await SessionRepository.getById(validReq.session_uuid);
        
        try {
            for (const obatUuid of session.obat_uuides){
                const obat = await prescriptionDetail.get(`/${obatUuid}`, {
                    headers: {
                        "Authorization": request.token
                    }
                });

                const obatStatus = obat.data.payload.order_status;
                console.log("Obat status:", obatStatus);

                if (obatStatus != 0) {
                    throw new BadRequestException("Sesi sudah memiliki order farmasi. Batalkan order farmasi terlebih dahulu untuk menghapus sesi ini.");
                }
            }
            
        } catch (error) {
            console.error("Failed creating rawat inap:", error);
            throw error; 
        }

        return await SessionRepository.delete(
            validReq.session_uuid,
            validReq.alasan
        )
    }

    static async getInstruksiMedises(request){
        const validReq = ZodValidator.validate(RekamMedisValidation.GET_INSTRUKSI_MEDISES, request);
        let result = await SessionRepository.getInstruksiMedises(validReq.session_uuid);

        result = result.map((data) => {
            return {
                message : data.message,
                name : data.name,
                user_uuid : data.user_uuid,
                time : data.time,
                dokter_name : data.dokter_name,
                _id: data._id,
                is_me : data.user_uuid === request.user_uuid,
                reply : data.reply ? {
                    message : data.reply.message,
                    name : data.reply.name,
                    user_uuid : data.reply.user_uuid,
                    time : data.reply.time,
                    _id: data.reply._id,
                } : null,
            }
        });

        // if (result.length === 0){
        //     throw new NotfoundException("Data tidak ditemukan");
        // }

        const last = result[result.length - 1];
        return {
            data: result,
            petugas: last?.name ?? null,
            updated_at: last?.time ?? null,
        };
    }

    static async getCatatanPerawat(request){
        const validReq = ZodValidator.validate(RekamMedisValidation.GET_INSTRUKSI_MEDISES, request);
        let result = await SessionRepository.getCatatanPerawat(validReq.session_uuid);

        result = result.map((data) => {
            return {
                message : data.message,
                name : data.name,
                user_uuid : data.user_uuid,
                time : data.time,
                _id: data._id,
                is_me : data.user_uuid === request.user_uuid,
                reply : data.reply ? {
                    message : data.reply.message,
                    name : data.reply.name,
                    user_uuid : data.reply.user_uuid,
                    time : data.reply.time,
                    _id: data.reply._id,
                } : null,
            }
        });

        // if (result.length === 0){
        //     throw new NotfoundException("Data tidak ditemukan");
        // }

        const last = result[result.length - 1];
        return {
            data: result,
            petugas: last?.name ?? null,
            updated_at: last?.time ?? null,
        };
    }
}