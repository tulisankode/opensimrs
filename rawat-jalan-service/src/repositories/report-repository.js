import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Pagination from "../helpers/pagination.js";
import { Op, Sequelize } from "sequelize";
import moment from "moment";
import {HistoryTindakanModel, PetugasTindakanModel} from "@opensimrs/model-sdk/rekam-medis";
import { RawatJalanModel } from "@opensimrs/model-sdk/pelayanan";
import { kunjunganReportInclude } from "./include/report-include.js";
import { cancelReportFilter, commonFilterReport } from "./filters/common-filter.js";
import { Context } from "../middlewares/context.js";
import { CTX_AUTHOR } from "../constants/context-constant.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";
import { endOfMonthForEpochSec, startOfMonthForEpochSec } from "../helpers/date-helper.js";
dayjs.extend(utc);
dayjs.extend(tz);

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
                polyclinic: (row) => ({
                  ...row.lokasi.get(),
                }),
                lokasi: (row) => undefined,
            };

            //* Tanpa Pagination
            if (args.all === "aktif") {
                const allData = await RawatJalanModel.findAll({
                  where: filter,
                  ...options,
                });

                const dataTransform = await Pagination.transform(allData, transform);

                return {
                  data: dataTransform,
                };
            }

            return await Pagination.init(RawatJalanModel, args, filter, options, transform);
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
                polyclinic: (row) => ({
                  ...row.lokasi.get(),
                }),
                lokasi: (row) => undefined,
              };

              //* Tanpa Pagination
              if (args.all === "aktif") {
                  const allData = await RawatJalanModel.findAll({
                    where: filter,
                    ...options,
                  });

                  const dataTransform = await Pagination.transform(allData, transform);

                  return {
                    data: dataTransform,
                  };
              }

              return await Pagination.init(RawatJalanModel, args, filter, options, transform);
          } catch (error) {
              throw error;
          }
  }

  static async getTindakans(args) {
    const { faskesUuid } = Context.get(CTX_AUTHOR);

    console.log("Args Timestamp:", args.timestamp);
    
    const startOfMonth = dayjs.unix(args.timestamp).tz("Asia/Jakarta").startOf("month").unix(); 
    const endOfMonth = dayjs.unix(args.timestamp).tz("Asia/Jakarta").endOf("month").unix();
    
    console.log("StartOfMonth:", startOfMonthForEpochSec(startOfMonth) , "EndofMonth:", endOfMonthForEpochSec(args.timestamp) );

    console.log("StartofMonth args:", startOfMonthForEpochSec(args.timestamp), "EndofMonth args:", endOfMonthForEpochSec(args.timestamp));
    console.log("startOfMonth:", startOfMonth, "endOfMonth:", endOfMonth);
    
      try { 
        let filter = {
          faskesUuid,
          nama_tindakan: { [Op.like]: `%${args.name || ""}%` },
          // tanggal_tindakan (migrasi 20250225071917) belum dikenal model-sdk sehingga bisa kosong
          // → pakai created_at sebagai cadangan.
          [Op.and]: [
            Sequelize.where(
              Sequelize.literal('COALESCE("HistoryTindakanModel"."tanggal_tindakan", "HistoryTindakanModel"."created_at")'),
              { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth }
            ),
          ],
          pelayanan: { [Op.like]: `%${args.pelayanan || ""}%` },
        };

        if (args.lokasi_uuid) {
          filter.lokasi_uuid = args.lokasi_uuid;
        }

        const options = {
          include: [
            {
              model: PetugasTindakanModel,
              as: "petugas_tindakan",
              attributes: [],
              required: true,
              where: args.practitioner_uuid && { practitioner_uuid: args.practitioner_uuid },
            },
          ],
          attributes: ["HistoryTindakanModel.nama_tindakan", [sequelizeInstance.fn("SUM", sequelizeInstance.col("HistoryTindakanModel.qty_tindakan")), "total"]],
          group: ["HistoryTindakanModel.nama_tindakan"],
          raw: true,
          subQuery: false,
        };

        //* Tanpa Pagination
        if (args.all === "aktif") {
          const allData = await HistoryTindakanModel.findAll({
            where: filter,
            ...options,
          });

          return {
            data: allData,
          };
        }

        return await Pagination.initWithGroup(HistoryTindakanModel, args, filter, options);
      } catch (error) {
          throw error;
      }
  }
}
