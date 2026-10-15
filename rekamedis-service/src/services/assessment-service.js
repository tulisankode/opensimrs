import ZodValidator from "../validations/zod-validator.js";
import RekamMedisValidation from "../validations/rekam-medis-validation.js";
import AssessmentRepository from "../repositories/assessment-repository.js";
import RekamMedisRepository from "../repositories/rekam-medis-repository.js";
import {z} from "zod";
import moment from "moment";
import PelayananService from "./pelayanan-service.js";

export default class AssessmentService {
    static async insert(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.INSERTASSESSMENT, request);

        if (request.key === 'diagnosis_dokter') {
            for (let i = 0; i < request.data.length; i++) {
                if (!request.data[i].petugas) {
                        request.data[i].petugas = request.petugas;
                }
            }
        }

        const session = await AssessmentRepository.insert(validReq.session_uuid, request.data, validReq.key);

        const rekamMedis = await this.updateSummary(request);
        return {
            data: session,
            summary : rekamMedis?.summary
        }
    }

    static async insertCatatanPerawat(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.INSERTCHAT, request);

        const data = {
            message: validReq.message,
            name: validReq.name,
            user_uuid: validReq.user_uuid,
            time: moment().unix(),
            session_uuid : validReq.session_uuid,
            reply: validReq.reply ?? null,
        }

        return await AssessmentRepository.insertCatatanPerawat(validReq.session_uuid, data);
    }

    static async insertInstruksiMedis(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.INSERTCHAT, request);

        const data = {
            message: validReq.message,
            name: validReq.name,
            user_uuid: validReq.user_uuid,
            time: moment().unix(),
            session_uuid : validReq.session_uuid,
            dokter_name : validReq.dokter_name,
            reply: validReq.reply ?? null,
        }

        return await AssessmentRepository.insertInstruksiMedis(validReq.session_uuid, data);
    }

    static async updateInstruksiMedis(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.UPDATECHAT, request);
        if (validReq.reply == null ) validReq.reply = null;
        console.log(validReq);
        return AssessmentRepository.updateInstruksiMedis(validReq.chat_uuid, {
            message: validReq.message,
            reply : validReq.reply
        });
    }

    static async updateCatatanPerawat(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.UPDATECHAT, request);
        if (validReq.reply == null) validReq.reply = null;
        console.log(validReq);
        return AssessmentRepository.updateCatatanPerawat(validReq.chat_uuid, {
            message: validReq.message,
            reply : validReq.reply
        });
    }

    static async updateSummary(request) {
        let data = {
            rekam_medis_uuid: request.rekam_medis_uuid,
            summary: {}
        }

        if (request.is_latest) {
            if (request.key === 'tanda_vital') {
                if (request.data.tekanan_darah_sistole !== null) {
                    data.summary.tekanan_darah_sistole = request.data.tekanan_darah_sistole;
                }
                if (request.data.tekanan_darah_diastole !== null) {
                    data.summary.tekanan_darah_diastole = request.data.tekanan_darah_diastole;
                }
                if (request.data.frekuensi_nadi !== null) {
                    data.summary.frekuensi_nadi = request.data.frekuensi_nadi;
                }
                if (request.data.frekuensi_nafas !== null) {
                    data.summary.frekuensi_nafas = request.data.frekuensi_nafas;
                }
                if (request.data.suhu !== null) {
                    data.summary.suhu = request.data.suhu;
                }
            } else if (request.key === 'antropometri') {
                if (request.data.tinggi_badan !== null) {
                    data.summary.tinggi_badan = request.data.tinggi_badan;
                }

                if (request.data.berat_badan !== null) {
                    data.summary.berat_badan = request.data.berat_badan;
                }
            } else if (request.key === 'triase'){
                if (request.data.warna_triase !== null) {
                    data.summary.warna_triase = request.data.warna_triase;
                }
            }
            else if (request.key === 'kesadaran') {
                if (request.data.gcs_score !== null) {
                    data.summary.gcs_score = request.data.gcs_score;
                }
            } else if (request.key === 'asesmen_nyeri') {
                if (request.data.skala_nyeri !== null) {
                    data.summary.skala_nyeri = request.data.skala_nyeri;
                }
            } else if (request.key === 'alergi') {
                if (request.data.nama_alergi !== null) {
                    data.summary.nama_alergi = request.data.nama_alergi;
                }
            } else if (request.key === 'anamnesis') {
                if (request.data.keluhan_utama !== null) {
                    data.summary.keluhan_utama = request.data.keluhan_utama;
                }

                if (request.data.anamnesis !== null) {
                    data.summary.anamnesis = request.data.anamnesis;
                }
            } else if (request.key === 'diagnosis_dokter') {
                if (request.data[0]?.diagnosis !== null) {
                    data.summary.diagnosis_primer = request.data[0]?.diagnosis;

                    data.summary.diagnosis_dokter = request.data;
                }
            } else if (request.key === 'pemeriksaan_fisik') {
                if (request.data.ket_kepala !== null) {
                    data.summary.ket_kepala = request.data.ket_kepala;
                }

                if (request.data.ket_mata !== null) {
                    data.summary.ket_mata = request.data.ket_mata;
                }

                if (request.data.ket_telinga_kanan !== null) {
                    data.summary.ket_telinga_kanan = request.data.ket_telinga_kanan;
                }

                if (request.data.ket_telinga_kiri !== null) {
                    data.summary.ket_telinga_kiri = request.data.ket_telinga_kiri;
                }

                if (request.data.ket_rongga_mulut !== null) {
                    data.summary.ket_rongga_mulut = request.data.ket_rongga_mulut;
                }

                if (request.data.ket_hidung !== null) {
                    data.summary.ket_hidung = request.data.ket_hidung;
                }

                if (request.data.ket_tenggorokan !== null) {
                    data.summary.ket_tenggorokan = request.data.ket_tenggorokan;
                }

                if (request.data.ket_mulut !== null) {
                    data.summary.ket_mulut = request.data.ket_mulut;
                }

                if (request.data.ket_leher !== null) {
                    data.summary.ket_leher = request.data.ket_leher;
                }

                if (request.data.ket_leher_depan !== null) {
                    data.summary.ket_leher_depan = request.data.ket_leher_depan;
                }

                if (request.data.ket_dada !== null) {
                    data.summary.ket_dada = request.data.ket_dada;
                }

                if (request.data.ket_jantung !== null) {
                    data.summary.ket_jantung = request.data.ket_jantung;
                }

                if (request.data.ket_paru !== null) {
                    data.summary.ket_paru = request.data.ket_paru;
                }

                if (request.data.ket_abdomen !== null) {
                    data.summary.ket_abdomen = request.data.ket_abdomen;
                }

                if (request.data.ket_anus !== null) {
                    data.summary.ket_anus = request.data.ket_anus;
                }

                if (request.data.ket_urogenital !== null) {
                    data.summary.ket_urogenital = request.data.ket_urogenital;
                }

                if (request.data.ket_ekstremitas_atas !== null) {
                    data.summary.ket_ekstremitas_atas = request.data.ket_ekstremitas_atas;
                }

                if (request.data.ket_ekstremitas_bawah !== null) {
                    data.summary.ket_ekstremitas_bawah = request.data.ket_ekstremitas_bawah;
                }

                if (request.data.ket_muskuloskeletal !== null) {
                    data.summary.ket_muskuloskeletal = request.data.ket_muskuloskeletal;
                }

                if (request.data.ket_pemeriksaan_lainnya !== null) {
                    data.summary.ket_pemeriksaan_lainnya = request.data.ket_pemeriksaan_lainnya;
                }
            }
        }

        if (Object.keys(data.summary).length > 0) {
            return await RekamMedisRepository.updateSummary(data);
        } else {
            return await RekamMedisRepository.get({rekam_medis_uuid: request.rekam_medis_uuid});
        }

    }

    static async insertTindakan(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.INSERT_TINDAKAN, request);

        // console.log("req", request);
        let tindakans = [];

        if (Array.isArray(request.data)){
            request.data.forEach((tindakan) => {
                ZodValidator.validate(z.boolean(), tindakan.is_mcu)

                const tindakanMap = {
                    ...tindakan,
                    petugas_input: request.petugas_input
                }

                if (tindakan.is_mcu) {
                    if (tindakan.is_deleted){
                        // TODO : DELETE IN LAB ORDER TABLE
                        return;
                    } else if (tindakan.is_new){
                        // TODO : INSERT IN LAB ORDER TABLE
                    }
                }

                tindakans.push(tindakanMap);
            })
        }
        
        const requestBilling = {
            type: "tindakan",
            token: request.token,
            session_uuid: validReq.session_uuid,
        };
        
        await PelayananService.createBillingLayanan(requestBilling, tindakans);

        const session = await AssessmentRepository.insert(validReq.session_uuid, tindakans, "pemeriksaan_tindakan");
        return {
            data: session,
        }
    }

    static async getItemBefore(request){
        const validReq = ZodValidator.validate(RekamMedisValidation.GET_ITEMS_BEFORE, request);

        return await AssessmentRepository.getItemBefore(validReq.no_rm, validReq.no_pelayanan, request.page, request.limit, validReq.key, request.jenis_kunjungan, request.session_order, request.date_filter);
    }

    static async pushOrderObat(request) {
        const validReq = ZodValidator.validate(RekamMedisValidation.PUSH_ORDER_OBAT, request);
        
        return await AssessmentRepository.pushOrderObat(validReq.session_uuid, validReq.order_obat_uuid);
    }
}