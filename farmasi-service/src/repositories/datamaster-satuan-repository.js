import Pagination from "../helpers/pagination.js";
import { Op } from "sequelize";
import { toEpochDate } from "../helpers/date-helper.js";
import { SatuanModel } from "@opensimrs/model-sdk/farmasi";
import NotfoundException from "../errors/notfound-exception.js";

export default class DataMasterSatuanRepository {
  static async create(req) {
    return await SatuanModel.create(req);
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
      order: [["created_at", "DESC"], ["uuid", "ASC"]],
    };

     if (req.status) {
       option.where.status = req.status;
     }

    return Pagination.init(SatuanModel, req, option);
  }

  static async update(req) {
    const [affectedRow] = await SatuanModel.update(
      {
        code: req.code,
        name: req.name,
        status: req.status,
        satuan_dosis: req.satuan_dosis,
        editable: req.editable,
      },
      {
        where: {
          uuid: req.uuid,
        },
      }
    );

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal diedit");
    }

    return affectedRow;
  }

  static async delete(req) {
    const [affectedRow] = await SatuanModel.update(
      {
        deleted_at: toEpochDate(new Date()),
      },
      {
        where: {
          uuid: req.uuid,
          deleted_at: null
        },
      }
    );

    if (affectedRow === 0) {
      throw new NotfoundException("Data gagal dihapus");
    }

    return affectedRow;
  }

  static async getAllWithoutPagination(faskes_uuid) {
    return await SatuanModel.findAll({
      where: {
        faskes_uuid: faskes_uuid,
        satuan_dosis: true,
      },
    });
  }

 static bulkCreate(req) {
     return SatuanModel.bulkCreate(req, {
       individualHooks: true,
     });
   }

  static async getUuidesByCodes(codes, faskesUuid) {
    return await SatuanModel.findAll({
      where: {
        code: {
          [Op.in]: codes,
        },
        faskes_uuid: faskesUuid,
      },
      attributes: ["uuid", "code", "name"],
    });
  }
}
