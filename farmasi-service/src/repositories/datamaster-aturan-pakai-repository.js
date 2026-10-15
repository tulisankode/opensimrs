import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import { AturanPakaiModel } from "@opensimrs/model-sdk/farmasi";
import NotfoundException from "../errors/notfound-exception.js";

export default class DataMasterAturanPakaiRepository {
  static async create(req) {
    return await AturanPakaiModel.create(req);
  }

  static async getAll(req) {
    const option = {
      where: {
        faskes_uuid: req.faskes_uuid,
        name: { [Op.iLike]: `%${req.name || ""}%` },
        code: { [Op.iLike]: `%${req.code ?? ""}%` },
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

    return Pagination.init(AturanPakaiModel, req, option);
  }

  static async update(req) {
    const [affectedRow] = await AturanPakaiModel.update(req, {
      where: {
        uuid: req.uuid,
      },
    });

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal diedit");
    }

    return affectedRow;
  }

  static async delete(req) {
    const [affectedRow] = await AturanPakaiModel.update(
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

  static async getAllWithoutPagination(faskes_uuid) {
    return await AturanPakaiModel.findAll({
      where: {
        faskes_uuid: faskes_uuid,
      },
    });
  }

  static bulkCreate(req) {
    return AturanPakaiModel.bulkCreate(req, {
      individualHooks: true,
    });
  }
}
