import { Op, Sequelize, Transaction, where } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Practitioner from "../models/practitioner-model.js";
import Pegawai from "../models/pegawai-model.js";
import { PegawaiModel, PractitionerModel } from "@opensimrs/model-sdk/datamaster";
import { BaseRePosiotry } from "./base-repository.js";
import { toEpochDate } from "../helpers/helper.js";

const pegawaiXpractitioner = PegawaiModel.belongsTo(PractitionerModel, {
  constraints: false,
  foreignKey: "pegawai_uuid",
  targetKey: "uuid",
  as: "pegawai",
});
export default class PractitionerRepository extends BaseRePosiotry {
  static async saveAll(practitionerList) {
    await PractitionerModel.bulkCreate(practitionerList, {
      returning: [
        "id",
        "uuid",
        "faskes_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "poli_pelayanan",
        "status",
        "created_at",
        "updated_at",
        "deleted_at",
      ],
    });
  }

  /**
   *
   * @param {{uuid: string, faskes_uuid: string}} request
   * @returns {Promise<number>}
   */
  static async delete(request) {
    if (request.poli_pelayanan)
      request.poli_pelayanan = JSON.stringify(request.poli_pelayanan);
    request.deletedAt = toEpochDate(new Date());
    const result = await PractitionerModel.update(request, {
      where: {
        [Op.and]: [
          {
            uuid: request.uuid,
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
        ],
      },
    });
    return result[0];
  }

  static async save(tr, request) {
    await PractitionerModel.create(request, {
      transaction: tr,
      returning: [
        "id",
        "uuid",
        "faskes_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "poli_pelayanan",
        "status",
        "created_at",
        "updated_at",
        "deleted_at",
      ],
    });
  }

  /**
   *
   * @param {{uuid: string, faskes_uuid: string}} request
   */
  static async findByPegawaiUuid(request) {
    const practitioenr = await PractitionerModel.findOne({
      where: {
        [Op.and]: [
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            uuid: request.uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
      attributes: [
        "id",
        "uuid",
        "faskes_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "poli_pelayanan",
        "status",
        "created_at",
        "updated_at",
        "deleted_at",
      ],
    });
    if (practitioenr) {
      let pr = practitioenr.toJSON();
      pr.poli_pelayanan = JSON.parse(practitioenr.toJSON().poli_pelayanan);
      return pr;
    } else return null;
  }

  /**
   *
   * @param {{faskes_uuid: string, code_bpjs: string, uuid: string}} request
   */
  static async findByBpjsOrUuid(request) {
    const practitioenr = await PractitionerModel.findOne({
      where: {
        [Op.or]: [
          {
            [Op.and]: [
              {
                faskes_uuid: request.faskes_uuid,
              },
              {
                uuid: request.uuid,
              },
              {
                deletedAt: {
                  [Op.is]: null,
                },
              },
            ],
          },
          {
            [Op.and]: [
              {
                faskes_uuid: request.faskes_uuid,
              },
              {
                uuid: request.code_bpjs,
              },
              {
                deletedAt: {
                  [Op.is]: null,
                },
              },
            ],
          },
        ],
      },
    });
    if (practitioenr) {
      let pr = practitioenr.toJSON();
      pr.poli_pelayanan = JSON.parse(practitioenr.toJSON().poli_pelayanan);
      return pr;
    } else return null;
  }

  static async findAll(request) {
    let whereClause = {
      deletedAt: {
        [Op.is]: null,
      },
      faskes_uuid: request.faskes_uuid,
    };

    let searchByPegawainame = {
      deletedAt: {
        [Op.is]: null,
      },
      faskes_uuid: request.faskes_uuid,
    };

    if (request.name)
      searchByPegawainame.name = {
        [Op.iLike]: `%${request.name}%`,
      };
    if (request.is_doctor) whereClause.is_doctor = request.is_doctor;

    const { count, rows } = await PractitionerModel.findAndCountAll({
      where: whereClause,
      limit: request.pageSize,
      offset: request.page - 1,
      order: [["id", request.order_by]],
      attributes: [
        "id",
        "uuid",
        "faskes_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "poli_pelayanan",
        "status",
        "created_at",
        "updated_at",
        "deleted_at",
      ],
      include: [
        {
          association: pegawaiXpractitioner,
          attributes: [
            "id",
            "uuid",
            "name",
            "nik",
            "tipe",
            "first_title",
            "last_title",
            "tanggal_lahir",
            "gender",
            "status",
            "created_at",
            "updated_at",
            "deleted_at",
          ],
          required: true,
          where: searchByPegawainame,
        },
      ],
    });

    return {
      data: rows.map((pegawai) => {
        let p = pegawai.toJSON();
        if (p.poli_pelayanan)
          p.poli_pelayanan = JSON.parse(pegawai.toJSON().poli_pelayanan);
        return p;
      }),
      properties: {
        current_page: request.page,
        total_page: Math.ceil(count / request.pageSize),
        total_item: count,
      },
    };
  }

  /**
   *
   * @param {{uuid: string, faskes_uuid: string}} request
   */
  static async findByUuidIncludePractitionerPoli(request) {
    console.log("REPO", request);
    PractitionerModel.hasOne(PegawaiModel, {
      constraints: false,
      foreignKey: "uuid",
      sourceKey: "pegawai_uuid",
    });

    PegawaiModel.belongsTo(PractitionerModel, {
      constraints: false,
      foreignKey: "uuid",
      targetKey: "pegawai_uuid",
    });

    const practitioner = await PractitionerModel.findOne({
      where: {
        faskes_uuid: request.faskes_uuid,
        uuid: request.uuid,
      },
      attributes: { exclude: ["practitioner_uuid"] },
      include: [
        {
          model: PegawaiModel,
          required: true,
          attributes: [
            "uuid",
            "faskes_uuid",
            "name",
            "nik",
            "tipe",
            "tanggal_lahir",
            "gender",
          ],
        },
      ],
    });
    if (practitioner) {
      let p = practitioner.toJSON();
      delete p.PractitionerPoliModels;
      delete p.PegawaiModel;
      p.practitioner_poli = practitioner.toJSON().PractitionerPoliModels;
      p.pegawai = practitioner.toJSON().PegawaiModel;
      return p;
    } else return null;
  }

  /**
   *
   * @param {PractitionerModel} updateRequest
   * @param {Transaction} transaction
   * @returns
   */
  static async update(updateRequest, transaction) {
    updateRequest.updatedAt = Math.floor(Date.now() / 1000.0);
    const affectedRows = await PractitionerModel.update(updateRequest, {
      transaction: transaction,
      where: {
        [Op.and]: [
          {
            uuid: updateRequest.uuid,
          },
          {
            faskes_uuid: updateRequest.faskes_uuid,
          },
        ],
      },
    });
    return affectedRows[0];
  }

  /**
   *
   * @param {string} bpjsCode
   * @param {string} faskes_uuid
   * @returns {Promise<PractitionerModel>}
   */
  static async findByBpjsCode(bpjsCode, faskes_uuid) {
    const practitioner = await PractitionerModel.findOne({
      attributes: [
        "uuid",
        "faskes_uuid",
        "pegawai_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "status",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ],
      where: {
        [Op.and]: [
          {
            code_bpjs: bpjsCode,
          },
          {
            faskes_uuid: faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
    if (practitioner) return practitioner.toJSON();
    else return null;
  }

  static async getAllPractitioner(faskes_uuid) {
    return await Practitioner.findAll({
      where: {
        [Op.and]: [
          {
            faskes_uuid: faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
    });
  }

  /**
   *
   * @param {{uuid: string, faskes_uuid: string}} request
   * @returns
   */
  static async findByUuid(request) {
    const practitioner = await PractitionerModel.findOne({
      where: {
        [Op.and]: [
          {
            uuid: request.uuid,
          },
          {
            faskes_uuid: request.faskes_uuid,
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
        ],
      },
      include: [
        {
          association: pegawaiXpractitioner,
          attributes: [
            "id",
            "uuid",
            "name",
            "nik",
            "tipe",
            "first_title",
            "last_title",
            "tanggal_lahir",
            "gender",
            "status",
            "created_at",
            "updated_at",
            "deleted_at",
          ],
          required: true,
        },
      ],
      attributes: [
        "uuid",
        "faskes_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "poli_pelayanan",
        "status",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ],
    });
    if (practitioner) {
      const pr = practitioner.toJSON();
      pr.poli_pelayanan = JSON.parse(practitioner.toJSON().poli_pelayanan);
      return pr;
    } else return null;
  }

  static async findPractitionerByCodeBpjs(code_bpjs) {
    return await Practitioner.findOne({
      where: { code_bpjs: code_bpjs },
    });
  }

  static async findPractitionerByCodeAntrian(code_antrian) {
    return await Practitioner.findOne({
      where: { code_antrian: code_antrian },
    });
  }

  static async findPractitionerByCodeAntrianByFaskes(req) {
    return await Practitioner.findOne({
      where: {
        code_antrian_dokter: req.code,
        faskes_uuid: req.faskes_uuid,
      },
      include: [
        {
          model: Pegawai,
          as: "Pegawai", // Optional: specify alias if needed
          required: true, // Ensures only Practitioners with associated Pegawai are included
          attributes: ["name", "nik", "tipe", "tanggal_lahir", "gender"],
        },
      ],
    });
  }

  static async findPractitionerBySatuSehatId(satu_sehat_id) {
    return await Practitioner.findOne({
      where: { satu_sehat_id: satu_sehat_id },
    });
  }

  static async findPractitionerByCodeNIK(nik) {
    return await Practitioner.findOne({
      where: { nik: nik },
    });
  }

  static async exportPractitioner() {
    // tambahkan detail pegawai
    return await Practitioner.findAll({
      where: {
        deletedAt: null,
      },
      include: [
        {
          model: Pegawai,
          as: "Pegawai", // Optional: specify alias if needed
          required: true, // Ensures only Practitioners with associated Pegawai are included
          attributes: ["name", "nik", "tipe", "tanggal_lahir", "gender"],
        },
      ],
    });
  }

  static async getAllPractitionerAktif(request) {
    let whereClause = {
      deletedAt: {
        [Op.is]: null,
      },
      faskes_uuid: request.faskes_uuid,
    };
    if (request.name) {
      whereClause[Op.or] = [
        { "$pegawai.name$": { [Op.iLike]: `%${request.name}%` } },
      ];
    }
    if (request.is_doctor) whereClause.is_doctor = request.is_doctor;

    const practitionerList = await PractitionerModel.findAll({
      where: whereClause,
      attributes: [
        "id",
        "uuid",
        "faskes_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "poli_pelayanan",
        "status",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ],
      include: [
        {
          model: PegawaiModel,
          required: false,
          as: "pegawai",
          attributes: ["name", "nik", "tipe", "tanggal_lahir", "gender"],
        },
      ],
      order: [["id", request.order_by]],
    });
    if (practitionerList) {
      return practitionerList.map((p) => {
        let pr = p.toJSON();
        pr.poli_pelayanan = JSON.parse(p.toJSON().poli_pelayanan);
        return pr;
      });
    } else return [];
  }

  static async getAllPractitionerAktifByPoli(request) {
    let whereClause = {
      deletedAt: {
        [Op.is]: null,
      },
      faskes_uuid: request.faskes_uuid,
      is_doctor: true,
    };
    if (request.name) {
      whereClause[Op.or] = [
        { "$pegawai.name$": { [Op.iLike]: `%${request.name}%` } },
      ];
    }
    if (request.poli_uuid) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        Sequelize.literal(`EXISTS (
      SELECT 1 FROM jsonb_array_elements(poli_pelayanan::jsonb) AS poli
      WHERE poli->>'lokasi_uuid' = '${request.poli_uuid}'
    )`),
      ];
    }

    const practitionerList = await PractitionerModel.findAll({
      where: whereClause,
      attributes: [
        "id",
        "uuid",
        "faskes_uuid",
        "sip",
        "str",
        "code_bpjs",
        "satu_sehat_id",
        "is_doctor",
        "code_antrian_dokter",
        "poli_pelayanan",
        "status",
        "createdAt",
        "updatedAt",
        "deletedAt",
      ],
      include: [
        {
          model: PegawaiModel,
          required: false,
          as: "pegawai",
          attributes: ["name", "nik", "tipe", "tanggal_lahir", "gender"],
        },
      ],
      order: [["id", "ASC"]],
    });
    if (practitionerList) {
      return practitionerList.map((p) => {
        let pr = p.toJSON();
        pr.poli_pelayanan = JSON.parse(p.toJSON().poli_pelayanan);
        return pr;
      });
    } else return [];
  }

  static async deletePractitioner(practitioner) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await practitioner.update(
        {
          deletedAt: Math.floor(Date.now() / 1000),
        },
        { transaction: tr }
      );
    });
    return result;
  }
}
