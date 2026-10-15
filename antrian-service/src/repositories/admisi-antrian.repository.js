import { RawatJalanModel } from "@opensimrs/model-sdk/pelayanan";
import { FormatterService } from "../services/formatter.service.js";
import { PatientModel } from "@opensimrs/model-sdk/admisi";
import { JadwalDokterModel } from "@opensimrs/model-sdk/antrian";
import { AntrianModel } from "../models/index.js";
import { Op } from "sequelize";
import {
  LokasiModel,
  PegawaiModel,
  PractitionerModel,
} from "@opensimrs/model-sdk/datamaster";
import { AddressModel } from "@opensimrs/model-sdk/setting";

const antrianAttributes = [
  "uuid",
  "rawat_jalan_uuid",
  "status_panggilan",
  "pelayanan",
  "jenis_pasien",
  "pasien_baru",
  "jenis_resep",
  "updatedAt", // waktu panggilan terakhir: layar antrian memakainya untuk mengenali panggilan ulang
];

export default class AdmisiAntrianRepository {
  static transform(antrian) {
    const plainObject = antrian.get({ plain: true });
    const snakeCase = FormatterService.toSnakeCase(plainObject);

    if (snakeCase.patient_data) {
      const patientData = snakeCase.patient_data;

      if (patientData.jadwal_dokter) {
        if (
          patientData.jadwal_dokter.practitioner &&
          patientData.jadwal_dokter.practitioner.pegawai
        ) {
          patientData.jadwal_dokter.nama_dokter =
            patientData.jadwal_dokter.practitioner.pegawai.name;

          delete patientData.jadwal_dokter.practitioner;
        }

        if (patientData.jadwal_dokter.lokasi) {
          patientData.jadwal_dokter.nama_poli =
            patientData.jadwal_dokter.lokasi.name;

          delete patientData.jadwal_dokter.lokasi;
        }
      }

      if (patientData.patient) {
        patientData.identity = patientData.patient.identity;
        patientData.no_identity = patientData.patient.no_identity;
        patientData.phone = patientData.patient.phone;
        patientData.gender = patientData.patient.gender;
        patientData.address = patientData.patient.address;
        delete patientData.patient;
      }

      patientData.antrian = {
        kode_booking: patientData.kode_booking,
        no_antrian_admisi: patientData.no_antrian_admisi,
        no_antrian_poli: patientData.no_antrian_poli,
        no_antrian_farmasi: patientData.no_antrian_farmasi,
      };

      delete patientData.kode_booking;
      delete patientData.no_antrian_admisi;
      delete patientData.no_antrian_poli;
      delete patientData.no_antrian_farmasi;
    }

    return snakeCase;
  }

  static async findAll({
    faskesUuid,
    filters = {},
    page,
    pageSize,
    noPagination = false,
    transaction = null,
  }) {
    const where = { faskes_uuid: faskesUuid };

    // pagination values
    const limit = pageSize ? parseInt(pageSize, 10) : 10;
    const offset = page ? (parseInt(page, 10) - 1) * limit : 0;

    // filter status_panggilan
    if (
      filters.status_panggilan !== undefined &&
      filters.status_panggilan !== null &&
      filters.status_panggilan !== ""
    ) {
      const statusArray = filters.status_panggilan.split(",");

      const statusNumbers = statusArray
        .map((status) => parseInt(status, 10))
        .filter((num) => !isNaN(num));
      if (statusNumbers.length > 0) {
        where.status_panggilan = {
          [Op.in]: statusNumbers,
        };
      }
    }

    const patientWhere = {};

    if (filters.start_date && filters.end_date) {
      patientWhere.jadwal_periksa = {
        [Op.gte]: filters.start_date,
        [Op.lte]: filters.end_date,
      };
    }

    if (filters.name) {
      patientWhere.name = { [Op.iLike]: `%${filters.name}%` };
    }

    if (
      filters.pelayanan !== undefined &&
      filters.pelayanan !== null &&
      filters.pelayanan !== ""
    ) {
      where.pelayanan = filters.pelayanan;
    }

    const queryOptions = {
      where,
      include: [
        {
          model: RawatJalanModel,
          as: "patient_data",
          required: true,
          where: patientWhere,
          attributes: [
            "patient_uuid",
            "no_rm",
            "status_rj",
            "name",
            "kode_booking",
            "no_antrian_admisi",
            "no_antrian_poli",
            "no_antrian_farmasi",
            "payment_method",
            "tanggal_daftar",
            "tanggal_checkin",
            "jadwal_periksa",
          ],
          include: [
            {
              model: JadwalDokterModel,
              as: "jadwal_dokter",
              required: false,
              attributes: [
                "practitioner_uuid",
                "lokasi_uuid",
                "day",
                "start_time",
                "end_time",
              ],
              include: [
                {
                  model: PractitionerModel,
                  as: "practitioner",
                  required: false,
                  attributes: ["pegawai_uuid"],
                  include: [
                    {
                      model: PegawaiModel,
                      as: "pegawai",
                      required: false,
                      attributes: ["name"],
                    },
                  ],
                },
                {
                  model: LokasiModel,
                  as: "lokasi",
                  required: false,
                  attributes: ["name"],
                },
              ],
            },
            {
              model: PatientModel,
              as: "patient",
              required: false,
              attributes: ["identity", "no_identity", "phone", "gender"],
              include: [
                {
                  model: AddressModel,
                  as: "address",
                  required: false,
                  attributes: {
                    exclude: [
                      "id",
                      "faskes_uuid",
                      "createdAt",
                      "updatedAt",
                      "deletedAt",
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
      attributes: antrianAttributes,
      order: [["createdAt", "ASC"]],
    };

    if (transaction) {
      queryOptions.transaction = transaction;
    }

    if (!noPagination) {
      queryOptions.limit = limit;
      queryOptions.offset = offset;

      const { count, rows } = await AntrianModel.findAndCountAll(queryOptions);
      return {
        pagination: {
          page: parseInt(page, 10) || 1,
          page_size: limit,
          total: count,
        },
        data: rows.map(this.transform),
      };
    }

    const rows = await AntrianModel.findAll(queryOptions);
    return {
      pagination: null,
      data: rows.map(this.transform),
    };
  }

  static async findByUuid(uuid, options = {}) {
    const antrian = await AntrianModel.findByPk(uuid, {
      include: [
        {
          model: RawatJalanModel,
          as: "patient_data",
          required: true,
          attributes: [
            "patient_uuid",
            "no_rm",
            "status_rj",
            "name",
            "kode_booking",
            "no_antrian_admisi",
            "no_antrian_poli",
            "no_antrian_farmasi",
            "payment_method",
          ],
          include: [
            {
              model: JadwalDokterModel,
              as: "jadwal_dokter",
              required: false,
              attributes: [
                "practitioner_uuid",
                "lokasi_uuid",
                "day",
                "start_time",
                "end_time",
              ],
              include: [
                {
                  model: PractitionerModel,
                  as: "practitioner",
                  required: false,
                  attributes: ["pegawai_uuid"],
                  include: [
                    {
                      model: PegawaiModel,
                      as: "pegawai",
                      required: false,
                      attributes: ["name"],
                    },
                  ],
                },
                {
                  model: LokasiModel,
                  as: "lokasi",
                  required: false,
                  attributes: ["name"],
                },
              ],
            },
            {
              model: PatientModel,
              as: "patient",
              required: false,
              attributes: ["identity", "no_identity", "phone", "gender"],
              include: [
                {
                  model: AddressModel,
                  as: "address",
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      attributes: antrianAttributes,
      ...options,
    });

    if (!antrian) return null;

    return this.transform(antrian);
  }

  /**
   * Service mengirim data camelCase (rawatJalanUuid, statusPanggilan, ...), sedangkan AntrianModel
   * mendefinisikan sebagian atribut dengan nama snake_case. Atribut yang tidak dikenal dibuang diam-diam
   * oleh Sequelize, sehingga antrian tersimpan tanpa rawat_jalan_uuid/status_panggilan.
   */
  static toModelAttributes(data) {
    const aliases = {
      rawatJalanUuid: "rawat_jalan_uuid",
      statusPanggilan: "status_panggilan",
      jenisPasien: "jenis_pasien",
      pasienBaru: "pasien_baru",
      kodeFarmasi: "kode_farmasi",
    };
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[aliases[key] ?? key] = value;
    }
    return result;
  }

  static async create(data, options = {}) {
    const newAntrian = await AntrianModel.create(this.toModelAttributes(data), options);
    return await this.findByUuid(newAntrian.uuid, options);
  }

  static async update(uuid, data, options = {}) {
    await AntrianModel.update(this.toModelAttributes(data), { where: { uuid }, ...options });
    return await this.findByUuid(uuid, options);
  }
}
