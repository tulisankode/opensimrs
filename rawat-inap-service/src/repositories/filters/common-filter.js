import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

export function commonFilterReport({ faskesUuid, args = {}, options = {} }) {
    const filter = {
        faskesUuid,
        [Op.or]: [
                //* Filter No Rm Layanan
            {no_rm: { [Op.iLike]: `%${args.q || ""}%` }},
                //* Filter Nama dan Title patient
            sequelizeInstance.where(sequelizeInstance.fn("concat", sequelizeInstance.col("patient.title"), " ", sequelizeInstance.col("patient.name")), { [Op.iLike]: `%${args.q || ""}%` }),
                //* Filter Alamat
            sequelizeInstance.where(sequelizeInstance.col("patient.address.full_address"), { [Op.iLike]: `%${args.q || ""}%` }),
                //* Filter No Rm Patient
            sequelizeInstance.where(sequelizeInstance.col("patient.no_rm"), { [Op.iLike]: `%${args.q || ""}%` }),
            ],
        ...options
    }

    if (args.practitioner_uuid) filter.practitionerUuid = args.practitioner_uuid;

    if (args.room) filter.room = sequelizeInstance.where(sequelizeInstance.col("monitoring_room.room.name") , { [Op.iLike]: `%${args.room || ""}%` });

    if (args.kelas) filter.kelas = sequelizeInstance.where(sequelizeInstance.col("monitoring_room.room.class_name"), { [Op.iLike]: `%${args.kelas || ""}%` });

    return filter;
}

export function cancelReportFilter({faskesUuid, args = {}, options = {}}) {
    const filter = commonFilterReport({
        faskesUuid,
        args,
        options: {
            ...options,
            deletedAt: {
                [Op.between]: [args.start_date, args.end_date],
            },
            statusRi: 0
        }
    });
    
    return filter;
}