import { InsuranceAdmissionModel, PerpindahanModel, RawatInapModel } from "@opensimrs/model-sdk/pelayanan";
import Pagination from "../helpers/pagination.js";
import { cancelReportInclude, kunjunganReportInclude, perpindahanReportInclude } from "./include/report-include.js";
import { cancelReportFilter, commonFilterReport } from "./filters/common-filter.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import { Op } from "sequelize";
import { perpindahanReportFilter } from "./filters/report-filter.js";
import { InsuranceAccountModel } from "@opensimrs/model-sdk/admisi";

InsuranceAccountModel.hasMany(InsuranceAdmissionModel, {
    foreignKey: "insurance_account_uuid",
    as: "insurance_admissions",
});

export default class ReportRepository {
    static async getAllKunjungan(args) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
            try {
                const filter = commonFilterReport({ faskesUuid, args, options: { discharge_date: { [Op.between]: [args.start_date, args.end_date] } } });

                const options = {
                include: kunjunganReportInclude,
                attributes: ["no_reg", "no_pelayanan", "tanggal_daftar", "discharge_date", "kondisi_pasien_pulang", "status_pulang"],
                };

                if (args.all === "aktif") {
                    const allData = await RawatInapModel.findAll({
                        where: filter,
                        ...options,
                    });

                    return {
                        data: allData,
                    };
                }

                return await Pagination.init(RawatInapModel, args, filter, options);
            } catch (error) {
                console.log("Error repository Report Kunjungan");
                throw error;
            }
    }

    static async getCancelKunjungan(args) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
            try {
                const filter = cancelReportFilter({ faskesUuid, args, options: {} });

                const options = {
                    include: cancelReportInclude,
                    attributes: ["tanggal_daftar", "no_reg", "no_pelayanan", "petugas", "alasan_batal", "deletedAt"],
                };

                if (args.all === "aktif") {
                    const allData = await RawatInapModel.findAll({
                        where: filter,
                        ...options,
                    });

                    return {
                        data: allData,
                    };
                }

                return await Pagination.init(RawatInapModel, args, filter, options);
            } catch (error) {
                console.log("Error repository Cancel Kunjungan");
                throw error;
            }
    }

    static async getPerpindahanPasien(args) {
        const { faskesUuid } = Context.get(CTX_AUTHOR);
            try {
                const filter = perpindahanReportFilter({ faskesUuid, args, options: {} });

                const options = {
                    include: perpindahanReportInclude,
                    attributes: ["petugas", "waktu_pindah",],
                    subQuery: false,
                }

                if (args.all === "aktif") {
                    const allData = await PerpindahanModel.findAll({
                        where: filter,
                        ...options,
                    });

                    return {
                        data: allData,
                    };
                }
                
                return await Pagination.init(PerpindahanModel, args, filter, options, {}, true);

            } catch (error) {
                console.log("Error repository Rekap Pasien");
                throw error;
            }
    }
}