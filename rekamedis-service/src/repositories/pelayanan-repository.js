import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {Op} from "sequelize";
import BadRequestException from "../errors/bad-request-exception.js";
import Utils from "../helpers/utils.js";
import {InstalasiGawatDaruratModel, RawatInapModel, RawatJalanModel} from "@opensimrs/model-sdk/pelayanan";
import {HistoryTindakanModel, OrderFisioModel, PetugasTindakanModel} from "@opensimrs/model-sdk/rekam-medis";
import moment from "moment";
import { eventEmitter } from "../helpers/event.js";
import { LOG_PELAYANAN_CHANNEL } from "../constant/event-constant.js";
import { LokasiModel, PegawaiModel, PractitionerModel } from "@opensimrs/model-sdk/datamaster";
import { PatientModel, RoomMonitoringModel } from "@opensimrs/model-sdk/admisi";
import AntrianPelayananRepository from "./antrian-pelayanan-repository.js";

// Ruangan rawat inap. model-sdk belum mendefinisikan relasi ini sehingga simpan tindakan pasien RI
// gagal "LokasiModel is not associated to RawatInap!".
if (!RawatInapModel.associations.ruangan) {
    RawatInapModel.belongsTo(LokasiModel, { as: "ruangan", foreignKey: "lokasi_uuid", targetKey: "uuid", constraints: false });
}

export default class PelayananRepository {
    static async updateResume(pelayanan ,data) {
        if (pelayanan === "igd"){
            return await sequelizeInstance.transaction(async tr => {
                return await InstalasiGawatDaruratModel.update(data, {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        deletedAt: {
                            [Op.is]: null
                        },
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        } else if (pelayanan === "rj") {
            return await sequelizeInstance.transaction(async tr => {
                return await RawatJalanModel.update(data, {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        deletedAt: {
                            [Op.is]: null
                        },
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        } else if (pelayanan === "ri") {
            return await sequelizeInstance.transaction(async tr => {
                return await RawatInapModel.update(data, {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        deletedAt: {
                            [Op.is]: null
                        },
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        }else if (pelayanan === "fisio") {
            return await sequelizeInstance.transaction(async tr => {
                return await OrderFisioModel.update(Utils.camelToSnakeObject(data), {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        deletedAt: {
                            [Op.is]: null
                        },
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        } else {
            throw new BadRequestException(`Pelayanan ${pelayanan} tidak ada`);
        }
    }

    static async getResume(pelayanan, data) {
        const attributes = [
            "rekam_medis_uuid",
            "edukasi",
            "edukasi_text",
            "kondisi_pasien_pulang",
            "status_pulang",
            "status_pulang_keterangan",
            "tujuan_rujuk",
            "tujuan_rujuk_lainnya",
            "instruksi_no_darurat",
            "transport_rujuk",
            "transport_rujuk_lainnya",
            "is_internal",
            "rujuk_internal",
            "rujuk_eksternal",
            "instruksi_tindak_lanjut",
            "discharge_date",
        ];

        if (pelayanan === "igd") {
            return await InstalasiGawatDaruratModel.findOne({
                where: {
                    rekam_medis_uuid: data.rekamMedisUuid,
                    deletedAt: {
                        [Op.is]: null
                    },
                    faskes_uuid: data.faskesUuid
                },
                attributes : attributes
            });
        } else if (pelayanan === "rj") {
            return await RawatJalanModel.findOne({
                where: {
                    rekam_medis_uuid: data.rekamMedisUuid,
                    deletedAt: {
                        [Op.is]: null
                    },
                    faskes_uuid: data.faskesUuid
                },
                attributes : attributes
            });
        } else if (pelayanan === "ri") {
            return await RawatInapModel.findOne({
                where: {
                    rekam_medis_uuid: data.rekamMedisUuid,
                    deletedAt: {
                        [Op.is]: null
                    },
                    faskes_uuid: data.faskesUuid
                },
                attributes : attributes
            });
        } else if (pelayanan === "fisio") {
            attributes.push(...["fase_rehabilitasi", "prognosis"]);
            return await OrderFisioModel.findOne({
                where: {
                    rekam_medis_uuid: data.rekamMedisUuid,
                    deletedAt: {
                        [Op.is]: null
                    },
                    faskes_uuid: data.faskesUuid
                },
                attributes : attributes
            });
        } else {
            throw new BadRequestException(`Pelayanan ${pelayanan} tidak ada`);
        }
    }

    static async dichargeService(pelayanan, data){
        if (pelayanan === "igd") {
            return await sequelizeInstance.transaction(async tr => {
                const result = await InstalasiGawatDaruratModel.update({statusIgd : 2, dischargeDate: data.dischargeDate}, {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });

                const results = await InstalasiGawatDaruratModel.findOne({
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });

                eventEmitter.emit(LOG_PELAYANAN_CHANNEL, {
                    faskes_uuid: results.faskesUuid,
                    tgl_registrasi: results.tanggalDaftar,
                    noreg: results.noReg,
                    no_pelayanan: results.noPelayanan,
                    practitioner_uuid: results.practitionerUuid,
                    jenis_kunjungan: "IGD",
                    patient_uuid: results.patientUuid,
                    lokasi_uuid: results.lokasiUuid,
                    discharge_date: data.dischargeDate,
                    payment_method: results.paymentMethod === "TUNAI" ? 1 : 2,
                });

                return result;
            });
        } else if (pelayanan === "rj") {
            return await sequelizeInstance.transaction(async tr => {
                
                const update = await RawatJalanModel.update({statusRj : 5, dischargeDate: data.dischargeDate}, {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
                
                const results = await RawatJalanModel.findOne({
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });

                // Panggilan poli ikut selesai & antrian farmasi dibuat bila ada resep, tanpa harus
                // menekan "Selesai" di panel panggilan.
                await AntrianPelayananRepository.selesaikanAntrianRawatJalan({
                    rawatJalanUuid: results?.uuid,
                    rekamMedisUuid: data.rekamMedisUuid,
                    faskesUuid: data.faskesUuid,
                }, tr);

                eventEmitter.emit(LOG_PELAYANAN_CHANNEL, {
                    faskes_uuid: results.faskesUuid,
                    tgl_registrasi: results.tanggalDaftar,
                    noreg: results.noReg,
                    no_pelayanan: results.noPelayanan,
                    practitioner_uuid: results.practitionerUuid,
                    jenis_kunjungan: "RJ",
                    patient_uuid: results.patientUuid,
                    lokasi_uuid: results.lokasiUuid,
                    discharge_date: data.dischargeDate,
                    payment_method: results.paymentMethod === "TUNAI" ? 1 : 2,
                });

                return update;

            });
        } else if (pelayanan === "ri") {
            return await sequelizeInstance.transaction(async tr => {
                const update = await RawatInapModel.update({statusRi : 4, dischargeDate: data.dischargeDate}, {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });

                const results = await RawatInapModel.findOne({
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });

                // Pasien pulang: kosongkan bed yang ditempati agar bisa dipakai pasien berikutnya
                // (sebelumnya bed hanya dilepas saat kunjungan dibatalkan).
                if (results?.monitoringRoomUuid) {
                    await RoomMonitoringModel.update(
                        { patientUuid: null, status_operasional: "Tersedia" },
                        { where: { uuid: results.monitoringRoomUuid, faskesUuid: data.faskesUuid }, transaction: tr }
                    );
                }

                eventEmitter.emit(LOG_PELAYANAN_CHANNEL, {
                    faskes_uuid: results.faskesUuid,
                    tgl_registrasi: results.tanggalDaftar,
                    noreg: results.noReg,
                    no_pelayanan: results.noPelayanan,
                    practitioner_uuid: results.practitionerUuid,
                    jenis_kunjungan: "RI",
                    patient_uuid: results.patientUuid,
                    lokasi_uuid: results.lokasiUuid,
                    discharge_date: data.dischargeDate,
                    payment_method: results.paymentMethod === "TUNAI" ? 1 : 2,
                });

                return update;

            });
        }else if (pelayanan === "fisio") {
            return await sequelizeInstance.transaction(async tr => {
                return await OrderFisioModel.update({status_fisio : 5}, {
                    where: {
                        rekam_medis_uuid : data.rekamMedisUuid,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        } else {
            throw new BadRequestException(`Pelayanan ${pelayanan} tidak ada`);
        }
    }

    static async insertRekamMedis(pelayanan, data){
        if (pelayanan === "igd") {
            return await sequelizeInstance.transaction(async tr => {
                return await InstalasiGawatDaruratModel.update({rekamMedisUuid : data.rekamMedisUuid}, {
                    where: {
                        no_pelayanan : data.noPelayanan,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        } else if (pelayanan === "rj") {
            return await sequelizeInstance.transaction(async tr => {
                return await RawatJalanModel.update({rekamMedisUuid : data.rekamMedisUuid}, {
                    where: {
                        no_pelayanan : data.noPelayanan,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        } else if (pelayanan === "ri") {
            return await sequelizeInstance.transaction(async tr => {
                return await RawatInapModel.update({rekamMedisUuid : data.rekamMedisUuid}, {
                    where: {
                        no_pelayanan : data.noPelayanan,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        } else if (pelayanan === "fisio") {
            return await sequelizeInstance.transaction(async tr => {
                return await OrderFisioModel.update({rekam_medis_uuid : data.rekamMedisUuid}, {
                    where: {
                        no_order : data.noPelayanan,
                        faskes_uuid: data.faskesUuid
                    },
                    transaction: tr
                });
            });
        }else {
            throw new BadRequestException(`Pelayanan ${pelayanan} tidak ada`);
        }
    }

    static async insertHistory(histories, petugas) {
        return await sequelizeInstance.transaction(
            async tr => {
                await HistoryTindakanModel.bulkCreate(histories, {transaction: tr});
                await PetugasTindakanModel.bulkCreate(petugas, {transaction: tr});
            }
        )
    }

    static async getPelayanan(pelayanan, rekam_medis_uuid) {
        if (pelayanan === "igd") {
            const result = await InstalasiGawatDaruratModel.findOne({
                where: {
                    rekamMedisUuid: rekam_medis_uuid,
                    deletedAt: {
                        [Op.is]: null
                    }
                },
                include: [
                    {
                        model: PractitionerModel,
                        as: "practitioner",
                        required: true,
                        where: {deletedAt: {[Op.is]: null}},
                        attributes: ["uuid", "is_doctor", "status", "sip"],
                        include: [
                            {
                                model: PegawaiModel,
                                as: "pegawai",
                                required: true,
                                where: {deletedAt: {[Op.is]: null}},
                                attributes: ["name"]
                            }
                        ]
                    },
                    {
                        model: PatientModel,
                        as: "patient",
                        required: false,
                        where: {
                            deletedAt: {[Op.is]: null}
                        },
                        attributes: [
                            "uuid", "noIdentity", "is_new_born"
                        ]
                    }
                ]
            });

            return { ...result.get({ plain: true }), encounter: "IGD" };
        } else if (pelayanan === "rj") {
            const result = await RawatJalanModel.findOne({
                where: {
                    rekamMedisUuid: rekam_medis_uuid,
                    deletedAt: {
                        [Op.is]: null
                    }
                },
                include: [
                    {
                        model: PractitionerModel,
                        as: "practitioner",
                        required: true,
                        where: {deletedAt: {[Op.is]: null}},
                        attributes: ["uuid", "is_doctor", "status", "sip"],
                        include: [
                            {
                                model: PegawaiModel,
                                as: "pegawai",
                                required: true,
                                where: {deletedAt: {[Op.is]: null}},
                                attributes: ["name"]
                            }
                        ]
                    },
                    {
                        model: LokasiModel,
                        as: "lokasi",
                        required: true,
                        where: {deletedAt: {[Op.is]: null}},
                        attributes: [
                            "uuid", "name", "code", "is_poli", "location_type"
                        ]
                    },
                    {
                        model: PatientModel,
                        as: "patient",
                        required: false,
                        where: {
                            deletedAt: {[Op.is]: null}
                        },
                        attributes: [
                            "uuid", "noIdentity", "is_new_born"
                        ]
                    }
                ]
            });

            return { ...result.get({ plain: true }), encounter: "RJ" };
        } else if (pelayanan === "ri") { 
            const result = await RawatInapModel.findOne({
                where: {
                    rekamMedisUuid: rekam_medis_uuid,
                    deletedAt: {
                        [Op.is]: null
                    }
                },
                include: [
                    {
                        model: PractitionerModel,
                        as: "practitioner",
                        required: true,
                        where: {deletedAt: {[Op.is]: null}},
                        attributes: ["uuid", "is_doctor", "status", "sip"],
                        include: [
                            {
                                model: PegawaiModel,
                                as: "pegawai",
                                required: true,
                                where: {deletedAt: {[Op.is]: null}},
                                attributes: ["name"]
                            }
                        ]
                    },
                    {
                        model: LokasiModel,
                        as: "ruangan",
                        required: false,
                        where: {deletedAt: {[Op.is]: null}},
                        attributes: [
                            "uuid", "name"
                        ]
                    },
                    {
                        model: PatientModel,
                        as: "patient",
                        required: false,
                        where: {
                            deletedAt: {[Op.is]: null}
                        },
                        attributes: [
                            "uuid", "noIdentity", "is_new_born"
                        ]
                    }
                ]
            });

            return { ...result.get({ plain: true }), encounter: "RI" };
        }else {
            throw new BadRequestException(`Pelayanan ${pelayanan} tidak ada`);
        }
    }

    static async createRawatInap(data) {
        return await sequelizeInstance.transaction(async tr => {
            return await RawatInapModel.create(data, {
                transaction: tr,
                validate: false
            });
        });
    }
}