import { BirthDetailModel, InsuranceAccountModel, PatientModel, RoomMonitoringModel } from "@opensimrs/model-sdk/admisi";
import { LokasiModel, PegawaiModel, PractitionerModel } from "@opensimrs/model-sdk/datamaster";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { InsuranceAdmissionModel, RawatInapModel } from "@opensimrs/model-sdk/pelayanan";
import { AddressModel } from "@opensimrs/model-sdk/setting";
import { Op } from "sequelize";

export const kunjunganReportInclude = [
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
                deletedAt: { [Op.is]: null },
                },
                attributes: ["full_address"],
            },
            {
                model: BirthDetailModel,
                as: "birth_detail",
                required: false,
                where: { deletedAt: { [Op.is]: null } },
                attributes: ["birth_date", "age_year", "age_month", "age_day"],
            }
        ],
        attributes: ["name", "gender", "no_rm"],
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
        ],
    },
    {
        model: PractitionerModel,
        as: "practitioner",
        required: false,
        where: { deletedAt: { [Op.is]: null } },
        attributes: ["uuid"],
        include: [
            {
                model: PegawaiModel,
                as: "pegawai",
                required: false,
                where: { deletedAt: { [Op.is]: null } },
                attributes: ["uuid", "name"],
            }
        ],
    }
]

export const perpindahanReportInclude = [
    {
        model: RawatInapModel,
        as: "rawat_inap",
        required: true,
        where: { deletedAt: { [Op.is]: null } },
        attributes: [
            "uuid", "no_reg", "no_rm", "no_pelayanan", "name", "payment_method"
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
                            "full_address",
                        ],
                    },
                    {
                        model: InsuranceAccountModel,
                        as: "insurance",
                        required: false,
                        where: { deletedAt: { [Op.is]: null } },
                        attributes: ["name", "account_number"],
                        include: [
                            {
                                model: InsuranceAdmissionModel,
                                as: "insurance_admissions",
                                required: false,
                                where: sequelizeInstance.where(
                                    sequelizeInstance.col("rawat_inap.patient.insurance.insurance_admissions.no_reg"),
                                    { [Op.eq]: sequelizeInstance.col("rawat_inap.no_reg") }
                                ),
                                attributes: []
                            }
                        ]
                    },
                ],
                attributes: ["uuid"]
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
                        attributes: ["uuid", "first_title", "last_title", "name", "gender"]
                    }
                ]
            },
        ]
    },
    {
        model: RoomMonitoringModel,
        as: "origin_monitoring_room",
        attributes: ["uuid", "no_bed"],
        include: [
            {
                model: LokasiModel,
                as: "bed_lokasi",
                required: true,
                where: { deletedAt: { [Op.is]: null } },
                attributes: ["uuid", "code", "name"],
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
        attributes: ["uuid", "no_bed"],
        include: [
            {
                model: LokasiModel,
                as: "bed_lokasi",
                required: true,
                where: { deletedAt: { [Op.is]: null } },
                attributes: ["uuid", "code", "name"],
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
]