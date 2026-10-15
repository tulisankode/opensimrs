import { Op, Sequelize } from "sequelize";
// import "../models/associations.js";
import { JadwalDokterModel } from "@opensimrs/model-sdk/antrian";
import {
  PractitionerModel,
  PegawaiModel,
  LokasiModel,
} from "@opensimrs/model-sdk/datamaster";
import moment from "moment";
import { FormatterService } from "../services/formatter.service.js";
import { ToIndoDay } from "../helpers/to-indo-day.js";

export class JadwalDokterRepository {
  static _buildCommonQueryOptions(filters = {}) {
    let tanggalFilterSql;
    if (filters.tanggal) {
      const tanggalEpoch = parseInt(filters.tanggal, 10);
      tanggalFilterSql = `${tanggalEpoch}`;
    } else {
      tanggalFilterSql =
        "EXTRACT(EPOCH FROM date_trunc('day', NOW(), 'Asia/Jakarta'))::bigint";
    }
    return {
      attributes: [
        // Get the uuid - group by this
        "uuid",

        // Get the code_antrian_dokter
        "code_antrian_dokter",

        // Get the code_antrian_poli
        [
          Sequelize.fn(
            "MAX",
            Sequelize.col("jadwal_dokter.lokasi.code_antrian_poli")
          ),
          "code_antrian_poli",
        ],

        [
          Sequelize.fn("MAX", Sequelize.col("jadwal_dokter.lokasi.name")),
          "lokasi_name",
        ],

        [Sequelize.col("jadwal_dokter.lokasi.uuid"), "lokasi_uuid"],

        [Sequelize.fn("MAX", Sequelize.col("pegawai.name")), "pegawai_name"],

        [
          Sequelize.fn("BOOL_OR", Sequelize.col("jadwal_dokter.status")),
          "status",
        ],

        [
          Sequelize.fn("array_agg", Sequelize.col("jadwal_dokter.uuid")),
          "jadwal_dokter_ids",
        ],
        [
          Sequelize.literal(
            "array_agg(TO_CHAR(jadwal_dokter.start_time, 'HH24:MI'))"
          ),
          "jadwal_dokter_start_times",
        ],

        [
          Sequelize.literal(
            "array_agg(TO_CHAR(jadwal_dokter.end_time, 'HH24:MI'))"
          ),
          "jadwal_dokter_end_times",
        ],
        [
          Sequelize.fn("array_agg", Sequelize.col("jadwal_dokter.day")),
          "jadwal_dokter_days",
        ],
        [
          Sequelize.fn("array_agg", Sequelize.col("jadwal_dokter.kuota")),
          "jadwal_dokter_kuotas",
        ],
        [
          Sequelize.fn("array_agg", Sequelize.col("jadwal_dokter.kuota_jkn")),
          "jadwal_dokter_kuotajkns",
        ],
        [
          Sequelize.fn(
            "array_agg",
            Sequelize.col("jadwal_dokter.kuota_non_jkn")
          ),
          "jadwal_dokter_kuotanonjkns",
        ],
        [
          Sequelize.fn(
            "array_agg",
            Sequelize.col("jadwal_dokter.durasi_pelayanan")
          ),
          "jadwal_dokter_durasi_pelayanans",
        ],
        [
          Sequelize.fn("array_agg", Sequelize.col("jadwal_dokter.status")),
          "jadwal_dokter_statuses",
        ],
        [
          Sequelize.literal(
            `array_agg(
      COALESCE(
        (SELECT "jumlah_jkn_aktif"
         FROM "report_antrian"
         WHERE "report_antrian"."jadwal_dokter_uuid" = "jadwal_dokter"."uuid"
         AND "report_antrian"."tanggal_pelayanan" = ${tanggalFilterSql}),
        0
      )
    )`
          ),
          "jadwal_dokter_jkn_terdaftar",
        ],
        [
          Sequelize.literal(
            `array_agg(
      COALESCE(
        (SELECT "jumlah_non_jkn_aktif"
         FROM "report_antrian"
         WHERE "report_antrian"."jadwal_dokter_uuid" = "jadwal_dokter"."uuid"
         AND "report_antrian"."tanggal_pelayanan" = ${tanggalFilterSql}),
        0
      )
    )`
          ),
          "jadwal_dokter_non_jkn_terdaftar",
        ],
      ],
      include: [
        {
          model: PegawaiModel,
          as: "pegawai",
          attributes: [],
        },
        {
          model: JadwalDokterModel,
          as: "jadwal_dokter",
          attributes: [],
          required: true,
          include: {
            model: LokasiModel,
            as: "lokasi",
            attributes: [],
            where: {
              is_poli: true,
              deletedAt: null,
            },
          },
          where: {
            deletedAt: null,
          },
        },
      ],
    };
  }

  static async findAll({ faskesUuid, filters, page, pageSize }) {
    const whereClause = {
      faskes_uuid: faskesUuid,
      is_doctor: true,
      deletedAt: null,
    };

    const limit = pageSize;
    const offset = (page - 1) * pageSize;

    if (filters.dokter) {
      whereClause["$pegawai.name$"] = {
        [Op.iLike]: `%${filters.dokter}%`,
      };
    }

    if (filters.poli) {
      whereClause["$jadwal_dokter.lokasi.name$"] = {
        [Op.iLike]: `%${filters.poli}%`,
      };
    }

    if (filters.doctor_uuid) {
      whereClause.uuid = filters.doctor_uuid;
    }

    if (filters.poli_uuid) {
      whereClause["$jadwal_dokter.lokasi.uuid$"] = filters.poli_uuid;
    }

    if (filters.aktif !== undefined) {
      whereClause["$jadwal_dokter.status$"] = filters.aktif;
    }

    const commonOptions = this._buildCommonQueryOptions(filters);

    const { count, rows: result } = await PractitionerModel.findAndCountAll({
      ...commonOptions,
      limit,
      offset,
      where: whereClause,
      group: ["PractitionerModel.uuid", "jadwal_dokter.lokasi.uuid"],
      order: [
        [Sequelize.fn("MIN", Sequelize.col("jadwal_dokter.created_at")), "ASC"],
      ],
      raw: true,
      nest: true,
      subQuery: false,
    });

    const ret = result.map((row) => ({
      doctor: {
        kode_antrian: row.code_antrian_dokter,
        name: row.pegawai_name,
        uuid: row.uuid,
      },
      poli: {
        kode_antrian: row.code_antrian_poli,
        name: row.lokasi_name,
        uuid: row.lokasi_uuid,
      },
      jadwal_dokter: row.jadwal_dokter_ids.map((uuid, index) => {
        // DATA JKN
        const kuota_jkn = row.jadwal_dokter_kuotajkns[index];
        const terdaftar_jkn = row.jadwal_dokter_jkn_terdaftar[index];
        const sisa_jkn = kuota_jkn - terdaftar_jkn;

        // DATA NON JKN
        const kuota_non_jkn = row.jadwal_dokter_kuotanonjkns[index];
        const terdaftar_non_jkn = row.jadwal_dokter_non_jkn_terdaftar[index];
        const sisa_non_jkn = kuota_non_jkn - terdaftar_non_jkn;

        return {
          jadwal_dokter_uuid: uuid,
          day: row.jadwal_dokter_days[index],
          start_time: row.jadwal_dokter_start_times[index],
          end_time: row.jadwal_dokter_end_times[index],

          //TOTAL KUOTA GABUNGAN
          kuota_total: kuota_jkn + kuota_non_jkn,
          kuota_terisi: terdaftar_jkn + terdaftar_non_jkn,
          sisa_kuota: sisa_jkn + sisa_non_jkn,

          //KUOTA JKN
          kuota_jkn: kuota_jkn,
          kuota_terisi_jkn: terdaftar_jkn,
          sisa_kuota_jkn: sisa_jkn,

          //KUOTA NON JKN
          kuota_non_jkn: kuota_non_jkn,
          kuota_terisi_non_jkn: terdaftar_non_jkn,
          sisa_kuota_non_jkn: sisa_non_jkn,

          durasi_pelayanan: row.jadwal_dokter_durasi_pelayanans[index],
          status: row.jadwal_dokter_statuses[index] ? "aktif" : "non aktif",
        };
      }),
    }));

    return {
      pagination: {
        page,
        pageSize,
        total: count.length,
      },
      data: ret,
    };
  }

  static async findAllWithoutPagination({ faskesUuid, filters }) {
    const whereClause = {
      faskes_uuid: faskesUuid,
      is_doctor: true,
      deletedAt: null,
    };

    if (filters.dokter) {
      whereClause["$pegawai.name$"] = { [Op.iLike]: `%${filters.dokter}%` };
    }
    if (filters.poli) {
      whereClause["$jadwal_dokter.lokasi.name$"] = {
        [Op.iLike]: `%${filters.poli}%`,
      };
    }
    if (filters.doctor_uuid) {
      whereClause.uuid = filters.doctor_uuid;
    }
    if (filters.poli_uuid) {
      whereClause["$jadwal_dokter.lokasi.uuid$"] = filters.poli_uuid;
    }
    if (filters.aktif !== undefined) {
      whereClause["$jadwal_dokter.status$"] = filters.aktif;
    }

    const commonOptions = this._buildCommonQueryOptions(filters);

    const queryOptions = {
      ...commonOptions,
      where: whereClause,
      group: ["PractitionerModel.uuid", "jadwal_dokter.lokasi.uuid"],
      order: [
        [Sequelize.fn("MIN", Sequelize.col("jadwal_dokter.created_at")), "ASC"],
      ],
      raw: true,
      nest: true,
      subQuery: false,
    };

    const { rows: result } = await PractitionerModel.findAndCountAll(
      queryOptions
    );

    const ret = result.map((row) => ({
      doctor: {
        kode_antrian: row.code_antrian_dokter,
        name: row.pegawai_name,
        uuid: row.uuid,
      },
      poli: {
        kode_antrian: row.code_antrian_poli,
        name: row.lokasi_name,
        uuid: row.lokasi_uuid,
      },
      jadwal_dokter: row.jadwal_dokter_ids.map((uuid, index) => {
        // DATA JKN
        const kuota_jkn = row.jadwal_dokter_kuotajkns[index];
        const terdaftar_jkn = row.jadwal_dokter_jkn_terdaftar[index];
        const sisa_jkn = kuota_jkn - terdaftar_jkn;

        // DATA NON JKN
        const kuota_non_jkn = row.jadwal_dokter_kuotanonjkns[index];
        const terdaftar_non_jkn = row.jadwal_dokter_non_jkn_terdaftar[index];
        const sisa_non_jkn = kuota_non_jkn - terdaftar_non_jkn;

        return {
          jadwal_dokter_uuid: uuid,
          day: row.jadwal_dokter_days[index],
          start_time: row.jadwal_dokter_start_times[index],
          end_time: row.jadwal_dokter_end_times[index],

          //TOTAL KUOTA GABUNGAN
          kuota_total: kuota_jkn + kuota_non_jkn,
          kuota_terisi: terdaftar_jkn + terdaftar_non_jkn,
          sisa_kuota: sisa_jkn + sisa_non_jkn,

          //KUOTA JKN
          kuota_jkn: kuota_jkn,
          kuota_terisi_jkn: terdaftar_jkn,
          sisa_kuota_jkn: sisa_jkn,

          //KUOTA NON JKN
          kuota_non_jkn: kuota_non_jkn,
          kuota_terisi_non_jkn: terdaftar_non_jkn,
          sisa_kuota_non_jkn: sisa_non_jkn,

          durasi_pelayanan: row.jadwal_dokter_durasi_pelayanans[index],
          status: row.jadwal_dokter_statuses[index] ? "aktif" : "non aktif",
        };
      }),
    }));

    return ret;
  }

  static async findAllByDoctorAndLocation({
    faskesUuid,
    dokterUuid,
    poliUuid,
    transaction,
  }) {
    const commonOptions = this._buildCommonQueryOptions();

    const whereClause = {
      faskes_uuid: faskesUuid,
      is_doctor: true,
      uuid: dokterUuid,
      "$jadwal_dokter.lokasi.uuid$": poliUuid,
      deletedAt: null,
    };

    const queryOptions = {
      ...commonOptions,
      where: whereClause,
      group: ["PractitionerModel.uuid", "jadwal_dokter.lokasi.uuid"],
      order: [
        [Sequelize.fn("MIN", Sequelize.col("jadwal_dokter.created_at")), "ASC"],
      ],
      raw: true,
      nest: true,
      subQuery: false,
    };

    const row = await PractitionerModel.findOne(queryOptions);
    console.log("data jadwal dokter repository:", row);

    if (!row) {
      return null;
    }

    const formattedJadwal = row.jadwal_dokter_ids.map((uuid, index) => {
      // DATA JKN
      const kuota_jkn = row.jadwal_dokter_kuotajkns[index];
      const terdaftar_jkn = row.jadwal_dokter_jkn_terdaftar[index];
      const sisa_jkn = kuota_jkn - terdaftar_jkn;
      console.log("kuota jkn:", kuota_jkn);
      console.log("terdaftar jkn:", terdaftar_jkn);
      console.log("sisa jkn:", sisa_jkn);

      // DATA NON JKN
      const kuota_non_jkn = row.jadwal_dokter_kuotanonjkns[index];
      const terdaftar_non_jkn = row.jadwal_dokter_non_jkn_terdaftar[index];
      const sisa_non_jkn = kuota_non_jkn - terdaftar_non_jkn;
      console.log("kuota non jkn:", kuota_non_jkn);
      console.log("terdaftar non jkn:", terdaftar_non_jkn);
      console.log("sisa non jkn:", sisa_non_jkn);

      return {
        jadwal_dokter_uuid: uuid,
        day: row.jadwal_dokter_days[index],
        start_time: row.jadwal_dokter_start_times[index],
        end_time: row.jadwal_dokter_end_times[index],

        //TOTAL KUOTA GABUNGAN
        kuota_total: kuota_jkn + kuota_non_jkn,
        kuota_terisi: terdaftar_jkn + terdaftar_non_jkn,
        sisa_kuota: sisa_jkn + sisa_non_jkn,

        //KUOTA JKN
        kuota_jkn: kuota_jkn,
        kuota_terisi_jkn: terdaftar_jkn,
        sisa_kuota_jkn: sisa_jkn,

        //KUOTA NON JKN
        kuota_non_jkn: kuota_non_jkn,
        kuota_terisi_non_jkn: terdaftar_non_jkn,
        sisa_kuota_non_jkn: sisa_non_jkn,

        durasi_pelayanan: row.jadwal_dokter_durasi_pelayanans[index],
        status: row.jadwal_dokter_statuses[index] ? "aktif" : "non aktif",
      };
    });

    return {
      doctor: {
        kode_antrian: row.code_antrian_dokter,
        name: row.pegawai_name,
        uuid: row.uuid,
      },
      poli: {
        kode_antrian: row.code_antrian_poli,
        name: row.lokasi_name,
        uuid: row.lokasi_uuid,
      },
      jadwal_dokter: formattedJadwal,
    };
  }

  static async findScheduleByUuid(uuid) {
    return await JadwalDokterModel.findOne({
      where: {
        uuid,
        deletedAt: null,
        status: true,
      },
      raw: true,
    });
  }

  static async findJadwalByUuid(uuid) {
    return await JadwalDokterModel.findOne({
      where: {
        uuid,
        deletedAt: null,
        status: true,
      },
      include: [
        {
          model: LokasiModel,
          as: "lokasi",
          attributes: ["code_antrian_poli", "name"],
        },
        {
          model: PractitionerModel,
          as: "practitioner",
          attributes: ["code_antrian_dokter", "uuid"],
          include: [
            {
              model: PegawaiModel,
              as: "pegawai",
              attributes: ["name"],
            },
          ],
        },
      ],
    });
  }

  static async findTodayScheduleByDoctorAndLocation({
    faskesUuid,
    dokterUuid,
    poliUuid,
    transaction,
  }) {
    const todayInIndonesian = ToIndoDay.fromEng(moment().format("dddd"));

    return await JadwalDokterModel.findOne({
      where: {
        faskesUuid,
        practitionerUuid: dokterUuid,
        lokasiUuid: poliUuid,
        day: todayInIndonesian,
        deletedAt: null,
        status: true,
      },
      transaction,
    });
  }

  static async create({ faskesUuid, jadwalDokter }) {
    const toBeCreated = jadwalDokter.jadwal.map((jadwal) => ({
      practitionerUuid: jadwalDokter.dokter_uuid,
      lokasiUuid: jadwalDokter.poliklinik_uuid,
      faskesUuid,
      day: jadwal.day,
      start_time: jadwal.start_time,
      end_time: jadwal.end_time,
      kuota: jadwal.kuota,
      kuotaNonJkn: jadwal.kuota_non_jkn,
      kuotaJkn: jadwal.kuota_jkn,
      durasiPelayanan: jadwal.durasi_pelayanan,
      codeAntrianDokter: jadwalDokter.code_antrian_dokter,
      codeAntrianPoli: jadwalDokter.code_antrian_poli,
      status: jadwal.aktif,
    }));

    const returning = await JadwalDokterModel.bulkCreate(toBeCreated, {
      returning: true,
    });

    return returning;
  }

  static async bulkDelete({ faskesUuid, UUIDsToBeDeleted, transaction }) {
    await JadwalDokterModel.update(
      { deletedAt: moment().unix() },
      {
        where: {
          faskes_uuid: faskesUuid,
          uuid: UUIDsToBeDeleted,
          deletedAt: null,
        },
        transaction,
      }
    );
  }

  /**
   * Bulk update schedules using CASE statements
   */
  static async bulkUpdate({
    faskesUuid,
    jadwalDokterToBeUpdated,
    transaction,
  }) {
    if (jadwalDokterToBeUpdated.length === 0) return [];

    const { sequelize } = JadwalDokterModel;
    const uuidList = jadwalDokterToBeUpdated.map((j) => j.jadwalDokterUuid);

    const fieldMap = {
      day: "day",
      start_time: "startTime",
      end_time: "endTime",
      durasiPelayanan: "durasiPelayanan",
      kuota: "kuota",
      kuotaJkn: "kuotaJkn",
      kuotaNonJkn: "kuotaNonJkn",
      codeAntrianPoli: "codeAntrianPoli",
      codeAntrianDokter: "codeAntrianDokter",
      status: "aktif",
    };

    const updatePayload = {
      updatedAt: moment().unix(),
    };

    Object.entries(fieldMap).forEach(([modelField, inputField]) => {
      const cases = jadwalDokterToBeUpdated
        .map((jadwal) => {
          const value = jadwal[inputField];
          if (value === undefined) return null;
          return `WHEN uuid = ${sequelize.escape(
            jadwal.jadwalDokterUuid
          )} THEN ${sequelize.escape(value)}`;
        })
        .filter(Boolean)
        .join(" ");

      if (cases) {
        updatePayload[modelField] = sequelize.literal(
          `(CASE ${cases} ELSE "${FormatterService.camelToSnake(
            modelField
          )}" END)`
        );
      }
    });

    return JadwalDokterModel.update(updatePayload, {
      where: {
        faskes_uuid: faskesUuid,
        uuid: { [Op.in]: uuidList },
        deletedAt: null,
      },
      transaction,
    });
  }

  /**
   * Bulk create new schedules
   */
  static async bulkCreate({
    faskesUuid,
    jadwalDokterToBeCreated,
    transaction,
  }) {
    if (jadwalDokterToBeCreated.length === 0) return [];

    const createPayload = jadwalDokterToBeCreated.map((j) => ({
      faskesUuid: faskesUuid,
      practitionerUuid: j.dokterUuid,
      lokasiUuid: j.poliklinikUuid,
      day: j.day,
      start_time: j.startTime,
      end_time: j.endTime,
      durasiPelayanan: j.durasiPelayanan,
      kuota: j.kuotaJkn + j.kuotaNonJkn,
      kuotaJkn: j.kuotaJkn,
      kuotaNonJkn: j.kuotaNonJkn,
      codeAntrianPoli: j.codeAntrianPoli,
      codeAntrianDokter: j.codeAntrianDokter,
      status: j.aktif,
      createdAt: moment().unix(),
    }));

    return JadwalDokterModel.bulkCreate(createPayload, {
      transaction,
    });
  }

  static async deleteAllByDoctorAndLocation({
    faskesUuid,
    dokterUuid,
    poliUuid,
    transaction,
  }) {
    await JadwalDokterModel.update(
      { deletedAt: moment().unix() },
      {
        where: {
          faskes_uuid: faskesUuid,
          practitionerUuid: dokterUuid,
          lokasiUuid: poliUuid,
          deletedAt: null,
        },
        transaction,
      }
    );
  }

  // FOR MOBILE
  static async findAllSchedulesByDay({
    faskesUuid,
    dokterUuid,
    poliUuid,
    day,
  }) {
    return await JadwalDokterModel.findAll({
      where: {
        faskesUuid,
        practitionerUuid: dokterUuid,
        lokasiUuid: poliUuid,
        day: day,
        status: true,
        deletedAt: null,
      },

      include: [
        {
          model: PractitionerModel,
          as: "practitioner",
          include: { model: PegawaiModel, as: "pegawai" },
        },
        {
          model: LokasiModel,
          as: "lokasi",
        },
      ],
    });
  }
}
