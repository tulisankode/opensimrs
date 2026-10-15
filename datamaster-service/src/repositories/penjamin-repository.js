import { Op } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import Penjamin from "../models/penjamin-model.js";
import { BaseRePosiotry } from "./base-repository.js";

export default class PenjaminRepository extends BaseRePosiotry {

  /**
   * 
   * @param {Array<string>} nameList 
   * @returns 
   */
  static async findAllByNameIn(nameList, faskes_uuid) {
    const penjaminList = await Penjamin.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: nameList.map((name) => {
              return {
                name: {
                  [Op.iLike]: `%${name}%`,
                },
              };
            }),
          },
          {
            deletedAt: {
              [Op.is]: null,
            },
          },
          {
            faskes_uuid: faskes_uuid
          },
        ],
      },
    });

    if (penjaminList.length === 0) {
      return [];
    } else return penjaminList.map((penjamin) => penjamin.toJSON());
  }

  /**
   * 
   * @param {Array<{uuid: string | uuid, faskes_uuid: string | uuid, name: string, code: string, phone: string, status: boolean}>} penjaminList 
   */
  static async saveAll(penjaminList){
    await sequelizeInstance.transaction(async (tr) => { 
      await Penjamin.bulkCreate(penjaminList, {transaction: tr});
    });
  }

  static async addPenjamin(data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      return await Penjamin.create(data, { transaction: tr });
    });
    return result;
  }

  static async findPenjaminByCode(code) {
    return await Penjamin.findOne({ where: { code: code } });
  }

  static async getAllPenjaminAktif(faskes_uuid) {
    return await Penjamin.findAll({
      where: {
        deletedAt: null,
        status: true,
        faskes_uuid: faskes_uuid
      },
      order: [["id", "DESC"]]
    });
  }

  static async getAllPenjaminByUuids(allPenjaminUuids) {
    return await Penjamin.findAll({
      where: { uuid: Array.from(allPenjaminUuids) },
      attributes: ["uuid", "name"],
    });
  }

  static async getAllPenjamin(name = null, page = 1, limit = 10, faskes_uuid, order_by) {
    let whereClause = {
      deletedAt: null,
      faskes_uuid, faskes_uuid
    };

    if (name) {
      whereClause.name = {
        [Op.iLike]: `%${name}%`,
      };
    }
    const offset = (page - 1) * limit;
    const { count, rows } = await Penjamin.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [["id", order_by]],
    });

    return {
      totalItems: count,
      penjaminList: rows,
      currentPage: page,
      paginationInfo: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        limit: limit,
      },
    };
  }

  static async findPenjaminById(uuid) {
    return await Penjamin.findOne({ where: { uuid } });
  }

  static async exportPenjamin() {
    return await Penjamin.findAll({
      where: {
        deletedAt: null,
      },
    });
  }

  static async updatePenjamin(penjamin, data) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const updatedPenjamin = await penjamin.update(
        data,
        { updatedAt: Math.floor(Date.now() / 1000) },
        {
          transaction: tr,
        }
      );
      return updatedPenjamin;
    });
    return result;
  }

  static async deletePenjamin(penjamin) {
    const result = await sequelizeInstance.transaction(async (tr) => {
      const date = Math.floor(Date.now() / 1000);
      await penjamin.update(
        {
          deletedAt: date,
        },
        { transaction: tr }
      );
      return true;
    });
    return result;
  }
}
