import {Context} from "../middlewares/context.js";
import {CTX_AUTHOR} from "../constants/context-constant.js";
import NotfoundException from "../exceptions/notfound-exception.js";
import {
    RawatInapModel,
    PerpindahanModel
} from "@opensimrs/model-sdk/pelayanan";
import {
    RoomMonitoringModel,
    PatientModel,
    BirthDetailModel
} from "@opensimrs/model-sdk/admisi";
import {
    AddressModel
} from "@opensimrs/model-sdk/setting";
import {
    PractitionerModel,
    PegawaiModel,
    LokasiModel
} from "@opensimrs/model-sdk/datamaster";

import moment from "moment";
import BadRequestException from "../exceptions/bad-request-exception.js";
import {Op} from "sequelize";
import Pagination from "../helpers/pagination.js";
import sequelizeInstance from "../configs/sequelize-instance.js";
import HduRepository from "./hdu-repository.js";
import HduPerpindahanAdapter from "../services/hdu-perpindahan-adapter.js";
import { gagal } from "../services/hdu-aturan.js";

export default class PerpindahanRepository {
    
    static async GetCurrentBed(uuid) {
        try {
            const { faskesUuid } = Context.get(CTX_AUTHOR);

            console.log("uuid", uuid);

            const bed = await RawatInapModel.findOne({
                where: {
                    uuid,
                    faskesUuid
                },
                include: [
                    {
                        model: RoomMonitoringModel,
                        as: "monitoring_room",
                        attributes: ["uuid", "room_uuid", "no_bed"],
                    },
                ],
                attributes: []
            });
            console.log("bed", bed);

            if(!bed) throw new NotfoundException("Data tidak ditemukan!");

            return bed.monitoring_room;
        }catch (error) {
            throw error;
        }
    }


    static async RequestMoveBed(uuid, request) {
        try{
            const { faskesUuid, username } = Context.get(CTX_AUTHOR);
            const currentBed = await this.GetCurrentBed(uuid);
            console.log("currentBed", currentBed);
            if(!currentBed) throw new NotfoundException("Data tidak ditemukan!");
            // check bed if empty
            const checkBed = await RoomMonitoringModel.findOne({
                where: {
                    uuid: request.destination_monitoring_room_uuid,
                    faskesUuid,
                    deletedAt: null
                }
            });
            
            if(!checkBed) throw new NotfoundException("Data Bed tidak ditemukan!");
            if(checkBed.patientUuid) throw new BadRequestException("Bed sudah terisi!");
            
            await RawatInapModel.update(
                {
                    statusRi: 2
                },
                {
                    where: {
                        uuid: uuid,
                        faskesUuid,
                    }
                }
            )

            console.log(currentBed);
            const result = await PerpindahanModel.create({
                faskesUuid,
                petugas: username,
                admissionRiUuid: uuid,
                originMonitoringRoomUuid: currentBed.uuid,
                destinationMonitoringRoomUuid: request.destination_monitoring_room_uuid,
                keterangan: request.keterangan,
                statusPindah: "pending"
            })

            if(!result) throw new Error("Gagal melakukan perpindahan!");

            return result;
        }catch (error) {
            throw error;
        }
    }

    static async GetAll(args){
        try{
            const { faskesUuid } = Context.get(CTX_AUTHOR);
            const filter = {
                faskesUuid,
                [Op.or]: [
                    {
                        '$rawat_inap.no_rm$': { [Op.iLike]: `%${args.q || ''}%` }
                    },
                    sequelizeInstance.where(
                        sequelizeInstance.fn('concat', sequelizeInstance.col('rawat_inap.patient.title'), ' ', sequelizeInstance.col('rawat_inap.patient.name')),
                        { [Op.iLike]: `%${args.q || ''}%` }
                    ),
                    sequelizeInstance.where(
                        sequelizeInstance.col('rawat_inap.patient.address.full_address'),
                        { [Op.iLike]: `%${args.q || ''}%` }
                    )
                ],
                status_pindah: "pending"
            };


            if (args.dpjp) {
                filter['$rawat_inap.practitioner.uuid$'] = args.dpjp;
            }

            if (args.payment_method) {
                const paymentMethodArray = args.payment_method.split(",").map((item) => item.trim());
                filter["$rawat_inap.payment_method$"] = { [Op.in]: paymentMethodArray };
            }

            const options = {
                include: [
                    {
                        model: RawatInapModel,
                        as: "rawat_inap",
                        required: true,
                        where: { deletedAt: { [Op.is]: null } },
                        attributes: [
                            "uuid", "no_reg", "no_rm", "no_pelayanan", "tanggal_daftar", "tanggal_daftar", "tanggal_dirawat", "payment_method"
                        ],
                        include: [
                            {
                                model: PatientModel,
                                as: "patient",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                include: [
                                    {
                                        model: AddressModel,
                                        as: "address",
                                        required: true,
                                        where: {
                                            deletedAt: {[Op.is]: null}
                                        },
                                        attributes: [
                                            "prov", "city", "district", "rt", "rw", "full_address", "country", "village"
                                        ],
                                    },
                                ],
                                attributes: [
                                    "uuid", "title", "name", "identity", "no_identity", "phone", "gender"
                                ]
                            },
                            {
                                model: BirthDetailModel,
                                as: "birth_detail",
                                required: true,
                                where: {deletedAt: {[Op.is]: null}},
                                attributes: [
                                    'age_year', 'age_month', 'age_day'
                                ]
                            },
                            {
                                model: PractitionerModel,
                                as: "practitioner",
                                required: true,
                                where: {deletedAt: {[Op.is]: null}},
                                attributes: ["uuid"],
                                include: [
                                    {
                                        model: PegawaiModel,
                                        as: "pegawai",
                                        required: true,
                                        where: {deletedAt: {[Op.is]: null}},
                                        attributes: ["first_title", "last_title", "name", "gender"]
                                    }
                                ]
                            },
                            {
                                model: RoomMonitoringModel,
                                as: "monitoring_room",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "room_uuid", "no_bed"],
                                include: [
                                    {
                                        model: LokasiModel,
                                        as: "bed_lokasi",
                                        required: true,
                                        where: { deletedAt: { [Op.is]: null } },
                                        attributes: ["uuid", "code", "name", "class_code", "class_name"],
                                    },
                                    {
                                        model: LokasiModel,
                                        as: "room",
                                        required: true,
                                        where: { deletedAt: { [Op.is]: null } },
                                        attributes: ["uuid", "code", "name", "class_code", "class_name"],
                                    }
                                ]
                            },
                        ]
                    },
                    {
                        model: RoomMonitoringModel,
                        as: "origin_monitoring_room",
                        attributes: ["uuid", "room_uuid", "no_bed"],
                        include: [
                            {
                                model: LokasiModel,
                                as: "bed_lokasi",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            },
                            {
                                model: LokasiModel,
                                as: "room",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            }
                        ]
                    },
                    {
                        model: RoomMonitoringModel,
                        as: "destination_monitoring_room",
                        attributes: ["uuid", "room_uuid", "no_bed"],
                        include: [
                            {
                                model: LokasiModel,
                                as: "bed_lokasi",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            },
                            {
                                model: LokasiModel,
                                as: "room",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            }
                        ]
                    }
                ],
                attributes: [
                    "uuid", "petugas", "waktu_pindah", "keterangan"
                ]
            }

            return await Pagination.init(
                PerpindahanModel,
                args,
                filter,
                options,
            )
        }catch (error) {
            throw error;
        }
    }

    static async ApproveMoveBed(uuid) {
        const repository = new HduRepository(sequelizeInstance, Context.get(CTX_AUTHOR));
        return sequelizeInstance.transaction(async (transaction) => {
            const q = (sql, data) => repository.query(sql, data, transaction);
            await q(`SELECT pg_advisory_xact_lock(hashtext(:f))`);
            const adapter = new HduPerpindahanAdapter(q);
            const perpindahan = await adapter.kunci(uuid);
            const { ri, tujuan } = perpindahan;
            const terkaitHdu = await q(`SELECT uuid FROM hdu_episode WHERE rawat_inap_uuid = :ri AND faskes_uuid = :f AND status = 'aktif' AND deleted_at IS NULL
                UNION ALL SELECT uuid FROM hdu_konfigurasi WHERE ruangan_uuid = :room AND faskes_uuid = :f AND deleted_at IS NULL`, { ri: ri.uuid, room: tujuan.room_uuid });
            if (terkaitHdu.length) gagal("Perpindahan HDU harus dikonfirmasi melalui serah terima HDU.");
            return adapter.pindahkan(perpindahan, moment().unix());
        });
    }


    static async RejectMoveBed(uuid) {
        const repository = new HduRepository(sequelizeInstance, Context.get(CTX_AUTHOR));
        return sequelizeInstance.transaction(async (transaction) => {
            const q = (sql, data) => repository.query(sql, data, transaction);
            await q(`SELECT pg_advisory_xact_lock(hashtext(:f))`);
            const { p, ri, asal } = await new HduPerpindahanAdapter(q).kunci(uuid);
            if (p.status_pindah !== "pending") gagal("Hanya perpindahan menunggu yang dapat ditolak.");
            if (ri.monitoring_room_uuid !== asal.uuid) gagal("Penempatan asal telah berubah.");
            await q(`UPDATE perpindahans SET status_pindah = 'reject', updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid });
            await q(`UPDATE rawat_inaps SET status_ri = 3, updated_at = :sekarang WHERE uuid = :uuid AND faskes_uuid = :f AND deleted_at IS NULL`, { uuid: ri.uuid });
            return { ...p, status_pindah: "reject" };
        });
    }


    static async GetHistoryBed(uuid) {
        try{
            const { faskesUuid } = Context.get(CTX_AUTHOR);
            return PerpindahanModel.findAll({
                where: {
                    admissionRiUuid: uuid,
                    faskesUuid,
                    statusPindah: "approve"
                },
                include: [
                    {
                        model: RoomMonitoringModel,
                        as: "origin_monitoring_room",
                        attributes: ["uuid", "room_uuid", "no_bed"],
                        include: [
                            {
                                model: LokasiModel,
                                as: "bed_lokasi",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            },
                            {
                                model: LokasiModel,
                                as: "room",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            }
                        ]
                    },
                    {
                        model: RoomMonitoringModel,
                        as: "destination_monitoring_room",
                        attributes: ["uuid", "room_uuid", "no_bed"],
                        include: [
                            {
                                model: LokasiModel,
                                as: "bed_lokasi",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            },
                            {
                                model: LokasiModel,
                                as: "room",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            }
                        ]
                    }
                ],
                attributes: [
                    "uuid",
                    "petugas",
                    "waktu_pindah",
                    "keterangan",
                ]
            });
        }catch (error) {
            throw error;
        }
    }


    static async GetDetailRequest(uuid) {
        try{
            const { faskesUuid } = Context.get(CTX_AUTHOR);
            return PerpindahanModel.findOne({
                where: {
                    uuid,
                    faskesUuid
                },
                include: [
                    {
                        model: RawatInapModel,
                        as: "rawat_inap",
                        required: true,
                        where: { deletedAt: { [Op.is]: null } },
                        attributes: [
                            "uuid", "rekam_medis_uuid"
                        ],
                    },
                    {
                        model: RoomMonitoringModel,
                        as: "origin_monitoring_room",
                        attributes: ["uuid", "room_uuid", "no_bed"],
                        include: [
                            {
                                model: LokasiModel,
                                as: "bed_lokasi",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            },
                            {
                                model: LokasiModel,
                                as: "room",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            }
                        ]
                    },
                    {
                        model: RoomMonitoringModel,
                        as: "destination_monitoring_room",
                        attributes: ["uuid", "room_uuid", "no_bed"],
                        include: [
                            {
                                model: LokasiModel,
                                as: "bed_lokasi",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            },
                            {
                                model: LokasiModel,
                                as: "room",
                                required: true,
                                where: { deletedAt: { [Op.is]: null } },
                                attributes: ["uuid", "code", "name", "class_code", "class_name"],
                            }
                        ]
                    }
                ],
                attributes: [
                    "uuid",
                    "petugas",
                    "waktu_pindah",
                    "keterangan",
                    "status_pindah"
                ]
            });
        }catch (error) {
            throw error;
        }
    }


    static async CountPendingRequest() {
        try{
            const { faskesUuid } = Context.get(CTX_AUTHOR);
            return PerpindahanModel.count({
                where: {
                    faskesUuid,
                    statusPindah: "pending"
                },
            });
        }catch (error) {
            throw error;
        }
    }
}
