import { BirthDetailModel, PatientModel, RoomMonitoringModel } from "@opensimrs/model-sdk/admisi";
import { LokasiModel, PegawaiModel, PractitionerModel } from "@opensimrs/model-sdk/datamaster";
import { AddressModel } from "@opensimrs/model-sdk/setting";
import { Op } from "sequelize";

export const kunjunganReportInclude = [
    {
        model: PatientModel,
        as: "patient",
        required: false,
        where: { deletedAt: { [Op.is]: null } },
        include: [
            {
                model: AddressModel,
                as: "address",
                required: false,
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
        attributes: ["name", "gender", "no_rm"],
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