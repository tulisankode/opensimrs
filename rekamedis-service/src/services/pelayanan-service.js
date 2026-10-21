import ZodValidator from "../validations/zod-validator.js";
import PelayananValidation from "../validations/pelayanan-validation.js";
import PelayananRepository from "../repositories/pelayanan-repository.js";
import InternalServerException from "../errors/internal-server-exception.js";
import Utils from "../helpers/utils.js";
import RekamMedisRepository from "../repositories/rekam-medis-repository.js";
import {uuidv7} from "uuidv7";
import BadRequestException from "../errors/bad-request-exception.js";
import NotfoundException from "../errors/notfound-exception.js";
import { checkNoIdentity, createBilling, createRawatInap } from "../configurations/axios-instance.js";
import BiayaKamarService from "./biaya-kamar-service.js";

export default class PelayananService {
    static async updateResume(request) {
        ZodValidator.validate(PelayananValidation.BEFOREUPDATE, request);

        if (request.status_pulang === "other-hcf") {
            ZodValidator.validate(PelayananValidation.UPDATEDIRUJUK, request);
        } else if (request.status_pulang === "oth") {
            ZodValidator.validate(PelayananValidation.UPDATELAINNYA, request);
        }

        const { pelayanan, ...requestWithoutPelayanan } = request;
        const affectedRow = await PelayananRepository.updateResume(request.pelayanan , Utils.snakeToCamelObject(requestWithoutPelayanan));

        if (affectedRow[0] === 0) {
            throw new InternalServerException("Pelayanan tidak berhasil di update");
        } else {
            return {message: `berhasil mengupdate resume medis`}
        }
    }

    static async getResume(request) {
        ZodValidator.validate(PelayananValidation.GET, request);

        let tindakans = [];
        let diagnosiss = [];
        let obats = [];

        const resume = await PelayananRepository.getResume(request.pelayanan, Utils.snakeToCamelObject(request));
        if (!resume) {
            throw new InternalServerException("Resume medis tidak ditemukan");
        }

        const rekamMedis = await RekamMedisRepository.getResumeNeed({rekam_medis_uuid: resume.dataValues.rekam_medis_uuid})

        if (rekamMedis === null){
            throw new InternalServerException("Rekam medis tidak ditemukan");
        }

        rekamMedis.daily_records.forEach((daily_record) => {
            const sessions = daily_record.sessions ?? [];
            sessions.forEach((session) => {
                const pemeriksaan_tindakan = session.pemeriksaan_tindakan ?? [];

                if (pemeriksaan_tindakan?.length !== 0) {
                    pemeriksaan_tindakan.forEach((tindakan_item) => {
                        tindakans.push(tindakan_item);
                    })
                }
            })
        })

        rekamMedis.daily_records.forEach((daily_record) => {
            const sessions = daily_record.sessions ?? [];
            sessions.forEach((session) => {
                const diagnosis_dokter = session.diagnosis_dokter ?? [];

                if (diagnosis_dokter?.length !== 0) {
                    diagnosis_dokter.forEach((diagnosis_item) => {
                        diagnosiss.push(diagnosis_item);
                    })
                }
            })
        })

        rekamMedis.daily_records.forEach((daily_record) => {
            const sessions = daily_record.sessions ?? [];
            sessions.forEach((session) => {
                const obat_uuides = session.obat_uuides ?? [];

                if (obat_uuides?.length !== 0) {
                    obat_uuides.forEach((obats_item) => {
                        obats.push(obats_item);
                    })
                }
            })
        })

        resume.dataValues.tanda_vital_pulang = {
            tekanan_darah_diastole : rekamMedis.summary.tekanan_darah_diastole,
            tekanan_darah_sistole : rekamMedis.summary.tekanan_darah_sistole,
            frekuensi_nadi : rekamMedis.summary.frekuensi_nadi,
            frekuensi_nafas : rekamMedis.summary.frekuensi_nafas,
            suhu : rekamMedis.summary.suhu,
        };

        resume.dataValues.pemeriksaan_tindakan = tindakans;

        resume.dataValues.diagnosa_dokter = diagnosiss;

        resume.dataValues.obat_uuides = obats;

        resume.dataValues.tanda_vital_awal = {
            tekanan_darah_diastole : rekamMedis.daily_records[0]?.sessions[0]?.tanda_vital?.tekanan_darah_diastole,
            tekanan_darah_sistole : rekamMedis.daily_records[0]?.sessions[0]?.tanda_vital?.tekanan_darah_sistole,
            frekuensi_nadi : rekamMedis.daily_records[0]?.sessions[0]?.tanda_vital?.frekuensi_nadi,
            frekuensi_nafas : rekamMedis.daily_records[0]?.sessions[0]?.tanda_vital?.frekuensi_nafas,
            suhu : rekamMedis.daily_records[0]?.sessions[0]?.tanda_vital?.suhu,
        }

        resume.dataValues.pemeriksaan_fisik = {
            kepala : rekamMedis.summary.ket_kepala,
            mata : rekamMedis.summary.ket_mata,
            telinga_kanan : rekamMedis.summary.ket_telinga_kanan,
            telinga_kiri : rekamMedis.summary.ket_telinga_kiri,
            rongga_mulut : rekamMedis.summary.ket_rongga_mulut,
            hidung : rekamMedis.summary.ket_hidung,
            tenggorokan : rekamMedis.summary.ket_tenggorokan,
            mulut : rekamMedis.summary.ket_mulut,
            leher : rekamMedis.summary.ket_leher,
            leher_depan : rekamMedis.summary.ket_leher_depan,
            dada : rekamMedis.summary.ket_dada,
            jantung : rekamMedis.summary.ket_jantung,
            paru : rekamMedis.summary.ket_paru,
            abdomen : rekamMedis.summary.ket_abdomen,
            anus : rekamMedis.summary.ket_anus,
            urogenital : rekamMedis.summary.ket_urogenital,
            ekstremitas_atas : rekamMedis.summary.ket_ekstermitas_atas,
            ekstremitas_bawah : rekamMedis.summary.ket_ekstermitas_bawah,
            muskuloskeletal : rekamMedis.summary.ket_muskuloskeletal,
            pemeriksaan_lainnya : rekamMedis.summary.ket_pemeriksaan_lainnya,
        }

        resume.dataValues.anamnesis = rekamMedis.summary.keluhan_utama

        return resume;
    }

    static async dischargeService(request) {
        ZodValidator.validate(PelayananValidation.DISCHARGE, request);

        // Biaya kamar RI ditagihkan lebih dulu: bila gagal, pasien belum ter-discharge dan bisa diulang
        // (item kamar diganti, tidak dobel).
        let biayaKamar = null;
        if (request.pelayanan === "ri") {
            const layanan = await PelayananRepository.getPelayanan("ri", request.rekam_medis_uuid);
            if (!layanan) throw new NotfoundException("Pelayanan rawat inap tidak ditemukan");
            biayaKamar = await BiayaKamarService.tagih(layanan, request.discharge_date, request.token);
        }

        // TODO : ADD TRANSACTION FOR THIS TRANSACTION
        await this.insertHistoryTindakan(request);

        const affectedRow = await PelayananRepository.dichargeService(request.pelayanan , Utils.snakeToCamelObject(request));
        if (affectedRow[0] === 0) {
            throw new InternalServerException("Pelayanan tidak berhasil di discharge");
        }

        return {message: `berhasil discharge resume medis`, biaya_kamar: biayaKamar}

    }

    static async insertHistoryTindakan(request) {
        let historyTindakan = [];
        let petugasTindakan = [];
        ZodValidator.validate(PelayananValidation.INSERT_HISTORY_TINDAKAN, request);
        const rekamMedis = await RekamMedisRepository.getResumeNeed({rekam_medis_uuid: request.rekam_medis_uuid})

        if (rekamMedis !== null) {
            rekamMedis.daily_records.forEach((daily_record) => {
                const sessions = daily_record.sessions ?? [];
                sessions.forEach((session) => {
                    const pemeriksaan_tindakan = session.pemeriksaan_tindakan ?? [];

                    if (pemeriksaan_tindakan?.length !== 0) {
                        pemeriksaan_tindakan.forEach((tindakan_item) => {
                            const tindakan_uuid = uuidv7();
                            const tindakan = {
                                faskesUuid: request.faskes_uuid,
                                uuid: tindakan_uuid,
                                tarif_uuid: tindakan_item.tarif_uuid,
                                nama_tindakan: tindakan_item.nama_tindakan,
                                harga_tindakan: tindakan_item.harga_tindakan,
                                qty_tindakan: tindakan_item.qty_tindakan,
                                lokasi_uuid: request.lokasi_uuid,
                                pelayanan: request.pelayanan,
                                tanggal_tindakan: request.discharge_date,
                            }
                            historyTindakan.push(tindakan);

                            tindakan_item.petugas.forEach((petugas_item) => {
                                const petugas = {
                                    faskesUuid: request.faskes_uuid,
                                    historyTindakanUuid: tindakan_uuid,
                                    practitionerUuid: petugas_item.practitioner_uuid,
                                }

                                petugasTindakan.push(petugas)
                            })
                        })
                    }
                })
            })
        } else {
            throw new BadRequestException("Rekam medis tidak ditemukan");
        }
        await PelayananRepository.insertHistory(historyTindakan, petugasTindakan);
    }

    static async createRiFromSrpi(request) {
        console.log("request create ri from srpi:", request);
        ZodValidator.validate(PelayananValidation.CREATE_RAWAT_INAP, request);
        
        const layanan = await PelayananRepository.getPelayanan(request.admission_type, request.rekam_medis_uuid);
        if (layanan == null) {
            throw new NotfoundException("Pelayanan tidak ditemukan");
        }

        layanan.targetDokterUuid = request.practitioner_uuid;
        layanan.nomorSurat = request.nomor_surat;
        layanan.targetTanggalDaftar = request.tanggal_daftar;
        layanan.targetLokasi = request.lokasi_uuid;

        try {
            const result = await createRawatInap.post("/", {
                ...layanan
            }, {
                headers: {
                    "Authorization": request.token
                }
            });

            return result;
            
        } catch (error) {
            console.error("Failed creating rawat inap:", error);
            throw error.response.data; 
        }
        
    }

    static async createBillingLayanan(requestBilling, serviceData = []) {

        const dataToValidate = {
            ...requestBilling, 
            items: serviceData, 
        };

        await ZodValidator.validate(PelayananValidation.CREATE_BILLING_LAYANAN, dataToValidate);

        //* Get Layanan dari Rekam Medis
        const rekamMedis = await RekamMedisRepository.getRekamMedisBySession(requestBilling.session_uuid);
        const layanan = await PelayananRepository.getPelayanan(rekamMedis.pelayanan, rekamMedis._id.toString());

        if (!layanan) throw new BadRequestException("Layanan tidak ditemukan");

        let targetPatient = null;
        
        //* Cek jika pasien adalah bayi baru lahir (untuk ambil target Uuid)
        if (layanan.patient.is_new_born){
            try {
                const patient = await checkNoIdentity.get('/', {
                    params: {
                        noIdentity: layanan.patient.noIdentity,
                        faskesUuid: layanan.faskesUuid
                    },
                    headers: {
                        Authorization: requestBilling.token,
                    },
                });
                
                targetPatient = patient.data.payload.uuid;

            } catch (error) {
                throw new Error(error.response?.data?.message || "Terjadi kesalahan pada ambil data Admisi");
            }
        }        

        let items;
        // Tindakan dikirim sebagai daftar lengkap per sesi: item sesi yang sama di tagihan diganti, bukan ditambah.
        let replaceRef;

        //* Build items berdasarkan category Billing
        if (requestBilling.type === "tindakan") {
            replaceRef = `tindakan:${requestBilling.session_uuid}`;
            items = Utils.buildTindakanItems(serviceData).map((item) => ({ ...item, additional_info: { ref: replaceRef } }));
        } else if (requestBilling.type === "order_obat") {
            items = await Utils.buildFarmasiItems(serviceData, "2");
            // Resep farmasi mengirim ref per resep: verifikasi ulang mengganti item, batal menarik item.
            if (requestBilling.ref) {
                replaceRef = requestBilling.ref;
                items = items.map((item) => ({ ...item, additional_info: { ref: replaceRef } }));
            }
        } else if (requestBilling.type === "alkes") {
            items = await Utils.buildFarmasiItems(serviceData, "3");
        }

        //* Destructuring layanan
        const { faskesUuid, patientUuid, noReg,  name: patientName, paymentMethod, uuid: layananUuid } = layanan;
        
        //* Complex destructuring untuk type service, nama dokter, nama layanan
        const serviceType = layanan.encounter || layanan.encounter;
        const practitionerName = layanan.practitioner?.pegawai?.name;
        const serviceName = await Utils.serviceName(serviceType, layanan);

        console.log("Items Billing:", items);
        const payload = {
            faskes_uuid: faskesUuid,
            patient_uuid: patientUuid,
            patient_name: patientName,
            target_patient_uuid: targetPatient,
            services: [
                {
                    type: serviceType,
                    practitioner_name: practitionerName,
                    service_name: serviceName,
                    service_code: noReg,
                    layanan_uuid: layananUuid,
                    with_insurance: paymentMethod === 1 ? false : true,
                    ...(replaceRef ? { replace_ref: replaceRef } : {}),
                    items
                }
            ]
        };
        console.log("Payload Billing:", payload);
        // throw new Error("Debug");

        //* Create Billing dari Modul Pembayaran
        try {
            const result = await createBilling.post("/", payload, {
                headers: {
                    Authorization: requestBilling.token,
                },
            });

            return result.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || "Terjadi kesalahan pada kirim data Pembayaran");
        }

    }
}