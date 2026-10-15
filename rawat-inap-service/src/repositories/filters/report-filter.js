import sequelizeInstance from "@opensimrs/model-sdk/instance";
import { Op } from "sequelize";

export function perpindahanReportFilter({ faskesUuid, args = {}, options = {} }) {
    console.log("Tanggal:", args);
    const filter = {
        faskesUuid,
        [Op.or]: [
            //* Filter No Rm Layanan
            sequelizeInstance.where(sequelizeInstance.col("rawat_inap.no_rm"), { [Op.iLike]: `%${args.q || ""}%` }),
            //* Filter nama pasien
            sequelizeInstance.where(sequelizeInstance.col("rawat_inap.name"), { [Op.iLike]: `%${args.q || ""}%` }),
            //* Filter Alamat
            sequelizeInstance.where(sequelizeInstance.col("rawat_inap.patient.address.full_address"), { [Op.iLike]: `%${args.q || ""}%` }),
        ],
        waktu_pindah: {
            [Op.between]: [args.start_date, args.end_date],
        },
        status_pindah: {
            [Op.eq]: "approve"
        }
    };

    return filter;
}