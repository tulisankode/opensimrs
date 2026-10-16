import { LabRujukanModel } from "@opensimrs/model-sdk/lab";
import toEpochDate from "../helpers/date-helper.js";
import pagination from "../helpers/pagination.js";
import { Op } from "sequelize";

export default class LabRujukanRepository {
  static async create(data) {
    return await LabRujukanModel.create({
      name: data.name,
      code: data.code,
      alamat: data.alamat,
      telepon: data.telepon,
      kontak_person: data.kontak_person,
      faskes_uuid: data.faskes_uuid,
      status: data.status,
    });
  }

  static async update(uuid, data) {
    return await LabRujukanModel.update(data, {
      where: { uuid: uuid },
    });
  }

  static async delete(uuid) {
    return await LabRujukanModel.update(
      { deleted_at: toEpochDate(new Date()) },
      { where: { uuid: uuid } }
    );
  }

  static async findByCode(code, faskes_uuid) {
    return await LabRujukanModel.findOne({
      where: {
        code: code,
        deleted_at: {
          [Op.is]: null,
        },
        faskes_uuid: faskes_uuid,
      },
    });
  }

  static async findByCodeWithoutItself(uuid, req) {
    return await LabRujukanModel.findOne({
      where: {
        code: req.code,
        faskes_uuid: req.faskes_uuid,
        deleted_at: {
          [Op.is]: null,
        },
        uuid: { [Op.not]: uuid },
      },
    });
  }

  static async findByUuid(uuid) {
    return await LabRujukanModel.findOne({
      where: { uuid: uuid, deleted_at: { [Op.is]: null } },
      attributes: {
        exclude: ["created_at", "updated_at", "deleted_at"],
      },
    });
  }

  static async findByUuidFaskes(uuid, faskes_uuid) {
    return await LabRujukanModel.findOne({
      where: {
        uuid: uuid,
        faskes_uuid: faskes_uuid,
        deleted_at: { [Op.is]: null },
      },
    });
  }

  static async findAll(req) {
    const options = {
      where: {
        faskes_uuid: req.faskes_uuid,
        name: {
          [Op.iLike]: `%${req.name || ""}%`,
        },
        deleted_at: {
          [Op.is]: null,
        },
      },
      order: [["created_at", "DESC"]],
      attributes: {
        exclude: ["created_at", "updated_at", "deleted_at"],
      },
      distinct: true,
      subQuery: false,
    };

    return pagination(LabRujukanModel, req, options);
  }

  static async findAllActive(req) {
    const options = {
      where: {
        faskes_uuid: req.faskes_uuid,
        name: {
          [Op.iLike]: `%${req.name || ""}%`,
        },
        deleted_at: {
          [Op.is]: null,
        },
        status: {
          [Op.is]: true,
        },
      },
      order: [["created_at", "DESC"]],
      attributes: {
        exclude: ["created_at", "updated_at", "deleted_at"],
      },
      distinct: true,
      subQuery: false,
    };

    return await LabRujukanModel.findAll(options);
  }

  static async bulkCreate(data, transaction) {
    return await LabRujukanModel.bulkCreate(data, { transaction });
  }
}
