import sequelizeInstance from "../configurations/sequelize-instance.js";
import Pagination from "../helpers/pagination.js";
import {Op} from "sequelize";
import moment from "moment";
import {HistoryTindakanModel, PetugasTindakanModel} from "@opensimrs/model-sdk/rekam-medis";
import { InstalasiGawatDaruratModel } from "@opensimrs/model-sdk/pelayanan";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { Context } from "../middlewares/context.js";
import { cancelReportFilter, commonFilterReport } from "./filters/common-filter.js";
import { kunjunganReportInclude } from "./include/report-include.js";

export default class ReportRepository {
    static async getAllKunjungan(args) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
            try {
                const filter = commonFilterReport({ faskesUuid, args, options: { discharge_date: { [Op.between]: [args.start_date, args.end_date] } } });

                const options = {
                include: kunjunganReportInclude,
                attributes: ["uuid", "no_reg", "no_pelayanan", "tanggal_daftar", "discharge_date", "kondisi_pasien_pulang", "status_pulang"],
                };

                const transform = {
                    practitioner: (row) => ({
                    uuid: undefined,
                    ...row.practitioner.pegawai.get(),
                    }),
                };

                //* Tanpa Pagination
                if (args.all === "aktif") {
                    const allData = await InstalasiGawatDaruratModel.findAll({
                    where: filter,
                    ...options,
                    });

                    const dataTransform = await Pagination.transform(allData, transform);

                    return {
                    data: dataTransform,
                    };
                }

                return await Pagination.init(InstalasiGawatDaruratModel, args, filter, options, transform);
            } catch (error) {
                console.log("Error on LogPelayananRepository");
                throw error;
            }
    }

    static async getCancelKunjungan(args) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
            try {
                const filter = cancelReportFilter({ faskesUuid, args, options: {} });

                const options = {
                    include: kunjunganReportInclude,
                    attributes: ["uuid", "tanggal_daftar", "no_reg", "no_pelayanan", "petugas", "alasan_batal", "deletedAt"],
                };

                const transform = {
                    practitioner: (row) => ({
                    uuid: undefined,
                    ...row.practitioner.pegawai.get(),
                    }),
                };

                //* Tanpa Pagination
                if (args.all === "aktif") {
                    const allData = await InstalasiGawatDaruratModel.findAll({
                        where: filter,
                        ...options,
                    });

                    const dataTransform = await Pagination.transform(allData, transform);

                    return {
                        data: dataTransform,
                    };
                }

                return await Pagination.init(InstalasiGawatDaruratModel, args, filter, options, transform);
            } catch (error) {
                console.log("Error on LogPelayananRepository");
                throw error;
            }
    }
    
    static async getTindakans(args) {
        return sequelizeInstance.transaction(async (tr) => {
            const currentYear = moment().year();
            const currentMonth = moment().month() + 1;
            const startOfMonth = moment().year(currentYear).month((args.month ?? currentMonth) - 1).startOf('month').unix();
            const endOfMonth = moment().year(currentYear).month((args.month ?? currentMonth) - 1).endOf('month').unix();

            let filter = {
                nama_tindakan: {[Op.like]: `%${args.name || ""}%`},
                created_at: {
                    [Op.between]: [startOfMonth, endOfMonth]
                },
                pelayanan : {[Op.like]: `%${args.pelayanan || ""}%`},
                faskes_uuid: args.faskes_uuid,
            };

            if (args.lokasi_uuid !== undefined && args.lokasi_uuid !== "" && args.lokasi_uuid !== null) {
                filter.lokasi_uuid = {[Op.like]: `%${args.lokasi_uuid || ""}%`}
            }

            const option = {
                where: {
                    ...filter
                },
                include: [
                    {
                        model: PetugasTindakanModel,
                        as: "petugas_tindakan",
                        attributes: ["practitionerUuid"],
                        required: false,
                        where: {
                            practitioner_uuid: {
                                [Op.iLike]: `%${args.practitioner_uuid || ""}%`
                            }
                        }
                    }
                ],
            }

            return await Pagination.init(HistoryTindakanModel, args, option);
        });

    }
}