import { BirthDetailModel, PatientModel, RoomMonitoringModel } from "@opensimrs/model-sdk/admisi";
import { LokasiModel, PegawaiModel, PractitionerModel } from "@opensimrs/model-sdk/datamaster";
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
                attributes: ["uuid", "full_address"],
            },
            {
                model: BirthDetailModel,
                as: "birth_detail",
                required: false,
                where: { deletedAt: { [Op.is]: null } },
                attributes: ["birth_date", "age_year", "age_month", "age_day"],
            }
        ],
        attributes: ["name", "gender", "no_rm", "identity", "no_identity"],
    },
    {
        model: LokasiModel,
        as: "lokasi",
        required: true,
        where: { deletedAt: { [Op.is]: null } },
        attributes: ["uuid", "name"],
    },
    {
        model: PractitionerModel,
        as: "practitioner",
        required: true,
        where: { deletedAt: { [Op.is]: null } },
        attributes: ["uuid"],
        include: [
            {
                model: PegawaiModel,
                as: "pegawai",
                required: true,
                where: { deletedAt: { [Op.is]: null } },
                attributes: ["uuid", "name"],
            }
        ],
    }
]