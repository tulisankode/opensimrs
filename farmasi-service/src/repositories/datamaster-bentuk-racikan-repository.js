import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import { BentukRacikanModel } from "@opensimrs/model-sdk/farmasi";
import NotfoundException from "../errors/notfound-exception.js";

export default class DataMasterBentukRacikanRepository {
  static async create(req) {
    return await BentukRacikanModel.create(req);
  }

  static async getAll(req) {
    const option = {
      where: {
        faskes_uuid: req.faskes_uuid,
        nama_bentuk_racikan: {
          [Op.iLike]: `%${req.nama_bentuk_racikan || ""}%`,
        },
        deleted_at: {
          [Op.is]: null,
        },
      },
      order: [["created_at", "DESC"]],
    };

    return Pagination.init(BentukRacikanModel, req, option);
  }

  static async update(req) {
    const [affectedRow] = await BentukRacikanModel.update(req, {
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
    const [affectedRow] = await BentukRacikanModel.update(
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
    return await BentukRacikanModel.findAll({
      where: {
        faskes_uuid: faskes_uuid,
      },
    });
  }

  static async getByUuid(uuid) {
    return await BentukRacikanModel.findOne({
      where: {
        uuid: uuid,
      },
      attributes: ["jumlah", "tarif_embalase", "tarif_racik"],
    });
  }
}
