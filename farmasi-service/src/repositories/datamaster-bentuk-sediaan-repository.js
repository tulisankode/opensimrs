import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import { BentukSediaanModel } from "@opensimrs/model-sdk/farmasi";
import NotfoundException from "../errors/notfound-exception.js";

export default class DatamasterBentukSediaanRepository {
  static async create(req) {
    return await BentukSediaanModel.create({
      code: req.code,
      name: req.name,
      status: req.status,
      faskes_uuid: req.faskes_uuid,
    });
  }

  static async getAll(req) {
    const option = {
      where: {
        faskes_uuid: req.faskes_uuid,
        name: { [Op.iLike]: `%${req.name || ""}%` },
        deleted_at: {
          [Op.is]: null,
        },
      },
      order: [
        ["created_at", "DESC"],
        ["uuid", "ASC"],
      ],
    };

     if (req.status) {
       option.where.status = req.status;
     }

    return Pagination.init(BentukSediaanModel, req, option);
  }

  static async update(req) {
    const [affectedRow] = await BentukSediaanModel.update(
      {
        code: req.code,
        name: req.name,
        status: req.status,
      },
      {
        where: {
          uuid: req.uuid,
          deleted_at: null,
        },
      }
    );

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal diedit");
    }

    return affectedRow;
  }

  static async delete(req) {
    const [affectedRow] = await BentukSediaanModel.update(
      {
        deleted_at: toEpochDate(new Date()),
      },
      {
        where: {
          uuid: req.uuid,
          deleted_at: null,
        },
      }
    );

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal dihapus");
    }

    return affectedRow;
  }

  static getUuidesByCode(codes, faskesUuid) {
    return BentukSediaanModel.findAll({
      where: {
        code: {
          [Op.in]: codes,
        },
        faskes_uuid: faskesUuid,
      },
      attributes: ["uuid", "code"],
    });
  }

  static bulkCreate(req) {
    return BentukSediaanModel.bulkCreate(req, {
      individualHooks: true,
    });
  }
}
